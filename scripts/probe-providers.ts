/**
 * Live provider probe. Runs a few tiny real generations to confirm keys, model
 * ids, latency, and reported cost. Writes docs/PROBE-RESULTS.md.
 *
 * The sandbox blocks agents from reading ./.env, so a human must run this:
 *
 *   npm run probe
 *
 * Never prints key values, only which key names are present. Outputs go to
 * data/probe/. Safe to run repeatedly; it is additive and cheap.
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRunwareImageProvider } from '../src/server/providers/runware.ts';
import { createAnthropicStoryProvider } from '../src/server/providers/anthropic.ts';
import { MODEL_IDS } from '../src/server/providers/registry.ts';
import type { ImageRequest } from '../src/server/providers/types.ts';
import type { StoryDirectorInput } from '../src/server/providers/types.ts';

const OUT_DIR = 'data/probe';
const lines: string[] = [];
function log(s = ''): void {
  console.log(s);
  lines.push(s);
}

function present(name: string): boolean {
  return typeof process.env[name] === 'string' && process.env[name]!.length > 0;
}

async function imageProbe(
  label: string,
  provider: ReturnType<typeof createRunwareImageProvider>,
  req: ImageRequest,
): Promise<void> {
  try {
    const res = await provider.generate(req);
    const file = `${OUT_DIR}/${label}.png`;
    await writeFile(file, res.bytes);
    log(`- ${label}: OK model=${res.model} ${res.width}x${res.height} latency=${res.latencyMs}ms cost=${res.costUsd ?? 'unknown'} task=${res.providerTaskId ?? 'n/a'} -> ${file}`);
  } catch (err) {
    log(`- ${label}: FAILED ${(err as Error).message}`);
  }
}

function tinyBibleInput(): StoryDirectorInput {
  return {
    bible: {
      id: 'probe-bible',
      version: 1,
      issueTitle: 'Probe Issue',
      premise: 'A tiny probe premise to confirm the director responds with schema-valid data.',
      characters: [
        { id: 'neri', name: 'Neri', role: 'protagonist', canonicalDescription: 'Short dark hair, brown skin, teal jacket, curious.', fixedTraits: ['teal jacket'], referenceAssetIds: [], source: 'authored' },
      ],
      worldRules: ['Time can be observed but not rewound.'],
      styleId: 'classic-pop',
      styleRules: ['bold ink contours'],
      tone: 'wondrous',
      genre: 'cosmic-mystery',
      episodeArc: [{ beatIndex: 0, goal: 'open the gate', pacing: 'setup' }],
    },
    state: {
      location: 'The Threshold',
      timeline: 'Now',
      inventory: { compass: 'neri' },
      relationships: [],
      knownFacts: ['The gate hums at dusk.'],
      promises: [],
      openThreads: ['Who lit the gate?'],
      pacing: 'setup',
      beatIndex: 0,
      summary: 'Neri arrives at the humming gate.',
    },
    recentBeats: [],
    pathSummary: 'Start of the probe.',
    action: { kind: 'custom', customText: 'Step toward the gate and touch it.' },
    effort: 'low',
    readerCast: [],
  };
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  log('# INKVERSE probe results');
  log('');
  log(`Run at ${new Date().toISOString()}`);
  log('');

  const hasRunware = present('RUNWARE_API_KEY');
  const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.FABLE_5_1_KEY;
  const hasAnthropic = Boolean(anthropicKey);
  log('## Keys present (names only)');
  log(`- RUNWARE_API_KEY: ${hasRunware ? 'present' : 'MISSING'}`);
  log(`- ANTHROPIC_API_KEY: ${present('ANTHROPIC_API_KEY') ? 'present' : 'MISSING'}`);
  log(`- FABLE_5_1_KEY: ${present('FABLE_5_1_KEY') ? 'present' : 'MISSING'}`);
  log('');

  log('## Runware image probes');
  if (!hasRunware) {
    log('- skipped (no RUNWARE_API_KEY)');
  } else {
    const baseReq = (over: Partial<ImageRequest>): ImageRequest => ({
      stage: 'preview',
      prompt: 'A calm inked comic panel of a small glowing gate at dusk, no text, cinematic.',
      width: 512,
      height: 512,
      referenceImagePaths: [],
      idempotencyKey: `probe-${Date.now()}`,
      timeoutMs: 120_000,
      ...over,
    });
    const schnell = createRunwareImageProvider({ apiKey: process.env.RUNWARE_API_KEY!, previewModel: MODEL_IDS.previewSchnell });
    const klein = createRunwareImageProvider({ apiKey: process.env.RUNWARE_API_KEY!, previewModel: MODEL_IDS.previewKlein });
    const flare = createRunwareImageProvider({ apiKey: process.env.RUNWARE_API_KEY!, finalModel: MODEL_IDS.finalFlare, defaultQuality: 'low' });

    await imageProbe('flux-schnell-preview', schnell, baseReq({ stage: 'preview' }));
    await imageProbe('flux-klein-preview', klein, baseReq({ stage: 'preview' }));
    await imageProbe('gpt-image-flare-final', flare, baseReq({ stage: 'final', width: 1024, height: 1024 }));
  }
  log('');

  log('## Anthropic director probe');
  if (!hasAnthropic) {
    log('- skipped (no ANTHROPIC_API_KEY)');
  } else {
    try {
      const story = createAnthropicStoryProvider({ apiKey: anthropicKey });
      const res = await story.direct(tinyBibleInput());
      const keys = res.response && typeof res.response === 'object' ? Object.keys(res.response as object) : [];
      log(`- director: OK model=${res.model} latency=${res.latencyMs}ms cacheRead=${res.usage.cacheReadTokens} cacheWrite=${res.usage.cacheWriteTokens} in=${res.usage.inputTokens} out=${res.usage.outputTokens} cost=${res.usage.costUsd ?? 'unknown'} topLevelKeys=[${keys.join(',')}]`);
    } catch (err) {
      log(`- director: FAILED ${(err as Error).message}`);
    }
  }
  log('');

  await writeFile('docs/PROBE-RESULTS.md', lines.join('\n') + '\n');
  log('Wrote docs/PROBE-RESULTS.md');
}

main().catch((err) => {
  console.error('probe failed:', (err as Error).message);
  process.exit(1);
});
