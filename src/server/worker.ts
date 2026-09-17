/**
 * In-process job queue. Two job kinds:
 *  - Story: run the director, commit the node ONCE (transaction), emit story.ready, enqueue art.
 *  - Image: reserve budget, call the image provider, persist the asset, emit panel.*.ready.
 * Concurrency is bounded (config.imageConcurrency); visible (active-node) jobs run first.
 */
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type {
  Run,
  StoryNode,
  StoryBible,
  GenerationJob,
  Asset,
  PanelSpec,
  JobStage,
} from '@shared/schemas';
import type { AppContext } from './context';
import type { ImageRequest } from './providers/types';
import { shouldUseSvgRenderer } from './providers/index';
import { createSvgImageProvider } from './providers/svg-renderer';
import type { DirectorRequest, DirectorAction } from './story/director';
import { directBeat } from './story/director';
import { applyDelta, stateHash } from './story/apply';
import { composeImageBrief, NEGATIVE_PROMPT } from './story/brief';
import { Budget, BudgetExhaustedError } from './budget';
import { sha256, nowIso, extByMime } from './util';

interface Task {
  visible: boolean;
  run: () => Promise<void>;
}

const IMAGE_STAGES: Extract<JobStage, 'preview' | 'final'>[] = ['preview', 'final'];

export class Worker {
  private queue: Task[] = [];
  private active = 0;
  private idleResolvers: (() => void)[] = [];
  private budgets = new Map<string, Budget>();

  constructor(private ctx: AppContext) {}

  // ---- scheduler ----
  private enqueue(task: Task): void {
    this.queue.push(task);
    this.pump();
  }
  private take(): Task | undefined {
    const i = this.queue.findIndex((t) => t.visible);
    return i >= 0 ? this.queue.splice(i, 1)[0] : this.queue.shift();
  }
  private pump(): void {
    while (this.active < this.ctx.config.imageConcurrency && this.queue.length) {
      const t = this.take()!;
      this.active++;
      Promise.resolve()
        .then(() => t.run())
        .catch(() => {})
        .finally(() => {
          this.active--;
          this.pump();
          this.settleIdle();
        });
    }
    this.settleIdle();
  }
  private settleIdle(): void {
    if (this.active === 0 && this.queue.length === 0) {
      const rs = this.idleResolvers;
      this.idleResolvers = [];
      for (const r of rs) r();
    }
  }
  whenIdle(): Promise<void> {
    if (this.active === 0 && this.queue.length === 0) return Promise.resolve();
    return new Promise((res) => this.idleResolvers.push(res));
  }

  // ---- budget ----
  private budgetFor(run: Run): Budget {
    let b = this.budgets.get(run.id);
    if (!b) {
      b = new Budget(structuredClone(run.budget));
      this.budgets.set(run.id, b);
    }
    return b;
  }
  private persistBudget(runId: string, budget: Budget): void {
    const run = this.ctx.db.getRun(runId);
    if (!run) return;
    run.budget = budget.snapshot();
    run.updatedAt = nowIso();
    this.ctx.db.updateRun(run);
    this.ctx.hub.publish(runId, { type: 'budget.updated', runId, budget: run.budget });
  }

  private bundleFor(run: Run) {
    const base = this.ctx.bundles[run.mode];
    // 'inked-svg' (or the env override) always draws locally, in demo or live mode, key or not.
    if (shouldUseSvgRenderer(run.styleId)) {
      return { ...base, image: createSvgImageProvider(), liveImage: false };
    }
    return base;
  }

  // ---- story ----
  enqueueStory(runId: string, nodeId: string): void {
    const run = this.ctx.db.getRun(runId);
    const node = this.ctx.db.getNode(nodeId);
    const visible = !!run && run.activeNodeId === nodeId;
    this.enqueue({ visible, run: () => this.runStory(runId, nodeId).catch(() => {}) });
    void node;
  }

