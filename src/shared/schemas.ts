/**
 * INKVERSE shared data contract. Zod schemas + inferred types.
 * Server validates everything crossing a trust boundary (Fable output, client mutations) with these.
 * Rule: the model proposes; server code decides. No provider or DB identifiers originate from the model.
 */
import { z } from 'zod';

// ---------- enums ----------
export const StyleId = z.enum(['classic-pop', 'manga', 'clear-line', 'neon-arcade', 'inked-svg']);
export type StyleId = z.infer<typeof StyleId>;

export const Tone = z.enum(['wondrous', 'tense', 'melancholic', 'playful']);
/** Prebuilt story starts plus custom setups. 'citadel' is the fully authored demo episode. */
export const StoryStartId = z.enum(['citadel', 'shadow-strike', 'ten-minute-powers', 'custom']);
export type StoryStartId = z.infer<typeof StoryStartId>;
/** The four editable setup cards Fable proposes from the reader's idea or picks. */
export const StorySetup = z.object({
  hero: z.string().trim().min(3).max(160),
  world: z.string().trim().min(3).max(160),
  problem: z.string().trim().min(3).max(200),
  mood: z.string().trim().min(3).max(120),
});
export type StorySetup = z.infer<typeof StorySetup>;
export const SetupCardKey = z.enum(['hero', 'world', 'problem', 'mood']);
export type SetupCardKey = z.infer<typeof SetupCardKey>;
export const Genre = z.enum(['cosmic-mystery', 'time-fable', 'archive-heist', 'quiet-horror']);

export const ShotScale = z.enum(['extreme-wide', 'wide', 'medium', 'close-up', 'extreme-close-up', 'insert']);
export const Viewpoint = z.enum(['eye-level', 'low-angle', 'high-angle', 'over-shoulder', 'top-down', 'dutch']);
export const Pacing = z.enum(['setup', 'discovery', 'complication', 'payoff']);
export const MotionPreset = z.enum(['portal', 'drifting_dust', 'rain', 'energy_pulse', 'slow_push', 'still']);
export type MotionPreset = z.infer<typeof MotionPreset>;

/** Layout templates are trusted app-defined arrangements; Fable only picks an id. See layouts.ts */
export const LayoutTemplateId = z.enum(['opening-trio', 'single-splash', 'duo-stack', 'duo-side', 'wide-over-insert', 'ending-splash']);
export type LayoutTemplateId = z.infer<typeof LayoutTemplateId>;

export const JobStage = z.enum(['preview', 'final', 'reference_sheet', 'style_sheet', 'cast_sheet']);
export type JobStage = z.infer<typeof JobStage>;
export const JobStatus = z.enum(['queued', 'reserved', 'running', 'succeeded', 'failed', 'cancelled', 'superseded']);
export type JobStatus = z.infer<typeof JobStatus>;
export const GenerationMode = z.enum(['parallel', 'reference_refine']);
export const RunMode = z.enum(['live', 'demo']);
export type RunMode = z.infer<typeof RunMode>;
export const Provider = z.enum(['anthropic', 'runware', 'fixture']);

// ---------- primitives ----------
export const Norm = z.number().min(0).max(1);
export const NormPoint = z.object({ x: Norm, y: Norm });
export type NormPoint = z.infer<typeof NormPoint>;
/** Normalized rect in image space (0..1), origin top-left. */
export const NormRect = z.object({ x: Norm, y: Norm, w: z.number().min(0.02).max(1), h: z.number().min(0.02).max(1) });
export type NormRect = z.infer<typeof NormRect>;
const Short = (max: number) => z.string().trim().min(1).max(max);
export const Id = z.string().min(1).max(64);

// ---------- bible ----------
export const CharacterDef = z.object({
  id: Id,
  name: Short(40),
  role: z.enum(['protagonist', 'reader', 'supporting', 'antagonist']),
  /** Immutable visual traits, always injected into image briefs. */
  canonicalDescription: Short(900),
  fixedTraits: z.array(Short(80)).max(16),
  /** Durable asset ids (reference sheet / reader photo). */
  referenceAssetIds: z.array(Id).max(4),
  /** For reader-cast members: the reader took a photo through the browser camera. */
  source: z.enum(['authored', 'reader-camera']).default('authored'),
});
export type CharacterDef = z.infer<typeof CharacterDef>;

