import type { StyleId } from './schemas';
/** Four selectable finishes. The drawing language stays stable; finish and accent palette vary. */
export interface StylePreset { id: StyleId; name: string; blurb: string; fit: string; rules: string[]; accent: string; paper: string; ink: string }
export const STYLES: Record<StyleId, StylePreset> = {
  'classic-pop': {
    id: 'classic-pop', name: 'Classic Pop Comic', fit: 'Funny action and superpowers',
    blurb: 'Thick black outlines, bright primary colors, halftone dots, angular panels, oversized sound effects.',
    accent: '#ffd400', paper: '#f6f1e3', ink: '#111111',
    rules: ['thick uniform black outlines', 'bright primary colors, flat fills', 'visible halftone dot shading', 'angular dynamic staging with strong silhouettes', 'no lettering, no text, no speech bubbles in the image'] },
  manga: {
    id: 'manga', name: 'Manga Adventure', fit: 'Rivalries, mysteries, and fast action',
    blurb: 'Expressive faces, black-and-white inks, screentones, speed lines, dramatic close-ups. Optional accent color.',
    accent: '#e4573d', paper: '#f7f7f4', ink: '#0f0f12',
    rules: ['black-and-white ink drawing with screentone shading', 'expressive faces and dramatic close-ups', 'speed lines for motion', 'one optional accent color only', 'no lettering, no text, no speech bubbles in the image'] },
  'clear-line': {
    id: 'clear-line', name: 'Clear-Line Adventure', fit: 'Exploration and imaginative worlds',
    blurb: 'Precise outlines, flat colors, detailed environments, tidy panels, expressive but grounded characters.',
    accent: '#2bb3c0', paper: '#f4efe4', ink: '#141210',
    rules: ['precise even-weight ink outlines', 'flat colors with minimal shading', 'detailed, readable environments', 'expressive but grounded character acting', 'no lettering, no text, no speech bubbles in the image'] },
  'neon-arcade': {
    id: 'neon-arcade', name: 'Neon Arcade', fit: 'Sci-fi, game worlds, and strange technology',
    blurb: 'Sharp silhouettes, cel shading, electric cyan and magenta, glowing effects, occasional pixel accents.',
    accent: '#ff3d81', paper: '#0d0b14', ink: '#f5f0ff',
    rules: ['sharp silhouettes with cel shading', 'electric cyan and magenta lighting on dark backgrounds', 'glowing edges and light bloom', 'occasional pixel-art accents', 'no lettering, no text, no speech bubbles in the image'] },
  'inked-svg': {
    id: 'inked-svg', name: 'Rendered Ink', fit: 'Instant, offline, no image model',
    blurb: 'Panels drawn locally as vector ink from the scene plan. Zero cost, sub-second.',
    accent: '#2bb3c0', paper: '#f4efe4', ink: '#1b1a1f',
    rules: ['ink outlines with flat fills', 'palette gradient skies', 'subtle halftone', 'drawn by the app, not an image model', 'lettering stays in the HTML layer'] },
};
export const DEFAULT_STYLE: StyleId = 'clear-line';