  private async runStory(runId: string, nodeId: string): Promise<void> {
    const db = this.ctx.db;
    const run = db.getRun(runId);
    const node = db.getNode(nodeId);
    if (!run || !node) return;
    const parent = node.parentId ? db.getNode(node.parentId) : null;
    const bible = db.getBible(run.bibleId);
    if (!parent || !bible) {
      this.failStory(runId, nodeId, 'missing parent or bible');
      return;
    }

    const operationId = db.findOperationByNode(nodeId)?.operationId ?? nodeId;
    const bundle = this.bundleFor(run);

    // reconstruct the director action from the pending node + parent
    let action: DirectorAction;
    const oc = node.originatingChoice;
    if (oc.kind === 'preset') {
      const choice = parent.choices.find((c) => c.id === oc.choiceId);
      if (!choice) return this.failStory(runId, nodeId, `choice ${oc.choiceId} not found on parent`);
      action = { kind: 'preset', choice };
    } else if (oc.kind === 'revision') {
      const original = node.revisionOf ? db.getNode(node.revisionOf) : null;
      action = { kind: 'revision', previousTitle: original?.beat.title ?? '', choiceLabel: oc.label };
    } else {
      action = { kind: 'custom', customText: oc.customText ?? oc.label };
    }

    // ancestry: last <=3 beats oldest-first
    const chain: StoryNode[] = [];
    let cur: StoryNode | null = parent;
    while (cur && chain.length < 3) {
      chain.push(cur);
      cur = cur.parentId ? db.getNode(cur.parentId) : null;
    }
    chain.reverse();

    const req: DirectorRequest = {
      bible,
      parentState: parent.state,
      recentBeats: chain.map((n) => ({
        title: n.beat.title,
        narration: n.beat.narration,
        choiceLabel: n.originatingChoice.label,
      })),
      pathSummary: parent.state.summary,
      action,
      readerCast: bible.characters.filter((c) => c.role === 'reader'),
      parentFixtureKey: parent.fixtureKey,
      isOpening: false,
    };

    // live story spends the anthropic ledger; fixture story is free
    let reserved = 0;
    const budget = this.budgetFor(run);
    if (bundle.liveStory) {
      try {
        reserved = budget.reserve('anthropic', null).reserved;
        this.persistBudget(runId, budget);
      } catch (e) {
        if (e instanceof BudgetExhaustedError) return this.failStory(runId, nodeId, 'budget_exhausted');
        throw e;
      }
    }

    const outcome = await directBeat(bundle.story, req);

    if (bundle.liveStory) {
      const cost = outcome.ok ? outcome.result.usage.costUsd : null;
      budget.reconcile('anthropic', reserved, cost);
      this.persistBudget(runId, budget);
    }

    if (!outcome.ok) {
      this.failStory(runId, nodeId, outcome.error);
      return;
    }

    const { response, result } = outcome;
    const knownHolders = new Set(bible.characters.map((c) => c.id));
    const nextState = applyDelta(parent.state, response.stateDelta, {
      summaryUpdate: response.summaryUpdate,
      knownHolders,
    });

    // commit the node exactly once
    db.transaction(() => {
      const fresh = db.getNode(nodeId);
      if (!fresh) return;
      fresh.state = nextState;
      fresh.stateHash = stateHash(nextState);
      fresh.beat = response.beat;
      fresh.panels = response.panels;
      fresh.choices = response.choices;
      fresh.continuityNotes = response.continuityNotes;
      fresh.ending = response.ending ?? null;
      fresh.storyStatus = 'ready';
      fresh.storyError = null;
      fresh.fixtureKey = result.fixtureKey ?? null;
      fresh.source = result.model === 'fixture' ? 'fixture' : 'live';
      db.updateNode(fresh);

      if (response.ending) {
        const r = db.getRun(runId);
        if (r && !r.endingsReached.includes(response.ending.title)) {
          r.endingsReached.push(response.ending.title);
          r.updatedAt = nowIso();
          db.updateRun(r);
        }
      }
    });

    // metrics: story-ready latency from choice.accepted (node.createdAt) + cost/tokens per beat
    const elapsed = Date.now() - Date.parse(node.createdAt);
    db.recordMetric({ runId, kind: 'storyReadyMs', value: elapsed });
    const u = result.usage;
    db.recordMetric({
      runId,
      kind: 'tokens',
      cacheReadTokens: u.cacheReadTokens,
      cacheWriteTokens: u.cacheWriteTokens,
      uncachedInputTokens: u.inputTokens,
    });
    if (u.costUsd !== null) db.recordMetric({ runId, kind: 'costPerBeat', value: u.costUsd });

    this.ctx.hub.publish(runId, { type: 'story.ready', operationId, runId, nodeId });

    // enqueue artwork for the committed node
    this.enqueueNodeArt(runId, nodeId);
  }

