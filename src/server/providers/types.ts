/** Provider adapter contracts. Server core depends only on these; adapters hide provider details. */
import type { StoryBible, StoryState, Choice, CharacterDef, JobStage, StorySetup, SetupCardKey, StoryStartId, StyleId, PanelSpec } from '@shared/schemas';

export type Effort = 'low' | 'medium' | 'high';

export interface StoryDirectorInput {
  bible: StoryBible;
  state: StoryState;
  /** Last 2-3 committed beats on this path, oldest first. */
  recentBeats: { title: string; narration: string; choiceLabel: string }[];
  pathSummary: string;
  action:
    | { kind: 'preset'; choice: Choice }
    | { kind: 'custom'; customText: string }
    | { kind: 'revision'; previousTitle: string; choiceLabel: string };
  effort: Effort;
  /** Reader-camera cast members (0-2) so the director can write them in. */
  readerCast: CharacterDef[];
  /** For demo replay only: fixture key of the parent node. */
  parentFixtureKey?: string | null;
}

export interface StoryUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** null when pricing is unknown; never report unknown as 0 */
  costUsd: number | null;
}

export interface StoryDirectorResult {
  /** Raw parsed JSON. Server validates with StoryResponse schema. */
  response: unknown;
  usage: StoryUsage;
  latencyMs: number;
  model: string;
  repaired: boolean;
  /** Demo replay: which fixture beat produced this. */
  fixtureKey?: string;
}

/** Setup proposal: idea sentence or picked ingredients -> four cards. Locked cards must be returned verbatim. */
export interface ProposeSetupInput {
  idea?: string;
  picks?: Partial<StorySetup>;
  locked: SetupCardKey[];
  /** When set, only this card should change; others stay verbatim. */
  shuffleOnly?: SetupCardKey;
}

/** Episode outline for a custom or prebuilt-but-not-authored start: bible + opening beat. */
export interface OutlineEpisodeInput {
  startId: StoryStartId;
  setup: StorySetup;
  protagonistName: string;
  styleId: StyleId;
  tone: string;
  readerCast: CharacterDef[];
  /** Authored teaser and first choices for prebuilt starts, so the outline honors them. */
  startCard?: { title: string; teaser: string; firstChoices: string[] };
}
export interface OutlineEpisodeResult {
  /** Raw JSON; server validates with StoryBible (ids issued server-side are overwritten). */
  bible: unknown;
  /** Raw JSON; server validates with StoryResponse. */
  opening: unknown;
  initialState: unknown;
  usage: StoryUsage;
  latencyMs: number;
  model: string;
}

export interface StoryProvider {
  name: 'anthropic' | 'fixture';
  direct(input: StoryDirectorInput, opts?: { repairHint?: string; signal?: AbortSignal }): Promise<StoryDirectorResult>;
  /** Optional vision pass: canonical text description of a reader photo for the bible. */
  describeReaderPhoto?(photoPath: string, hint: string | undefined): Promise<string>;
  /** Four editable setup cards from an idea or picks. */
  proposeSetup?(input: ProposeSetupInput): Promise<{ setup: unknown; usage: StoryUsage; latencyMs: number }>;
  /** High-effort call: build a bible, initial state and opening beat for a non-authored start. */
  outlineEpisode?(input: OutlineEpisodeInput): Promise<OutlineEpisodeResult>;
}

export interface ModelCapability {
  model: string;
  /** Allowed output sizes, width x height. */
  sizes: { width: number; height: number }[];
  supportsReferenceImages: boolean;
  maxReferenceImages: number;
  supportsSeed: boolean;
  supportsNegativePrompt: boolean;
  /** e.g. 'low' | 'medium' | 'high' for GPT Image quality; null if not applicable */
  qualityLevels: string[] | null;
  /** Estimated USD per image at default settings; null if unknown. */
  estimatedCostUsd: number | null;
}

export interface ImageRequest {
  stage: Extract<JobStage, 'preview' | 'final' | 'reference_sheet' | 'style_sheet' | 'cast_sheet'>;
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  /** Local durable paths of reference images (character sheet, reader photos, optional preview for reference_refine). */
  referenceImagePaths: string[];
  seed?: number;
  idempotencyKey: string;
  timeoutMs: number;
  /** Demo replay only: which fixture art file to return. */
  fixtureArtPath?: string;
  /** Local SVG renderer only: the structured panel to draw from. */
  panelSpec?: PanelSpec;
  /** Local SVG renderer only: which style's palette/rules to draw with. */
  styleId?: StyleId;
}

export interface ImageResult {
  bytes: Buffer;
  mime: string;
  width: number;
  height: number;
  providerTaskId: string | null;
  costUsd: number | null;
  model: string;
  latencyMs: number;
}

export interface ImageProvider {
  name: 'runware' | 'fixture' | 'svg';
  capabilities(stage: ImageRequest['stage']): ModelCapability;
  generate(req: ImageRequest, opts?: { signal?: AbortSignal }): Promise<ImageResult>;
  /** Reserve amount before dispatch. null means unknown (counts toward unknownCount, not as 0). */
  estimateCostUsd(req: ImageRequest): number | null;
  /** If the provider supports it, look up a task by id to avoid duplicate charges after an ambiguous timeout. */
  lookupTask?(providerTaskId: string): Promise<ImageResult | null>;
}
