# INKVERSE provider adapters

Adapters behind `src/server/providers/types.ts`. Server core depends only on those
interfaces. Two live providers: Anthropic (story director) and Runware (images).

No key values are ever logged. Keys load from `.env` in the server/scripts only.

## Story director: Anthropic

- File: `src/server/providers/anthropic.ts`, factory `createAnthropicStoryProvider(config)`.
- SDK: `@anthropic-ai/sdk` v0.126.0.
- Model id: `claude-fable-5-1` (configured Fable 5.1 id for this account). Override
  with `INKVERSE_STORY_MODEL`. Fallback constant `claude-opus-4-8`
  (`INKVERSE_STORY_MODEL_FALLBACK`).
- Method: `client.beta.messages.create(...)`.
- Structured output (VERIFIED in the installed SDK `.d.ts`): `output_config.format =
  { type: 'json_schema', schema }`. The legacy top-level `output_format` is marked
  deprecated in favor of `output_config.format`; we use the new field.
- Effort (VERIFIED): `output_config.effort` accepts `'low' | 'medium' | 'high' |
  'xhigh' | 'max'`. Our `Effort` (`low|medium|high`) is a subset, so it passes
  through directly.
- Prompt caching (VERIFIED): the system prefix is a single text block with
  `cache_control: { type: 'ephemeral' }`.
- Schema: generated from the Zod `StoryResponse` with `z.toJSONSchema(..., { target:
  'draft-2020-12', io: 'output', reused: 'inline' })`, then `default` keys are
  stripped. The server still validates the parsed JSON with Zod regardless.
- Vision: `describeReaderPhoto` uses a base64 `image` content block and asks for a
  ~60-word canonical description (hair, skin tone, glasses, clothing colors, build),
  no names.
- Key resolution: the factory takes `config.apiKey`; when omitted it falls back to
  `ANTHROPIC_API_KEY`, then `FABLE_5_1_KEY` (the user stores the key under that name).
  `resolveAnthropicKey(explicit?)` is exported for callers/probe.

### proposeSetup (low effort)

`proposeSetup(input)` returns `{ setup, usage, latencyMs }`. Structured output against
`StorySetup { hero, world, problem, mood }`, one vivid sentence per card, original and
age-appropriate. `locked` cards are returned verbatim; `shuffleOnly` changes only that
one card. Idea/picks are placed in the user message as data, not instructions. One
bounded repair attempt if the parsed JSON fails `StorySetup` validation.

### outlineEpisode (high effort)

`outlineEpisode(input)` returns `{ bible, opening, initialState, usage, latencyMs,
model }`. One call, structured output against a combined schema
`{ bible: StoryBible, initialState: StoryState, opening: StoryResponse }` (all three
JSON schemas embedded). Prompt rules: protagonist id `hero` named
`input.protagonistName` with 6-10 fixedTraits held identical every panel; 2-4 supporting
characters; 4-6 world rules; a 6-beat episodeArc (setup, discovery, discovery,
complication, complication, payoff); `initialState.inventory` keyed by item id with
holder `hero`; opening beat is `opening-trio` with 3 panels (establishing, key detail,
decision) and hotspots on the relevant objects; when `startCard.firstChoices` is given,
the two opening choices are exactly those in order; reader-cast written into the bible;
no lettering in sceneBriefs. One bounded repair attempt if the result lacks the three
top-level keys. Server still issues ids and validates with Zod.

### Prompt trust boundary (enforced in code + tested)

- System prefix = immutable bible JSON + finish-style rules + layout ids + motion
  presets + the `StoryResponse` schema + the verbatim runtime instruction. It depends
  ONLY on the bible, so it is byte-identical across different reader actions (keeps
  the ephemeral cache warm). Test asserts this.
- User message = JSON with `authoritativeState, pathSummary, recentBeats, readerCast,
  action, constraints`. Reader free text appears ONLY in `action.customText`. Test
  asserts the reader phrase never appears in the system prefix.
- One bounded repair: pass `opts.repairHint`; it is appended as `repairInstruction`
  in the user message and `repaired` is set true. No internal retry loop.

## Images: Runware

- File: `src/server/providers/runware.ts`, factory `createRunwareImageProvider(config)`.
- SDK: `@runware/sdk-js` v1.3.2, method `imageInference(params)`. We use the SDK (not
  raw REST) because it cleanly exposes every field we need: `referenceImages`,
  `includeCost`, `seed`, `steps`, `base64Data` output, and `customTaskUUID`.
- Output: `outputType: 'base64Data'`, `outputFormat: 'PNG'` -> decoded straight to a
  Buffer (no second network hop). Falls back to `imageDataURI` / `imageURL` fetch.
- Cost: `includeCost: true`; `ImageResult.costUsd` comes from the response `cost`
  field, else `null` (never 0).
