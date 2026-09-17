/**
 * Business validation of a parsed StoryResponse against the parent state. Zod already checked
 * shape; this enforces the narrative + layout invariants the model must not violate.
 */
import type { StoryResponse, StoryState, StoryBible, NormRect, Bubble } from '@shared/schemas';

export interface ValidateContext {
  parentState: StoryState;
  bible: StoryBible;
  /** Opening beats may have up to 3 panels; later beats 1-2. */
  isOpening: boolean;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const area = (r: NormRect): number => r.w * r.h;
function intersectArea(a: NormRect, b: NormRect): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}
const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

export function validateStory(response: StoryResponse, ctx: ValidateContext): ValidationResult {
  const errors: string[] = [];
  const isEnding = !!response.ending;

  // panels-per-beat
  if (!ctx.isOpening && response.panels.length > 2) {
    errors.push(`non-opening beat has ${response.panels.length} panels (max 2)`);
  }

  // choices count
  if (isEnding && response.choices.length !== 0) {
    errors.push('ending node must have 0 choices');
  }
  if (!isEnding && (response.choices.length < 2 || response.choices.length > 3)) {
    errors.push(`non-ending node must have 2-3 choices, got ${response.choices.length}`);
  }

  const panelIds = new Set(response.panels.map((p) => p.id));

  // ownership set: protagonist + reader-cast may hold required items
  const ownerIds = new Set(
    ctx.bible.characters.filter((c) => c.role === 'protagonist' || c.role === 'reader').map((c) => c.id),
  );
  // effective inventory = parent inventory + this beat's inventory changes
  const inventory: Record<string, string> = { ...ctx.parentState.inventory };
  for (const ch of response.stateDelta.inventoryChanges) inventory[ch.itemId] = ch.toHolder;

  for (const choice of response.choices) {
    if (!panelIds.has(choice.hotspot.panelId)) {
      errors.push(`choice "${choice.label}" hotspot references unknown panel ${choice.hotspot.panelId}`);
    }
    for (const item of choice.requires.items) {
      const holder = inventory[item];
      if (!holder || !ownerIds.has(holder)) {
        errors.push(`choice "${choice.label}" requires item "${item}" not owned by protagonist or cast`);
      }
    }
  }

  // per-panel bubble rules
  for (const panel of response.panels) {
    const safe = panel.composition.textSafeAreas;
    let totalWords = 0;
    const bubbles: Bubble[] = panel.bubbles;
    for (const b of bubbles) {
      totalWords += wordCount(b.text);
      const bubbleArea = area(b.rect);
      const intersectsSafe = safe.some((s) => intersectArea(b.rect, s) >= 0.5 * bubbleArea);
      if (!intersectsSafe) {
        errors.push(`panel ${panel.id}: a bubble sits outside the text-safe areas`);
      }
    }
    if (totalWords > 35) {
      errors.push(`panel ${panel.id}: ${totalWords} bubble words exceeds 35`);
    }
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        if (intersectArea(bubbles[i].rect, bubbles[j].rect) > 0) {
          errors.push(`panel ${panel.id}: bubbles overlap`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
