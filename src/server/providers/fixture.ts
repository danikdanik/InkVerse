/**
 * Fixture providers replay the authored episode through the same interfaces as live providers,
 * so demo mode exercises the identical worker/job/event path (with a small artificial delay so
 * the three-stage panel is visible). Never presented as live.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { FixtureEpisode, FixtureBeat } from '@content/types';
import type {
  StoryProvider,
  StoryDirectorInput,
  StoryDirectorResult,
  ImageProvider,
  ImageRequest,
  ImageResult,
  ModelCapability,
} from './types';
import { mimeByExt, sleep } from '../util';

const ZERO_USAGE = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 };

export class FixtureStoryProvider implements StoryProvider {
  readonly name = 'fixture' as const;
  constructor(private episode: FixtureEpisode) {}

  async direct(input: StoryDirectorInput): Promise<StoryDirectorResult> {
    const parentKey = input.parentFixtureKey ?? 'root';
    const parentBeat = this.episode.beats.find((b) => b.key === parentKey) ?? this.episode.beats[0];
    const candidates = this.episode.beats.filter((b) => b.parentKey === parentKey);

    let match: FixtureBeat | undefined;
    if (input.action.kind === 'preset') {
      const choiceId = input.action.choice.id;
      match = candidates.find((b) => b.via.kind === 'choice' && b.via.choiceId === choiceId);
    } else if (input.action.kind === 'custom') {
      const text = input.action.customText;
      match = candidates.find((b) => b.via.kind === 'custom' && b.via.match.test(text));
    } else {
      // revision: reuse the matching authored beat for the same label if present
      const label = input.action.choiceLabel;
      match = candidates.find((b) => b.via.kind === 'custom' && b.via.match.test(label));
    }

    if (match) {
      return {
        response: match.response,
        usage: { ...ZERO_USAGE },
        latencyMs: 0,
        model: 'fixture',
        repaired: false,
        fixtureKey: match.key,
      };
    }

    // No authored match: action-aware generic consequence that still echoes the action.
    const text =
      input.action.kind === 'custom'
        ? input.action.customText
        : input.action.kind === 'revision'
          ? input.action.choiceLabel
          : input.action.choice.label;
    const response = this.episode.fallbackCustom(parentBeat, input.state, text);
    return {
      response,
      usage: { ...ZERO_USAGE },
      latencyMs: 0,
      model: 'fixture',
      repaired: false,
      // fallback has no authored art; tag with parent so worker can still resolve a placeholder
      fixtureKey: `${parentBeat.key}:custom`,
    };
  }
}

export class FixtureImageProvider implements ImageProvider {
  readonly name = 'fixture' as const;
  constructor(
    private artRoot: string,
    private delays: { previewMs: number; finalMs: number },
  ) {}

  capabilities(): ModelCapability {
    return {
      model: 'fixture',
      sizes: [
        { width: 512, height: 512 },
        { width: 1024, height: 1024 },
      ],
      supportsReferenceImages: true,
      maxReferenceImages: 4,
      supportsSeed: true,
      supportsNegativePrompt: true,
      qualityLevels: null,
      estimatedCostUsd: 0,
    };
  }

  estimateCostUsd(): number | null {
    return 0;
  }

  async generate(req: ImageRequest): Promise<ImageResult> {
    const delay = req.stage === 'final' ? this.delays.finalMs : this.delays.previewMs;
    if (delay > 0) await sleep(delay);

    let bytes: Buffer;
    let mime: string;
    const abs = req.fixtureArtPath ? path.resolve(this.artRoot, req.fixtureArtPath) : null;
    if (abs && fs.existsSync(abs)) {
      bytes = fs.readFileSync(abs);
      mime = mimeByExt(abs);
    } else {
      // placeholder so fallbackCustom beats (no authored art) still produce an asset
      bytes = Buffer.from(placeholderSvg(req.width, req.height, req.stage), 'utf8');
      mime = 'image/svg+xml';
    }

    return {
      bytes,
      mime,
      width: req.width,
      height: req.height,
      providerTaskId: null,
      costUsd: 0,
      model: 'fixture',
      latencyMs: delay,
    };
  }
}

function placeholderSvg(w: number, h: number, stage: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#141210"/><text x="50%" y="50%" fill="#2bb3c0" font-family="sans-serif" font-size="${Math.round(h / 12)}" text-anchor="middle" dominant-baseline="middle">${stage}</text></svg>`;
}
