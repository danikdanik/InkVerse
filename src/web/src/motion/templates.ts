/**
 * Motion templates. We evaluated the @hyperframes/player web component (embeds a
 * composition HTML via an iframe `src`, blob URL possible), but its composition-runtime
 * readiness contract is undocumented in the shipped package and could not be verified
 * in-browser inside the build timebox. So the six trusted templates run as a CSS/GSAP
 * fallback. Only numbers/enums from MotionParams reach the DOM; no model text is injected.
 */
import type { MotionParams, MotionPreset } from '@shared/schemas';

export const MOTION_PLAYER: 'hyperframes' | 'css-fallback' = 'css-fallback';

/** Deterministic PRNG so particle fields are identical for a given seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const num = (v: number, min: number, max: number, d: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;

/** Sanitized, clamped params. Guarantees only safe numeric values flow into styles. */
export function safeParams(p: Partial<MotionParams> | undefined): Required<Pick<MotionParams,
  'preset' | 'durationMs' | 'zoomStart' | 'zoomEnd' | 'panXPercent' | 'panYPercent' | 'intensity' | 'particleCount' | 'seed'>> & { focalPoint: { x: number; y: number } } {
  const presets: MotionPreset[] = ['portal', 'drifting_dust', 'rain', 'energy_pulse', 'slow_push', 'still'];
  const preset = (p && presets.includes(p.preset as MotionPreset) ? p.preset : 'still') as MotionPreset;
  return {
    preset,
    durationMs: Math.round(num(p?.durationMs ?? 4800, 3000, 8000, 4800)),
    zoomStart: num(p?.zoomStart ?? 1, 1, 1.1, 1),
    zoomEnd: num(p?.zoomEnd ?? 1.03, 1, 1.12, 1.03),
    panXPercent: num(p?.panXPercent ?? 0, -3, 3, 0),
    panYPercent: num(p?.panYPercent ?? 0, -3, 3, 0),
    intensity: num(p?.intensity ?? 0.25, 0, 1, 0.25),
    particleCount: Math.round(num(p?.particleCount ?? 12, 0, 48, 12)),
    seed: Math.round(num(p?.seed ?? 1, 0, 1e9, 1)),
    focalPoint: { x: num(p?.focalPoint?.x ?? 0.5, 0, 1, 0.5), y: num(p?.focalPoint?.y ?? 0.45, 0, 1, 0.45) },
  };
}

export interface Particle { left: number; top: number; size: number; delay: number; dur: number; drift: number }

export function particlesFor(preset: MotionPreset, count: number, seed: number): Particle[] {
  const rnd = mulberry32(seed + count * 7 + preset.length * 131);
  const out: Particle[] = [];
  const usesParticles = preset === 'rain' || preset === 'drifting_dust' || preset === 'energy_pulse';
  if (!usesParticles) return out;
  for (let i = 0; i < count; i++) {
    out.push({
      left: rnd() * 100,
      top: rnd() * 100,
      size: preset === 'rain' ? 1 + rnd() * 1.5 : 1.5 + rnd() * 3,
      delay: rnd() * 2.5,
      dur: 2 + rnd() * 3,
      drift: (rnd() - 0.5) * 8,
    });
  }
  return out;
}

/** Whether the base image gets a slow zoom/pan for this preset. */
export function usesCameraMove(preset: MotionPreset): boolean {
  return preset === 'portal' || preset === 'slow_push' || preset === 'energy_pulse' || preset === 'drifting_dust';
}