- Timeout: `AbortSignal` + a race timeout. On an ambiguous timeout/abort we call
  `getResponse({ taskType, taskUUID })` with the request's `customTaskUUID` to recover
  a completed task and avoid a duplicate charge before the caller retries.
  `lookupTask(providerTaskId)` exposes the same recovery to the caller.
- Reference images: attached ONLY when the model's capability record allows them
  (gpt-image), read from disk and passed as data URIs, capped at `maxReferenceImages`.

## Models and capabilities (`registry.ts`)

| Role | Model id (AIR) | Verified? | Sizes | Ref images | Seed | Quality tiers |
|---|---|---|---|---|---|---|
| Final (default) | `openai:gpt-image@2.5-flare` | VERIFIED (flare doc) | 16-3840, area 0.66-8.29MP, aspect 1:3..3:1 | yes, 1-16 | no | auto/max/xhigh/high/medium/low |
| Final (alt) | `openai:gpt-image@2.5-sunburst` | id uses `@` form for consistency; sunburst doc page rendered it as `openai:gpt-image-2.5-sunburst` (ASSUMED/verify) | same family | yes | no | same |
| Preview | `runware:400@4` (FLUX.2 klein 4B) | VERIFIED (klein doc) | 128-2048, 16px steps | no | yes | n/a |
| Preview (alt) | `runware:100@1` (FLUX.1 schnell) | ASSUMED (schnell AIR not shown on fetched docs; classic Runware id) | ~512, 64px steps | no | yes | n/a |

Env overrides: `INKVERSE_FINAL_MODEL`, `INKVERSE_FINAL_MODEL_ALT`,
`INKVERSE_PREVIEW_MODEL`.

- `pickSize(model, aspect)`: nearest supported size, snapped to the model's dimension
  grid (16px for gpt-image/klein, 64px for schnell). Finals target a 1536 long edge,
  previews a 512 long edge.
- `sendOnlyAccepted(model, params)`: drops params the model does not accept - `seed`,
  `negativePrompt`, `referenceImages` per capability; `settings`/`quality` for FLUX;
  `steps`/`CFGScale`/`scheduler` for gpt-image.

## Pricing (`pricing.ts`, USD, null where unknown)

| Model | Estimate | Source |
|---|---|---|
| gpt-image flare | ~$0.04 | Token-billed ($5/$8/$30 per Mtok in/img-in/img-out); doc examples ~$0.023-$0.047/gen. Estimate for medium quality at 1024-1536. |
| gpt-image sunburst | ~$0.06 | Doc examples ~$0.054-$0.167/gen. |
| FLUX.2 klein 4B | $0.0006 | Klein doc: "$0.0006" per generation at 1024x1024. |
| FLUX.1 schnell | $0.0006 | ASSUMED low-cost tier; not confirmed on fetched page. |

Story (Anthropic) cost is `null` unless operator sets rates via
`INKVERSE_STORY_IN_PER_MTOK` / `INKVERSE_STORY_OUT_PER_MTOK` (optional cache-read /
cache-write per-Mtok overrides). Unknown is reported as `null`, never 0.

## Quality parameter caveat (ASSUMED)

gpt-image quality is sent as `settings.quality` (per the task brief and doc quality
tiers), passed through the SDK's passthrough. This exact path is not confirmed in the
SDK `.d.ts` (which has no typed `settings` on the image request) - verify with a live
probe. Default quality: `medium` for final, `low` for preview-quality finals.

Reference-image passing: gpt-image docs describe `inputs.referenceImages`; the SDK
exposes a top-level `referenceImages: string[]`. We use the SDK field and trust it to
format the request. Verify with the probe.

## Scripts

- `npm run probe` - `scripts/probe-providers.ts`. Reports key presence (names only),
  runs one FLUX schnell preview, one FLUX.2 klein preview, one gpt-image flare final
  (low quality, small), and one minimal Anthropic director call; writes
  `docs/PROBE-RESULTS.md`. The sandbox blocks agents from reading `.env`, so a human
  must run it: `npm run probe`.
- `npm run fixtures:art` - `scripts/generate-fixture-art.ts`. Generates preview+final
  PNGs for every panel of `@content/episode` plus the protagonist reference sheet
  (`src/content/art/neri-reference.png`), which is attached as a reference to every
  final. Flags: `--only=<beatKey>`, `--stage=preview|final`, `--limit=N`,
  `--max-usd=8`. Prints an estimated total before running and stops when the running
  spend exceeds the budget. Needs `RUNWARE_API_KEY`; exits clearly if `@content/episode`
  is missing.

## Known limitations

- gpt-image `settings.quality` and reference-image field path are assumed from docs,
  not confirmed in the SDK types. Confirm with `npm run probe`.
- The sunburst and FLUX.1 schnell AIR ids are not fully confirmed; both are env
  overridable.
- Anthropic structured-output schema is generated from Zod; if the service rejects a
  keyword, the server-side Zod validation still guards correctness. Tune the schema
  or fall back to prompt-only if a live call rejects it.
- Story per-call cost is null unless rates are configured via env.
