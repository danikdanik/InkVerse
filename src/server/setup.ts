/**
 * Story-start + ingredient-deck catalog. Prefers the authored '@content/decks' module; falls back
 * to a compact built-in catalog so /api/setup/* works before the content agent's decks land.
 * The dynamic import uses a variable specifier so tsc never hard-resolves the (maybe absent) module.
 */
import { StorySetup, type SetupCardKey } from '@shared/schemas';
import { StoryStartCard, SetupDecks, type StoryStartCard as TStartCard, type SetupDecks as TDecks } from '@shared/api';

type StorySetupT = ReturnType<typeof StorySetup.parse>;

export interface ComposeInput {
  picks?: Partial<StorySetupT>;
  locked: SetupCardKey[];
  shuffleOnly?: SetupCardKey;
  seed?: number;
}

export interface SetupCatalog {
  STORY_STARTS: TStartCard[];
  DECKS: TDecks;
  composeSetupFromDeck: (input: ComposeInput) => StorySetupT;
}

const FALLBACK_STARTS: TStartCard[] = [
  {
    id: 'citadel',
    title: 'The Citadel Between Skies',
    teaser: 'A bridge ends at a citadel hung between a dawn sky and a dusk sky, and your compass will not settle.',
    firstChoices: ['Step through the gate', 'Question the guardian'],
    sketchKey: 'citadel',
    requiresLive: false,
  },
  {
    id: 'shadow-strike',
    title: 'Shadow Strike',
    teaser: 'A city under a curfew of shadows; a courier who can step between them looks for the source.',
    firstChoices: ['Follow the courier', 'Trace the shadow'],
    sketchKey: 'generic',
    requiresLive: true,
  },
  {
    id: 'ten-minute-powers',
    title: 'Ten-Minute Powers',
    teaser: 'Every ten minutes a new, random power arrives and the last one leaves. Use them before the clock turns.',
    firstChoices: ['Test the new power', 'Save it for the door'],
    sketchKey: 'generic',
    requiresLive: true,
  },
  {
    id: 'custom',
    title: 'Invent your own',
    teaser: 'Describe a hero, a world, a problem and a mood, and Fable builds the opening for you.',
    firstChoices: [],
    sketchKey: 'generic',
    requiresLive: true,
  },
].map((s) => StoryStartCard.parse(s));

const card = (id: string, title: string, text: string, sketchKey = 'generic') => ({ id, title, text, sketchKey });

const FALLBACK_DECKS: TDecks = SetupDecks.parse({
  hero: [
    card('hero-1', 'Reluctant heir', 'A reluctant heir who would rather run the workshop than the war'),
    card('hero-2', 'Quiet cartographer', 'A quiet cartographer who maps places that do not exist yet'),
  ],
  world: [
    card('world-1', 'Two skies', 'A world split between a dawn sky and a dusk sky that refuse to agree'),
    card('world-2', 'Sunken archive', 'A drowned archive-city where memories wash up on the tide'),
  ],
  problem: [
    card('problem-1', 'The sealed door', 'A door that the future has already opened but the present cannot'),
    card('problem-2', 'The forgetting', 'The city is forgetting people one by one, starting with you'),
  ],
  mood: [
    card('mood-1', 'Wondrous', 'Wondrous and a little melancholic'),
    card('mood-2', 'Tense', 'Tense, close, and quietly dangerous'),
  ],
});

const DEFAULTS: StorySetupT = {
  hero: FALLBACK_DECKS.hero[0].text,
  world: FALLBACK_DECKS.world[0].text,
  problem: FALLBACK_DECKS.problem[0].text,
  mood: FALLBACK_DECKS.mood[0].text,
};

function fallbackCompose(input: ComposeInput): StorySetupT {
  const out: StorySetupT = { ...DEFAULTS };
  const cards: Record<SetupCardKey, { text: string }[]> = {
    hero: FALLBACK_DECKS.hero,
    world: FALLBACK_DECKS.world,
    problem: FALLBACK_DECKS.problem,
    mood: FALLBACK_DECKS.mood,
  };
  if (input.picks) {
    for (const k of Object.keys(out) as SetupCardKey[]) {
      const v = input.picks[k];
      if (typeof v === 'string' && v.trim()) out[k] = v;
    }
  }
  // shuffle a single card to a different deck option
  if (input.shuffleOnly) {
    const pool = cards[input.shuffleOnly];
    const pick = pool[(input.seed ?? Math.floor(Math.random() * pool.length)) % pool.length];
    out[input.shuffleOnly] = pick.text;
  }
  return StorySetup.parse(out);
}

const FALLBACK: SetupCatalog = {
  STORY_STARTS: FALLBACK_STARTS,
  DECKS: FALLBACK_DECKS,
  composeSetupFromDeck: fallbackCompose,
};

export async function loadSetupCatalog(): Promise<SetupCatalog> {
  try {
    const spec = '@content/decks';
    const mod: any = await import(spec);
    if (mod?.STORY_STARTS && mod?.DECKS && typeof mod?.composeSetupFromDeck === 'function') {
      return mod as SetupCatalog;
    }
  } catch {
    // decks module not written yet; use the built-in fallback
  }
  return FALLBACK;
}
