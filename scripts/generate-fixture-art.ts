/**
 * Generate preview (FLUX) + final (GPT Image flare) PNGs for every panel of the
 * demo episode, plus the protagonist reference sheet. Writes to src/content/art/
 * and prints a manifest.
 *
 *   npm run fixtures:art -- [--only=<beatKey>] [--stage=preview|final] [--limit=N] [--max-usd=8]
 *
 * Needs RUNWARE_API_KEY. The reference sheet is passed as a reference image to
 * every final so the protagonist stays recognizable. Budget-aware: prints an
 * estimated total before running and stops once the running spend exceeds --max-usd.
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRunwareImageProvider } from '../src/server/providers/runware.ts';
import { pickSize, modelForStage, MODEL_IDS, PREVIEW_MODEL } from '../src/server/providers/registry.ts';
import { estimateImageCostUsd } from '../src/server/providers/pricing.ts';
import { STYLES } from '../src/shared/styles.ts';
import type { ImageRequest } from '../src/server/providers/types.ts';

const ART_DIR = 'src/content/art';
const REF_PATH = `${ART_DIR}/neri-reference.png`;

interface Args { only?: string; stage?: 'preview' | 'final'; limit?: number; maxUsd: number }
function parseArgs(): Args {
  const a: Args = { maxUsd: 8 };
  for (const raw of process.argv.slice(2)) {
    const [k, v] = raw.replace(/^--/, '').split('=');
    if (k === 'only') a.only = v;
    else if (k === 'stage' && (v === 'preview' || v === 'final')) a.stage = v;
    else if (k === 'limit') a.limit = Number(v);
    else if (k === 'max-usd') a.maxUsd = Number(v);
  }
  return a;
}

// Dynamic specifiers so tsc does not hard-require content that another agent owns.
async function loadEpisode(): Promise<any> {
  const spec = ['@content', 'episode'].join('/');
  try {
    return (await import(spec)).EPISODE;
  } catch {
    return null;
  }
}
async function loadBriefComposer(): Promise<((bible: any, panel: any, style: any) => string) | null> {
  const spec = ['../src', 'server', 'story', 'brief.ts'].join('/');
  try {
    const mod: any = await import(spec);
    if (typeof mod.composePanelBrief === 'function') return mod.composePanelBrief;
  } catch {
    /* fall through to inline composer */
  }
  return null;
}

/** Minimal inline brief composer: style rules + scene + composition + present cast. */
function inlineBrief(bible: any, panel: any, style: any): string {
  const comp = panel.composition ?? {};
  const cast = (panel.presentCharacterIds ?? [])
    .map((id: string) => bible.characters?.find((c: any) => c.id === id))
    .filter(Boolean)
    .map((c: any) => `${c.name}: ${c.canonicalDescription}`);
  return [
    `Comic panel, finish style ${style.name}.`,
    style.rules.join('; ') + '.',
    panel.sceneBrief,
    comp.shot ? `Shot: ${comp.shot}, viewpoint ${comp.viewpoint}.` : '',
    comp.background ? `Background: ${comp.background}.` : '',
    comp.keyProp ? `Key prop: ${comp.keyProp}.` : '',
    comp.palette ? `Palette: ${comp.palette.join(', ')}.` : '',
    cast.length ? `Characters present -> ${cast.join(' | ')}.` : '',
    'Keep the reserved lettering areas visually quiet. No lettering, no text, no speech bubbles in the image.',
  ].filter(Boolean).join(' ');
}

