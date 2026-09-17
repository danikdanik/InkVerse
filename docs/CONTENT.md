# Demo episode content: Issue #1, The Citadel of Time and Space

The fully authored demo episode lives in `src/content/episode.ts` as `EPISODE: FixtureEpisode`.
In demo mode the server replays these beats through the same worker, job, and event path as a live
run, so every `beat.response` is exactly the shape Fable would return.

Protagonist: Neri, a cartographer. She reaches a citadel suspended between two timelines that
disagree by one day. Her compass points at a sealed door; the guardian insists the door was opened
tomorrow. Neri must find why the timelines are separating and decide which connection to repair.

## Beat graph

```
root  (opening-trio, 3 panels; choices: gate, guardian; custom: /hold.*compass|.../)
|
|-- [gate] ------ gate-1 --g1-next--> gate-2 --g2-next--> gate-3 --g3-next--> gate-4
|                 (archive clue)                                              |
|                 addFacts: page "lost tomorrow"          g4-future (*fact)--+--> ending-repair-future
|                                                         g4-sever ----------+--> ending-sever
|
|-- [guardian] -- guardian-1 --gd1-next--> guardian-2 --gd2-next--> guardian-3 --gd3-next--> guardian-4
|                 (trust +1, listens)      (trust +1)                                        |
|                 fact: visitor wore teal scarf = Neri                    gd4-past (#trust>=1)+--> ending-repair-past
|
`-- (custom) ---- custom-compass-1 --cc-back--> custom-compass-2
                  hands compass to guardian; needle splits; exists in both timelines

Legend:  *fact  = choice requires the archived "lost tomorrow" fact
         #trust = choice requires guardian trust >= 1
```

14 beats, 16 panels total. Every non-root, non-custom beat is reached by a choice id that exists in
its parent's `choices`. Both route endings and the optional sever ending are reachable from `root`
by following `via` edges (asserted by the validator).

## The two routes and how knowledge matters

- Gate route (repair the future): Neri crosses the cosmic gate into the floating archive, learns a
  page of her own map is recorded as "lost tomorrow", follows the tear to the seam, and at `gate-4`
  can only choose "Repair the future" if she carries that archived fact. Otherwise she can sever.
- Guardian route (repair the past): Neri stays and listens; the guardian's trust rises (+1 at
  `guardian-1`, +1 at `guardian-2`). It reveals the tomorrow-visitor wore Neri's teal scarf and was
  Neri herself. The citadel is forgetting her. At `guardian-4`, entrusting a memory to make the
  citadel remember her ("Repair the past") requires guardian trust >= 1, which only listening earns.

So a route's discovered knowledge (archive fact vs guardian trust) gates the beat-4 payoff choice on
that route. This is enforced through each choice's `requires` (facts or `minTrust`).

## Endings

- `ending-repair-future` (kind `repair-future`): the archived page closes the seam; the skies rejoin.
- `ending-repair-past` (kind `repair-past`): the guardian keeps Neri's memory; the door opens.
- `ending-sever` (kind `sever`): the timelines are cut apart; the citadel drifts free.

Each ending is `ending-splash`, one panel, `sketchKey: 'ending'`, no choices, with a title, an
epilogue (<= 400 chars), and a next-issue hook.

## Custom action demo

`custom-compass-1` fires when the reader types anything matching
`/hold.*compass|compass.*hold|give.*compass|hand.*compass/i`
(for example "ask the guardian to hold the compass"). Its `stateDelta.inventoryChanges` moves the
compass to the guardian; the panel shows the compass in the guardian's stone hand while Neri reads
her map, and the needle splits because the object now exists in both timelines. `custom-compass-2`
follows when the reader asks for it back.

Any custom action with no authored match goes through `fallbackCustom(parent, state, text)`, which
quotes the reader ("Neri tries to <text>..."), keeps them at the parent's location with a small
sanitized consequence, and offers two dead-end choices `return-a` / `return-b` on a `single-splash`.

## Art provenance (important)

Every panel has two files under `src/content/art/`, named `<beatKey>-<panelId>-preview.svg` and
`<beatKey>-<panelId>-final.svg` (preview 512px long edge, final 1280px long edge). These are honest
placeholders: composed inkline-style SVG illustrations (paper ground, bold black contours, flat cel
color from the panel's palette, halftone via a reused pattern, the citadel/gate/guardian/compass
motifs and a stylized Neri in mustard jacket and teal scarf). They are NOT model renders.

They are generated deterministically from the episode data by `scripts/build-art.ts`
(`node --import tsx/esm scripts/build-art.ts`). The providers agent's render script replaces every
file with real FLUX (preview) and GPT Image (final) output; the filenames and aspect ratios are the
contract it renders into. The Stage A `sketches` map in `episode.ts` holds the immediate local SVG
motifs (viewBox `0 0 160 90`, `currentColor` ink, `var(--accent)` accent) shown before art arrives.

## Story picker: starts, decks, composer (src/content/decks.ts)

- `STORY_STARTS: StoryStartCard[]` (from `@shared/api`): the four prebuilt starts shown in the
  picker. `citadel` (`requiresLive: false`) replays this authored demo; `shadow-strike`,
  `ten-minute-powers`, and `custom` need Live mode so Fable outlines a fresh episode.
- `DECKS: SetupDecks`: eight illustrated ingredient cards each for `hero`, `world`, `problem`,
  `mood` (the "help me invent one" flow). Each card is `{ id, title, text, sketchKey }`.
- `DECK_ART: Record<string, string>`: one small single-color SVG icon (viewBox `0 0 160 90`,
  `currentColor`, under 1KB) per `sketchKey` used by the starts and decks (including `shadow` and
  `bolt`). Icons are reused across thematically similar cards.
- `composeSetupFromDeck({ picks?, locked, shuffleOnly?, seed? })`: deterministic from `seed`
  (default `Date.now()`). Keeps provided `picks` and any `locked` cards verbatim, fills the rest
  from the decks, and when `shuffleOnly` is set re-rolls only that card to a different deck entry
  (a lock on that card still wins).

## Contract notes for other agents

- `EPISODE` uses `styleId: 'clear-line'` with `styleRules` sourced from `STYLES['clear-line'].rules`
  in `src/shared/styles.ts` (the canonical finish table).
- One additive line was added to `src/shared/schemas.ts`: `export type SketchKey = ...`, because
  `src/content/types.ts` uses `SketchKey` as a type. No Zod shape changed.

## Validation

`scripts/validate-episode.ts` (run standalone with `node --import tsx/esm scripts/validate-episode.ts`,
or imported by `tests/content.test.ts`) checks: every `beat.response` parses against `StoryResponse`;
bible and initial state parse; each `choice.hotspot.panelId` exists in its beat; `parentKey`
references resolve; each choice-via beat's `choiceId` exists in the parent's choices; every panel's
preview and final art files exist on disk; each bubble rect intersects a text-safe area; bubble word
counts and the root narration word count are within limits; both endings (and sever) are reachable
from root; the custom compass beat moves the compass to the guardian; and `fallbackCustom` returns a
valid response. `npm test` runs the vitest suite.
