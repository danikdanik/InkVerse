/**
 * Local SVG art provider for the 'inked-svg' style ("Rendered Ink"). Draws panels directly from
 * the structured PanelSpec: no image model, zero cost, deterministic per seed. Bubbles are NOT
 * lettered here; Panel.tsx overlays them in the HTML layer, same as every other style.
 */
import type { PanelSpec, Composition } from '@shared/schemas';
import { EPISODE } from '@content/episode';
import type { ImageProvider, ImageRequest, ImageResult, ModelCapability } from './types';

const MODEL = 'svg-renderer';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Extract the inner markup of an authored sketch motif SVG (viewBox 0 0 160 90), recolored. */
function motifInner(sketchKey: string, ink: string, accent: string): string {
  const raw = EPISODE.sketches[sketchKey as keyof typeof EPISODE.sketches] ?? EPISODE.sketches.generic;
  const inner = raw.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  return inner.replace(/currentColor/g, ink).replace(/var\(--accent\)/g, accent);
}

function figureGlyph(charId: string, protagonistId: string | undefined, ink: string): string {
  const isHero = !!protagonistId ? charId === protagonistId : charId === 'neri' || charId === 'hero';
  if (charId === 'guardian') {
    // grey stone block figure
    return (
      '<path d="M-9 40 V16 a9 9 0 0 1 18 0 V40 Z" fill="#8a8a8f" stroke="' + ink + '" stroke-width="1.5"/>' +
      '<circle cx="0" cy="8" r="3" fill="#e8a13a"/>'
    );
  }
  if (charId === 'archivist') {
    // lantern shape
    return (
      '<ellipse cx="0" cy="16" rx="9" ry="14" fill="#e8a13a" opacity="0.85" stroke="' + ink + '" stroke-width="1.5"/>' +
      '<circle cx="0" cy="14" r="4" fill="#fff6d8"/>'
    );
  }
  if (isHero) {
    // mustard jacket, teal scarf, dark trousers, brown satchel
    return (
      '<path d="M-8 40 V20 h16 V40 Z" fill="#2a2620"/>' + // trousers
      '<path d="M-9 20 h18 v-14 a9 9 0 0 0 -18 0 Z" fill="#d9a441" stroke="' + ink + '" stroke-width="1.5"/>' + // jacket
      '<path d="M-9 8 q9 6 18 0" fill="none" stroke="#2bb3c0" stroke-width="3"/>' + // scarf
      '<circle cx="0" cy="-6" r="6" fill="#caa06f"/>' + // head
      '<rect x="4" y="10" width="7" height="9" rx="1.5" fill="#6b4a2f"/>' // satchel
    );
  }
  // neutral supporting character
  return (
    '<path d="M-7 40 V18 a7 9 0 0 1 14 0 V40 Z" fill="#9aa0a6" stroke="' + ink + '" stroke-width="1.5"/>' +
    '<circle cx="0" cy="7" r="5.5" fill="#c9c2b4"/>'
  );
}

function halftonePattern(id: string, ink: string): string {
  return (
    `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse">` +
    `<circle cx="1.5" cy="1.5" r="1.1" fill="${ink}" opacity="0.12"/></pattern>`
  );
}