async function main(): Promise<void> {
  const args = parseArgs();
  const apiKey = process.env.RUNWARE_API_KEY ?? process.env.RUNWARE_KEY;
  if (!apiKey) {
    console.error('fixtures:art needs RUNWARE_API_KEY (loaded from .env). A human must run: npm run fixtures:art');
    process.exit(1);
  }
  const EPISODE = await loadEpisode();
  if (!EPISODE) {
    console.error('No episode found at @content/episode. The content agent must deliver EPISODE first. Exiting.');
    process.exit(1);
  }
  await mkdir(ART_DIR, { recursive: true });

  const style = STYLES[EPISODE.bible.styleId as keyof typeof STYLES];
  const composer = (await loadBriefComposer()) ?? inlineBrief;
  const provider = createRunwareImageProvider({ apiKey, previewModel: PREVIEW_MODEL, finalModel: MODEL_IDS.finalFlare, defaultQuality: 'medium' });

  // Enumerate planned jobs.
  const stages: ('preview' | 'final')[] = args.stage ? [args.stage] : ['preview', 'final'];
  let beats = (EPISODE.beats as any[]).filter((b) => !args.only || b.key === args.only);
  if (args.limit != null) beats = beats.slice(0, args.limit);

  const jobs: { beatKey: string; panel: any; stage: 'preview' | 'final' }[] = [];
  for (const beat of beats) {
    for (const panel of beat.response.panels as any[]) {
      for (const stage of stages) jobs.push({ beatKey: beat.key, panel, stage });
    }
  }

  const refModel = modelForStage('reference_sheet', { finalModel: MODEL_IDS.finalFlare });
  const estTotal =
    (estimateImageCostUsd(refModel) ?? 0) +
    jobs.reduce((sum, j) => sum + (estimateImageCostUsd(modelForStage(j.stage, { previewModel: PREVIEW_MODEL, finalModel: MODEL_IDS.finalFlare })) ?? 0), 0);
  console.log(`Planned: ${jobs.length} panel images + 1 reference sheet. Estimated total: $${estTotal.toFixed(4)} (budget $${args.maxUsd}).`);
  if (estTotal > args.maxUsd) {
    console.error(`Estimated $${estTotal.toFixed(4)} exceeds --max-usd=${args.maxUsd}. Narrow with --only/--limit/--stage or raise --max-usd. Exiting.`);
    process.exit(1);
  }

  let spent = 0;
  const manifest: string[] = [];

  // Reference sheet (protagonist, neutral pose, full body, front view).
  const protagonist = (EPISODE.bible.characters as any[]).find((c) => c.role === 'protagonist') ?? EPISODE.bible.characters[0];
  const refSize = pickSize(refModel, '3:4');
  try {
    const refPrompt = [
      `Character reference sheet, finish style ${style.name}.`,
      style.rules.join('; ') + '.',
      `Full body, neutral standing pose, front view, plain neutral studio background.`,
      `${protagonist.name}: ${protagonist.canonicalDescription}`,
      'No lettering, no text, no speech bubbles in the image.',
    ].join(' ');
    const refRes = await provider.generate({
      stage: 'reference_sheet',
      prompt: refPrompt,
      width: refSize.width,
      height: refSize.height,
      referenceImagePaths: [],
      idempotencyKey: `fixture-ref-${protagonist.id}`,
      timeoutMs: 180_000,
    });
    await writeFile(REF_PATH, refRes.bytes);
    spent += refRes.costUsd ?? estimateImageCostUsd(refModel) ?? 0;
    manifest.push(`reference ${protagonist.id} -> ${REF_PATH} (cost ${refRes.costUsd ?? 'est'} , ${refRes.latencyMs}ms)`);
    console.log(`ref sheet -> ${REF_PATH}`);
  } catch (err) {
    console.error(`reference sheet FAILED: ${(err as Error).message}`);
  }

  for (const job of jobs) {
    const model = modelForStage(job.stage, { previewModel: PREVIEW_MODEL, finalModel: MODEL_IDS.finalFlare });
    const est = estimateImageCostUsd(model) ?? 0;
    if (spent + est > args.maxUsd) {
      console.error(`Budget stop: spent $${spent.toFixed(4)} + next $${est.toFixed(4)} > $${args.maxUsd}. Stopping.`);
      break;
    }
    const aspect = job.panel.composition?.aspect ?? '3:2';
    const size = pickSize(model, aspect);
    const prompt = composer(EPISODE.bible, job.panel, style);
    const req: ImageRequest = {
      stage: job.stage,
      prompt,
      width: size.width,
      height: size.height,
      // Only finals get the reference sheet; previews are FLUX (no reference support).
      referenceImagePaths: job.stage === 'final' ? [REF_PATH] : [],
      idempotencyKey: `fixture-${job.beatKey}-${job.panel.id}-${job.stage}`,
      timeoutMs: 180_000,
    };
    const outPath = `${ART_DIR}/${job.beatKey}-${job.panel.id}-${job.stage}.png`;
    try {
      const res = await provider.generate(req);
      await writeFile(outPath, res.bytes);
      spent += res.costUsd ?? est;
      manifest.push(`${job.beatKey}/${job.panel.id} ${job.stage} -> ${outPath} (${res.model}, cost ${res.costUsd ?? 'est'}, ${res.latencyMs}ms)`);
      console.log(`ok ${outPath}`);
    } catch (err) {
      manifest.push(`${job.beatKey}/${job.panel.id} ${job.stage} -> FAILED ${(err as Error).message}`);
      console.error(`FAILED ${outPath}: ${(err as Error).message}`);
    }
  }

  console.log('\n=== MANIFEST ===');
  for (const m of manifest) console.log(m);
  console.log(`\nApprox spent: $${spent.toFixed(4)}`);
}

main()
  .then(() => {
    // The Runware SDK keeps its websocket open; exit explicitly so the script does not hang after finishing.
    process.exit(0);
  })
  .catch((err) => {
    console.error('fixtures:art failed:', (err as Error).message);
    process.exit(1);
  });
