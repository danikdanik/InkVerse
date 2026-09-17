/**
 * Story picker content: the prebuilt story starts, the "help me invent one" ingredient decks, small
 * single-color icons for each, and a deterministic composer that turns deck picks into a StorySetup.
 * The citadel start replays the authored demo episode; the other starts need Live mode so Fable can
 * outline a fresh episode from the setup.
 */
import type { StoryStartCard, SetupDecks } from '@shared/api';
import type { StorySetup, SetupCardKey } from '@shared/schemas';

// ---------- prebuilt story starts ----------
export const STORY_STARTS: StoryStartCard[] = [
  {
    id: 'citadel',
    title: 'The Citadel of Time and Space',
    teaser:
      'A cartographer crosses a bridge to a citadel hung between two skies that disagree by a single day. ' +
      'Her compass points at a sealed door the guardian swears was already opened, tomorrow.',
    firstChoices: ['Step through the gate', 'Question the guardian'],
    sketchKey: 'citadel',
    requiresLive: false,
    setup: {
      hero: 'Neri, a cartographer whose brass compass points at the connections between timelines.',
      world: 'A citadel suspended between two skies whose timelines disagree by exactly one day.',
      problem: 'A stone guardian insists the sealed door was opened tomorrow, and the two timelines are pulling apart.',
      mood: 'Wondrous mystery with quiet, personal stakes.',
    },
  },
  {
    id: 'shadow-strike',
    title: 'Shadow on Strike',
    teaser:
      'One morning, your shadow stops copying you. It folds its arms, points toward town, and holds up a ' +
      'handwritten sign: "WE NEED TO TALK." At school, several other shadows have disappeared completely.',
    firstChoices: ['Follow your shadow', 'Find someone else whose shadow is missing'],
    sketchKey: 'shadow',
    requiresLive: true,
    setup: {
      hero: 'A kid whose own shadow just quit, folded its arms, and started making demands.',
      world: 'An ordinary town where shadows have begun going on strike, and some vanish entirely.',
      problem: 'Your shadow needs to talk, other kids’ shadows are missing, and no grown-up can see the problem.',
      mood: 'Playful and a little uncanny, with a real mystery underneath.',
    },
  },
  {
    id: 'ten-minute-powers',
    title: 'Ten-Minute Powers',
    teaser: 'You finally get superpowers. They change every ten minutes. Your first mission starts in nine.',
    firstChoices: ['Test the power you have right now', 'Open the mission envelope'],
    sketchKey: 'bolt',
    requiresLive: true,
    setup: {
      hero: 'A rookie hero whose superpower reshuffles into a brand-new one every ten minutes.',
      world: 'A city full of working heroes where your abilities never stay the same twice.',
      problem: 'Your first mission starts in nine minutes and you cannot choose which power you will have.',
      mood: 'Fast, funny, high-energy action against the clock.',
    },
  },
  {
    id: 'custom',
    title: 'Your own idea',
    teaser: 'Type a sentence or build one from cards.',
    firstChoices: [],
    sketchKey: 'generic',
    requiresLive: true,
  },
];

