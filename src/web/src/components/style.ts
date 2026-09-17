import type { CSSProperties } from 'react';
import type { StyleId } from '@shared/schemas';
import { STYLES, DEFAULT_STYLE } from '@shared/styles';

/** CSS custom properties for a style preset, applied on a wrapper so children inherit palette. */
export function styleVars(styleId: StyleId): CSSProperties {
  const s = STYLES[styleId] ?? STYLES[DEFAULT_STYLE];
  return { ['--paper' as any]: s.paper, ['--ink' as any]: s.ink, ['--accent' as any]: s.accent } as CSSProperties;
}
