import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PanelSpec, Choice } from '@shared/schemas';
import type { PanelBest } from '../hooks/useRun';
import { MotionLayer } from '../motion/MotionLayer';
import { sketchFor } from '../lib/sketches';
import { containBox, rectToPx, type PxRect } from '../lib/transform';

/**
 * Three forward-only visual stages: sketch (immediate) -> preview -> final.
 * Final art is decoded before reveal and cross-dissolved (~450ms); frame, crop and lettering
 * stay put. Bubbles and choice hotspots live in HTML/SVG layers above the moving image plane,
 * positioned through the single shared CONTAIN transform (letterbox, never crop).
 */
export function Panel({
  panel, best, aspect, sketches, assetUrl, choices, motionOn, ambient, disabled,
  onChoose, onCustom, onRetryArt,
}: {
  panel: PanelSpec;
  best?: PanelBest;
  aspect: number;
  sketches: Record<string, string> | null;
  assetUrl: (id?: string | null) => string | undefined;
  choices: Choice[];
  motionOn: boolean;
  ambient: boolean;
  disabled: boolean;
  onChoose: (choiceId: string) => void;
  onCustom: (panelId: string) => void;
  onRetryArt: (panelId: string, stage: 'preview' | 'final') => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [finalReady, setFinalReady] = useState(false);
  const lastPreview = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => {
      const r = e[0]?.contentRect;
      if (r) setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stage = best?.stage ?? 'sketch';
  const previewUrl = stage === 'preview' ? assetUrl(best?.assetId) : lastPreview.current;
  if (stage === 'preview' && previewUrl) lastPreview.current = previewUrl;
  const finalUrl = stage === 'final' ? assetUrl(best?.assetId) : undefined;

  // Decode final before revealing it, so the swap never flashes.
  useEffect(() => {
    let cancelled = false;
    setFinalReady(false);
    if (!finalUrl) return;
    const img = new Image();
    img.src = finalUrl;
    img.decode().then(() => { if (!cancelled) setFinalReady(true); })
      .catch(() => { if (!cancelled) setFinalReady(true); });
    return () => { cancelled = true; };
  }, [finalUrl]);

  const content: PxRect = containBox(size.w, size.h, aspect);
  const sketchSvg = sketchFor(sketches, panel.sketchKey);
  const palette = panel.composition?.palette ?? [];
  // Motion runs on preview; on final it settles unless the reader keeps ambient motion on.
  const animate = motionOn && (stage === 'preview' || (stage === 'final' && ambient));

  return (
    <div ref={boxRef} className="relative w-full overflow-hidden rounded-md bg-black/60 border border-black/20"
      style={{ aspectRatio: String(aspect) }}>
      <MotionLayer params={panel.motion} animate={animate} palette={palette}>
        {/* Stage A: sketch base, always present */}
        <div className="stage-svg" style={{ opacity: finalReady ? 0 : 1, transition: 'opacity 450ms ease' }}
          dangerouslySetInnerHTML={{ __html: sketchSvg }} aria-hidden />
        {/* Stage B: preview */}
        {previewUrl && (
          <img className="stage-layer" src={previewUrl} alt="" aria-hidden
            style={{ opacity: finalReady ? 0 : 1 }} />
        )}
        {/* Stage C: final, cross-dissolved after decode */}
        {finalUrl && (
          <img className="stage-layer" src={finalUrl} alt={panel.altText || undefined}
            style={{ opacity: finalReady ? 1 : 0 }} />
        )}
      </MotionLayer>

      {/* Bubble layer (above the moving plane) */}
      <div className="absolute inset-0 pointer-events-none">
        {panel.bubbles?.map((b, i) => {
          const r = rectToPx(b.rect, content);
          return (
            <div key={i}
              className={`absolute text-black text-[11px] leading-tight px-1.5 py-1 ${b.kind === 'sfx' ? 'font-letter font-bold' : ''}`}
              style={{
                left: r.x, top: r.y, maxWidth: r.w,
                background: b.kind === 'caption' ? 'rgba(20,18,16,0.85)' : 'white',
                color: b.kind === 'caption' ? 'var(--paper)' : '#141210',
                borderRadius: b.kind === 'thought' ? 12 : 4,
                border: b.kind === 'speech' ? '1px solid rgba(0,0,0,0.5)' : 'none',
              }}>
              {b.text}
            </div>
          );
        })}
      </div>

      {/* Choice hotspots: a marker dot at the hotspot center and a compact labelled pill
          anchored at its bottom-center, clamped inside the panel. */}
      <div className="absolute inset-0">
        {choices.map((c) => {
          const hp = rectToPx(c.hotspot.rect, content);
          const cx = hp.x + hp.w / 2;
          const cy = hp.y + hp.h / 2;
          const anchorX = Math.min(Math.max(cx, 62), Math.max(62, size.w - 62));
          const belowTop = hp.y + hp.h + 8;
          const maxTop = size.h - 48;
          const top = belowTop > maxTop ? Math.min(Math.max(hp.y - 50, 4), maxTop) : Math.min(belowTop, maxTop);
          const dotX = Math.min(Math.max(cx, 6), size.w - 6);
          const dotY = Math.min(Math.max(cy, 6), size.h - 6);
          return (
            <div key={c.id}>
              <span className="choice-dot" style={{ left: dotX, top: dotY }} aria-hidden />
              <button type="button" disabled={disabled} onClick={() => onChoose(c.id)}
                className="choice-pill focus-ring text-sm disabled:opacity-60"
                style={{ left: anchorX, top, transform: 'translateX(-50%)', maxWidth: Math.max(96, size.w - 16) }}>
                {c.label}
              </button>
            </div>
          );
        })}
      </div>

      {/* Art failure */}
      {best?.failedStage && (
        <div className="absolute bottom-1 left-1 flex gap-1">
          <button type="button" onClick={() => onRetryArt(panel.id, best.failedStage === 'final' ? 'final' : 'preview')}
            className="focus-ring text-[11px] rounded bg-black/70 text-white px-2 py-1">Retry artwork</button>
        </div>
      )}

      {choices.length > 0 && (
        <button type="button" onClick={() => onCustom(panel.id)} disabled={disabled}
          className="absolute bottom-1 right-1 focus-ring text-[11px] rounded bg-black/70 text-white px-2 py-1 disabled:opacity-60">
          Try another approach
        </button>
      )}
    </div>
  );
}
