/** All HTTP routes. Exactly the contract in src/shared/api.ts (+ retry-story). */
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  CreateRunRequest,
  ChooseRequest,
  CursorRequest,
  RetryArtRequest,
  ReviseRequest,
  ExportRequest,
  ClientConfig,
  Metrics,
  RunBundle,
  ProposeSetupRequest,
  ProposeSetupResponse,
  ShuffleCardRequest,
} from '@shared/api';
import {
  StoryBible,
  CharacterDef,
  StoryNode,
  Run,
  ExportSnapshot,
  StorySetup,
  StoryState,
  StoryResponse,
  type Choice,
  type SketchKey,
  type SetupCardKey,
  type Bubble,
} from '@shared/schemas';
import { STYLES } from '@shared/styles';
import { loadSetupCatalog } from '../setup';
import { renderIssuePdf } from '../export/pdf';
import type { AppContext } from '../context';
import { applyDelta, stateHash } from '../story/apply';
import { validateStory } from '../story/validate';
import { freshLedger } from '../budget';
import { nowIso, imageSize, extByMime, sha256 } from '../util';
import { describeProviderSetup } from '../providers/index';

const SESSION_HEADER = 'x-inkverse-session';

function getSession(req: FastifyRequest, reply: FastifyReply, allowQuery = false): string | null {
  const h = req.headers[SESSION_HEADER];
  let session = Array.isArray(h) ? h[0] : h;
  if (!session && allowQuery) {
    const q = (req.query as Record<string, string | undefined>)?.session;
    if (q) session = q;
  }
  if (!session || !session.trim()) {
    reply.code(400).send({ error: 'missing_session', message: `header ${SESSION_HEADER} is required` });
    return null;
  }
  return session.trim();
}

function ownedRun(ctx: AppContext, session: string, runId: string, reply: FastifyReply) {
  const run = ctx.db.getRun(runId);
  if (!run || run.ownerSessionId !== session) {
    reply.code(404).send({ error: 'not_found' });
    return null;
  }
  return run;
}

function bundleFor(ctx: AppContext, runId: string): RunBundle {
  const run = ctx.db.getRun(runId)!;
  return RunBundle.parse({
    run,
    nodes: ctx.db.listNodes(runId),
    jobs: ctx.db.listJobs(runId),
    assets: ctx.db.listAssets(runId),
  });
}

function ownerIds(bible: StoryBible): Set<string> {
  return new Set(bible.characters.filter((c) => c.role === 'protagonist' || c.role === 'reader').map((c) => c.id));
}

function requirementsMet(choice: Choice, state: StoryState, owners: Set<string>): boolean {
  for (const item of choice.requires.items) {
    const holder = state.inventory[item];
    if (!holder || !owners.has(holder)) return false;
  }
  for (const fact of choice.requires.facts) {
    if (!state.knownFacts.some((f) => f.toLowerCase().includes(fact.toLowerCase()))) return false;
  }
  if (choice.requires.minTrust) {
    const rel = state.relationships.find((r) => r.characterId === choice.requires.minTrust!.characterId);
    if ((rel?.trust ?? 0) < choice.requires.minTrust.trust) return false;
  }
  return true;
}

const SKETCH_KEYWORDS: Record<string, SketchKey> = {
  gate: 'gate',
  guardian: 'guardian',
  archive: 'archive',
  compass: 'compass',
  citadel: 'citadel',
  door: 'door',
  map: 'map',
  void: 'void',
  ending: 'ending',
};

function deriveSketchKey(label: string, panelSketchKey?: SketchKey): SketchKey {
  const l = label.toLowerCase();
  for (const [kw, key] of Object.entries(SKETCH_KEYWORDS)) {
    if (l.includes(kw)) return key;
  }
  if (panelSketchKey && panelSketchKey !== 'generic') return panelSketchKey;
  return 'generic';
}

