/** HTTP contract between web and server. Server base: http://localhost:8787 (Vite proxies /api and /assets). */
import { z } from 'zod';
import { Asset, GenerationJob, Id, Run, StoryNode, StyleId, Tone, Genre, GenerationMode, RunMode, ExportSnapshot, BudgetLedger, StorySetup, StoryStartId, SetupCardKey } from './schemas';

export const ReaderCastInput = z.object({
  displayName: z.string().trim().min(1).max(40),
  photoAssetId: Id,
  /** Optional reader-typed hint, e.g. "my sister, red glasses". Server/Fable produce canonicalDescription. */
  hint: z.string().trim().max(160).optional(),
});
export type ReaderCastInput = z.infer<typeof ReaderCastInput>;

export const CreateRunRequest = z.object({
  protagonistName: z.string().trim().min(1).max(40).default('Neri'),
  tone: Tone.default('wondrous'),
  genre: Genre.default('cosmic-mystery'),
  styleId: StyleId.default('clear-line'),
  /** Which story start. 'custom' and non-citadel starts need Live mode (Fable outlines the episode). */
  startId: StoryStartId.default('citadel'),
  /** Present for 'custom' (and optionally to tweak a prebuilt start). */
  setup: StorySetup.optional(),
  mode: RunMode.default('demo'),
  generationMode: GenerationMode.default('parallel'),
  /** 0, 1 or 2 people captured with the browser camera; they join the story as companions. */
  readerCast: z.array(ReaderCastInput).max(2).default([]),
});
export type CreateRunRequest = z.infer<typeof CreateRunRequest>;

export const RunBundle = z.object({ run: Run, nodes: z.array(StoryNode), jobs: z.array(GenerationJob), assets: z.array(Asset) });
export type RunBundle = z.infer<typeof RunBundle>;

export const ChooseRequest = z.object({
  parentNodeId: Id,
  /** Optimistic concurrency: must equal parent.stateVersion or 409. */
  parentVersion: z.number().int(),
  choiceId: Id.optional(),
  customAction: z.string().trim().min(3).max(200).optional(),
  /** Client-generated idempotency key; duplicate submissions return the same operation. */
  clientOpId: z.string().min(8).max(64),
}).refine((v) => !!v.choiceId !== !!v.customAction, { message: 'exactly one of choiceId or customAction' });
export type ChooseRequest = z.infer<typeof ChooseRequest>;
export const ChooseResponse = z.object({ operationId: Id, nodeId: Id, deduplicated: z.boolean() });
export type ChooseResponse = z.infer<typeof ChooseResponse>;

export const CursorRequest = z.object({ nodeId: Id });
export const RetryArtRequest = z.object({ stage: z.enum(['preview', 'final']) });
export const ReviseRequest = z.object({ clientOpId: z.string().min(8).max(64) });
export const ExportRequest = z.object({ endNodeId: Id.optional(), allowDraft: z.boolean().default(false) });
export const ExportResponse = z.object({ snapshot: ExportSnapshot, pdfUrl: z.string().nullable(), pendingPanelIds: z.array(Id) });
export type ExportResponse = z.infer<typeof ExportResponse>;

/** POST /api/setup/propose: idea sentence or picked ingredients -> four editable cards. */
export const ProposeSetupRequest = z.object({
  idea: z.string().trim().min(3).max(300).optional(),
  picks: StorySetup.partial().optional(),
  /** Cards the reader explicitly set; the proposer must keep them verbatim. */
  locked: z.array(SetupCardKey).default([]),
});
export type ProposeSetupRequest = z.infer<typeof ProposeSetupRequest>;
export const ProposeSetupResponse = z.object({ setup: StorySetup, source: z.enum(['anthropic', 'deck']) });
export type ProposeSetupResponse = z.infer<typeof ProposeSetupResponse>;
/** POST /api/setup/shuffle: replace one card, keeping the others. */
export const ShuffleCardRequest = z.object({ card: SetupCardKey, current: StorySetup.partial() });
export type ShuffleCardRequest = z.infer<typeof ShuffleCardRequest>;
/** GET /api/setup/decks: illustrated ingredient cards for "Help me invent one". */
export const DeckCard = z.object({ id: z.string(), title: z.string(), text: z.string(), sketchKey: z.string() });
export const SetupDecks = z.object({ hero: z.array(DeckCard), world: z.array(DeckCard), problem: z.array(DeckCard), mood: z.array(DeckCard) });
export type SetupDecks = z.infer<typeof SetupDecks>;
/** GET /api/setup/starts: prebuilt story starts for the picker. */
export const StoryStartCard = z.object({
  id: StoryStartId, title: z.string(), teaser: z.string(), firstChoices: z.array(z.string()), sketchKey: z.string(), requiresLive: z.boolean(),
  /** Authored four cards for prebuilt starts, so Step 2 is accurate without a model call. */
  setup: StorySetup.optional(),
});
export type StoryStartCard = z.infer<typeof StoryStartCard>;

/** GET /api/config: what the client may show. Never includes secrets. */
export const ClientConfig = z.object({
  liveAvailable: z.boolean(),
  liveSetupMessage: z.string().nullable(),
  storyModel: z.string(),
  previewModel: z.string(),
  finalModel: z.string(),
  generationMode: GenerationMode,
  motionPlayer: z.enum(['hyperframes', 'css-fallback']),
  budget: BudgetLedger,
  /** Which adapters a Live run would use right now. Web shows 'Hybrid' when story is fixture but image is runware. */
  liveProviders: z.object({ story: z.enum(['anthropic', 'fixture']), image: z.enum(['runware', 'fixture', 'svg']) }).optional(),
});
export type ClientConfig = z.infer<typeof ClientConfig>;

export const Metrics = z.object({
  storyReadyMs: z.array(z.number()),
  previewReadyMs: z.array(z.number()),
  finalReadyMs: z.array(z.number()),
  retryCount: z.number().int(),
  cacheReadTokens: z.number().int(),
  cacheWriteTokens: z.number().int(),
  uncachedInputTokens: z.number().int(),
  costPerBeatUsd: z.array(z.number()),
});
export type Metrics = z.infer<typeof Metrics>;

/**
 * Routes:
 *  GET  /api/config                        -> ClientConfig
 *  GET  /api/setup/starts                  -> StoryStartCard[]
 *  GET  /api/setup/decks                   -> SetupDecks
 *  POST /api/setup/propose                 ProposeSetupRequest -> ProposeSetupResponse
 *  POST /api/setup/shuffle                 ShuffleCardRequest -> ProposeSetupResponse
 *  GET  /api/metrics                       -> Metrics
 *  GET  /api/runs                          -> Run[] (archive, owner session via header x-inkverse-session)
 *  POST /api/runs                          CreateRunRequest -> RunBundle (root node committed synchronously from the authored opening)
 *  GET  /api/runs/:runId                   -> RunBundle
 *  POST /api/runs/:runId/choose            ChooseRequest -> ChooseResponse (202)
 *  GET  /api/runs/:runId/events            SSE stream of AppEvent (text/event-stream); client re-fetches bundle on connect
 *  POST /api/runs/:runId/cursor            CursorRequest -> Run
 *  POST /api/runs/:runId/nodes/:nodeId/revise  ReviseRequest -> ChooseResponse
 *  POST /api/runs/:runId/nodes/:nodeId/panels/:panelId/retry  RetryArtRequest -> GenerationJob
 *  POST /api/runs/:runId/export            ExportRequest -> ExportResponse
 *  POST /api/assets/upload                 multipart 'file' (image/jpeg|png, <=6MB) -> Asset
 *  GET  /assets/:file                      static, durable assets
 */
