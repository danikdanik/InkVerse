# INKVERSE architecture brief (read before coding)

Single package. `npm run dev` starts Fastify server (:8787) and Vite web (:5173, proxies /api,/assets).
Node 26: use built-in `node:sqlite` (`DatabaseSync`). No native builds. Dependencies are already installed; do not run `npm install` (use `npm_config_cache=/tmp/claude/npm-cache` if you truly must add one).

```
src/shared/     schemas.ts (Zod contract; do not change shapes without telling the orchestrator), api.ts (routes), layouts.ts, styles.ts
src/content/    episode fixtures: bible, opening, beats for both routes, custom-action demo beat, endings; sketch SVG library
src/server/     index.ts (Fastify), db.ts, routes/, worker.ts (in-process job queue), story/ (director prompt, validators, state apply), providers/ (anthropic.ts, runware.ts, fixture.ts), export/ (pdf.ts), budget.ts, events.ts
src/web/        Vite React app. src/main.tsx, App.tsx, components/, hooks/, motion/ (HyperFrames compositions + fallback)
tests/          vitest (node) tests for the risk list
data/           sqlite db + assets/ (durable copies of provider output)
```

Trust rules: Fable proposes `StoryResponse`; server validates with Zod, checks choice requirements against owned inventory, applies `StateDelta` field-by-field, issues all ids, commits the node once, then enqueues image jobs. Keys server-only (`.env` loaded by dotenv in the server only). Reader text goes in its own user-message field, never in the system prompt.

Modes: `run.mode = 'live' | 'demo'`. Demo replays `src/content` fixtures through the same worker/job/event interfaces (with a small artificial delay so the three-stage panel is visible, labelled as replay in the UI). Never present fixture playback as live. Live with a Runware key but no Anthropic key: story from fixtures, artwork live (label as "hybrid").

Artwork stages per panel: sketch (local SVG, immediate) -> preview (FLUX, ~512px) -> final (GPT Image 2.5). Client asset state only moves forward. Events carry `requestVersion`; stale versions are ignored for the active panel but still stored on their node.

Sandbox note for agents: shell commands cannot read `./.env`. Live provider probes must be run by the user (`! npm run probe`), or documented as unverified.
