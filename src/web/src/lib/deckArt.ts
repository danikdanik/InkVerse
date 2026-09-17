/**
 * Illustrated icons for setup cards/decks. Prefer the authored sketch library (EPISODE.sketches),
 * then the deck art pack (@content/decks DECK_ART), then the neutral generic sketch. Both content
 * imports are lazy so the web build never hard-depends on them.
 */
import { GENERIC_SKETCH, loadSketches } from './sketches';

let deckCache: Record<string, string> | null = null;

export async function loadDeckArt(): Promise<Record<string, string>> {
  if (deckCache) return deckCache;
  deckCache = {};
  // import.meta.glob resolves at build time: empty when @content/decks does not exist yet,
  // lazy-loads it when it does, so the web build never hard-depends on the content pack.
  try {
    const mods = import.meta.glob('../../../content/decks.ts') as Record<string, () => Promise<any>>;
    const loader = Object.values(mods)[0];
    if (loader) {
      const mod = await loader();
      deckCache = (mod?.DECK_ART as Record<string, string>) ?? {};
    }
  } catch {
    /* ignore: fall back to generic art */
  }
  return deckCache;
}

/** Resolve a sketchKey to an inline SVG string across both packs, with a generic fallback. */
export function iconFor(sketches: Record<string, string> | null, deckArt: Record<string, string> | null, key?: string | null): string {
  if (key && sketches && sketches[key]) return sketches[key];
  if (key && deckArt && deckArt[key]) return deckArt[key];
  return GENERIC_SKETCH;
}

/** Load both packs together. */
export async function loadAllArt(): Promise<{ sketches: Record<string, string>; deckArt: Record<string, string> }> {
  const [sketches, deckArt] = await Promise.all([loadSketches(), loadDeckArt()]);
  return { sketches, deckArt };
}