  private failStory(runId: string, nodeId: string, error: string): void {
    const db = this.ctx.db;
    const node = db.getNode(nodeId);
    if (!node) return;
    node.storyStatus = 'failed';
    node.storyError = error;
    db.updateNode(node);
    const operationId = db.findOperationByNode(nodeId)?.operationId ?? nodeId;
    this.ctx.hub.publish(runId, { type: 'story.failed', operationId, runId, nodeId, error, retryable: true });
  }

  // ---- image jobs ----
  enqueueNodeArt(runId: string, nodeId: string): void {
    const db = this.ctx.db;
    const run = db.getRun(runId);
    const node = db.getNode(nodeId);
    if (!run || !node) return;
    const mode = run.generationMode;
    for (const panel of node.panels) {
      if (mode === 'reference_refine') {
        // final chains off preview success
        this.createImageJob(run, node, panel, 'preview', 1, []);
      } else {
        this.createImageJob(run, node, panel, 'preview', 1, []);
        this.createImageJob(run, node, panel, 'final', 1, []);
      }
    }
  }

  retryArt(runId: string, nodeId: string, panelId: string, stage: 'preview' | 'final'): GenerationJob | null {
    const db = this.ctx.db;
    const run = db.getRun(runId);
    const node = db.getNode(nodeId);
    if (!run || !node) return null;
    const panel = node.panels.find((p) => p.id === panelId);
    if (!panel) return null;
    // supersede older jobs for this panel+stage, bump requestVersion
    const existing = db.listJobsForNode(nodeId).filter((j) => j.panelId === panelId && j.stage === stage);
    let maxVersion = 0;
    for (const j of existing) {
      maxVersion = Math.max(maxVersion, j.requestVersion);
      if (j.status !== 'succeeded') {
        j.status = 'superseded';
        db.updateJob(j);
      }
    }
    return this.createImageJob(run, node, panel, stage, maxVersion + 1, []);
  }

  private createImageJob(
    run: Run,
    node: StoryNode,
    panel: PanelSpec,
    stage: 'preview' | 'final',
    requestVersion: number,
    extraRefPaths: string[],
  ): GenerationJob {
    const db = this.ctx.db;
    const idempotencyKey = sha256(Buffer.from(`${node.id}|${panel.id}|${stage}|${requestVersion}`));
    const existing = db.getJobByIdempotency(idempotencyKey);
    if (existing) return existing;

    const bundle = this.bundleFor(run);
    const job: GenerationJob = {
      id: nanoid(),
      runId: run.id,
      nodeId: node.id,
      panelId: panel.id,
      stage,
      requestVersion,
      provider: 'fixture',
      model: bundle.image.capabilities(stage).model,
      providerTaskId: null,
      idempotencyKey,
      status: 'queued',
      attempts: 0,
      assetId: null,
      error: null,
      reservedCostUsd: 0,
      actualCostUsd: null,
      createdAt: nowIso(),
      startedAt: null,
      finishedAt: null,
      latencyMs: null,
    };
    job.provider = bundle.liveImage ? 'runware' : 'fixture';
    db.insertJob(job);

    const visible = run.activeNodeId === node.id;
    this.enqueue({ visible, run: () => this.runImageJob(job.id, extraRefPaths).catch(() => {}) });
    return job;
  }