export const StoryBible = z.object({
  id: Id,
  version: z.number().int().min(1),
  issueTitle: Short(80),
  premise: Short(1200),
  characters: z.array(CharacterDef).min(1).max(6),
  worldRules: z.array(Short(200)).max(12),
  styleId: StyleId,
  styleRules: z.array(Short(200)).max(12),
  styleReferenceAssetId: Id.optional(),
  tone: Tone,
  genre: Genre,
  /** Fixed episode skeleton, 6 beats after opening; Fable follows it, does not rewrite it. */
  episodeArc: z.array(z.object({ beatIndex: z.number().int(), goal: Short(200), pacing: Pacing })).max(8),
});
export type StoryBible = z.infer<typeof StoryBible>;

// ---------- mutable state ----------
export const Relationship = z.object({ characterId: Id, trust: z.number().int().min(-3).max(3), note: Short(120).optional() });
export const StoryState = z.object({
  location: Short(80),
  timeline: Short(80),
  /** item id -> holder character id (or 'nobody' / 'lost'). Authoritative ownership. */
  inventory: z.record(Id, Id),
  relationships: z.array(Relationship).max(8),
  knownFacts: z.array(Short(160)).max(24),
  promises: z.array(Short(160)).max(8),
  openThreads: z.array(Short(160)).max(8),
  pacing: Pacing,
  beatIndex: z.number().int().min(0).max(12),
  summary: Short(1200),
});
export type StoryState = z.infer<typeof StoryState>;

/** Allowlisted delta. Server applies field by field and rejects anything else. */
export const StateDelta = z.object({
  location: Short(80).optional(),
  timeline: Short(80).optional(),
  inventoryChanges: z.array(z.object({ itemId: Id, toHolder: Id, reason: Short(120) })).max(4).default([]),
  relationshipChanges: z.array(z.object({ characterId: Id, trustDelta: z.number().int().min(-2).max(2), note: Short(120).optional() })).max(4).default([]),
  addFacts: z.array(Short(160)).max(4).default([]),
  addPromises: z.array(Short(160)).max(2).default([]),
  resolvePromises: z.array(Short(160)).max(2).default([]),
  addThreads: z.array(Short(160)).max(2).default([]),
  resolveThreads: z.array(Short(160)).max(3).default([]),
  pacing: Pacing.optional(),
});
export type StateDelta = z.infer<typeof StateDelta>;

// ---------- panels ----------
export const Bubble = z.object({
  kind: z.enum(['speech', 'thought', 'caption', 'sfx']),
  speakerId: Id.optional(),
  text: Short(140),
  /** Anchor rect in normalized image space; must sit inside a text-safe area and avoid faces. */
  rect: NormRect,
  tailTo: NormPoint.optional(),
});
export type Bubble = z.infer<typeof Bubble>;

export const MotionParams = z.object({
  preset: MotionPreset,
  durationMs: z.number().int().min(3000).max(8000).default(4800),
  focalPoint: NormPoint.default({ x: 0.5, y: 0.45 }),
  zoomStart: z.number().min(1).max(1.1).default(1),
  zoomEnd: z.number().min(1).max(1.12).default(1.03),
  panXPercent: z.number().min(-3).max(3).default(0),
  panYPercent: z.number().min(-3).max(3).default(0),
  intensity: z.number().min(0).max(1).default(0.25),
  particleCount: z.number().int().min(0).max(48).default(12),
  seed: z.number().int().min(0).default(1),
});
export type MotionParams = z.infer<typeof MotionParams>;

