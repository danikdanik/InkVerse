import { describe, it, expect } from 'vitest';
import { EPISODE } from '@content/episode';
import { STORY_STARTS, DECKS, DECK_ART, composeSetupFromDeck } from '@content/decks';
import { validateEpisode } from '../scripts/validate-episode.ts';
import { StoryResponse, StoryBible, StoryState, StorySetup } from '@shared/schemas';
import { StoryStartCard, SetupDecks } from '@shared/api';
import { LAYOUTS } from '@shared/layouts';

describe('demo episode fixtures', () => {
  it('passes the full episode validator (schema, art, reachability, custom action)', () => {
    expect(validateEpisode(EPISODE)).toEqual([]);
  });

  it('bible and initial state satisfy the shared schema', () => {
    expect(StoryBible.safeParse(EPISODE.bible).success).toBe(true);
    expect(StoryState.safeParse(EPISODE.initialState).success).toBe(true);
    expect(EPISODE.bible.id).toBe('citadel-1');
    expect(EPISODE.bible.episodeArc.length).toBe(6);
    expect(EPISODE.initialState.inventory).toMatchObject({ compass: 'neri', map: 'neri', satchel: 'neri' });
  });

  it('every beat.response parses and every hotspot panel exists in its beat', () => {
    for (const beat of EPISODE.beats) {
      const parsed = StoryResponse.safeParse(beat.response);
      expect(parsed.success, `beat ${beat.key}`).toBe(true);
      const ids = new Set(beat.response.panels.map((p) => p.id));
      for (const c of beat.response.choices) expect(ids.has(c.hotspot.panelId), `${beat.key}/${c.id}`).toBe(true);
    }
  });

  it('each panel aspect matches its layout slot aspect', () => {
    for (const beat of EPISODE.beats) {
      const layout = LAYOUTS[beat.response.beat.layoutTemplate];
      for (const panel of beat.response.panels) {
        const slot = layout.slots.find((s) => s.slot === panel.layoutSlot);
        expect(slot, `${beat.key}/${panel.id} slot ${panel.layoutSlot} in ${layout.id}`).toBeTruthy();
        expect(panel.composition.aspect, `${beat.key}/${panel.id}`).toBe(slot!.aspect);
      }
    }
  });

  it('the root offers exactly the gate and guardian choices', () => {
    const root = EPISODE.beats.find((b) => b.key === 'root')!;
    expect(root.response.choices.map((c) => c.id)).toEqual(['gate', 'guardian']);
    expect(root.parentKey).toBeNull();
  });

  it('the custom compass beat matches its trigger phrases and moves the compass to the guardian', () => {
    const cc = EPISODE.beats.find((b) => b.key === 'custom-compass-1')!;
    expect(cc.via.kind).toBe('custom');
    if (cc.via.kind === 'custom') {
      expect(cc.via.match.test('ask the guardian to hold the compass')).toBe(true);
      expect(cc.via.match.test('hand the compass to it')).toBe(true);
    }
    const move = cc.response.stateDelta.inventoryChanges.find((c) => c.itemId === 'compass');
    expect(move?.toHolder).toBe('guardian');
  });

  it('knowledge gates later choices: beat-4 requires facts or trust from its route', () => {
    const g4 = EPISODE.beats.find((b) => b.key === 'gate-4')!;
    const gFuture = g4.response.choices.find((c) => c.id === 'g4-future')!;
    expect(gFuture.requires.facts.length).toBeGreaterThan(0);

    const gd4 = EPISODE.beats.find((b) => b.key === 'guardian-4')!;
    const gdPast = gd4.response.choices.find((c) => c.id === 'gd4-past')!;
    expect(gdPast.requires.minTrust?.characterId).toBe('guardian');
    expect(gdPast.requires.minTrust?.trust).toBeGreaterThanOrEqual(1);
  });

  it('both route endings are reachable and carry the right ending kind', () => {
    const future = EPISODE.beats.find((b) => b.key === 'ending-repair-future')!;
    const past = EPISODE.beats.find((b) => b.key === 'ending-repair-past')!;
    expect(future.response.ending?.kind).toBe('repair-future');
    expect(past.response.ending?.kind).toBe('repair-past');
    expect(future.response.choices).toEqual([]);
    expect(past.response.choices).toEqual([]);
  });

  it('fallbackCustom quotes the reader action and returns a valid, dead-ending response', () => {
    const root = EPISODE.beats.find((b) => b.key === 'root')!;
    const res = EPISODE.fallbackCustom(root, EPISODE.initialState, 'climb the nearest tower');
    expect(StoryResponse.safeParse(res).success).toBe(true);
    expect(res.beat.narration).toMatch(/Neri tries to climb the nearest tower/);
    expect(res.beat.layoutTemplate).toBe('single-splash');
    expect(res.choices.map((c) => c.id)).toEqual(['return-a', 'return-b']);
  });

  it('all ten sketch keys are present as inline SVG', () => {
    const keys = ['gate', 'guardian', 'archive', 'compass', 'citadel', 'door', 'map', 'void', 'ending', 'generic'] as const;
    for (const k of keys) {
      expect(EPISODE.sketches[k], k).toBeTruthy();
      expect(EPISODE.sketches[k]).toContain('viewBox="0 0 160 90"');
    }
  });

  it('the clear-line bible uses the shared style rules for that finish', () => {
    expect(EPISODE.bible.styleId).toBe('clear-line');
    expect(EPISODE.bible.styleRules.length).toBeGreaterThan(0);
  });
});

