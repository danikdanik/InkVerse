import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import type { MotionParams } from '@shared/schemas';
import { safeParams, particlesFor, usesCameraMove } from './templates';

/**
 * The single moving image plane. Children are the stacked stage layers (sketch/preview/final);
 * the camera transform lives here so it stays stable across image swaps. Particles are a
 * deterministic overlay above the art but below HTML/SVG lettering (rendered by the parent).
 * Pauses offscreen (IntersectionObserver), stops on unmount, honors prefers-reduced-motion.
 */
export function MotionLayer({
  params, animate, palette, children, className,
}: {
  params: Partial<MotionParams> | undefined;
  animate: boolean;
  palette?: string[];
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const p = safeParams(params);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? true),
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = animate && inView;
  const camMove = usesCameraMove(p.preset);
  const particles = particlesFor(p.preset, p.particleCount, p.seed);
  const wash = palette && palette.length ? palette[palette.length - 1] : undefined;

  const camStyle: CSSProperties & Record<string, string | number> = {
    transformOrigin: `${(p.focalPoint.x * 100).toFixed(1)}% ${(p.focalPoint.y * 100).toFixed(1)}%`,
    animationName: camMove ? 'hf-cam' : 'none',
    animationDuration: `${p.durationMs}ms`,
    animationPlayState: running ? 'running' : 'paused',
    '--hf-zs': String(p.zoomStart),
    '--hf-ze': String(p.zoomEnd),
    '--hf-px': `${p.panXPercent}%`,
    '--hf-py': `${p.panYPercent}%`,
  };

  return (
    <div ref={ref} className={`hf-plane ${className ?? ''}`}>
      <div className="hf-cam-wrap" style={camStyle}>{children}</div>

      {wash && <div className="hf-wash" style={{ background: wash, opacity: 0.16 * p.intensity + 0.04 }} aria-hidden />}

      {particles.length > 0 && (
        <div className="hf-particles" aria-hidden>
          {particles.map((pt, i) => {
            const s: CSSProperties = {
              left: `${pt.left}%`,
              top: `${pt.top}%`,
              width: pt.size,
              height: p.preset === 'rain' ? pt.size * 8 : pt.size,
              animationName: p.preset === 'rain' ? 'hf-rain' : p.preset === 'energy_pulse' ? 'hf-pulse' : 'hf-dust',
              animationDuration: `${pt.dur}s`,
              animationDelay: `${pt.delay}s`,
              animationPlayState: running ? 'running' : 'paused',
              opacity: running ? undefined : 0.2,
            };
            return <span key={i} className={`hf-p hf-p-${p.preset}`} style={s} />;
          })}
        </div>
      )}
    </div>
  );
}
