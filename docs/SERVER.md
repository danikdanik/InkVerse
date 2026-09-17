# INKVERSE server core

The server owns trust: Fable proposes a `StoryResponse`, the server validates it with Zod, checks
choice requirements against owned inventory, applies the `StateDelta` field by field, issues every
id, commits the node once, then enqueues image jobs. Keys stay server-side and never reach the
client.

## How to run

- `npm run dev` starts Fastify (:8787) and Vite (:5173, proxies /api and /assets).
- `npm run dev:server` runs the server alone (tsx watch).
- `npm start` runs in production (`NODE_ENV=production`); if `dist/web` exists it is served with an
  SPA fallback.
- `npm test` runs the vitest suite. Server tests build the app in memory with
  `buildServer({ inMemory: true })` and drive it with `fastify.inject`.

Config comes from `.env` (dotenv). Notable vars, all optional with sane defaults:
`PORT`, `INKVERSE_STORY_MODEL`, `INKVERSE_PREVIEW_MODEL`, `INKVERSE_FINAL_MODEL`,
`INKVERSE_CAP_ANTHROPIC_USD`, `INKVERSE_CAP_RUNWARE_USD`, `INKVERSE_CAP_PER_RUN_USD`,
`INKVERSE_IMAGE_CONCURRENCY`, `INKVERSE_AUTO_RETRY_LIMIT`, `INKVERSE_GENERATION_MODE`,
`INKVERSE_FIXTURE_DELAY_MS` (preview replay delay, default 1200),
`INKVERSE_FIXTURE_FINAL_DELAY_MS` (default 3200), `ANTHROPIC_API_KEY`, `RUNWARE_API_KEY`.
Fixture delays are forced to 0 under tests so the queue drains synchronously.

## Modes and providers

- `demo`: replays the authored episode (`@content/episode`) through the fixture providers.
- `live`: story via Claude when `ANTHROPIC_API_KEY` is set, artwork via Runware when
  `RUNWARE_API_KEY` is set. Missing either falls back to fixtures for that half and the run is
  labelled `hybrid`. Live adapters are imported dynamically inside try/catch, so a missing or
  broken adapter can never stop the server from booting.

## Routes

| Method | Path | Body -> result |
| --- | --- | --- |
| GET | /api/health | liveness |
| GET | /api/config | ClientConfig (never secret values; includes liveProviders + motionPlayer) |
| GET | /api/metrics | Metrics |
| GET | /api/setup/starts | StoryStartCard[] (prebuilt starts) |
| GET | /api/setup/decks | SetupDecks (ingredient cards) |
| POST | /api/setup/propose | ProposeSetupRequest -> ProposeSetupResponse (locked cards kept verbatim) |
| POST | /api/setup/shuffle | ShuffleCardRequest -> ProposeSetupResponse (one card changes) |
| GET | /api/runs | Run[] for the session |
| POST | /api/runs | CreateRunRequest -> RunBundle (201). startId 'citadel' replays EPISODE; other starts need Live mode + outlineEpisode, else 400 live_required |
| GET | /api/runs/:runId | RunBundle |
| POST | /api/runs/:runId/choose | ChooseRequest -> ChooseResponse (202) |
| POST | /api/runs/:runId/nodes/:nodeId/retry-story | -> ChooseResponse (202) |
| POST | /api/runs/:runId/nodes/:nodeId/revise | ReviseRequest -> ChooseResponse (202) |
| POST | /api/runs/:runId/nodes/:nodeId/panels/:panelId/retry | RetryArtRequest -> GenerationJob |
| POST | /api/runs/:runId/cursor | CursorRequest -> Run |
| POST | /api/runs/:runId/export | ExportRequest -> ExportResponse (409 if pending and not allowDraft) |
| POST | /api/assets/upload | multipart `file` (image/jpeg|png, <= 6MB) -> Asset |
| GET | /api/runs/:runId/events | SSE stream of AppEvent |
| GET | /assets/:file | durable asset bytes, long cache |

Session: every run route requires the `x-inkverse-session` header (400 if missing). Runs are owned
by the session; a mismatch is 404. The SSE route also accepts `?session=` because `EventSource`
cannot set headers.

## Events (SSE)

Each frame is `event: <type>\ndata: <JSON of the AppEvent>\n\n`. Types and payloads exactly match
`AppEvent` in `src/shared/schemas.ts`:

- `choice.accepted` { operationId, runId, parentNodeId, nodeId, sketchKey }
- `story.ready` { operationId, runId, nodeId }
- `story.failed` { operationId, runId, nodeId, error, retryable }
- `panel.preview.ready` / `panel.final.ready` { runId, nodeId, panelId, jobId, assetId, requestVersion }
- `panel.art.failed` { runId, nodeId, panelId, jobId, stage, error, requestVersion }
- `budget.updated` { runId, budget }
- `cursor.moved` { runId, nodeId }

The client re-fetches the bundle on connect, then applies events. Stale `requestVersion` values are
ignored for the active panel but still stored on their node.

## Worker

In-process queue, concurrency `INKVERSE_IMAGE_CONCURRENCY`, visible (active-node) jobs first.

- Story job: run the director, commit the node once in a transaction (state, panels, choices,
  ending, storyStatus ready, fixtureKey), emit `story.ready`, then enqueue image jobs per panel.
  Failure marks the node failed and leaves the parent untouched.
- Image job: idempotencyKey = sha256(nodeId, panelId, stage, requestVersion). `parallel` enqueues
  preview and final together; `reference_refine` runs final after preview succeeds, adding the
  preview path as a reference. Each job reserves budget, calls the provider, writes bytes to
  `data/assets/<assetId>.<ext>`, inserts an Asset, marks the job succeeded, emits the ready event.
  On failure it emits `panel.art.failed` and auto-retries up to the configured limit.

## Budget

Per-provider ledger (anthropic, runware): `available = cap - actual - reserved`. `reserve()` before
dispatch throws `budget_exhausted` when nothing is available (the job fails, the story stays
readable). `reconcile()` books actual spend; an unknown cost increments `unknownCount` and is never
silently counted as $0. Image spend maps to the runware ledger; live story spend to anthropic.

## Tables (SQLite via node:sqlite)

Complex records are stored as JSON columns and re-validated with Zod on read; migrations are
idempotent.

- `runs` (id, owner_session, created_at, data)
- `bibles` (id, version, data)
- `nodes` (id, run_id, parent_id, created_at, data)
- `jobs` (id, run_id, node_id, panel_id, stage, status, idempotency_key UNIQUE, created_at, data)
- `assets` (id, run_id, node_id, panel_id, stage, created_at, data)
- `operations` (run_id, client_op_id, operation_id, node_id) with UNIQUE(run_id, client_op_id)
- `metrics` (id, run_id, kind, value, cache_read, cache_write, uncached_input)

## State and validation

- `applyDelta` is allowlisted: only `StateDelta` fields move the world forward. Inventory holders
  must be a known character id or `nobody`/`lost`; trust is clamped -3..3; facts are deduped;
  beatIndex increments; summary is replaced by `summaryUpdate`.
- `stateHash` is sha256 of canonical (sorted-key) JSON; used for optimistic concurrency.
- Business validation: 1-3 panels (later beats 1-2), non-ending nodes 2-3 choices, ending nodes 0,
  every hotspot panel exists, no choice requires an unowned item, each bubble intersects a
  text-safe area by >= 50% of its area, <= 35 bubble words per panel, bubbles do not overlap.
