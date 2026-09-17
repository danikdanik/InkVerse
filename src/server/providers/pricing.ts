/**
 * Per-model USD cost estimates. Numbers are pre-dispatch reservations only; the
 * real charge comes back on the provider response (Runware includeCost, Anthropic
 * usage). Never report an unknown price as 0 -> return null so the budget ledger
 * counts it as unknown.
 *
 * Sources are Runware model docs (see docs/PROVIDERS.md). gpt-image is billed per
 * token so the per-image figure is a doc-example-derived estimate, not a fixed rate.
 */
import { capabilityFor } from './registry';

export interface PriceNote {
  estimatedCostUsd: number | null;
  source: string;
}

export const IMAGE_PRICING: Record<string, PriceNote> = {
  'openai:gpt-image@2.5-flare': {
    estimatedCostUsd: 0.04,
    source: 'Runware flare doc: token-billed ($5/$8/$30 per Mtok in/img-in/img-out); examples ~$0.023-$0.047/gen. Estimate for medium quality at 1024-1536.',
  },
  'openai:gpt-image@2.5-sunburst': {
    estimatedCostUsd: 0.06,
    source: 'Runware sunburst doc examples: ~$0.054-$0.167/gen depending on prompt/output. Estimate for a typical panel.',
  },
  'runware:100@1': {
    estimatedCostUsd: 0.0006,
    source: 'FLUX.1 schnell: assumed ~$0.0006/gen (Runware low-cost tier; not confirmed on the fetched page). Override if docs differ.',
  },
  'runware:400@4': {
    estimatedCostUsd: 0.0006,
    source: 'Runware FLUX.2 klein 4B doc: "$0.0006" per generation at 1024x1024.',
  },
};

/** Estimated USD per image for a model, or null if unknown. */
export function estimateImageCostUsd(model: string): number | null {
  const note = IMAGE_PRICING[model];
  if (note) return note.estimatedCostUsd;
  // Fall back to the capability record's estimate if the model is registered.
  try {
    return capabilityFor(model).estimatedCostUsd;
  } catch {
    return null;
  }
}

export function imagePriceSource(model: string): string {
  return IMAGE_PRICING[model]?.source ?? 'unknown';
}

/**
 * Story (Anthropic) pricing. The configured Fable id has no public per-token rate
 * here, so cost is null unless the operator supplies rates via env (USD per 1M
 * tokens). This keeps unknown honest instead of guessing.
 */
interface StoryRates {
  inPerMTok: number;
  outPerMTok: number;
  cacheReadPerMTok: number;
  cacheWritePerMTok: number;
}

function storyRatesFromEnv(): StoryRates | null {
  const inP = process.env.INKVERSE_STORY_IN_PER_MTOK;
  const outP = process.env.INKVERSE_STORY_OUT_PER_MTOK;
  if (!inP || !outP) return null;
  const num = (v: string | undefined, d: number) => (v == null ? d : Number(v));
  return {
    inPerMTok: Number(inP),
    outPerMTok: Number(outP),
    cacheReadPerMTok: num(process.env.INKVERSE_STORY_CACHE_READ_PER_MTOK, Number(inP) * 0.1),
    cacheWritePerMTok: num(process.env.INKVERSE_STORY_CACHE_WRITE_PER_MTOK, Number(inP) * 1.25),
  };
}

export interface StoryTokens {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** USD for a story call, or null when no rates are configured. */
export function estimateStoryCostUsd(tokens: StoryTokens): number | null {
  const r = storyRatesFromEnv();
  if (!r) return null;
  const per = (n: number, rate: number) => (n / 1_000_000) * rate;
  return (
    per(tokens.inputTokens, r.inPerMTok) +
    per(tokens.outputTokens, r.outPerMTok) +
    per(tokens.cacheReadTokens, r.cacheReadPerMTok) +
    per(tokens.cacheWriteTokens, r.cacheWritePerMTok)
  );
}
