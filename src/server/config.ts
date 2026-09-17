/**
 * Typed server config. Reads .env (dotenv) once; sandbox may block reading .env, that is fine.
 * Secrets (ANTHROPIC_API_KEY / RUNWARE_API_KEY) are read here but never leave the server.
 */
import 'dotenv/config';
import path from 'node:path';
import { MODEL_IDS, PREVIEW_MODEL } from './providers/registry';

type GenerationMode = 'parallel' | 'reference_refine';

const num = (v: string | undefined, d: number): number => {
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
};

export interface ServerConfig {
  isTest: boolean;
  port: number;
  dataDir: string;
  dbPath: string;
  assetsDir: string;
  models: { story: string; preview: string; final: string };
  caps: { anthropicUsd: number; runwareUsd: number; perRunUsd: number };
  panel: { maxPerBeat: number };
  imageConcurrency: number;
  timeouts: { storyMs: number; imageMs: number };
  autoRetryLimit: number;
  generationMode: GenerationMode;
  fixtureDelays: { previewMs: number; finalMs: number };
  keys: { anthropic: string | null; runware: string | null };
}

export interface ConfigOverrides {
  inMemory?: boolean;
  dataDir?: string;
  forceZeroDelay?: boolean;
}

export function loadConfig(overrides: ConfigOverrides = {}): ServerConfig {
  const env = process.env;
  const isTest = overrides.inMemory === true || env.NODE_ENV === 'test' || !!env.VITEST;
  const dataDir = overrides.dataDir ?? path.resolve(process.cwd(), 'data');
  const zeroDelay = overrides.forceZeroDelay ?? isTest;
  const baseDelay = num(env.INKVERSE_FIXTURE_DELAY_MS, 1200);
  return {
    isTest,
    port: num(env.PORT, 8787),
    dataDir,
    dbPath: overrides.inMemory ? ':memory:' : path.join(dataDir, 'inkverse.sqlite'),
    assetsDir: path.join(dataDir, 'assets'),
    models: {
      // Fable is Claude 5.1 under an app-facing id; do NOT read ANTHROPIC_DEFAULT_OPUS_MODEL.
      story: env.INKVERSE_STORY_MODEL ?? 'claude-fable-5-1',
      // Verified Runware/OpenAI AIR ids come from the image registry (env-overridable there).
      preview: PREVIEW_MODEL,
      final: MODEL_IDS.finalFlare,
    },
    caps: {
      anthropicUsd: num(env.INKVERSE_CAP_ANTHROPIC_USD, 2),
      runwareUsd: num(env.INKVERSE_CAP_RUNWARE_USD, 3),
      perRunUsd: num(env.INKVERSE_CAP_PER_RUN_USD, 5),
    },
    panel: { maxPerBeat: num(env.INKVERSE_MAX_PANELS, 3) },
    imageConcurrency: num(env.INKVERSE_IMAGE_CONCURRENCY, 3),
    timeouts: {
      storyMs: num(env.INKVERSE_STORY_TIMEOUT_MS, 45000),
      imageMs: num(env.INKVERSE_IMAGE_TIMEOUT_MS, 60000),
    },
    autoRetryLimit: num(env.INKVERSE_AUTO_RETRY_LIMIT, 2),
    generationMode: (env.INKVERSE_GENERATION_MODE as GenerationMode) || 'parallel',
    fixtureDelays: {
      previewMs: zeroDelay ? 0 : baseDelay,
      finalMs: zeroDelay ? 0 : num(env.INKVERSE_FIXTURE_FINAL_DELAY_MS, 3200),
    },
    keys: {
      // The user stores the Anthropic key as FABLE_5_1_KEY; accept either.
      anthropic: env.ANTHROPIC_API_KEY?.trim() || env.FABLE_5_1_KEY?.trim() || null,
      runware: (env.RUNWARE_API_KEY ?? env.RUNWARE_KEY)?.trim() || null,
    },
  };
}