// ---------- ingredient decks (8 per row) ----------
export const DECKS: SetupDecks = {
  hero: [
    { id: 'hero-mapmaker', title: 'The Mapmaker', text: 'A kid who draws maps of places that do not exist yet, then goes and finds them.', sketchKey: 'compass' },
    { id: 'hero-tinkerer', title: 'The Tinkerer', text: 'She builds machines out of junk, and about half of them almost work.', sketchKey: 'gear' },
    { id: 'hero-shadowless', title: 'The Shadowless One', text: 'A boy whose shadow ran off to have adventures without him.', sketchKey: 'shadow' },
    { id: 'hero-listener', title: 'The Quiet Listener', text: 'He can hear what animals worry about when they think no one is near.', sketchKey: 'creature' },
    { id: 'hero-starcatcher', title: 'The Star Catcher', text: 'A girl who keeps a fallen star in a jam jar, and it very much wants to go home.', sketchKey: 'star' },
    { id: 'hero-fastfriend', title: 'The Fast Friend', text: 'The fastest kid in town, except for the exact moments when it matters most.', sketchKey: 'bolt' },
    { id: 'hero-librarian', title: 'The Library Ghost', text: 'A shy kid who all but lives in the library and knows every secret shelf.', sketchKey: 'book' },
    { id: 'hero-smallknight', title: 'The Small Knight', text: 'The bravest of the small, armed mostly with a plan and a very loud voice.', sketchKey: 'flame' },
  ],
  world: [
    { id: 'world-floating', title: 'Floating Islands', text: 'Green islands drift through the sky on slow, warm currents of wind.', sketchKey: 'citadel' },
    { id: 'world-underforest', title: 'The Under-Forest', text: 'A forest that grows downward into the dark, its roots reaching for light.', sketchKey: 'leaf' },
    { id: 'world-tidecity', title: 'Tide City', text: 'A city that floods at high tide, so everyone lives and plays on the rooftops.', sketchKey: 'wave' },
    { id: 'world-neon', title: 'Neon Underground', text: 'Tunnels lit by glowing signs for shops that only open after midnight.', sketchKey: 'city' },
    { id: 'world-clockwork', title: 'The Clockwork Town', text: 'A town run by gears, where every door needs the exact right time to open.', sketchKey: 'clock' },
    { id: 'world-station', title: 'Station Adrift', text: 'A space station that lost its map and now drifts around a strange blue moon.', sketchKey: 'star' },
    { id: 'world-museum', title: 'The Endless Museum', text: 'A museum whose rooms quietly rearrange themselves whenever the lights blink.', sketchKey: 'book' },
    { id: 'world-frostpeak', title: 'Frostpeak', text: 'A mountain so tall its summit keeps a small pocket of last winter all year.', sketchKey: 'moon' },
  ],
  problem: [
    { id: 'prob-door', title: 'A Door That Waits', text: 'A door appears that will only open for someone it has never met before.', sketchKey: 'door' },
    { id: 'prob-colorthief', title: 'The Color Thief', text: 'One color has gone missing from the world, and nobody else has noticed yet.', sketchKey: 'eye' },
    { id: 'prob-slippinghour', title: 'The Slipping Hour', text: 'Time keeps skipping ten minutes, and you seem to be the only one who feels it.', sketchKey: 'clock' },
    { id: 'prob-crack', title: 'The Widening Crack', text: 'A crack in the ground is humming softly, and it grows a little wider each night.', sketchKey: 'crack' },
    { id: 'prob-familiar', title: 'The Runaway Familiar', text: 'Your best friend, who happens to be a very small dragon, has completely vanished.', sketchKey: 'creature' },
    { id: 'prob-storm', title: 'The Backwards Storm', text: 'A storm is rolling in that un-rains, lifting puddles right back up into the sky.', sketchKey: 'wave' },
    { id: 'prob-signal', title: 'The Strange Signal', text: 'A message keeps arriving, addressed to you by name, apparently sent from tomorrow.', sketchKey: 'bolt' },
    { id: 'prob-doubleyou', title: 'The Extra You', text: 'Someone wearing your exact face was seen doing something you know you never did.', sketchKey: 'mask' },
  ],
  mood: [
    { id: 'mood-wonder', title: 'Wide-Eyed Wonder', text: 'Everything feels new and bright and just a little too big to take in at once.', sketchKey: 'star' },
    { id: 'mood-tense', title: 'Quiet Tension', text: 'Something is wrong, and the hush before it is somehow the loudest part.', sketchKey: 'flame' },
    { id: 'mood-funny', title: 'Cheerful Chaos', text: 'Nothing goes to plan, and that is exactly where the fun keeps coming from.', sketchKey: 'mask' },
    { id: 'mood-cozy', title: 'Warm and Cozy', text: 'Small kindnesses and safe corners, even in the middle of a lot of trouble.', sketchKey: 'heart' },
    { id: 'mood-eerie', title: 'Gentle Eerie', text: 'Not scary, just strange, like a hallway that hums quietly after you leave it.', sketchKey: 'moon' },
    { id: 'mood-epic', title: 'Grand Adventure', text: 'Big skies, long roads, and the growing feeling that this journey really matters.', sketchKey: 'citadel' },
    { id: 'mood-mystery', title: 'Curious Mystery', text: 'Clues in every corner, and the itch to turn just one more page, one more corner.', sketchKey: 'eye' },
    { id: 'mood-hopeful', title: 'Bright and Hopeful', text: 'Hard things lie ahead, but the sun keeps insisting it will all be fine.', sketchKey: 'heart' },
  ],
};

