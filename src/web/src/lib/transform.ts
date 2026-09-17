import type { NormRect } from '@shared/schemas';

/** Pixel rect inside a panel box. */
export interface PxRect { x: number; y: number; w: number; h: number }

/**
 * The single shared image-to-panel transform. The art is CONTAINED inside the panel
 * (letterboxed, never cropped) so every overlay (bubbles, hotspots) sits over the same
 * pixels the reader sees. Given the panel box and the image aspect, returns the content box.
 */
export function containBox(panelW: number, panelH: number, imgAspect: number): PxRect {
  if (panelW <= 0 || panelH <= 0 || !isFinite(imgAspect) || imgAspect <= 0) {
    return { x: 0, y: 0, w: panelW, h: panelH };
  }
  const panelAspect = panelW / panelH;
  if (imgAspect > panelAspect) {
    const w = panelW;
    const h = panelW / imgAspect;
    return { x: 0, y: (panelH - h) / 2, w, h };
  }
  const h = panelH;
  const w = panelH * imgAspect;
  return { x: (panelW - w) / 2, y: 0, w, h };
}

/** Map a normalized image-space rect into pixels within the contained content box. */
export function rectToPx(rect: NormRect, content: PxRect): PxRect {
  return {
    x: content.x + rect.x * content.w,
    y: content.y + rect.y * content.h,
    w: rect.w * content.w,
    h: rect.h * content.h,
  };
}

export function clampRectInside(r: PxRect, panelW: number, panelH: number, minH = 44): PxRect {
  const h = Math.max(r.h, minH);
  const w = Math.max(r.w, 88);
  const x = Math.min(Math.max(r.x, 0), Math.max(0, panelW - w));
  const y = Math.min(Math.max(r.y, 0), Math.max(0, panelH - h));
  return { x, y, w: Math.min(w, panelW), h: Math.min(h, panelH) };
}
