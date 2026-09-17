/**
 * Generates honest placeholder art for every panel in the demo episode.
 * These are composed inkline-style SVG illustrations (paper ground, bold black contours, flat cel
 * color from the panel palette, halftone via a reused pattern). The providers agent's render script
 * replaces every file here with real FLUX (preview) and GPT Image (final) output; the filenames and
 * aspect ratios are the contract it renders into.
 *
 * Run: npx tsx scripts/build-art.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { EPISODE } from '../src/content/episode.ts';
import type { SketchKey } from '@shared/schemas';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ART_DIR = path.resolve(HERE, '../src/content/art');

// Consistent character palette (Neri reads the same in every panel regardless of scene palette).
const MUSTARD = '#d9a441', SCARF = '#2bb3c0', SKIN = '#8a5a3b', HAIR = '#241c17', SILVER = '#d7d2c4', TROUSER = '#2a2a30';

type Pal = string[]; // [ink, paper, c3, c4?]
const ink = (p: Pal) => p[0];
const paper = (p: Pal) => p[1] ?? '#f4efe4';
const c3 = (p: Pal) => p[2] ?? '#2bb3c0';
const c4 = (p: Pal) => p[3] ?? p[2] ?? '#e8a13a';

function dims(aspect: string, long: number) {
  const [w, h] = aspect.split(':').map(Number);
  const r = w / h;
  return r >= 1 ? { W: long, H: Math.round(long / r) } : { W: Math.round(long * r), H: long };
}

function neri(cx: number, cy: number, s: number) {
  // Stylized figure: dark trousers/boots, mustard jacket, teal scarf, dark curls with one silver streak.
  return (
    `<g stroke="${HAIR}" stroke-width="${1.5 * s}" stroke-linejoin="round">` +
    `<rect x="${cx - 5 * s}" y="${cy + 6 * s}" width="${4 * s}" height="${12 * s}" fill="${TROUSER}"/>` +
    `<rect x="${cx + 1 * s}" y="${cy + 6 * s}" width="${4 * s}" height="${12 * s}" fill="${TROUSER}"/>` +
    `<rect x="${cx - 6 * s}" y="${cy + 17 * s}" width="${6 * s}" height="${3 * s}" fill="${HAIR}"/>` +
    `<rect x="${cx + 1 * s}" y="${cy + 17 * s}" width="${6 * s}" height="${3 * s}" fill="${HAIR}"/>` +
    `<path d="M${cx - 7 * s} ${cy + 8 * s} q${7 * s} ${-9 * s} ${14 * s} 0 l${-2 * s} ${-2 * s} q${-5 * s} ${-6 * s} ${-10 * s} 0 Z" fill="${MUSTARD}"/>` +
    `<path d="M${cx - 6 * s} ${cy - 4 * s} q${6 * s} ${3 * s} ${12 * s} 0 l${-3 * s} ${4 * s} q${-3 * s} ${2 * s} ${-6 * s} 0 Z" fill="${SCARF}" stroke="${SCARF}"/>` +
    `<circle cx="${cx}" cy="${cy - 9 * s}" r="${4.5 * s}" fill="${SKIN}"/>` +
    `<path d="M${cx - 5 * s} ${cy - 10 * s} q${5 * s} ${-7 * s} ${10 * s} 0 q${-5 * s} ${-3 * s} ${-10 * s} 0 Z" fill="${HAIR}"/>` +
    `<path d="M${cx + 1 * s} ${cy - 15 * s} l${1.5 * s} ${5 * s}" stroke="${SILVER}" stroke-width="${1.2 * s}"/>` +
    `</g>`
  );
}

function halftone(p: Pal, dense: boolean) {
  const gap = dense ? 7 : 10;
  return (
    `<pattern id="ht" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse">` +
    `<circle cx="${gap / 2}" cy="${gap / 2}" r="${dense ? 1.3 : 1.1}" fill="${ink(p)}" opacity="0.15"/></pattern>`
  );
}

function hatch(x: number, y: number, w: number, h: number, col: string) {
  const lines: string[] = [];
  for (let i = 0; i < w + h; i += 7) lines.push(`M${x + i} ${y} L${x + i - h} ${y + h}`);
  return `<g stroke="${col}" stroke-width="0.8" opacity="0.25"><path d="${lines.join(' ')}"/></g>`;
}

type Scene = (W: number, H: number, p: Pal, hi: boolean) => string;

const scenes: Record<SketchKey, Scene> = {
  citadel: (W, H, p, hi) => {
    const midX = W * 0.55;
    return (
      `<rect x="0" y="0" width="${midX}" height="${H}" fill="${c4(p)}" opacity="0.5"/>` +
      `<rect x="${midX}" y="0" width="${W - midX}" height="${H}" fill="${c3(p)}" opacity="0.28"/>` +
      `<rect x="${midX - 2}" y="0" width="4" height="${H}" fill="${c3(p)}"/>` +
      `<g fill="${ink(p)}" stroke="${ink(p)}" stroke-width="2" stroke-linejoin="round">` +
      `<path d="M${W * 0.34} ${H * 0.7} h${W * 0.32} v${H * 0.22} h${-W * 0.32} Z"/>` +
      `<path d="M${W * 0.4} ${H * 0.7} v${-H * 0.3} h${W * 0.05} v${H * 0.3}"/>` +
      `<path d="M${W * 0.55} ${H * 0.7} v${-H * 0.4} h${W * 0.05} v${H * 0.4}"/></g>` +
      `<g fill="${c3(p)}"><rect x="${W * 0.41}" y="${H * 0.45}" width="${W * 0.03}" height="${H * 0.05}"/>` +
      `<rect x="${W * 0.56}" y="${H * 0.36}" width="${W * 0.03}" height="${H * 0.05}"/></g>` +
      `<path d="M0 ${H * 0.85} H${W * 0.34}" stroke="${ink(p)}" stroke-width="3"/>` +
      neri(W * 0.2, H * 0.72, (W / 512) * 1.1) +
      (hi ? hatch(W * 0.34, H * 0.7, W * 0.32, H * 0.22, ink(p)) : '')
    );
  },
  compass: (W, H, p, hi) => {
    const cx = W * 0.5, cy = H * 0.48, r = Math.min(W, H) * 0.34;
    return (
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${paper(p)}" stroke="${ink(p)}" stroke-width="5"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.8}" fill="none" stroke="${ink(p)}" stroke-width="1.5"/>` +
      `<path d="M${cx} ${cy} L${cx + r * 0.7} ${cy - r * 0.55}" stroke="${c3(p)}" stroke-width="5" stroke-linecap="round"/>` +
      `<path d="M${cx} ${cy} L${cx - r * 0.55} ${cy + r * 0.5}" stroke="${ink(p)}" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r * 0.12}" fill="${c3(p)}"/>` +
      `<g stroke="${ink(p)}" stroke-width="2">` +
      `<path d="M${cx} ${cy - r} v${r * 0.14} M${cx} ${cy + r} v${-r * 0.14} M${cx - r} ${cy} h${r * 0.14} M${cx + r} ${cy} h${-r * 0.14}"/></g>` +
      (hi ? `<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="none" stroke="${c4(p)}" stroke-width="1" opacity="0.5"/>` : '')
    );
  },
  door: (W, H, p, hi) => (
    `<rect x="0" y="0" width="${W * 0.42}" height="${H}" fill="${c3(p)}" opacity="0.22"/>` +
    `<g stroke="${c3(p)}" stroke-width="2" opacity="0.7"><path d="M${W * 0.18} ${H * 0.15} v${H * 0.7} M${W * 0.1} ${H * 0.5} h${W * 0.16}"/></g>` +
    `<rect x="${W * 0.55}" y="${H * 0.2}" width="${W * 0.18}" height="${H * 0.62}" rx="6" fill="${paper(p)}" stroke="${ink(p)}" stroke-width="5"/>` +
    `<path d="M${W * 0.64} ${H * 0.2} v${H * 0.62}" stroke="${ink(p)}" stroke-width="1.5"/>` +
    `<circle cx="${W * 0.64}" cy="${H * 0.52}" r="${W * 0.02}" fill="none" stroke="${c3(p)}" stroke-width="3"/>` +
    `<g fill="${ink(p)}" stroke="${ink(p)}" stroke-width="2"><path d="M${W * 0.78} ${H * 0.82} v${-H * 0.42} a${W * 0.05} ${W * 0.05} 0 0 1 ${W * 0.1} 0 v${H * 0.42} Z"/></g>` +
    `<circle cx="${W * 0.83}" cy="${H * 0.42}" r="${W * 0.015}" fill="${c4(p)}"/>` +
    (hi ? hatch(W * 0.78, H * 0.4, W * 0.1, H * 0.42, paper(p)) : '')
  ),
  gate: (W, H, p, hi) => {
    const cx = W * 0.5;
    return (
      `<rect x="${cx - 3}" y="0" width="6" height="${H}" fill="${c3(p)}"/>` +
      `<rect x="0" y="0" width="${cx}" height="${H}" fill="${c4(p)}" opacity="0.35"/>` +
      `<g fill="none" stroke="${ink(p)}" stroke-width="5" stroke-linejoin="round">` +
      `<path d="M${W * 0.28} ${H * 0.85} v${-H * 0.4} a${W * 0.22} ${H * 0.32} 0 0 1 ${W * 0.44} 0 v${H * 0.4}"/></g>` +
      `<g fill="${c3(p)}">${starfield(W, H, hi ? 12 : 7, cx)}</g>` +
      neri(W * 0.22, H * 0.72, (W / 512) * 1.0) +
      (hi ? `<path d="M${cx} 0 v${H}" stroke="${paper(p)}" stroke-width="1.5" opacity="0.6"/>` : '')
    );
  },
  guardian: (W, H, p, hi) => (
    `<rect x="${W * 0.5}" y="${H * 0.18}" width="${W * 0.02}" height="${H * 0.64}" fill="${ink(p)}" opacity="0.2"/>` +
    `<g fill="${ink(p)}" stroke="${ink(p)}" stroke-width="2" stroke-linejoin="round">` +
    `<path d="M${W * 0.58} ${H * 0.85} v${-H * 0.4} a${W * 0.1} ${W * 0.1} 0 0 1 ${W * 0.2} 0 v${H * 0.4} Z"/>` +
    `<path d="M${W * 0.62} ${H * 0.45} v${-H * 0.16} a${W * 0.06} ${W * 0.06} 0 0 1 ${W * 0.12} 0 v${H * 0.16} Z"/></g>` +
    `<g stroke="${c3(p)}" stroke-width="2" opacity="0.8"><path d="M${W * 0.6} ${H * 0.55} h${W * 0.16} M${W * 0.66} ${H * 0.45} v${H * 0.37}"/></g>` +
    `<circle cx="${W * 0.68}" cy="${H * 0.32}" r="${W * 0.02}" fill="${c4(p)}"/>` +
    neri(W * 0.28, H * 0.72, (W / 512) * 1.0) +
    (hi ? hatch(W * 0.58, H * 0.45, W * 0.2, H * 0.4, paper(p)) : '')
  ),
  archive: (W, H, p, hi) => (
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${c4(p)}" opacity="0.14"/>` +
    `<g fill="none" stroke="${ink(p)}" stroke-width="4">` +
    `<rect x="${W * 0.12}" y="${H * 0.2}" width="${W * 0.22}" height="${H * 0.12}"/>` +
    `<rect x="${W * 0.16}" y="${H * 0.62}" width="${W * 0.22}" height="${H * 0.12}"/>` +
    `<rect x="${W * 0.66}" y="${H * 0.24}" width="${W * 0.22}" height="${H * 0.12}"/>` +
    `<rect x="${W * 0.64}" y="${H * 0.6}" width="${W * 0.22}" height="${H * 0.12}"/></g>` +
    `<circle cx="${W * 0.6}" cy="${H * 0.42}" r="${Math.min(W, H) * 0.09}" fill="${c4(p)}" stroke="${ink(p)}" stroke-width="4"/>` +
    `<path d="M${W * 0.6} ${H * 0.33} v${-H * 0.08} M${W * 0.6} ${H * 0.51} v${H * 0.08}" stroke="${c3(p)}" stroke-width="3"/>` +
    neri(W * 0.3, H * 0.7, (W / 512) * 1.0) +
    (hi ? starfield(W, H, 8, W) : '')
  ),
  map: (W, H, p, hi) => (
    `<path d="M${W * 0.2} ${H * 0.24} q${W * 0.3} ${-H * 0.08} ${W * 0.6} 0 v${H * 0.5} q${-W * 0.3} ${H * 0.08} ${-W * 0.6} 0 Z" fill="${paper(p)}" stroke="${ink(p)}" stroke-width="5"/>` +
    `<path d="M${W * 0.26} ${H * 0.5} q${W * 0.16} ${-H * 0.12} ${W * 0.28} ${H * 0.03} t${W * 0.22} ${-H * 0.03}" fill="none" stroke="${c3(p)}" stroke-width="4"/>` +
    `<circle cx="${W * 0.66}" cy="${H * 0.44}" r="${W * 0.02}" fill="${c4(p)}"/>` +
    `<g stroke="${ink(p)}" stroke-width="1" opacity="0.5"><path d="M${W * 0.36} ${H * 0.28} v${H * 0.42} M${W * 0.54} ${H * 0.26} v${H * 0.46}"/></g>` +
    (hi ? hatch(W * 0.2, H * 0.24, W * 0.6, H * 0.5, ink(p)) : '')
  ),
  void: (W, H, p, hi) => (
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${p[1] ?? '#1b1a33'}"/>` +
    `<g fill="${paper(p)}">${starfield(W, H, hi ? 26 : 16, -1)}</g>` +
    `<g fill="${ink(p)}" stroke="${c3(p)}" stroke-width="2"><path d="M${W * 0.44} ${H * 0.5} h${W * 0.12} v${H * 0.1} h${-W * 0.12} Z"/></g>` +
    `<circle cx="${W * 0.5}" cy="${H * 0.4}" r="${Math.min(W, H) * 0.08}" fill="none" stroke="${c3(p)}" stroke-width="2" opacity="0.7"/>` +
    neri(W * 0.5, H * 0.66, (W / 512) * 0.8)
  ),
  ending: (W, H, p, hi) => (
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${c3(p)}" opacity="0.18"/>` +
    `<circle cx="${W * 0.5}" cy="${H * 0.64}" r="${Math.min(W, H) * 0.2}" fill="${c3(p)}" opacity="0.55"/>` +
    `<g fill="${ink(p)}" stroke="${ink(p)}" stroke-width="2" stroke-linejoin="round">` +
    `<path d="M${W * 0.4} ${H * 0.66} h${W * 0.2} v${H * 0.18} h${-W * 0.2} Z"/>` +
    `<path d="M${W * 0.44} ${H * 0.66} v${-H * 0.16} h${W * 0.04} v${H * 0.16} M${W * 0.53} ${H * 0.66} v${-H * 0.2} h${W * 0.04} v${H * 0.2}"/></g>` +
    `<path d="M0 ${H * 0.84} H${W}" stroke="${ink(p)}" stroke-width="3"/>` +
    `<g stroke="${c4(p)}" stroke-width="2" opacity="0.8"><path d="M${W * 0.5} ${H * 0.34} v${-H * 0.1} M${W * 0.34} ${H * 0.44} l${-W * 0.05} ${-H * 0.05} M${W * 0.66} ${H * 0.44} l${W * 0.05} ${-H * 0.05}"/></g>` +
    (hi ? starfield(W, H * 0.5, 8, -1) : '')
  ),
  generic: (W, H, p, hi) => (
    `<rect x="${W * 0.08}" y="${H * 0.12}" width="${W * 0.84}" height="${H * 0.66}" rx="6" fill="${paper(p)}" stroke="${ink(p)}" stroke-width="5"/>` +
    `<path d="M${W * 0.08} ${H * 0.55} q${W * 0.2} ${-H * 0.16} ${W * 0.42} 0 t${W * 0.42} ${-H * 0.04}" fill="none" stroke="${c3(p)}" stroke-width="4"/>` +
    `<circle cx="${W * 0.72}" cy="${H * 0.34}" r="${W * 0.04}" fill="none" stroke="${c4(p)}" stroke-width="3"/>` +
    (hi ? hatch(W * 0.08, H * 0.12, W * 0.84, H * 0.66, ink(p)) : '')
  ),
};

function starfield(W: number, H: number, n: number, seamX: number) {
  const out: string[] = [];
  let seed = 97;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < n; i++) {
    const x = rnd() * W, y = rnd() * H;
    if (seamX > 0 && Math.abs(x - seamX) < W * 0.04) continue;
    out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1 + rnd() * 1.4).toFixed(1)}"/>`);
  }
  return out.join('');
}

function render(sketch: SketchKey, palette: Pal, aspect: string, long: number, hi: boolean) {
  const { W, H } = dims(aspect, long);
  const body = (scenes[sketch] ?? scenes.generic)(W, H, palette, hi);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<defs>${halftone(palette, hi)}</defs>` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${paper(palette)}"/>` +
    body +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#ht)"/>` +
    `<rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="${ink(palette)}" stroke-width="4"/>` +
    `</svg>`
  );
}

function main() {
  mkdirSync(ART_DIR, { recursive: true });
  let count = 0;
  for (const beat of EPISODE.beats) {
    for (const panel of beat.response.panels) {
      const files = beat.art[panel.id];
      if (!files) throw new Error(`Beat ${beat.key} panel ${panel.id} has no art entry`);
      const pal = panel.composition.palette;
      const aspect = panel.composition.aspect;
      const preview = render(panel.sketchKey, pal, aspect, 512, false);
      const final = render(panel.sketchKey, pal, aspect, 1280, true);
      writeFileSync(path.join(ART_DIR, path.basename(files.preview)), preview);
      writeFileSync(path.join(ART_DIR, path.basename(files.final)), final);
      count += 2;
    }
  }
  console.log(`Wrote ${count} art files to ${path.relative(process.cwd(), ART_DIR)}`);
}

main();
