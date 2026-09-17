# INKVERSE status (2026-09-17, end of 45-minute build)

Build: single package, Node 26, TypeScript, React 19, Vite 8, Tailwind 4, Zod 4, Fastify 5, `node:sqlite`, pdf-lib, resvg, @xyflow/react, @runware/sdk-js 1.3.2, @anthropic-ai/sdk 0.126.0, @hyperframes/player 0.8.46 (installed, not integrated).

Typecheck: 0 errors. Tests: 33 passing (server branching, content validation, provider builders, PDF export).

## Feature status

| Feature | Status | Notes |
| --- | --- | --- |
| Cover, Begin Issue, Continue, My Issues | working | Cover art is the citadel sketch, not root panel art |
| Setup: story starts, "I have an idea", "Help me invent one", four editable cards, Surprise me, shuffle, lock | working (UI) / live-gated | Card proposals use Fable when an Anthropic key is present, a deterministic deck otherwise. Non-Citadel starts and custom ideas require Live mode |
| Four styles (Classic Pop, Manga, Clear-Line, Neon Arcade) | working | Style rules feed every image brief |
| Camera cast, one or two people | working (upload path) | Photos become reader characters with reference images; vision description of the photo runs only in Live mode |
| Opening page, two preset paths, Try another approach | working | Custom compass action moves the compass to the guardian and records the possession |
| Fable story director, structured output, effort, prompt caching | working (unverified live) | `client.beta.messages.create` with `output_config.format` json_schema and `output_config.effort`, cached system prefix. Not exercised with a real key inside the sandbox |
| Runware FLUX preview + GPT Image 2.5 Flare final | working (unverified live) | `runware:400@4` preview, `openai:gpt-image@2.5-flare` final, reference images, cost capture. Run `npm run probe` to verify |
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

Local click-to-sketch is measured in the dev drawer. Cloud latency and cost were not measured in this session: the sandbox cannot read `.env`. Run `npm run probe` with your keys; it writes `docs/PROBE-RESULTS.md`.

## Known limitations and defects

- Fixture artwork is placeholder SVG drawn in code. `npm run fixtures:art` regenerates it with real FLUX and GPT Image renders (spends Runware credit).
- HyperFrames player not integrated; CSS fallback carries the same composition parameters.
- Live mode was not exercised end to end in this session (no key access in the sandbox). Provider adapters follow the SDK and docs but need one probe run.
- Archive progress shows endings reached rather than beats read.
- Custom ideas and the two extra story starts run only in Live mode; demo replay covers the Citadel episode.

## Switching models and budgets

All via `.env`: `INKVERSE_STORY_MODEL`, `INKVERSE_PREVIEW_MODEL`, `INKVERSE_FINAL_MODEL`, `INKVERSE_FINAL_MODEL_ALT`, `INKVERSE_GENERATION_MODE`, `INKVERSE_BUDGET_*`, `INKVERSE_IMAGE_CONCURRENCY`, timeouts and retry limit. No code changes required.