function enforceLocked(setup: StorySetup, locked: SetupCardKey[], picks?: Partial<StorySetup>): StorySetup {
  const out = { ...setup };
  for (const k of locked) {
    const v = picks?.[k];
    if (typeof v === 'string' && v.trim()) out[k] = v; // locked cards stay verbatim
  }
  return StorySetup.parse(out);
}

function buildReaderChars(
  readerCast: { displayName: string; photoAssetId: string; hint?: string }[],
): CharacterDef[] {
  return readerCast.map((rc, i) =>
    CharacterDef.parse({
      id: `reader-${i + 1}`,
      name: rc.displayName,
      role: 'reader',
      canonicalDescription: rc.hint?.trim() || 'a companion photographed by the reader',
      fixedTraits: [],
      referenceAssetIds: [rc.photoAssetId],
      source: 'reader-camera',
    }),
  );
}

const PLACEHOLDER_BEAT = {
  title: 'Weaving',
  narration: 'The next beat is being drawn.',
  pacing: 'setup' as const,
  layoutTemplate: 'single-splash' as const,
};

/**
 * Create a run for a non-citadel story start. Requires Live mode + a story provider with
 * outlineEpisode (Fable builds the bible, initial state and opening beat). The server still issues
 * every id, overwrites bible id/version/style, injects the reader cast, business-validates the
 * opening, then commits the root exactly like the citadel path.
 */
async function createOutlinedRun(
  ctx: AppContext,
  session: string,
  body: CreateRunRequest,
  reply: FastifyReply,
): Promise<unknown> {
  const { db, config, worker } = ctx;
  const live = ctx.bundles.live;
  const canOutline =
    !!config.keys.anthropic && live.liveStory && typeof live.story.outlineEpisode === 'function';
  if (body.mode !== 'live' || !canOutline) {
    return reply
      .code(400)
      .send({ error: 'live_required', message: 'This story start needs Live mode with an Anthropic key.' });
  }

  const cat = await loadSetupCatalog();
  const startCard = cat.STORY_STARTS.find((s) => s.id === body.startId);
  let setup = body.setup;
  if (!setup) {
    if (body.startId === 'custom' || !startCard) {
      return reply
        .code(400)
        .send({ error: 'setup_required', message: 'Custom starts need a setup (hero, world, problem, mood).' });
    }
    // prebuilt-but-not-authored: seed the setup from the authored card text
    setup = StorySetup.parse({
      hero: startCard.teaser,
      world: startCard.teaser,
      problem: startCard.teaser,
      mood: body.tone,
    });
  }

  const readers = buildReaderChars(body.readerCast);
  let outline;
  try {
    outline = await live.story.outlineEpisode!({
      startId: body.startId,
      setup,
      protagonistName: body.protagonistName,
      styleId: body.styleId,
      tone: body.tone,
      readerCast: readers,
      startCard: startCard
        ? { title: startCard.title, teaser: startCard.teaser, firstChoices: startCard.firstChoices }
        : undefined,
    });
  } catch (e) {
    return reply.code(502).send({ error: 'outline_failed', detail: String(e) });
  }

  const bibleParsed = StoryBible.safeParse(outline.bible);
  const initParsed = StoryState.safeParse(outline.initialState);
  const openParsed = StoryResponse.safeParse(outline.opening);
  if (!bibleParsed.success || !initParsed.success || !openParsed.success) {
    return reply.code(502).send({ error: 'outline_invalid' });
  }

  const bible = StoryBible.parse({
    ...bibleParsed.data,
    id: nanoid(),
    version: 1,
    styleId: body.styleId,
    styleRules: STYLES[body.styleId].rules,
    characters: [...bibleParsed.data.characters, ...readers],
  });

  const bv = validateStory(openParsed.data, { parentState: initParsed.data, bible, isOpening: true });
  if (!bv.ok) return reply.code(502).send({ error: 'opening_invalid', detail: bv.errors });

  const now = nowIso();
  db.insertBible(bible);
  const run = Run.parse({
    id: nanoid(),
    ownerSessionId: session,
    mode: body.mode,
    bibleId: bible.id,
    bibleVersion: bible.version,
    rootNodeId: null,
    activeNodeId: null,
    title: bible.issueTitle,
    protagonistName: body.protagonistName,
    styleId: body.styleId,
    generationMode: body.generationMode,
    budget: freshLedger(config.caps.anthropicUsd, config.caps.runwareUsd),
    endingsReached: [],
    createdAt: now,
    updatedAt: now,
  });
  db.insertRun(run);

  const knownHolders = new Set(bible.characters.map((c) => c.id));
  const rootState = applyDelta(initParsed.data, openParsed.data.stateDelta, {
    summaryUpdate: openParsed.data.summaryUpdate,
    knownHolders,
  });
  rootState.beatIndex = initParsed.data.beatIndex;

  const rootNode = StoryNode.parse({
    id: nanoid(),
    runId: run.id,
    parentId: null,
    originatingChoice: { kind: 'root', label: 'Opening' },
    revisionOf: null,
    stateVersion: 1,
    stateHash: stateHash(rootState),
    state: rootState,
    beat: openParsed.data.beat,
    panels: openParsed.data.panels,
    choices: openParsed.data.choices,
    continuityNotes: openParsed.data.continuityNotes,
    ending: openParsed.data.ending ?? null,
    storyStatus: 'ready',
    storyError: null,
    createdAt: now,
    source: 'live',
    fixtureKey: null,
  });
  db.insertNode(rootNode);

  run.rootNodeId = rootNode.id;
  run.activeNodeId = rootNode.id;
  run.updatedAt = nowIso();
  db.updateRun(run);
  worker.enqueueNodeArt(run.id, rootNode.id);

  return reply.code(201).send(bundleFor(ctx, run.id));
}

