# INKVERSE status (2026-09-17, end of 45-minute build)

Build: single package, Node 26, TypeScript, React 19, Vite 8, Tailwind 4, Zod 4, Fastify 5, `node:sqlite`, pdf-lib, resvg, @xyflow/react, @runware/sdk-js 1.3.2, @anthropic-ai/sdk 0.126.0, @hyperframes/player 0.8.46 (installed, not integrated).

Typecheck: 0 errors. Tests: 51 passing (server branching, content validation, provider builders, PDF export, SVG renderer).

## Feature status

| Feature | Status | Notes |
| --- | --- | --- |
| Cover, Begin Issue, Continue, My Issues | working | Cover art is the citadel sketch, not root panel art |
| Setup: story starts, "I have an idea", "Help me invent one", four editable cards, Surprise me, shuffle, lock | working (UI) / live-gated | Card proposals use Fable when an Anthropic key is present, a deterministic deck otherwise. Non-Citadel starts and custom ideas require Live mode |
| Four styles (Classic Pop, Manga, Clear-Line, Neon Arcade) | working | Style rules feed every image brief |
| Rendered Ink style (local SVG renderer) | working | 'inked-svg' draws preview/final panels locally from the PanelSpec, zero cost, no image model, works without RUNWARE_API_KEY |
| Camera cast, one or two people | working (upload path) | Photos become reader characters with reference images; vision description of the photo runs only in Live mode |
| Opening page, two preset paths, Try another approach | working | Custom compass action moves the compass to the guardian and records the possession |
| Fable story director, structured output, effort, prompt caching | working (verified live) | `client.beta.messages.create` with `output_config.format` json_schema and `output_config.effort`, cached system prefix. First live probe was rejected for `maxItems`; unsupported JSON Schema keywords are now stripped (Zod still enforces them). Re-run `npm run probe` |
| Runware FLUX preview + GPT Image 2.5 Flare final | working (verified live) | `runware:400@4` previews 1 to 6 s at $0.0006; `openai:gpt-image@2.5-flare` finals 13 to 24 s at $0.004 to $0.042 depending on size and quality. All six aspects render after the pixel-bound fix |
| Three-stage panel (sketch, preview, final), forward-only | working | Verified with fixture jobs. Preview and final never regress on out-of-order arrival |
| HyperFrames player | fallback | Six motion presets shipped as CSS templates with the same composition data. Dev drawer reports `css-fallback` |
| Reduced motion, offscreen pause | working | |
| Saved nodes, rewind, sibling isolation, dedupe | working | Tested |
| Story map (React Flow) + list history | working | |
| Revisions ("Try another version") | working | |
| Autosave, reload without regeneration | working | Tested |
| PDF export of the actual path, draft labelling | working | Abandoned branches excluded, blank panels refused. Standard fonts only |
| CBZ, speculative generation, image critique loop, animated recap | not implemented | Later phase |
| Budget ledger with reserved and unknown costs | working | Hard stop on exhaustion tested |
| Demo replay vs Live labelling | working | Hybrid label when story is fixture and art is Runware |

## Verified model ids

- Story: `claude-fable-5-1` (configurable, `INKVERSE_STORY_MODEL`)
- Preview: `runware:400@4` FLUX.2 klein 4B (verified on Runware model page); `runware:100@1` FLUX.1 schnell unverified
- Final: `openai:gpt-image@2.5-flare` (verified); `openai:gpt-image@2.5-sunburst` id form unverified

## Measurements

Local click-to-sketch is measured in the dev drawer. Live Runware measurements above come from one opening page (3 panels, parallel mode) generated at 2026-09-17 17:05 UTC: total spend $0.0255. Story generation was not measured live yet (schema fix applied after the first probe).

## Known limitations and defects

- Fixed: GPT Image 2.5 requires 655,360 to 8,294,400 total pixels; 16:9 finals at 1024x576 were rejected (`invalidPixels`). Sizes now scale into the bounds (16:9 final renders at 1104x624) and Runware error text is surfaced in job errors.
- Fixed: Anthropic structured output rejected our schema twice (unsupported `maxItems`, then 'compiled grammar too large'). Schema keywords are stripped and shared subschemas emitted as `$defs`; if the API still rejects the grammar the adapter falls back to JSON-only prompting with one repair, and Zod validates either way. Verified live: director OK in 20 s.
- Demo scope: setup opens Citadel-only (skips story-start and card steps) and defaults to Live when both keys exist. Set `VITE_CITADEL_ONLY=0` to show the full setup flow.
- Cover art: `src/web/public/covers/citadel-cover.png` is a GPT Image 2.5 render (1024x1536, $0.042) used as the default cover.
- Pre-rendered fixture art: `npm run fixtures:art` writes `<beat>-<panel>-<stage>.png` next to the authored SVGs and the worker prefers those PNGs in demo replay, so every authored page shows real Runware art without live calls.
- Budget ledger counted the Runware jobs as unknown cost even though actual cost was reported; reconcile should clear unknownCount.
- The 'Try another approach' pill can overlap the last choice pill on narrow panels.
- Env aliases accepted: ANTHROPIC_API_KEY or FABLE_5_1_KEY; RUNWARE_API_KEY or RUNWARE_KEY.

- Fixture artwork is placeholder SVG drawn in code. `npm run fixtures:art` regenerates it with real FLUX and GPT Image renders (spends Runware credit).
- HyperFrames player not integrated; CSS fallback carries the same composition parameters.
- Live mode was not exercised end to end in this session (no key access in the sandbox). Provider adapters follow the SDK and docs but need one probe run.
- Archive progress shows endings reached rather than beats read.
- Custom ideas and the two extra story starts run only in Live mode; demo replay covers the Citadel episode.
- Rendered Ink is a vector approximation of the scene plan (motif + palette + figure glyphs), not model-generated art; it won't match the other styles' painterly detail.

## Switching models and budgets

All via `.env`: `INKVERSE_STORY_MODEL`, `INKVERSE_PREVIEW_MODEL`, `INKVERSE_FINAL_MODEL`, `INKVERSE_FINAL_MODEL_ALT`, `INKVERSE_GENERATION_MODE`, `INKVERSE_BUDGET_*`, `INKVERSE_IMAGE_CONCURRENCY`, timeouts and retry limit. No code changes required.
