# INKVERSE web reader

React 19 + Vite + Tailwind v4 reader for the playable issue "The Citadel of Time and Space".
Owns `src/web/**` only. Aliases: `@shared/*`, `@content/*`. Palette is driven per style by
CSS vars (`--paper`, `--ink`, `--accent`) from `STYLES[styleId]`.

## Screens

- Cover (`components/Cover.tsx`): opens on the issue cover. "Begin Issue", plus "Continue"
  (most recent run for this session) and a small "My Issues" link. Cover art is a stylized SVG
  built from the citadel sketch (falls back cleanly when no run art is loaded).
- Setup (`components/Setup.tsx`): protagonist name (default Neri), tone, optional genre, style
  cards, Live/Demo toggle (Live disabled with the server's `liveSetupMessage` when
  `liveAvailable` is false), generation mode (parallel default), and "Add yourself to the comic".
- Camera (`components/CameraCapture.tsx`): `getUserMedia` video (facingMode user), capture to
  canvas, JPEG export at max 1024px long edge, retake, name field. Up to two cast members.
  Permission denial falls back to a file upload input. The camera track stops on unmount and
  after each capture. Each JPEG uploads via `POST /api/assets/upload`; ids go into `readerCast`.
- Reader (`components/Reader.tsx`, `Panel.tsx`): top bar (title, map, motion toggle, transcript,
  save/export, dev drawer, mode badge). Desktop renders a 12-column CSS grid from
  `LAYOUTS[layoutTemplate]`; mobile stacks panels in reading order. Each panel keeps a fixed
  aspect from its slot so nothing shifts while art loads. Panels are forward-only three stages:
  sketch SVG, then preview, then final (decoded with `img.decode()` before a ~450ms
  cross-dissolve). Bubbles and choice hotspots sit in HTML/SVG layers above the moving image,
  positioned through one shared CONTAIN transform (letterbox, never crop). A compact text-choice
  list is always rendered for assistive tech. "Try another approach" opens a 3-200 char custom
  action input. Ending nodes show an ending card with export. Transcript toggle reads narration,
  bubbles and alt text (labelled "described from scene plan" when altText is unverified).
- Story map (`components/StoryMap.tsx`): `@xyflow/react` graph, root at top, active path
  highlighted, node inspector with "Continue from here" (`POST cursor`), plus a keyboard list.
- Dev drawer (`components/DevDrawer.tsx`): config, budget ledger, jobs for the active node,
  metrics, measured click-to-sketch ms, SSE state, and the active motion player.
- Archive (`components/Archive.tsx`): "My Issues" list of saved runs.
- Export (`components/ExportDialog.tsx`): `POST export`; on 409 offers wait-for-final or draft.

## State

- `hooks/useSession.ts`: durable `x-inkverse-session` id in localStorage.
- `hooks/useRun.ts`: fetches the RunBundle, connects `EventSource`, refetches the bundle on
  connect and on data-changing events, and keeps a per-panel best stage that only moves forward
  and ignores stale `requestVersion`s. Choice submit uses a `crypto.randomUUID()` clientOpId with
  an optimistic pending child; buttons disable while pending so a double-click cannot duplicate.

## Motion player status

Active player: css-fallback (`MOTION_PLAYER = 'css-fallback'`, shown in the dev drawer).

We read the `@hyperframes/player` README and its `.d.ts`. The player is a web component that
loads a composition HTML into a sandboxed iframe via a `src` URL (a blob URL is possible) and
auto-detects size and duration. The blocker: the composition-runtime readiness contract (what a
valid composition HTML must expose so the player reports ready and plays) is not documented in
the shipped package, and verifying an image-plus-CSS composition in a real browser was not
feasible in the build timebox. Rather than ship a player that might render an empty frame, the
six trusted templates (portal, drifting_dust, rain, energy_pulse, slow_push, still) run as a
CSS fallback in `motion/`. Only numbers and enums from `MotionParams` reach the DOM; particle
fields are deterministic from the seed. Motion pauses offscreen (IntersectionObserver), stops on
unmount, and honors prefers-reduced-motion. Motion runs on the preview stage and settles when
final art arrives unless the ambient toggle is on.