export function registerRoutes(app: FastifyInstance, ctx: AppContext): void {
  const { db, config, worker, hub, episode } = ctx;

  app.get('/api/health', async () => ({ ok: true, ts: nowIso() }));

  // ---- config / metrics ----
  app.get('/api/config', async () => {
    const live = ctx.bundles.live;
    return ClientConfig.parse({
      liveAvailable: live.liveStory || live.liveImage,
      liveSetupMessage: describeProviderSetup(config),
      storyModel: config.models.story,
      previewModel: config.models.preview,
      finalModel: config.models.final,
      generationMode: config.generationMode,
      // The web shipped CSS motion templates, not the HyperFrames player.
      motionPlayer: 'css-fallback',
      budget: freshLedger(config.caps.anthropicUsd, config.caps.runwareUsd),
      liveProviders: {
        story: live.liveStory ? 'anthropic' : 'fixture',
        image: live.liveImage ? 'runware' : 'fixture',
      },
    });
  });

  // ---- setup: story starts + ingredient decks + proposals ----
  app.get('/api/setup/starts', async () => (await loadSetupCatalog()).STORY_STARTS);
  app.get('/api/setup/decks', async () => (await loadSetupCatalog()).DECKS);

  app.post('/api/setup/propose', async (req, reply) => {
    let body;
    try {
      body = ProposeSetupRequest.parse(req.body ?? {});
    } catch (e) {
      return reply.code(400).send({ error: 'bad_request', detail: String(e) });
    }
    const live = ctx.bundles.live;
    if (config.keys.anthropic && live.liveStory && typeof live.story.proposeSetup === 'function') {
      try {
        const r = await live.story.proposeSetup({ idea: body.idea, picks: body.picks, locked: body.locked });
        const parsed = StorySetup.safeParse(r.setup);
        if (parsed.success) {
          const setup = enforceLocked(parsed.data, body.locked, body.picks);
          return ProposeSetupResponse.parse({ setup, source: 'anthropic' });
        }
      } catch {
        // fall through to the deck path
      }
    }
    const cat = await loadSetupCatalog();
    const composed = cat.composeSetupFromDeck({ picks: body.picks, locked: body.locked });
    const setup = enforceLocked(StorySetup.parse(composed), body.locked, body.picks);
    return ProposeSetupResponse.parse({ setup, source: 'deck' });
  });

  app.post('/api/setup/shuffle', async (req, reply) => {
    let body;
    try {
      body = ShuffleCardRequest.parse(req.body ?? {});
    } catch (e) {
      return reply.code(400).send({ error: 'bad_request', detail: String(e) });
    }
    const others = (['hero', 'world', 'problem', 'mood'] as SetupCardKey[]).filter((k) => k !== body.card);
    const live = ctx.bundles.live;
    if (config.keys.anthropic && live.liveStory && typeof live.story.proposeSetup === 'function') {
      try {
        const r = await live.story.proposeSetup({ picks: body.current, locked: others, shuffleOnly: body.card });
        const parsed = StorySetup.safeParse(r.setup);
        if (parsed.success) {
          const setup = enforceLocked(parsed.data, others, body.current);
          return ProposeSetupResponse.parse({ setup, source: 'anthropic' });
        }
      } catch {
        // fall through to the deck path
      }
    }
    const cat = await loadSetupCatalog();
    const composed = cat.composeSetupFromDeck({ picks: body.current, locked: others, shuffleOnly: body.card });
    const setup = enforceLocked(StorySetup.parse(composed), others, body.current);
    return ProposeSetupResponse.parse({ setup, source: 'deck' });
  });

  app.get('/api/metrics', async () => {
    const m = db.allMetrics();
    const vals = (kind: string) => m.filter((x) => x.kind === kind).map((x) => x.value ?? 0);
    const sum = (pick: (r: (typeof m)[number]) => number | undefined) =>
      m.reduce((a, r) => a + (pick(r) ?? 0), 0);
    return Metrics.parse({
      storyReadyMs: vals('storyReadyMs'),
      previewReadyMs: vals('previewReadyMs'),
      finalReadyMs: vals('finalReadyMs'),
      retryCount: m.filter((x) => x.kind === 'retry').length,
      cacheReadTokens: sum((r) => r.cacheReadTokens),
      cacheWriteTokens: sum((r) => r.cacheWriteTokens),
      uncachedInputTokens: sum((r) => r.uncachedInputTokens),
      costPerBeatUsd: vals('costPerBeat'),
    });
  });

  // ---- runs ----
  app.get('/api/runs', async (req, reply) => {
    const session = getSession(req, reply);
    if (!session) return;
    return db.listRunsBySession(session);
  });

  app.post('/api/runs', async (req, reply) => {
    const session = getSession(req, reply);
    if (!session) return;
    let body;
    try {
      body = CreateRunRequest.parse(req.body ?? {});
    } catch (e) {
      return reply.code(400).send({ error: 'bad_request', detail: String(e) });
    }

    // Non-citadel starts are not authored; they need Live mode + a story provider that can outline.
    if (body.startId !== 'citadel') {
      const outcome = await createOutlinedRun(ctx, session, body, reply);
      return outcome;
    }

    // build bible from the authored bible with overrides + reader cast
    const base = episode.bible;
    const chars = base.characters.map((c) => (c.id === 'neri' ? { ...c, name: body.protagonistName } : c));
    const readers = buildReaderChars(body.readerCast);
    const bible = StoryBible.parse({
      ...base,
      id: nanoid(),
      styleId: body.styleId,
      styleRules: STYLES[body.styleId].rules,
      tone: body.tone,
      genre: body.genre,
      characters: [...chars, ...readers],
    });
    db.insertBible(bible);

    const now = nowIso();
    const run = Run.parse({
      id: nanoid(),
      ownerSessionId: session,
      mode: body.mode,
      bibleId: bible.id,
      bibleVersion: bible.version,
      rootNodeId: null,
      activeNodeId: null,
      title: bible.issueTitle,
      protagonistName: body.protagonistName,
      styleId: body.styleId,
      generationMode: body.generationMode,
      budget: freshLedger(config.caps.anthropicUsd, config.caps.runwareUsd),
      endingsReached: [],
      createdAt: now,
      updatedAt: now,
    });
    db.insertRun(run);

    // root node from the authored opening (synchronous, both modes)
    const rootBeat =
      episode.beats.find((b) => b.via.kind === 'root') ?? episode.beats.find((b) => b.parentKey === null);
    if (!rootBeat) return reply.code(500).send({ error: 'no_root_beat' });
    const knownHolders = new Set(bible.characters.map((c) => c.id));
    const rootState = applyDelta(episode.initialState, rootBeat.response.stateDelta, {
      summaryUpdate: rootBeat.response.summaryUpdate,
      knownHolders,
    });
    rootState.beatIndex = episode.initialState.beatIndex; // opening keeps beat 0

    const rootNode = StoryNode.parse({
      id: nanoid(),
      runId: run.id,
      parentId: null,
      originatingChoice: { kind: 'root', label: 'Opening' },
      revisionOf: null,
      stateVersion: 1,
      stateHash: stateHash(rootState),
      state: rootState,
      beat: rootBeat.response.beat,
      panels: rootBeat.response.panels,
      choices: rootBeat.response.choices,
      continuityNotes: rootBeat.response.continuityNotes,
      ending: rootBeat.response.ending ?? null,
      storyStatus: 'ready',
      storyError: null,
      createdAt: now,
      source: 'fixture',
      fixtureKey: rootBeat.key,
    });
    db.insertNode(rootNode);

    run.rootNodeId = rootNode.id;
    run.activeNodeId = rootNode.id;
    run.updatedAt = nowIso();
    db.updateRun(run);

    // enqueue artwork for the opening (fixture art in demo, live art in live)
    worker.enqueueNodeArt(run.id, rootNode.id);

    return reply.code(201).send(bundleFor(ctx, run.id));
  });

  app.get('/api/runs/:runId', async (req, reply) => {
    const session = getSession(req, reply);
    if (!session) return;
    const { runId } = req.params as { runId: string };
    if (!ownedRun(ctx, session, runId, reply)) return;
    return bundleFor(ctx, runId);
  });

  // ---- choose ----
  app.post('/api/runs/:runId/choose', async (req, reply) => {
    const session = getSession(req, reply);
    if (!session) return;
    const { runId } = req.params as { runId: string };
    const run = ownedRun(ctx, session, runId, reply);
    if (!run) return;

    let body;
    try {
      body = ChooseRequest.parse(req.body ?? {});
    } catch (e) {
      return reply.code(400).send({ error: 'bad_request', detail: String(e) });
    }

    // idempotency: duplicate clientOpId returns the same operation, no new node/jobs
    const dup = db.findOperation(runId, body.clientOpId);
    if (dup) {
      return reply.code(202).send({ operationId: dup.operationId, nodeId: dup.nodeId, deduplicated: true });
    }

    const parent = db.getNode(body.parentNodeId);
    if (!parent || parent.runId !== runId) return reply.code(404).send({ error: 'parent_not_found' });
    if (parent.storyStatus !== 'ready') return reply.code(409).send({ error: 'parent_not_ready' });
    if (body.parentVersion !== parent.stateVersion) {
      return reply.code(409).send({ error: 'version_mismatch', expected: parent.stateVersion });
    }

    const bible = db.getBible(run.bibleId)!;
    const owners = ownerIds(bible);

    let originatingChoice;
    let sketchKey: SketchKey;
    if (body.choiceId) {
      const choice = parent.choices.find((c) => c.id === body.choiceId);
      if (!choice) return reply.code(400).send({ error: 'unknown_choice' });
      if (!requirementsMet(choice, parent.state, owners)) {
        return reply.code(400).send({ error: 'requirements_unmet' });
      }
      const panel = parent.panels.find((p) => p.id === choice.hotspot.panelId);
      sketchKey = deriveSketchKey(choice.label, panel?.sketchKey);
      originatingChoice = { kind: 'preset' as const, choiceId: choice.id, label: choice.label };
    } else {
      const text = body.customAction!;
      sketchKey = deriveSketchKey(text);
      originatingChoice = { kind: 'custom' as const, label: text.slice(0, 48), customText: text };
    }

    const now = nowIso();
    const child = StoryNode.parse({
      id: nanoid(),
      runId,
      parentId: parent.id,
      originatingChoice,
      revisionOf: null,
      stateVersion: parent.stateVersion + 1,
      stateHash: stateHash(parent.state),
      state: parent.state,
      beat: PLACEHOLDER_BEAT,
      panels: [],
      choices: [],
      continuityNotes: [],
      ending: null,
      storyStatus: 'pending',
      storyError: null,
      createdAt: now,
      source: run.mode === 'live' ? 'live' : 'fixture',
      fixtureKey: null,
    });
    db.insertNode(child);

    const operationId = nanoid();
    db.insertOperation({ runId, clientOpId: body.clientOpId, operationId, nodeId: child.id });

    hub.publish(runId, {
      type: 'choice.accepted',
      operationId,
      runId,
      parentNodeId: parent.id,
      nodeId: child.id,
      sketchKey,
    });
    // advance the cursor to the new beat so a reload lands on it; rewind stays an explicit cursor call
    run.activeNodeId = child.id;
    run.updatedAt = nowIso();
    db.updateRun(run);
    hub.publish(runId, { type: 'cursor.moved', runId, nodeId: child.id });
    worker.enqueueStory(runId, child.id);

    return reply.code(202).send({ operationId, nodeId: child.id, deduplicated: false });
  });

  // ---- retry story (re-run director on the same node) ----
  app.post('/api/runs/:runId/nodes/:nodeId/retry-story', async (req, reply) => {
    const session = getSession(req, reply);
    if (!session) return;
    const { runId, nodeId } = req.params as { runId: string; nodeId: string };
    if (!ownedRun(ctx, session, runId, reply)) return;
    const node = db.getNode(nodeId);
    if (!node || node.runId !== runId) return reply.code(404).send({ error: 'node_not_found' });
    node.storyStatus = 'pending';
    node.storyError = null;
    db.updateNode(node);
    const operationId = db.findOperationByNode(nodeId)?.operationId ?? nanoid();
    worker.enqueueStory(runId, nodeId);
    return reply.code(202).send({ operationId, nodeId, deduplicated: false });
  });

  // ---- revise (new sibling, kind revision) ----
  app.post('/api/runs/:runId/nodes/:nodeId/revise', async (req, reply) => {
    const session = getSession(req, reply);
    if (!session) return;
    const { runId, nodeId } = req.params as { runId: string; nodeId: string };
    const run = ownedRun(ctx, session, runId, reply);
    if (!run) return;
    let body;
    try {
      body = ReviseRequest.parse(req.body ?? {});
    } catch (e) {
      return reply.code(400).send({ error: 'bad_request', detail: String(e) });
    }
    const dup = db.findOperation(runId, body.clientOpId);
    if (dup) return reply.code(202).send({ operationId: dup.operationId, nodeId: dup.nodeId, deduplicated: true });

    const original = db.getNode(nodeId);
    if (!original || original.runId !== runId) return reply.code(404).send({ error: 'node_not_found' });
    if (!original.parentId) return reply.code(400).send({ error: 'cannot_revise_root' });
    const parent = db.getNode(original.parentId);
    if (!parent) return reply.code(404).send({ error: 'parent_not_found' });

    const now = nowIso();
    const child = StoryNode.parse({
      id: nanoid(),
      runId,
      parentId: parent.id,
      originatingChoice: {
        kind: 'revision',
        choiceId: original.originatingChoice.choiceId,
        label: original.originatingChoice.label,
        customText: original.originatingChoice.customText,
      },
      revisionOf: nodeId,
      stateVersion: parent.stateVersion + 1,
      stateHash: stateHash(parent.state),
      state: parent.state,
      beat: PLACEHOLDER_BEAT,
      panels: [],
      choices: [],
      continuityNotes: [],
      ending: null,
      storyStatus: 'pending',
      storyError: null,
      createdAt: now,
      source: run.mode === 'live' ? 'live' : 'fixture',
      fixtureKey: null,
    });
    db.insertNode(child);
    const operationId = nanoid();
    db.insertOperation({ runId, clientOpId: body.clientOpId, operationId, nodeId: child.id });
    hub.publish(runId, {
      type: 'choice.accepted',
      operationId,
      runId,
      parentNodeId: parent.id,
      nodeId: child.id,
      sketchKey: deriveSketchKey(original.originatingChoice.label),
    });
    run.activeNodeId = child.id;
    run.updatedAt = nowIso();
    db.updateRun(run);
    hub.publish(runId, { type: 'cursor.moved', runId, nodeId: child.id });
    worker.enqueueStory(runId, child.id);
    return reply.code(202).send({ operationId, nodeId: child.id, deduplicated: false });
  });

  // ---- retry art ----
  app.post('/api/runs/:runId/nodes/:nodeId/panels/:panelId/retry', async (req, reply) => {
    const session = getSession(req, reply);
    if (!session) return;
    const { runId, nodeId, panelId } = req.params as { runId: string; nodeId: string; panelId: string };
    if (!ownedRun(ctx, session, runId, reply)) return;
    let body;
    try {
      body = RetryArtRequest.parse(req.body ?? {});
    } catch (e) {
      return reply.code(400).send({ error: 'bad_request', detail: String(e) });
    }
    const job = worker.retryArt(runId, nodeId, panelId, body.stage);
    if (!job) return reply.code(404).send({ error: 'panel_not_found' });
    return job;
  });

  // ---- cursor ----
  app.post('/api/runs/:runId/cursor', async (req, reply) => {
    const session = getSession(req, reply);
    if (!session) return;
    const { runId } = req.params as { runId: string };
    const run = ownedRun(ctx, session, runId, reply);
    if (!run) return;
    let body;
    try {
      body = CursorRequest.parse(req.body ?? {});
    } catch (e) {
      return reply.code(400).send({ error: 'bad_request', detail: String(e) });
    }
    const node = db.getNode(body.nodeId);
    if (!node || node.runId !== runId) return reply.code(404).send({ error: 'node_not_found' });
    run.activeNodeId = node.id;
    run.updatedAt = nowIso();
    db.updateRun(run);
    hub.publish(runId, { type: 'cursor.moved', runId, nodeId: node.id });
    return run;
  });

  // ---- export ----
  app.post('/api/runs/:runId/export', async (req, reply) => {
    const session = getSession(req, reply);
    if (!session) return;
    const { runId } = req.params as { runId: string };
    const run = ownedRun(ctx, session, runId, reply);
    if (!run) return;
    let body;
    try {
      body = ExportRequest.parse(req.body ?? {});
    } catch (e) {
      return reply.code(400).send({ error: 'bad_request', detail: String(e) });
    }

    const endId = body.endNodeId ?? run.activeNodeId;
    if (!endId) return reply.code(400).send({ error: 'no_end_node' });

    // walk parent links to root, then order root-first
    const path0: StoryNode[] = [];
    let cur = db.getNode(endId);
    while (cur) {
      path0.push(cur);
      cur = cur.parentId ? db.getNode(cur.parentId) : null;
    }
    path0.reverse();
    const readyNodes = path0.filter((n) => n.storyStatus === 'ready');
    if (readyNodes.length === 0) return reply.code(400).send({ error: 'no_ready_nodes' });

    const selectedAssets: Record<string, string> = {};
    const dialogueVersions: Record<string, Bubble[]> = {};
    const pendingPanelIds: string[] = [];
    let isDraft = false;

    for (const node of readyNodes) {
      const assets = db.listAssetsForNode(node.id);
      for (const panel of node.panels) {
        dialogueVersions[panel.id] = panel.bubbles;
        const forPanel = assets.filter((a) => (a.generationMeta.panelId as string) === panel.id);
        const final = forPanel.find((a) => a.stage === 'final');
        const preview = forPanel.find((a) => a.stage === 'preview');
        if (final) {
          selectedAssets[panel.id] = final.id;
        } else if (preview) {
          selectedAssets[panel.id] = preview.id;
          isDraft = true;
        } else {
          pendingPanelIds.push(panel.id);
        }
      }
    }

    if (pendingPanelIds.length > 0 && !body.allowDraft) {
      return reply.code(409).send({ error: 'pending_panels', pendingPanelIds });
    }

    const lastEnding = [...readyNodes].reverse().find((n) => n.ending)?.ending?.title ?? null;
    const snapshot = ExportSnapshot.parse({
      id: nanoid(),
      runId,
      pathNodeIds: readyNodes.map((n) => n.id),
      selectedAssets,
      dialogueVersions,
      issue: {
        title: run.title,
        number: 1,
        protagonistName: run.protagonistName,
        styleId: run.styleId,
        endingTitle: lastEnding,
      },
      isDraft: isDraft || pendingPanelIds.length > 0,
      createdAt: nowIso(),
    });

    const bible = db.getBible(run.bibleId)!;
    let pdfUrl: string | null = null;
    try {
      const bytes = await renderIssuePdf({
        snapshot,
        nodes: readyNodes,
        assets: db.listAssets(runId),
        bible,
        readAsset: async (asset) => fs.readFileSync(path.join(config.assetsDir, path.basename(asset.url))),
      });
      const file = `export-${snapshot.id}.pdf`;
      fs.mkdirSync(config.assetsDir, { recursive: true });
      fs.writeFileSync(path.join(config.assetsDir, file), bytes);
      pdfUrl = `/assets/${file}`;
    } catch {
      pdfUrl = null; // export renderer not wired yet; snapshot still returned
    }

    return { snapshot, pdfUrl, pendingPanelIds };
  });

  // ---- asset upload ----
  app.post('/api/assets/upload', async (req, reply) => {
    const session = getSession(req, reply);
    if (!session) return;
    const data = await (req as any).file();
    if (!data) return reply.code(400).send({ error: 'no_file' });
    const mime = data.mimetype as string;
    if (mime !== 'image/jpeg' && mime !== 'image/png') {
      return reply.code(415).send({ error: 'unsupported_media_type', mime });
    }
    const buf = await data.toBuffer();
    if (buf.length > 6 * 1024 * 1024) return reply.code(413).send({ error: 'too_large' });
    const dims = imageSize(buf);
    if (!dims || dims.width <= 0 || dims.height <= 0) {
      return reply.code(400).send({ error: 'unreadable_image' });
    }
    const assetId = nanoid();
    const ext = extByMime(mime);
    const file = `${assetId}.${ext}`;
    fs.mkdirSync(config.assetsDir, { recursive: true });
    fs.writeFileSync(path.join(config.assetsDir, file), buf);
    const asset = {
      id: assetId,
      url: `/assets/${file}`,
      mime,
      width: dims.width,
      height: dims.height,
      sha256: sha256(buf),
      model: 'upload',
      stage: 'upload' as const,
      generationMeta: {},
      referenceAssetIds: [],
      createdAt: nowIso(),
    };
    db.insertAsset(asset, { runId: null, nodeId: null, panelId: null });
    return asset;
  });

  // ---- SSE stream ----
  app.get('/api/runs/:runId/events', (req, reply) => {
    const session = getSession(req, reply, true);
    if (!session) return;
    const { runId } = req.params as { runId: string };
    const run = db.getRun(runId);
    if (!run || run.ownerSessionId !== session) {
      reply.code(404).send({ error: 'not_found' });
      return;
    }
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    reply.raw.write(': connected\n\n');
    hub.subscribe(runId, reply);
  });
}