  private resolveAssetPath(assetId: string): string | null {
    const asset = this.ctx.db.getAsset(assetId);
    if (!asset) return null;
    const file = path.basename(asset.url);
    const p = path.join(this.ctx.config.assetsDir, file);
    return fs.existsSync(p) ? p : null;
  }

  private async runImageJob(jobId: string, extraRefPaths: string[]): Promise<void> {
    const db = this.ctx.db;
    const job = db.getJob(jobId);
    if (!job || job.status === 'superseded' || job.status === 'succeeded') return;
    const run = db.getRun(job.runId);
    const node = db.getNode(job.nodeId);
    const bible = run ? db.getBible(run.bibleId) : null;
    if (!run || !node || !bible) return;
    const panel = node.panels.find((p) => p.id === job.panelId);
    if (!panel) return;

    const bundle = this.bundleFor(run);
    const provider = bundle.image;
    const stage: 'preview' | 'final' = job.stage === 'final' ? 'final' : 'preview';

    // references: present characters' sheets + all reader photos (+ chained preview for refine)
    const refIds = new Set<string>();
    for (const cid of panel.presentCharacterIds) {
      const c = bible.characters.find((ch) => ch.id === cid);
      c?.referenceAssetIds.forEach((r) => refIds.add(r));
    }
    for (const c of bible.characters.filter((ch) => ch.role === 'reader')) {
      c.referenceAssetIds.forEach((r) => refIds.add(r));
    }
    const refPaths = [...refIds].map((id) => this.resolveAssetPath(id)).filter((p): p is string => !!p);
    const referenceImagePaths = [...refPaths, ...extraRefPaths];

    const size = sizeForAspect(panel.composition.aspect, stage);
    const req: ImageRequest = {
      stage,
      prompt: composeImageBrief(bible, panel),
      negativePrompt: NEGATIVE_PROMPT,
      width: size.width,
      height: size.height,
      referenceImagePaths,
      seed: panel.motion.seed,
      idempotencyKey: job.idempotencyKey,
      timeoutMs: this.ctx.config.timeouts.imageMs,
      fixtureArtPath: this.fixtureArtFor(node, panel.id, stage),
      panelSpec: panel,
      styleId: run.styleId,
    };

    // reserve budget (image spend maps to the runware ledger)
    const budget = this.budgetFor(run);
    let reserved = 0;
    try {
      reserved = budget.reserve('runware', provider.estimateCostUsd(req)).reserved;
    } catch (e) {
      if (e instanceof BudgetExhaustedError) {
        job.status = 'failed';
        job.error = 'budget_exhausted';
        job.finishedAt = nowIso();
        db.updateJob(job);
        this.ctx.hub.publish(run.id, {
          type: 'panel.art.failed',
          runId: run.id,
          nodeId: node.id,
          panelId: panel.id,
          jobId: job.id,
          stage: job.stage,
          error: 'budget_exhausted',
          requestVersion: job.requestVersion,
        });
        return; // terminal: retrying will not create budget
      }
      throw e;
    }
    job.status = 'reserved';
    job.reservedCostUsd = reserved;
    job.startedAt = nowIso();
    db.updateJob(job);
    this.persistBudget(run.id, budget);

    job.status = 'running';
    db.updateJob(job);

    try {
      const result = await provider.generate(req);
      budget.reconcile('runware', reserved, result.costUsd);
      this.persistBudget(run.id, budget);

      const assetId = nanoid();
      const ext = extByMime(result.mime);
      const file = `${assetId}.${ext}`;
      fs.mkdirSync(this.ctx.config.assetsDir, { recursive: true });
      fs.writeFileSync(path.join(this.ctx.config.assetsDir, file), result.bytes);

      const asset: Asset = {
        id: assetId,
        url: `/assets/${file}`,
        mime: result.mime,
        width: result.width,
        height: result.height,
        sha256: sha256(result.bytes),
        model: result.model,
        stage: job.stage,
        generationMeta: {
          promptHash: sha256(Buffer.from(req.prompt)),
          nodeId: node.id,
          panelId: panel.id,
          stage: job.stage,
          requestVersion: job.requestVersion,
          seed: req.seed ?? null,
        },
        referenceAssetIds: [...refIds],
        createdAt: nowIso(),
      };
      db.insertAsset(asset, { runId: run.id, nodeId: node.id, panelId: panel.id });

      job.assetId = assetId;
      job.status = 'succeeded';
      job.providerTaskId = result.providerTaskId;
      job.actualCostUsd = result.costUsd;
      job.finishedAt = nowIso();
      job.latencyMs = result.latencyMs;
      db.updateJob(job);

      const elapsed = Date.now() - Date.parse(node.createdAt);
      db.recordMetric({ runId: run.id, kind: job.stage === 'final' ? 'finalReadyMs' : 'previewReadyMs', value: elapsed });

      this.ctx.hub.publish(run.id, {
        type: job.stage === 'final' ? 'panel.final.ready' : 'panel.preview.ready',
        runId: run.id,
        nodeId: node.id,
        panelId: panel.id,
        jobId: job.id,
        assetId,
        requestVersion: job.requestVersion,
      });

      // reference_refine: final runs after preview succeeds, with the preview added as reference
      if (job.stage === 'preview' && run.generationMode === 'reference_refine') {
        const previewPath = path.join(this.ctx.config.assetsDir, file);
        this.createImageJob(run, node, panel, 'final', job.requestVersion, [previewPath]);
      }
    } catch (err) {
      budget.reconcile('runware', reserved, null);
      this.persistBudget(run.id, budget);
      job.attempts += 1;
      job.error = (err as Error).message;
      this.ctx.hub.publish(run.id, {
        type: 'panel.art.failed',
        runId: run.id,
        nodeId: node.id,
        panelId: panel.id,
        jobId: job.id,
        stage: job.stage,
        error: job.error,
        requestVersion: job.requestVersion,
      });
      db.recordMetric({ runId: run.id, kind: 'retry' });
      if (job.attempts <= this.ctx.config.autoRetryLimit) {
        job.status = 'queued';
        db.updateJob(job);
        const visible = run.activeNodeId === node.id;
        this.enqueue({ visible, run: () => this.runImageJob(job.id, extraRefPaths).catch(() => {}) });
      } else {
        job.status = 'failed';
        job.finishedAt = nowIso();
        db.updateJob(job);
      }
    }
  }

