/**
 * Provider selection by run mode + key presence. Live adapters are imported dynamically inside
 * try/catch so a missing or throwing adapter module can never stop the server from booting; we
 * fall back to fixtures and label the run accordingly (demo / hybrid / live).
 */
import type { FixtureEpisode } from '@content/types';
import type { RunMode, StyleId } from '@shared/schemas';
import type { ServerConfig } from '../config';
import type { StoryProvider, ImageProvider } from './types';
import { FixtureStoryProvider, FixtureImageProvider } from './fixture';
import { createSvgImageProvider } from './svg-renderer';

/** True when a run should use the local zero-cost SVG renderer instead of any model, live or fixture. */
export function shouldUseSvgRenderer(styleId?: StyleId): boolean {
  return styleId === 'inked-svg' || process.env.INKVERSE_ART_RENDERER === 'svg';
}

export type ProviderLabel = 'demo' | 'hybrid' | 'live';

export interface ProviderBundle {
  story: StoryProvider;
  image: ImageProvider;
  label: ProviderLabel;
  liveStory: boolean;
  liveImage: boolean;
}

// Variable specifiers keep tsc from hard-resolving adapters the providers agent may not have
// written yet; a missing module simply throws at runtime and we fall back to fixtures.
async function tryLoadAnthropic(config: ServerConfig): Promise<StoryProvider | null> {
  try {
    const spec = './anthropic';
    const mod: any = await import(spec);
    const provider = mod.createAnthropicStoryProvider?.(config);
    return provider ?? null;
  } catch {
    return null;
  }
}

async function tryLoadRunware(config: ServerConfig): Promise<ImageProvider | null> {
  try {
    const spec = './runware';
    const mod: any = await import(spec);
    const provider = mod.createRunwareImageProvider?.(config);
    return provider ?? null;
  } catch {
    return null;
  }
}

export async function chooseProviders(
  mode: RunMode,
  config: ServerConfig,
  episode: FixtureEpisode,
  artRoot: string,
  styleId?: StyleId,
): Promise<ProviderBundle> {
  const fixtureStory = new FixtureStoryProvider(episode);
  const fixtureImage = new FixtureImageProvider(artRoot, config.fixtureDelays);
  const svgOverride = shouldUseSvgRenderer(styleId);

  if (mode === 'demo') {
    const image: ImageProvider = svgOverride ? createSvgImageProvider() : fixtureImage;
    return { story: fixtureStory, image, label: 'demo', liveStory: false, liveImage: false };
  }

  let story: StoryProvider = fixtureStory;
  let image: ImageProvider = fixtureImage;
  let liveStory = false;
  let liveImage = false;

  if (config.keys.anthropic) {
    const live = await tryLoadAnthropic(config);
    if (live) {
      story = live;
      liveStory = true;
    }
  }
  if (config.keys.runware) {
    const live = await tryLoadRunware(config);
    if (live) {
      image = live;
      liveImage = true;
    }
  }

  // 'inked-svg' style (or the env override) always renders locally, live key or not.
  if (svgOverride) {
    image = createSvgImageProvider();
    liveImage = false;
  }

  const label: ProviderLabel = liveStory && liveImage ? 'live' : liveStory || liveImage ? 'hybrid' : 'demo';
  return { story, image, label, liveStory, liveImage };
}

/** Human message for /api/config.liveSetupMessage naming exactly which env vars are missing. */
export function describeProviderSetup(config: ServerConfig): string | null {
  const missing: string[] = [];
  if (!config.keys.anthropic) missing.push('ANTHROPIC_API_KEY or FABLE_5_1_KEY (live story)');
  if (!config.keys.runware) missing.push('RUNWARE_API_KEY (live artwork)');
  if (missing.length === 0) return null;
  return `Add ${missing.join(' and ')} to your .env to enable live generation. Without it the app replays authored fixtures.`;
}
