/**
 * State transition. applyDelta is allowlisted: only StateDelta fields move the world forward.
 * Anything not in the delta cannot be changed by the model. stateHash is a deterministic
 * fingerprint (sha256 of canonical JSON) used for optimistic concurrency + dedupe.
 */
import { createHash } from 'node:crypto';
import type { StoryState, StateDelta } from '@shared/schemas';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Stable stringify: object keys sorted recursively so equal states hash equal. */
export function canonicalJson(value: unknown): string {
  const seen = new WeakSet();
  const norm = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v as object)) return null;
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(norm);
    const obj = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) out[k] = norm(obj[k]);
    return out;
  };
  return JSON.stringify(norm(value));
}

export function stateHash(state: StoryState): string {
  return createHash('sha256').update(canonicalJson(state)).digest('hex');
}

export interface ApplyOptions {
  summaryUpdate?: string;
  /** Known character ids (protagonist + cast). Inventory holders must be one of these or 'nobody'/'lost'. */
  knownHolders?: Set<string>;
}

const RESERVED_HOLDERS = new Set(['nobody', 'lost']);

const dedupe = (arr: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const key = s.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
};

export function applyDelta(state: StoryState, delta: StateDelta, opts: ApplyOptions = {}): StoryState {
  const next: StoryState = structuredClone(state);

  if (delta.location) next.location = delta.location;
  if (delta.timeline) next.timeline = delta.timeline;
  if (delta.pacing) next.pacing = delta.pacing;

  for (const ch of delta.inventoryChanges) {
    const holderOk =
      !opts.knownHolders || opts.knownHolders.has(ch.toHolder) || RESERVED_HOLDERS.has(ch.toHolder);
    if (!holderOk) continue; // reject unknown holders rather than corrupting ownership
    next.inventory[ch.itemId] = ch.toHolder;
  }

  for (const rc of delta.relationshipChanges) {
    const existing = next.relationships.find((r) => r.characterId === rc.characterId);
    if (existing) {
      existing.trust = clamp(existing.trust + rc.trustDelta, -3, 3);
      if (rc.note) existing.note = rc.note;
    } else if (next.relationships.length < 8) {
      next.relationships.push({ characterId: rc.characterId, trust: clamp(rc.trustDelta, -3, 3), note: rc.note });
    }
  }

  next.knownFacts = dedupe([...next.knownFacts, ...delta.addFacts]).slice(0, 24);

  if (delta.resolvePromises.length) {
    const resolved = new Set(delta.resolvePromises.map((p) => p.trim().toLowerCase()));
    next.promises = next.promises.filter((p) => !resolved.has(p.trim().toLowerCase()));
  }
  next.promises = dedupe([...next.promises, ...delta.addPromises]).slice(0, 8);

  if (delta.resolveThreads.length) {
    const resolved = new Set(delta.resolveThreads.map((t) => t.trim().toLowerCase()));
    next.openThreads = next.openThreads.filter((t) => !resolved.has(t.trim().toLowerCase()));
  }
  next.openThreads = dedupe([...next.openThreads, ...delta.addThreads]).slice(0, 8);

  next.beatIndex = clamp(state.beatIndex + 1, 0, 12);
  if (opts.summaryUpdate && opts.summaryUpdate.trim()) next.summary = opts.summaryUpdate.slice(0, 1200);

  return next;
}