  private fixtureArtFor(node: StoryNode, panelId: string, stage: 'preview' | 'final'): string | undefined {
    if (!node.fixtureKey) return undefined;
    // Fallback beats (no authored page) are tagged '<parentKey>:custom'. Show the parent's finished
    // art for their single panel rather than a placeholder: the beat says the moment folds back on itself.
    if (node.fixtureKey.endsWith(':custom')) {
      const parentKey = node.fixtureKey.slice(0, -':custom'.length);
      const parentPng = `${parentKey}-p0-${stage}.png`;
      if (fs.existsSync(path.join(this.ctx.artRoot, parentPng))) return parentPng;
      const parentBeat = this.ctx.episode.beats.find((b) => b.key === parentKey);
      const art = parentBeat?.art?.p0;
      return art ? (stage === 'final' ? art.final : art.preview) : undefined;
    }
    // Prefer a real Runware render produced by `npm run fixtures:art` (PNG next to the authored SVG).
    const rendered = `${node.fixtureKey}-${panelId}-${stage}.png`;
    if (fs.existsSync(path.join(this.ctx.artRoot, rendered))) return rendered;
    const beat = this.ctx.episode.beats.find((b) => b.key === node.fixtureKey);
    const art = beat?.art?.[panelId];
    if (!art) return undefined;
    return stage === 'final' ? art.final : art.preview;
  }
}

function sizeForAspect(aspect: string, stage: 'preview' | 'final'): { width: number; height: number } {
  const base = stage === 'final' ? 1024 : 512;
  const [aw, ah] = aspect.split(':').map(Number);
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  if (aw >= ah) return { width: base, height: even((base * ah) / aw) };
  return { width: even((base * aw) / ah), height: base };
}

// referenced only to keep the stage list intentional
void IMAGE_STAGES;
