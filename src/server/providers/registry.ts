/**
 * Image model registry: capability records, size selection, and param filtering.
 *
 * Model ids are Runware AIR identifiers. Verified against Runware model docs
 * (see docs/PROVIDERS.md). All ids are env-overridable so we can swap models
 * without a code change.
 */
import type { ModelCapability, ImageRequest } from './types';
import type { Composition } from '@shared/schemas';

export type Aspect = Composition['aspect'];
type Family = 'gpt-image' | 'flux';

// Verified AIR ids (docs/PROVIDERS.md). Overridable via env.
export const MODEL_IDS = {
  finalFlare: process.env.INKVERSE_FINAL_MODEL ?? 'openai:gpt-image@2.5-flare',
  finalSunburst: process.env.INKVERSE_FINAL_MODEL_ALT ?? 'openai:gpt-image@2.5-sunburst',
  previewSchnell: 'runware:100@1',
  previewKlein: 'runware:400@4',
} as const;

/** Preview model is one of the FLUX candidates, chosen by env. Default: klein 4B. */
export const PREVIEW_MODEL = process.env.INKVERSE_PREVIEW_MODEL ?? MODEL_IDS.previewKlein;

const ASPECTS: Aspect[] = ['16:9', '4:3', '3:2', '1:1', '3:4', '2:3'];

function aspectRatio(aspect: Aspect): number {
  const [a, b] = aspect.split(':').map(Number);
  return a / b;
}
function snap(n: number, step: number, min: number, max: number): number {
  const v = Math.round(n / step) * step;
  return Math.min(max, Math.max(min, v));
}
function sizeForAspect(aspect: Aspect, longEdge: number, step: number, min: number, max: number) {
  const r = aspectRatio(aspect);
  const w = r >= 1 ? longEdge : longEdge * r;
  const h = r >= 1 ? longEdge / r : longEdge;
  return { width: snap(w, step, min, max), height: snap(h, step, min, max) };
}

interface ModelMeta {
  family: Family;
  longEdge: number;
  step: number;
  minDim: number;
  maxDim: number;
  capability: ModelCapability;
}

function buildMeta(
  model: string,
  family: Family,
  longEdge: number,
  step: number,
  minDim: number,
  maxDim: number,
  partial: Omit<ModelCapability, 'model' | 'sizes'>,
): ModelMeta {
  const sizes = ASPECTS.map((a) => sizeForAspect(a, longEdge, step, minDim, maxDim));
  return { family, longEdge, step, minDim, maxDim, capability: { model, sizes, ...partial } };
}

// gpt-image 2.5: reference images (1-16), six quality tiers, no seed/negative/steps.
// FLUX (distilled schnell / klein 4B): seed + steps, no negative prompt, no quality tiers.
const META: Record<string, ModelMeta> = {
  [MODEL_IDS.finalFlare]: buildMeta(MODEL_IDS.finalFlare, 'gpt-image', 1536, 16, 256, 3840, {
    supportsReferenceImages: true,
    maxReferenceImages: 16,
    supportsSeed: false,
    supportsNegativePrompt: false,
    qualityLevels: ['auto', 'max', 'xhigh', 'high', 'medium', 'low'],
    estimatedCostUsd: 0.04,
  }),
  [MODEL_IDS.finalSunburst]: buildMeta(MODEL_IDS.finalSunburst, 'gpt-image', 1536, 16, 256, 3840, {
    supportsReferenceImages: true,
    maxReferenceImages: 16,
    supportsSeed: false,
    supportsNegativePrompt: false,
    qualityLevels: ['auto', 'max', 'xhigh', 'high', 'medium', 'low'],
    estimatedCostUsd: 0.06,
  }),
  [MODEL_IDS.previewSchnell]: buildMeta(MODEL_IDS.previewSchnell, 'flux', 512, 64, 256, 1536, {
    supportsReferenceImages: false,
    maxReferenceImages: 0,
    supportsSeed: true,
    supportsNegativePrompt: false,
    qualityLevels: null,
    estimatedCostUsd: 0.0006,
  }),
  [MODEL_IDS.previewKlein]: buildMeta(MODEL_IDS.previewKlein, 'flux', 512, 16, 128, 2048, {
    supportsReferenceImages: false,
    maxReferenceImages: 0,
    supportsSeed: true,
    supportsNegativePrompt: false,
    qualityLevels: null,
    estimatedCostUsd: 0.0006,
  }),
};

function meta(model: string): ModelMeta {
  const m = META[model];
  if (!m) throw new Error(`unknown model in registry: ${model}`);
  return m;
}

export function capabilityFor(model: string): ModelCapability {
  return meta(model).capability;
}

/** Nearest supported size for an aspect (exact, snapped to the model's dimension grid). */
export function pickSize(model: string, aspect: Aspect): { width: number; height: number } {
  const m = meta(model);
  return sizeForAspect(aspect, m.longEdge, m.step, m.minDim, m.maxDim);
}

/** Snap arbitrary width/height to the model's dimension grid and bounds. */
export function snapDims(model: string, width: number, height: number): { width: number; height: number } {
  const m = meta(model);
  return { width: snap(width, m.step, m.minDim, m.maxDim), height: snap(height, m.step, m.minDim, m.maxDim) };
}

/**
 * Strip params the model does not accept, so we never send a field the provider
 * will reject or silently ignore. Returns a new object; input is not mutated.
 */
export function sendOnlyAccepted<T extends Record<string, unknown>>(model: string, params: T): Partial<T> {
  const cap = capabilityFor(model);
  const fam = meta(model).family;
  const out: Record<string, unknown> = { ...params };
  if (!cap.supportsSeed) delete out.seed;
  if (!cap.supportsNegativePrompt) delete out.negativePrompt;
  if (!cap.supportsReferenceImages) delete out.referenceImages;
  if (cap.qualityLevels === null) {
    delete out.settings;
    delete out.quality;
  }
  if (fam === 'gpt-image') {
    // Diffusion-only knobs are meaningless for the OpenAI image path.
    delete out.steps;
    delete out.CFGScale;
    delete out.scheduler;
    delete out.clipSkip;
  }
  return out as Partial<T>;
}

/** Which model serves a given job stage. Only preview uses a FLUX model. */
export function modelForStage(stage: ImageRequest['stage'], cfg?: { previewModel?: string; finalModel?: string }): string {
  if (stage === 'preview') return cfg?.previewModel ?? PREVIEW_MODEL;
  return cfg?.finalModel ?? MODEL_IDS.finalFlare;
}

export function familyOf(model: string): Family {
  return meta(model).family;
}

export const ALL_MODELS = Object.keys(META);