export const Composition = z.object({
  shot: ShotScale,
  viewpoint: Viewpoint,
  /** Where each present character stands (normalized center). */
  subjects: z.array(z.object({ characterId: Id, at: NormPoint, facing: z.enum(['left', 'right', 'camera', 'away']) })).max(4),
  focalPoint: NormPoint,
  keyProp: Short(80).optional(),
  background: Short(200),
  palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(2).max(5),
  /** Empty regions reserved for lettering; the image brief asks the model to keep these quiet. */
  textSafeAreas: z.array(NormRect).min(1).max(3),
  /** Aspect ratio of the art. Fixed per layout slot to avoid layout jump. */
  aspect: z.enum(['16:9', '4:3', '3:2', '1:1', '3:4', '2:3']),
});
export type Composition = z.infer<typeof Composition>;

/** Local Stage A sketch key: app-owned SVG motif keyed to the option/scene. */
export const SketchKey = z.enum(['gate', 'guardian', 'archive', 'compass', 'citadel', 'door', 'map', 'void', 'ending', 'generic']);
export type SketchKey = z.infer<typeof SketchKey>;

export const PanelSpec = z.object({
  id: Id,
  layoutSlot: z.number().int().min(0).max(3),
  action: Short(240),
  presentCharacterIds: z.array(Id).max(4),
  composition: Composition,
  /** Full image brief the server assembles; model supplies only sceneBrief. */
  sceneBrief: Short(700),
  bubbles: z.array(Bubble).max(2),
  altText: Short(300),
  altTextVerified: z.boolean().default(false),
  motion: MotionParams,
  sketchKey: SketchKey.default('generic'),
});
export type PanelSpec = z.infer<typeof PanelSpec>;

// ---------- choices ----------
export const Choice = z.object({
  id: Id,
  label: Short(48),
  intent: Short(200),
  /** Requirements evaluated server-side; a choice requiring an unowned item is rejected. */
  requires: z.object({ items: z.array(Id).max(3).default([]), facts: z.array(Short(160)).max(3).default([]), minTrust: z.object({ characterId: Id, trust: z.number().int() }).optional() }).default({ items: [], facts: [] }),
  /** Panel + normalized hotspot rect for placing the button beside the relevant object. */
  hotspot: z.object({ panelId: Id, rect: NormRect }),
  previewHint: Short(80),
});
export type Choice = z.infer<typeof Choice>;

// ---------- Fable structured response (app-defined) ----------
export const Ending = z.object({ title: Short(60), kind: z.enum(['repair-past', 'repair-future', 'sever', 'open']), epilogue: Short(400), nextIssueHook: Short(200) });
export const StoryResponse = z.object({
  beat: z.object({ title: Short(60), narration: Short(320), pacing: Pacing, layoutTemplate: LayoutTemplateId }),
  stateDelta: StateDelta,
  panels: z.array(PanelSpec).min(1).max(3),
  choices: z.array(Choice).max(3),
  continuityNotes: z.array(Short(160)).max(6),
  summaryUpdate: Short(600),
  ending: Ending.optional(),
});
export type StoryResponse = z.infer<typeof StoryResponse>;

// ---------- persisted records ----------
export const OriginatingChoice = z.object({ kind: z.enum(['preset', 'custom', 'root', 'revision']), choiceId: Id.optional(), label: Short(48), customText: Short(200).optional() });
export const StoryNode = z.object({
  id: Id,
  runId: Id,
  parentId: Id.nullable(),
  originatingChoice: OriginatingChoice,
  revisionOf: Id.nullable().default(null),
  stateVersion: z.number().int().min(1),
  stateHash: z.string(),
  state: StoryState,
  beat: StoryResponse.shape.beat,
  panels: z.array(PanelSpec),
  choices: z.array(Choice),
  continuityNotes: z.array(z.string()),
  ending: Ending.nullable().default(null),
  /** narrative readiness is independent from artwork */
  storyStatus: z.enum(['pending', 'ready', 'failed']),
  storyError: z.string().nullable().default(null),
  createdAt: z.string(),
  source: z.enum(['live', 'fixture']),
  /** Demo replay: which authored beat this node came from (null for live nodes). */
  fixtureKey: z.string().nullable().default(null),
});
export type StoryNode = z.infer<typeof StoryNode>;