describe('story picker: starts, decks, composer', () => {
  it('STORY_STARTS parse and cover all four starts, citadel is the only demo (not live)', () => {
    expect(StoryStartCard.array().safeParse(STORY_STARTS).success).toBe(true);
    expect(STORY_STARTS.map((s) => s.id).sort()).toEqual(['citadel', 'custom', 'shadow-strike', 'ten-minute-powers']);
    const citadel = STORY_STARTS.find((s) => s.id === 'citadel')!;
    expect(citadel.requiresLive).toBe(false);
    expect(citadel.firstChoices).toEqual(['Step through the gate', 'Question the guardian']);
    for (const s of STORY_STARTS.filter((s) => s.id !== 'citadel')) expect(s.requiresLive).toBe(true);
    // prebuilt starts carry an authored setup; 'custom' does not
    for (const s of STORY_STARTS.filter((s) => s.id !== 'custom')) expect(StorySetup.safeParse(s.setup).success, s.id).toBe(true);
    expect(STORY_STARTS.find((s) => s.id === 'custom')!.setup).toBeUndefined();
  });

  it('DECKS parse and each row has eight cards', () => {
    expect(SetupDecks.safeParse(DECKS).success).toBe(true);
    for (const key of ['hero', 'world', 'problem', 'mood'] as const) {
      expect(DECKS[key].length, key).toBe(8);
      const ids = DECKS[key].map((c) => c.id);
      expect(new Set(ids).size, `${key} unique ids`).toBe(ids.length);
    }
  });

  it('DECK_ART has a valid icon for every sketchKey used by starts and decks', () => {
    const used = new Set<string>(STORY_STARTS.map((s) => s.sketchKey));
    for (const key of ['hero', 'world', 'problem', 'mood'] as const) DECKS[key].forEach((c) => used.add(c.sketchKey));
    for (const k of ['shadow', 'bolt']) expect(used.has(k), `expected ${k} to be used`).toBe(true);
    for (const k of used) {
      expect(DECK_ART[k], `missing icon ${k}`).toBeTruthy();
      expect(DECK_ART[k]).toContain('viewBox="0 0 160 90"');
      expect(DECK_ART[k].length, `icon ${k} under 1KB`).toBeLessThan(1024);
    }
  });

  it('composeSetupFromDeck fills all four cards deterministically and parses as StorySetup', () => {
    const a = composeSetupFromDeck({ locked: [], seed: 42 });
    const b = composeSetupFromDeck({ locked: [], seed: 42 });
    expect(a).toEqual(b);
    expect(StorySetup.safeParse(a).success).toBe(true);
  });

  it('composeSetupFromDeck keeps locked cards verbatim', () => {
    const out = composeSetupFromDeck({
      picks: { hero: 'A locked hero of my own', world: 'A locked world' },
      locked: ['hero'],
      seed: 7,
    });
    expect(out.hero).toBe('A locked hero of my own');
    // world was provided as a pick (not locked) so it is also kept verbatim
    expect(out.world).toBe('A locked world');
    // problem and mood were filled from the decks
    expect(DECKS.problem.some((c) => c.text === out.problem)).toBe(true);
    expect(DECKS.mood.some((c) => c.text === out.mood)).toBe(true);
  });

  it('shuffleOnly re-rolls only the named card and respects a lock on it', () => {
    const base = composeSetupFromDeck({ locked: [], seed: 100 });
    const shuffled = composeSetupFromDeck({ picks: base, locked: [], shuffleOnly: 'mood', seed: 101 });
    expect(shuffled.hero).toBe(base.hero);
    expect(shuffled.world).toBe(base.world);
    expect(shuffled.problem).toBe(base.problem);
    expect(shuffled.mood).not.toBe(base.mood);
    expect(DECKS.mood.some((c) => c.text === shuffled.mood)).toBe(true);

    const locked = composeSetupFromDeck({ picks: base, locked: ['mood'], shuffleOnly: 'mood', seed: 101 });
    expect(locked.mood).toBe(base.mood);
  });
});
