# INKVERSE

A playable digital comic in the browser. Every choice changes the next panel: an immediate local sketch, then a moving FLUX preview, then finished GPT Image 2.5 artwork. Rewind keeps every path. Export the issue you actually read as a PDF.

Launch episode: **Issue #1: The Citadel of Time and Space**, starring Neri, a cartographer at a citadel suspended between two timelines that disagree by one day.

## Quick start

```bash
npm install            # already done in this checkout
cp .env.example .env   # add RUNWARE_API_KEY and ANTHROPIC_API_KEY for Live mode
npm run dev            # server :8787 + web :5173
open http://localhost:5173
```

Without keys the app runs in **Demo replay** (authored fixtures through the same job pipeline, labelled as replay). With only `RUNWARE_API_KEY` set, story beats come from fixtures and artwork is generated live (labelled **Hybrid**). With both keys, **Live** uses Fable 5.1 as story director and Runware for art.

Other commands:

```bash
npm test               # vitest: branching, dedupe, stale jobs, reload, budget, export path isolation
npm run typecheck
npm run probe          # measures provider latency and cost with your keys; writes docs/PROBE-RESULTS.md
npm run fixtures:art   # regenerates fixture artwork with real FLUX / GPT Image renders (spends Runware credit)
```

## Configuration

All provider keys and models live in `.env` (server only, never bundled). See `.env.example` for model ids, per-provider and per-run budget caps, concurrency, timeouts and the `parallel` vs `reference_refine` generation mode. Switching models or budgets is an env change, not a code change. Details: `docs/PROVIDERS.md`.

## Documentation

- `docs/ARCHITECTURE.md` layout, trust rules, modes
- `docs/SERVER.md` routes, tables, events
- `docs/WEB.md` screens and motion player status
- `docs/CONTENT.md` episode graph and art provenance
- `docs/EXPORT.md` PDF export
- `docs/STATUS.md` feature status table, verified model ids, measurements, known defects