// ---------- icons: single color (currentColor), viewBox 0 0 160 90, each under 1KB ----------
const svg = (body: string) =>
  `<svg viewBox="0 0 160 90" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const DECK_ART: Record<string, string> = {
  citadel: svg('<path d="M40 62 H120 M60 62 V38 h12 v24 M88 62 V30 h12 v32"/><path d="M62 38 l4 -8 4 8 M90 30 l4 -8 4 8"/>'),
  shadow: svg('<circle cx="66" cy="30" r="9"/><path d="M66 40 v22 M54 48 h24 M60 78 l6 -16 6 16"/><path d="M92 78 q18 -6 22 -30" stroke-dasharray="3 6"/>'),
  bolt: svg('<path d="M86 14 L60 50 h18 l-8 26 30 -40 h-18 Z"/>'),
  generic: svg('<rect x="34" y="22" width="92" height="46" rx="5"/><path d="M34 54 q22 -12 46 0 t46 -4"/>'),
  compass: svg('<circle cx="80" cy="45" r="26"/><path d="M80 45 L98 30 M80 45 L66 60"/><circle cx="80" cy="45" r="3" fill="currentColor"/>'),
  gear: svg('<circle cx="80" cy="45" r="14"/><path d="M80 22 v-8 M80 76 v-8 M57 45 h-8 M111 45 h-8 M63 28 l-6 -6 M103 68 l6 6 M97 28 l6 -6 M57 68 l-6 6"/>'),
  creature: svg('<path d="M56 66 q-6 -30 24 -30 t24 30 Z"/><path d="M62 40 l-6 -12 10 6 M98 40 l6 -12 -10 6"/><circle cx="72" cy="52" r="2.5" fill="currentColor"/><circle cx="88" cy="52" r="2.5" fill="currentColor"/>'),
  star: svg('<path d="M80 18 l7 20 21 1 -16 14 6 21 -18 -12 -18 12 6 -21 -16 -14 21 -1 Z"/>'),
  book: svg('<path d="M80 26 v42 M80 26 q-18 -8 -34 0 v42 q16 -8 34 0 M80 26 q18 -8 34 0 v42 q-16 -8 -34 0"/>'),
  flame: svg('<path d="M80 74 q-20 -6 -20 -26 q0 -16 14 -26 q-2 12 8 16 q8 -6 6 -18 q16 12 12 30 q-2 20 -20 24 Z"/>'),
  leaf: svg('<path d="M56 68 q0 -34 48 -46 q6 40 -48 46 Z M60 64 q24 -18 40 -34"/>'),
  wave: svg('<path d="M32 42 q12 -14 24 0 t24 0 24 0 24 0"/><path d="M32 58 q12 -14 24 0 t24 0 24 0 24 0"/>'),
  city: svg('<path d="M36 68 V44 h16 V68 M52 68 V32 h18 V68 M70 68 V50 h16 V68 M86 68 V38 h18 V68 M104 68 V54 h20 V68"/><path d="M30 68 H130"/>'),
  clock: svg('<circle cx="80" cy="45" r="24"/><path d="M80 45 V30 M80 45 l12 8"/>'),
  moon: svg('<path d="M92 22 a26 26 0 1 0 0 46 a20 20 0 1 1 0 -46 Z"/>'),
  door: svg('<rect x="60" y="20" width="40" height="50" rx="3"/><circle cx="92" cy="46" r="2.5" fill="currentColor"/>'),
  eye: svg('<path d="M40 45 q40 -30 80 0 q-40 30 -80 0 Z"/><circle cx="80" cy="45" r="8"/>'),
  crack: svg('<path d="M78 16 l8 16 -12 10 14 12 -8 20"/><path d="M40 70 H120"/>'),
  mask: svg('<path d="M50 30 q30 -10 60 0 q2 26 -12 34 q-18 8 -36 0 q-14 -8 -12 -34 Z"/><circle cx="68" cy="44" r="2.5" fill="currentColor"/><circle cx="92" cy="44" r="2.5" fill="currentColor"/>'),
  heart: svg('<path d="M80 68 q-26 -16 -26 -34 a13 13 0 0 1 26 -4 a13 13 0 0 1 26 4 q0 18 -26 34 Z"/>'),
};

// ---------- deterministic setup composer ----------
const CARD_KEYS: SetupCardKey[] = ['hero', 'world', 'problem', 'mood'];

/** Small deterministic PRNG so the same seed always yields the same fill. */
function rand(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function pickText(cards: SetupDecks[SetupCardKey], seed: number, avoid?: string): string {
  if (cards.length === 0) return '';
  let idx = Math.floor(rand(seed) * cards.length) % cards.length;
  if (avoid !== undefined && cards[idx].text === avoid) idx = (idx + 1) % cards.length;
  return cards[idx].text;
}

/**
 * Builds a StorySetup from deck ingredients. Provided `picks` and any `locked` cards are kept
 * verbatim; every other card is filled deterministically from the decks using `seed`. When
 * `shuffleOnly` is set, only that card is re-rolled to a different deck entry (locked cards still win).
 */
export function composeSetupFromDeck(input: {
  picks?: Partial<StorySetup>;
  locked: SetupCardKey[];
  shuffleOnly?: SetupCardKey;
  seed?: number;
}): StorySetup {
  const seed = (input.seed ?? Date.now()) >>> 0;
  const picks = input.picks ?? {};
  const locked = new Set(input.locked);
  const out = {} as StorySetup;

  CARD_KEYS.forEach((key, i) => {
    const deck = DECKS[key];
    const current = picks[key];
    if (locked.has(key) && current !== undefined) { out[key] = current; return; }
    if (input.shuffleOnly === key) { out[key] = pickText(deck, seed + i * 131 + 977, current); return; }
    if (current !== undefined) { out[key] = current; return; }
    out[key] = pickText(deck, seed + i * 131);
  });

  return out;
}
