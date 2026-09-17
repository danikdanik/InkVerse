/**
 * Stage A sketch source. Sketches ship with the content package (EPISODE.sketches),
 * imported lazily so the web build never hard-depends on it. Anything missing falls
 * back to a neutral generic motif. All SVGs use viewBox 0 0 160 90, currentColor for
 * ink and var(--accent) for accent.
 */

export const GENERIC_SKETCH = `<svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
  <rect width="160" height="90" fill="var(--paper, #f4efe4)"/>
  <g fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.55">
    <rect x="10" y="10" width="140" height="70" rx="3"/>
    <path d="M10 58 L52 34 L88 52 L118 28 L150 46"/>
    <circle cx="118" cy="30" r="10" stroke="var(--accent, #2bb3c0)" stroke-width="2"/>
  </g>
  <g fill="currentColor" opacity="0.25">
    <circle cx="34" cy="66" r="2"/><circle cx="70" cy="70" r="2"/><circle cx="108" cy="64" r="2"/>
  </g>
</svg>`;

let cache: Record<string, string> | null = null;

/** Lazily load the authored sketch library. Never throws; returns {} on any failure. */
export async function loadSketches(): Promise<Record<string, string>> {
  if (cache) return cache;
  try {
    const mod: any = await import('@content/episode');
    cache = (mod?.EPISODE?.sketches as Record<string, string>) ?? {};
  } catch {
    cache = {};
  }
  return cache;
}

export function sketchFor(sketches: Record<string, string> | null, key?: string | null): string {
  if (sketches && key && sketches[key]) return sketches[key];
  return GENERIC_SKETCH;
}
