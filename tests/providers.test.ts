import { describe, it, expect } from 'vitest';
import { sendOnlyAccepted, pickSize, capabilityFor, MODEL_IDS } from '../src/server/providers/registry';
import {
  buildSystemPrefix,
  buildUserMessage,
  buildSetupUserMessage,
  buildOutlineSystem,
  buildOutlineUserMessage,
  SETUP_SYSTEM,
} from '../src/server/providers/anthropic-prompt';
import type { StoryDirectorInput, ProposeSetupInput, OutlineEpisodeInput } from '../src/server/providers/types';

const ASPECTS = ['16:9', '4:3', '3:2', '1:1', '3:4', '2:3'] as const;

describe('runware request builder (registry)', () => {
  it('strips diffusion/seed/negative params for gpt-image, keeps quality + references', () => {
    const knobs = { seed: 7, steps: 4, negativePrompt: 'blurry', settings: { quality: 'medium' }, referenceImages: ['data:...'] };
    const out = sendOnlyAccepted(MODEL_IDS.finalFlare, knobs);
    expect(out).not.toHaveProperty('seed');
    expect(out).not.toHaveProperty('steps');
    expect(out).not.toHaveProperty('negativePrompt');
    expect(out).toHaveProperty('settings');
    expect(out).toHaveProperty('referenceImages');
  });

  it('strips quality/negative/reference params for FLUX, keeps seed + steps', () => {
    const knobs = { seed: 7, steps: 4, negativePrompt: 'blurry', settings: { quality: 'medium' }, referenceImages: ['data:...'] };
    const out = sendOnlyAccepted(MODEL_IDS.previewKlein, knobs);
    expect(out).toHaveProperty('seed');
    expect(out).toHaveProperty('steps');
    expect(out).not.toHaveProperty('negativePrompt');
    expect(out).not.toHaveProperty('settings');
    expect(out).not.toHaveProperty('referenceImages');
  });

  it('maps every aspect to an allowed size on the model dimension grid', () => {
    for (const model of [MODEL_IDS.finalFlare, MODEL_IDS.previewSchnell, MODEL_IDS.previewKlein]) {
      const step = model === MODEL_IDS.previewSchnell ? 64 : 16;
      for (const aspect of ASPECTS) {
        const { width, height } = pickSize(model, aspect);
        expect(width % step).toBe(0);
        expect(height % step).toBe(0);
        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);
        const [a, b] = aspect.split(':').map(Number);
        // Landscape aspects produce wider images, portrait produce taller.
        if (a > b) expect(width).toBeGreaterThanOrEqual(height);
        if (a < b) expect(height).toBeGreaterThanOrEqual(width);
      }
    }
  });

  it('exposes reference-image capability only for gpt-image models', () => {
    expect(capabilityFor(MODEL_IDS.finalFlare).supportsReferenceImages).toBe(true);
    expect(capabilityFor(MODEL_IDS.previewKlein).supportsReferenceImages).toBe(false);
  });
});

function baseInput(): StoryDirectorInput {
  return {
    bible: {
      id: 'b1',
      version: 1,
      issueTitle: 'Test Issue',
      premise: 'A test premise long enough to be valid.',
      characters: [
        { id: 'neri', name: 'Neri', role: 'protagonist', canonicalDescription: 'Short dark hair, teal jacket.', fixedTraits: [], referenceAssetIds: [], source: 'authored' },
      ],
      worldRules: ['Rule one.'],
      styleId: 'classic-pop',
      styleRules: ['bold ink contours'],
      tone: 'wondrous',
      genre: 'cosmic-mystery',
      episodeArc: [{ beatIndex: 0, goal: 'begin', pacing: 'setup' }],
    },
    state: {
      location: 'Gate',
      timeline: 'Now',
      inventory: {},
      relationships: [],
      knownFacts: [],
      promises: [],
      openThreads: [],
      pacing: 'setup',
      beatIndex: 0,
      summary: 'Start.',
    },
    recentBeats: [],
    pathSummary: 'Path summary.',
    action: { kind: 'preset', choice: { id: 'c1', label: 'Open gate', intent: 'open', requires: { items: [], facts: [] }, hotspot: { panelId: 'p1', rect: { x: 0, y: 0, w: 0.1, h: 0.1 } }, previewHint: 'gate' } },
    effort: 'low',
    readerCast: [],
  };
}

describe('anthropic prompt builder', () => {
  const READER_TEXT = 'ZZTOP_SECRET_READER_PHRASE_9417';

  it('keeps the system prefix byte-identical across two different actions (cache precondition)', () => {
    const a = baseInput();
    const b = baseInput();
    b.action = { kind: 'custom', customText: READER_TEXT };
    expect(buildSystemPrefix(a)).toBe(buildSystemPrefix(b));
  });

  it('places reader free text only in the user message, never in the system prefix', () => {
    const input = baseInput();
    input.action = { kind: 'custom', customText: READER_TEXT };
    expect(buildSystemPrefix(input).includes(READER_TEXT)).toBe(false);
    expect(buildUserMessage(input).includes(READER_TEXT)).toBe(true);
  });

  it('embeds the repair hint in the user message only', () => {
    const input = baseInput();
    const hint = 'REPAIR_HINT_TOKEN_55';
    expect(buildUserMessage(input, hint).includes(hint)).toBe(true);
    expect(buildSystemPrefix(input).includes(hint)).toBe(false);
  });
});

describe('proposeSetup / outlineEpisode prompt builders', () => {
  it('setup system states the verbatim-locked and single-card-shuffle rules', () => {
    expect(SETUP_SYSTEM).toContain('locked');
    expect(SETUP_SYSTEM).toContain('shuffleOnly');
    expect(SETUP_SYSTEM.toLowerCase()).toContain('original');
  });

  it('setup user message carries idea/picks/locked as data', () => {
    const input: ProposeSetupInput = {
      idea: 'A girl discovers that her doodles can escape her notebook',
      picks: { mood: 'Funny adventure with a little mystery' },
      locked: ['mood'],
      shuffleOnly: 'hero',
    };
    const msg = buildSetupUserMessage(input);
    expect(msg).toContain('doodles');
    expect(msg).toContain('"locked":["mood"]');
    expect(msg).toContain('"shuffleOnly":"hero"');
  });

  function outlineInput(): OutlineEpisodeInput {
    return {
      startId: 'custom',
      setup: { hero: 'Alex, an inventive student', world: 'An ordinary town', problem: 'The notebook is stolen', mood: 'Funny mystery' },
      protagonistName: 'Alex',
      styleId: 'classic-pop',
      tone: 'playful',
      readerCast: [],
      startCard: { title: 'Doodle Escape', teaser: 'Drawings are loose', firstChoices: ['Chase the sketch', 'Guard the notebook'] },
    };
  }

  it('outline system embeds the 6-beat arc, opening-trio, and no-lettering rules', () => {
    const sys = buildOutlineSystem(outlineInput());
    expect(sys).toContain('setup, discovery, discovery, complication, complication, payoff');
    expect(sys).toContain('opening-trio');
    expect(sys.toLowerCase()).toContain('id "hero"');
    expect(sys).toContain('Do not put any lettering, text, or speech bubbles inside sceneBrief');
  });

  it('outline user message honors provided first choices verbatim', () => {
    const msg = buildOutlineUserMessage(outlineInput());
    expect(msg).toContain('Chase the sketch');
    expect(msg).toContain('Guard the notebook');
    expect(msg).toContain('"protagonistName":"Alex"');
  });
});