function renderSvg(req: ImageRequest, stage: 'preview' | 'final'): string {
  const { width: w, height: h } = req;
  const panel: PanelSpec | undefined = req.panelSpec;
  const comp: Composition | undefined = panel?.composition;
  const palette = comp?.palette && comp.palette.length >= 2 ? comp.palette : ['#f4efe4', '#2bb3c0'];
  const ink = '#1b1a1f';
  const accent = palette[palette.length - 1] ?? '#2bb3c0';
  const paper = '#f4efe4';
  const skyA = palette[0];
  const skyB = palette[1];
  const groundY = h * 0.78;
  const focal = comp?.focalPoint ?? { x: 0.5, y: 0.45 };
  const sketchKey = panel?.sketchKey ?? 'generic';

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`);
  parts.push('<defs>');
  parts.push(`<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${esc(skyA)}"/><stop offset="1" stop-color="${esc(skyB)}"/></linearGradient>`);
  parts.push(`<radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.28"/></radialGradient>`);
  parts.push(`<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${esc(accent)}" stop-opacity="0.55"/><stop offset="100%" stop-color="${esc(accent)}" stop-opacity="0"/></radialGradient>`);
  parts.push(halftonePattern('dots', ink));
  parts.push('</defs>');

  // paper base
  parts.push(`<rect width="${w}" height="${h}" fill="${esc(paper)}"/>`);
  // sky/background gradient
  parts.push(`<rect width="${w}" height="${h}" fill="url(#sky)"/>`);

  // scene motif, scaled to cover the frame (viewBox 0 0 160 90 preserved aspect, centered, cover-fit)
  const scale = Math.max(w / 160, h / 90);
  const mw = 160 * scale;
  const mh = 90 * scale;
  const mx = (w - mw) / 2;
  const my = (h - mh) / 2;
  parts.push(`<g transform="translate(${mx.toFixed(1)},${my.toFixed(1)}) scale(${scale.toFixed(3)})" opacity="0.9">${motifInner(sketchKey, ink, accent)}</g>`);

  // ground line
  parts.push(`<line x1="0" y1="${groundY.toFixed(1)}" x2="${w}" y2="${groundY.toFixed(1)}" stroke="${ink}" stroke-width="2" opacity="0.5"/>`);

  // figures
  const subjects = comp?.subjects ?? [];
  const protagonistId = panel?.presentCharacterIds?.[0];
  for (const subj of subjects) {
    const cx = subj.at.x * w;
    const cy = subj.at.y * h;
    const figH = h * 0.22;
    const s = figH / 40;
    const mirror = subj.facing === 'left' ? -1 : 1;
    parts.push(
      `<g class="figure" transform="translate(${cx.toFixed(1)},${cy.toFixed(1)}) scale(${(mirror * s).toFixed(3)},${s.toFixed(3)})">` +
        figureGlyph(subj.characterId, protagonistId, ink) +
        '</g>',
    );
  }

  // key prop callout: small accent ring at the focal point
  parts.push(`<circle cx="${(focal.x * w).toFixed(1)}" cy="${(focal.y * h).toFixed(1)}" r="${Math.max(4, h * 0.015).toFixed(1)}" fill="none" stroke="${esc(accent)}" stroke-width="2" opacity="0.8"/>`);

  // text-safe areas: keep quiet, draw nothing but background (paint a soft paper wash over them)
  for (const area of comp?.textSafeAreas ?? []) {
    const x = area.x * w, y = area.y * h, aw = area.w * w, ah = area.h * h;
    parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${aw.toFixed(1)}" height="${ah.toFixed(1)}" fill="${esc(paper)}" opacity="0.001"/>`);
  }

  if (stage === 'final') {
    // halftone over midtones
    parts.push(`<rect width="${w}" height="${h}" fill="url(#dots)"/>`);
    // soft glow at focal point
    const gr = Math.max(w, h) * 0.28;
    parts.push(`<circle cx="${(focal.x * w).toFixed(1)}" cy="${(focal.y * h).toFixed(1)}" r="${gr.toFixed(1)}" fill="url(#glow)"/>`);
    // vignette
    parts.push(`<rect width="${w}" height="${h}" fill="url(#vig)"/>`);
  }

  // ink border
  parts.push(`<rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" fill="none" stroke="${ink}" stroke-width="3"/>`);

  parts.push('</svg>');
  return parts.join('');
}

export function createSvgImageProvider(): ImageProvider {
  return {
    name: 'svg',
    capabilities(): ModelCapability {
      return {
        model: MODEL,
        // Any size is fine; sizes list intentionally empty (drawn to spec, not snapped to a grid).
        sizes: [],
        supportsReferenceImages: false,
        maxReferenceImages: 0,
        supportsSeed: true,
        supportsNegativePrompt: false,
        qualityLevels: null,
        estimatedCostUsd: 0,
      };
    },
    estimateCostUsd(): number | null {
      return 0;
    },
    async generate(req: ImageRequest): Promise<ImageResult> {
      const start = Date.now();
      const stage: 'preview' | 'final' = req.stage === 'final' ? 'final' : 'preview';
      const svg = renderSvg(req, stage);
      return {
        bytes: Buffer.from(svg, 'utf8'),
        mime: 'image/svg+xml',
        width: req.width,
        height: req.height,
        providerTaskId: null,
        costUsd: 0,
        model: MODEL,
        latencyMs: Date.now() - start,
      };
    },
  };
}
