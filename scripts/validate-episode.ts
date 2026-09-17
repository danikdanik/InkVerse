/**
 * Validates the demo episode fixtures against the shared Zod contract and the structural rules the
 * demo replay relies on. Import { validateEpisode } from tests, or run standalone:
 *   npx tsx scripts/validate-episode.ts   (exits non-zero and prints every failure)
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { StoryResponse, StoryBible, StoryState } from '@shared/schemas';
import type { NormRect } from '@shared/schemas';
import { EPISODE } from '../src/content/episode.ts';
import type { FixtureEpisode } from '../src/content/types.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ART_DIR = path.resolve(HERE, '../src/content/art');

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const intersects = (a: NormRect, b: NormRect) =>
  !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);

export function validateEpisode(ep: FixtureEpisode = EPISODE): string[] {
  const errors: string[] = [];
  const E = (cond: unknown, msg: string) => { if (!cond) errors.push(msg); };

  // bible + initial state parse
  const bible = StoryBible.safeParse(ep.bible);
  E(bible.success, `bible failed schema: ${bible.success ? '' : bible.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const init = StoryState.safeParse(ep.initialState);
  E(init.success, `initialState failed schema: ${init.success ? '' : init.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);

  const byKey = new Map(ep.beats.map((b) => [b.key, b]));
  E(byKey.size === ep.beats.length, 'duplicate beat keys present');

  for (const beat of ep.beats) {
    const where = `beat '${beat.key}'`;

    // 1. response parses
    const parsed = StoryResponse.safeParse(beat.response);
    if (!parsed.success) {
      errors.push(`${where} response failed schema: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      continue;
    }
    const r = parsed.data;
    const panelIds = new Set(r.panels.map((p) => p.id));

    // 3. parentKey references exist
    if (beat.parentKey !== null) E(byKey.has(beat.parentKey), `${where} has unknown parentKey '${beat.parentKey}'`);
    else E(beat.key === 'root', `${where} has null parentKey but is not root`);

    // 4. choice-via beats reference an existing choice id in the parent
    if (beat.via.kind === 'choice') {
      const choiceId = beat.via.choiceId;
      const parent = beat.parentKey ? byKey.get(beat.parentKey) : undefined;
      const ok = !!parent && parent.response.choices.some((c) => c.id === choiceId);
      E(ok, `${where} via choice '${choiceId}' not found in parent '${beat.parentKey}' choices`);
    }

    // 2. hotspot panelId exists in this beat
    for (const c of r.choices) {
      E(panelIds.has(c.hotspot.panelId), `${where} choice '${c.id}' hotspot panelId '${c.hotspot.panelId}' not in this beat`);
    }

    // endings have no choices
    if (r.ending) E(r.choices.length === 0, `${where} is an ending but has choices`);

    for (const panel of r.panels) {
      const pw = `${where} panel '${panel.id}'`;

      // 5. art files exist
      const files = beat.art[panel.id];
      E(!!files, `${pw} has no art entry`);
      if (files) {
        E(existsSync(path.join(ART_DIR, path.basename(files.preview))), `${pw} preview art missing: ${files.preview}`);
        E(existsSync(path.join(ART_DIR, path.basename(files.final))), `${pw} final art missing: ${files.final}`);
      }

      // 6. bubble rects intersect a text-safe area
      const safe = panel.composition.textSafeAreas;
      for (const b of panel.bubbles) {
        E(safe.some((s) => intersects(b.rect, s)), `${pw} bubble "${b.text}" rect does not intersect any textSafeArea`);
      }

      // 7. word counts: <=2 bubbles (schema) and <=35 words total per panel
      const totalWords = panel.bubbles.reduce((n, b) => n + words(b.text), 0);
      E(totalWords <= 35, `${pw} bubbles total ${totalWords} words (>35)`);

      // composition aspect must match the panel's layout slot aspect is verified in tests via LAYOUTS
    }

    // 7b. narration length (schema caps 320; root additionally <=40 words)
    E(r.beat.narration.length <= 320, `${where} narration exceeds 320 chars`);
    if (beat.key === 'root') E(words(r.beat.narration) <= 40, `${where} root narration is ${words(r.beat.narration)} words (>40)`);
  }

  // 8. both endings (and the optional sever) reachable from root via edges
  const reachable = new Set<string>(['root']);
  let grew = true;
  while (grew) {
    grew = false;
    for (const beat of ep.beats) {
      if (reachable.has(beat.key) || beat.parentKey === null) continue;
      if (!reachable.has(beat.parentKey)) continue;
      const parent = byKey.get(beat.parentKey)!;
      const via = beat.via;
      const ok =
        via.kind === 'custom' ||
        (via.kind === 'choice' && parent.response.choices.some((c) => c.id === via.choiceId));
      if (ok) { reachable.add(beat.key); grew = true; }
    }
  }
  for (const k of ['ending-repair-future', 'ending-repair-past', 'ending-sever']) {
    E(reachable.has(k), `ending '${k}' is not reachable from root by following via edges`);
  }

  // 9. custom compass beat hands the compass to the guardian
  const cc = byKey.get('custom-compass-1');
  E(!!cc, "missing beat 'custom-compass-1'");
  if (cc) {
    const moves = cc.response.stateDelta.inventoryChanges.some((c) => c.itemId === 'compass' && c.toHolder === 'guardian');
    E(moves, "custom-compass-1 does not move the compass to the guardian");
    E(cc.via.kind === 'custom', 'custom-compass-1 is not reached via a custom action');
  }

  // fallbackCustom must return a valid StoryResponse
  const root = byKey.get('root')!;
  const fb = StoryResponse.safeParse(ep.fallbackCustom(root, ep.initialState, 'spin around three times and whistle'));
  E(fb.success, `fallbackCustom output failed schema: ${fb.success ? '' : fb.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  if (fb.success) {
    E(fb.data.panels.length >= 1, 'fallbackCustom must include a panel');
    E(fb.data.beat.layoutTemplate === 'single-splash', "fallbackCustom must use layoutTemplate 'single-splash'");
    E(/Neri tries to/.test(fb.data.beat.narration), 'fallbackCustom narration must quote the action ("Neri tries to ...")');
    E(fb.data.choices.length === 2, 'fallbackCustom must return exactly 2 choices');
    E(fb.data.choices.map((c) => c.id).join(',') === 'return-a,return-b', "fallbackCustom choice ids must be 'return-a','return-b'");
  }

  return errors.filter(Boolean);
}

// standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  const errs = validateEpisode();
  if (errs.length) {
    console.error(`Episode validation FAILED with ${errs.length} error(s):`);
    for (const e of errs) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`Episode OK: ${EPISODE.beats.length} beats, ${EPISODE.beats.reduce((n, b) => n + b.response.panels.length, 0)} panels validated.`);
}