export const GenerationJob = z.object({
  id: Id,
  runId: Id,
  nodeId: Id,
  panelId: Id,
  stage: JobStage,
  requestVersion: z.number().int().min(1),
  provider: Provider,
  model: z.string(),
  providerTaskId: z.string().nullable(),
  idempotencyKey: z.string(),
  status: JobStatus,
  attempts: z.number().int().min(0),
  assetId: Id.nullable(),
  error: z.string().nullable(),
  reservedCostUsd: z.number().min(0),
  actualCostUsd: z.number().min(0).nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  latencyMs: z.number().nullable(),
});
export type GenerationJob = z.infer<typeof GenerationJob>;

export const Asset = z.object({
  id: Id,
  /** Path served from our origin, e.g. /assets/<id>.png */
  url: z.string(),
  mime: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  sha256: z.string(),
  model: z.string(),
  stage: JobStage.or(z.literal('upload')).or(z.literal('sketch')),
  generationMeta: z.record(z.string(), z.unknown()).default({}),
  referenceAssetIds: z.array(Id).default([]),
  createdAt: z.string(),
});
export type Asset = z.infer<typeof Asset>;

export const BudgetLedger = z.object({
  anthropic: z.object({ capUsd: z.number(), actualUsd: z.number(), reservedUsd: z.number(), unknownCount: z.number().int() }),
  runware: z.object({ capUsd: z.number(), actualUsd: z.number(), reservedUsd: z.number(), unknownCount: z.number().int() }),
});
export type BudgetLedger = z.infer<typeof BudgetLedger>;

export const Run = z.object({
  id: Id,
  ownerSessionId: Id,
  mode: RunMode,
  bibleId: Id,
  bibleVersion: z.number().int(),
  rootNodeId: Id.nullable(),
  activeNodeId: Id.nullable(),
  title: Short(80),
  protagonistName: Short(40),
  styleId: StyleId,
  generationMode: GenerationMode,
  budget: BudgetLedger,
  endingsReached: z.array(Short(60)).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Run = z.infer<typeof Run>;

export const ExportSnapshot = z.object({
  id: Id,
  runId: Id,
  pathNodeIds: z.array(Id).min(1),
  /** panelId -> assetId chosen for export (final preferred, preview if draft) */
  selectedAssets: z.record(Id, Id),
  dialogueVersions: z.record(Id, z.array(Bubble)),
  issue: z.object({ title: Short(80), number: z.number().int(), protagonistName: Short(40), styleId: StyleId, endingTitle: Short(60).nullable() }),
  isDraft: z.boolean(),
  createdAt: z.string(),
});
export type ExportSnapshot = z.infer<typeof ExportSnapshot>;

// ---------- events (SSE) ----------
export const AppEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('choice.accepted'), operationId: Id, runId: Id, parentNodeId: Id, nodeId: Id, sketchKey: SketchKey }),
  z.object({ type: z.literal('story.ready'), operationId: Id, runId: Id, nodeId: Id }),
  z.object({ type: z.literal('story.failed'), operationId: Id, runId: Id, nodeId: Id, error: z.string(), retryable: z.boolean() }),
  z.object({ type: z.literal('panel.preview.ready'), runId: Id, nodeId: Id, panelId: Id, jobId: Id, assetId: Id, requestVersion: z.number().int() }),
  z.object({ type: z.literal('panel.final.ready'), runId: Id, nodeId: Id, panelId: Id, jobId: Id, assetId: Id, requestVersion: z.number().int() }),
  z.object({ type: z.literal('panel.art.failed'), runId: Id, nodeId: Id, panelId: Id, jobId: Id, stage: JobStage, error: z.string(), requestVersion: z.number().int() }),
  z.object({ type: z.literal('budget.updated'), runId: Id, budget: BudgetLedger }),
  z.object({ type: z.literal('cursor.moved'), runId: Id, nodeId: Id }),
]);
export type AppEvent = z.infer<typeof AppEvent>;
