/**
 * INKVERSE demo episode fixtures: "Issue #1: The Citadel of Time and Space".
 * Every beat.response is exactly what Fable would return; the server replays these through the
 * same worker/job/event path in demo mode. Art files under src/content/art are honest hand-drawn
 * SVG placeholders that the providers agent's render script replaces with FLUX/GPT Image output.
 */
import type { FixtureEpisode, FixtureBeat } from './types';
import type {
  StoryBible, StoryState, StoryResponse, PanelSpec, Choice, Composition,
  MotionParams, StateDelta, Bubble, NormPoint, NormRect, SketchKey,
} from '@shared/schemas';
import { STYLES } from '@shared/styles';

type Subject = Composition['subjects'][number];

// ---------- palettes (all from the inkline finish; each 2-5 valid hex) ----------
const INK = '#141210', PAPER = '#f4efe4', TEAL = '#2bb3c0';
const P_CITADEL = [INK, PAPER, TEAL, '#2a2f4a'];
const P_COMPASS = [INK, PAPER, TEAL, '#d9a441'];
const P_DOOR = [INK, PAPER, TEAL, '#b5533b'];
const P_GATE = [INK, PAPER, TEAL, '#5b7fb5'];
const P_GUARDIAN = [INK, PAPER, '#2b7a78', '#e8a13a'];
const P_ARCHIVE = [INK, PAPER, TEAL, '#e8a13a'];
const P_ENDING = [INK, PAPER, '#e8a13a', TEAL];
const P_VOID = [INK, '#1b1a33', TEAL, '#5b7fb5'];

// ---------- shared geometry ----------
const TS: NormRect[] = [
  { x: 0.06, y: 0.05, w: 0.88, h: 0.2 },
  { x: 0.06, y: 0.74, w: 0.88, h: 0.21 },
];
const B_TOPL: NormRect = { x: 0.09, y: 0.07, w: 0.46, h: 0.13 };
const B_TOPR: NormRect = { x: 0.5, y: 0.07, w: 0.4, h: 0.13 };
const B_BOT: NormRect = { x: 0.1, y: 0.78, w: 0.5, h: 0.13 };
const B_BOTR: NormRect = { x: 0.52, y: 0.78, w: 0.38, h: 0.13 };

// ---------- builders (fill every default so literals stay in the story, not the boilerplate) ----------
const M = (preset: MotionParams['preset'], o: Partial<MotionParams> = {}): MotionParams => ({
  preset, durationMs: 4800, focalPoint: { x: 0.5, y: 0.45 }, zoomStart: 1, zoomEnd: 1.03,
  panXPercent: 0, panYPercent: 0, intensity: 0.28, particleCount: 12, seed: 7, ...o,
});
const D = (o: Partial<StateDelta> = {}): StateDelta => ({
  inventoryChanges: [], relationshipChanges: [], addFacts: [], addPromises: [],
  resolvePromises: [], addThreads: [], resolveThreads: [], ...o,
});
const SP = (speakerId: string, text: string, rect: NormRect, tailTo?: NormPoint): Bubble =>
  ({ kind: 'speech', speakerId, text, rect, ...(tailTo ? { tailTo } : {}) });
const CAP = (text: string, rect: NormRect): Bubble => ({ kind: 'caption', text, rect });

const C = (o: {
  id: string; label: string; intent: string; panelId: string; rect: NormRect; hint: string;
  items?: string[]; facts?: string[]; minTrust?: { characterId: string; trust: number };
}): Choice => ({
  id: o.id, label: o.label, intent: o.intent,
  requires: { items: o.items ?? [], facts: o.facts ?? [], ...(o.minTrust ? { minTrust: o.minTrust } : {}) },
  hotspot: { panelId: o.panelId, rect: o.rect }, previewHint: o.hint,
});

const P = (o: {
  id: string; slot?: number; action: string; present?: string[]; sketch: SketchKey;
  shot: Composition['shot']; view?: Composition['viewpoint']; subjects?: Subject[];
  focal?: NormPoint; keyProp?: string; bg: string; palette: string[]; aspect: Composition['aspect'];
  safe?: NormRect[]; brief: string; bubbles?: Bubble[]; alt: string; motion: MotionParams;
}): PanelSpec => ({
  id: o.id, layoutSlot: o.slot ?? 0, action: o.action, presentCharacterIds: o.present ?? [],
  composition: {
    shot: o.shot, viewpoint: o.view ?? 'eye-level', subjects: o.subjects ?? [],
    focalPoint: o.focal ?? { x: 0.5, y: 0.45 }, ...(o.keyProp ? { keyProp: o.keyProp } : {}),
    background: o.bg, palette: o.palette, textSafeAreas: o.safe ?? TS, aspect: o.aspect,
  },
  sceneBrief: o.brief, bubbles: o.bubbles ?? [], altText: o.alt, altTextVerified: true,
  motion: o.motion, sketchKey: o.sketch,
});

const art = (key: string, ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, { preview: `${key}-${id}-preview.svg`, final: `${key}-${id}-final.svg` }]));

// ---------- durable facts referenced by later requirements ----------
const FACT_ARCHIVE = "The archive lists Neri's missing map page as 'lost tomorrow'.";
const FACT_SCARF = "The visitor the guardian remembers from tomorrow wore a teal scarf; it was Neri.";
const FACT_SPLIT = 'Held by the guardian, the compass exists in both timelines and its needle has split in two.';

// ---------- bible ----------
const bible: StoryBible = {
  id: 'citadel-1',
  version: 1,
  issueTitle: 'Issue #1: The Citadel of Time and Space',
  premise:
    'Neri, a cartographer, crosses a bridge to a citadel suspended between two incompatible timelines that ' +
    'disagree by a single day. Her brass compass points at a sealed door, but the stone guardian insists the ' +
    'door was already opened, tomorrow. Neri must discover why the timelines are separating and decide which ' +
    'connection to repair before the citadel forgets her entirely.',
  characters: [
    {
      id: 'neri', name: 'Neri', role: 'protagonist',
      canonicalDescription:
        'Adult cartographer with warm brown skin and short dark curly hair marked by one silver streak. Wears a ' +
        'mustard field jacket, a teal scarf, dark trousers and worn boots, with a brown cross-body map satchel and ' +
        'a brass compass whose center glows cyan.',
      fixedTraits: [
        'adult cartographer', 'warm brown skin', 'short dark curly hair with one silver streak',
        'mustard field jacket', 'teal scarf', 'dark trousers', 'worn boots',
        'brown cross-body map satchel', 'brass compass with a cyan center',
      ],
      referenceAssetIds: [], source: 'authored',
    },
    {
      id: 'guardian', name: 'The Guardian', role: 'supporting',
      canonicalDescription:
        'Stone guardian of the citadel: a towering figure of cracked basalt with moss growing in the seams and one ' +
        'eye lit amber. It speaks of the future in the past tense, as if tomorrow had already happened.',
      fixedTraits: ['cracked basalt body', 'moss in the seams', 'one amber-lit eye', 'speaks of the future in past tense'],
      referenceAssetIds: [], source: 'authored',
    },
    {
      id: 'archivist', name: 'The Archivist', role: 'supporting',
      canonicalDescription:
        'The keeper of a floating archive: a lantern-like drifting index with no face, ringed by shelves that turn ' +
        'in the air. It records only what will be lost, never what happened.',
      fixedTraits: ['lantern-like drifting index', 'no face', 'ringed by floating shelves', 'glows softly'],
      referenceAssetIds: [], source: 'authored',
    },
  ],
  worldRules: [
    'The citadel holds two timelines that disagree by exactly one day.',
    'Objects handed to the guardian exist in both timelines at once.',
    'The archive records what will be lost, not what happened.',
    'The door opens only for someone the citadel remembers.',
    'The compass points to the nearest unrepaired connection.',
  ],
  styleId: 'clear-line',
  styleRules: STYLES['clear-line'].rules,
  tone: 'wondrous',
  genre: 'cosmic-mystery',
  episodeArc: [
    { beatIndex: 0, goal: 'Arrive at the threshold; the compass points to a sealed door.', pacing: 'setup' },
    { beatIndex: 1, goal: 'Discover why the two timelines disagree.', pacing: 'discovery' },
    { beatIndex: 2, goal: 'Find the clue that names the connection being lost.', pacing: 'discovery' },
    { beatIndex: 3, goal: 'The complication: the visitor from tomorrow was Neri herself.', pacing: 'complication' },
    { beatIndex: 4, goal: 'Choose which connection to repair, guided by what was learned.', pacing: 'complication' },
    { beatIndex: 5, goal: 'Repair the past, repair the future, or sever the citadel.', pacing: 'payoff' },
  ],
};

// ---------- initial state ----------
const initialState: StoryState = {
  location: 'Citadel threshold',
  timeline: 'today (unstable)',
  inventory: { compass: 'neri', map: 'neri', satchel: 'neri' },
  relationships: [{ characterId: 'guardian', trust: 0 }],
  knownFacts: [],
  promises: [],
  openThreads: ['Why are the two timelines separating?'],
  pacing: 'setup',
  beatIndex: 0,
  summary: 'Neri reaches a citadel suspended between two skies. Her compass points at a sealed door.',
};

// ---------- beats ----------
const beats: FixtureBeat[] = [
  // ===== ROOT =====
  {
    key: 'root', parentKey: null, via: { kind: 'root' },
    art: art('root', ['p0', 'p1', 'p2']),
    response: {
      beat: {
        title: 'The Citadel Between Skies',
        narration:
          'The bridge ends at a citadel hung between two skies that refuse to agree. Neri’s compass will not ' +
          'settle. Its cyan needle keeps pointing at one sealed door.',
        pacing: 'setup', layoutTemplate: 'opening-trio',
      },
      stateDelta: D({ addThreads: ['The door the compass points to will not open.'] }),
      panels: [
        P({
          id: 'p0', slot: 0, action: 'Establishing shot of the citadel suspended between two skies; Neri crosses the bridge.',
          present: ['neri'], sketch: 'citadel', shot: 'extreme-wide', view: 'low-angle',
          subjects: [{ characterId: 'neri', at: { x: 0.32, y: 0.66 }, facing: 'right' }],
          focal: { x: 0.55, y: 0.42 }, keyProp: 'stone bridge', aspect: '16:9', palette: P_CITADEL,
          bg: 'Two disagreeing skies, dawn on the left and dusk on the right, split by the citadel silhouette.',
          brief:
            'A vast stone citadel of leaning towers floats over an abyss, joined to the foreground by a narrow bridge. ' +
            'One sky breaks into dawn, the other into dusk, meeting in a seam of light behind the towers. A small lone ' +
            'figure in a mustard jacket and teal scarf walks the bridge toward the citadel.',
          bubbles: [CAP('Two skies. One bridge. No agreement.', B_BOT)],
          alt: 'Wide view of a floating stone citadel between a dawn sky and a dusk sky, a tiny figure crossing a bridge toward it.',
          motion: M('drifting_dust', { zoomEnd: 1.04, panXPercent: 1.2, focalPoint: { x: 0.55, y: 0.42 } }),
        }),
        P({
          id: 'p1', slot: 1, action: 'Extreme close-up of the brass compass; its needle points at a sealed door.',
          present: [], sketch: 'compass', shot: 'extreme-close-up', view: 'top-down',
          focal: { x: 0.5, y: 0.5 }, keyProp: 'brass compass with a cyan center', aspect: '1:1', palette: P_COMPASS,
          bg: 'A faint double exposure of a sealed door bleeds through the compass glass.',
          brief:
            'Macro view of an antique brass compass held open, its center glowing cyan. The needle strains toward one ' +
            'edge. A ghosted double exposure of a tall sealed door shows faintly through the glass, as if two moments ' +
            'overlap.',
          bubbles: [CAP('It only ever points here.', B_BOT)],
          alt: 'Close-up of a brass compass with a glowing cyan center, its needle pointing off to one side, a sealed door faint behind the glass.',
          motion: M('energy_pulse', { intensity: 0.35, zoomEnd: 1.02, particleCount: 10 }),
        }),
        P({
          id: 'p2', slot: 2, action: 'Decision panel: a glowing cosmic gate at left, the stone guardian at right beside the unopened door.',
          present: ['guardian'], sketch: 'door', shot: 'wide', view: 'eye-level',
          subjects: [{ characterId: 'guardian', at: { x: 0.74, y: 0.55 }, facing: 'left' }],
          focal: { x: 0.5, y: 0.5 }, keyProp: 'unopened door', aspect: '3:2', palette: P_DOOR,
          bg: 'Interior courtyard: a rift of light on the left, a sealed door in the wall on the right.',
          brief:
            'A courtyard inside the citadel. On the left a cosmic gate glows, an arch full of drifting stars. On the ' +
            'right a towering figure of cracked basalt with one amber eye stands beside a tall sealed door set in the ' +
            'wall. Space is left quiet above both for lettering.',
          bubbles: [
            SP('guardian', 'You opened that door tomorrow.', B_TOPR, { x: 0.74, y: 0.4 }),
            SP('neri', 'Then why is it still shut?', B_BOT, { x: 0.3, y: 0.6 }),
          ],
          alt: 'A glowing star-filled gate on the left; a cracked stone guardian with an amber eye stands beside a sealed door on the right.',
          motion: M('portal', { intensity: 0.34, zoomEnd: 1.03, focalPoint: { x: 0.3, y: 0.5 } }),
        }),
      ],
      choices: [
        C({
          id: 'gate', label: 'Step through the gate', intent: 'Cross the cosmic gate into the floating archive.',
          panelId: 'p2', rect: { x: 0.04, y: 0.3, w: 0.28, h: 0.5 }, hint: 'Enter the glowing gate',
        }),
        C({
          id: 'guardian', label: 'Question the guardian', intent: 'Stay and press the stone guardian about the door.',
          panelId: 'p2', rect: { x: 0.66, y: 0.3, w: 0.3, h: 0.5 }, hint: 'Speak with the guardian',
        }),
      ],
      continuityNotes: ['Compass owned by Neri; needle locked on the sealed door.', 'Guardian trust starts at 0.'],
      summaryUpdate: 'Neri arrives at the citadel between two skies. The compass points at a sealed door; the guardian claims the door was opened tomorrow.',
    },
  },

  // ===== GATE ROUTE =====
  {
    key: 'gate-1', parentKey: 'root', via: { kind: 'choice', choiceId: 'gate' },
    art: art('gate-1', ['p0']),
    response: {
      beat: {
        title: 'The Floating Archive',
        narration:
          'Through the gate, shelves drift in the dark around a faceless lantern. The archivist turns one index to ' +
          'Neri: a map page listed as lost, the exact page torn from her own satchel.',
        pacing: 'discovery', layoutTemplate: 'single-splash',
      },
      stateDelta: D({
        location: 'The floating archive', timeline: 'tomorrow (archived)', pacing: 'discovery',
        addFacts: [FACT_ARCHIVE],
        addThreads: ['A page of Neri’s map is already recorded as lost.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'Neri floats among turning shelves; the archivist shows an index naming her missing map page.',
          present: ['neri', 'archivist'], sketch: 'archive', shot: 'wide', view: 'eye-level',
          subjects: [
            { characterId: 'neri', at: { x: 0.34, y: 0.6 }, facing: 'right' },
            { characterId: 'archivist', at: { x: 0.68, y: 0.44 }, facing: 'left' },
          ],
          focal: { x: 0.6, y: 0.48 }, keyProp: 'archive index page', aspect: '3:2', palette: P_ARCHIVE,
          bg: 'Weightless shelves turning slowly around a floating lantern in deep blue space.',
          brief:
            'A weightless archive: rings of shelves rotate around a faceless lantern-like keeper that glows amber. Neri ' +
            'floats among them in her mustard jacket and teal scarf, reaching for a single glowing index card that ' +
            'names a lost map page. Deep blue void behind.',
          bubbles: [SP('archivist', 'Recorded: one page, lost tomorrow.', B_TOPL, { x: 0.68, y: 0.44 })],
          alt: 'Neri floats among rotating archive shelves toward a faceless glowing lantern that holds a single index card.',
          motion: M('slow_push', { zoomEnd: 1.03, intensity: 0.24 }),
        }),
      ],
      choices: [
        C({
          id: 'g1-next', label: 'Follow the index deeper', intent: 'Chase the record of the lost page further into the archive.',
          panelId: 'p0', rect: { x: 0.6, y: 0.3, w: 0.3, h: 0.4 }, hint: 'Go deeper',
        }),
        C({
          id: 'g1-index', label: 'Read the lost-page entry', intent: 'Study the archive entry about the missing map page.',
          panelId: 'p0', rect: { x: 0.55, y: 0.36, w: 0.24, h: 0.22 }, hint: 'Read the entry', facts: [FACT_ARCHIVE],
        }),
      ],
      continuityNotes: ['Neri crossed into the tomorrow-archive timeline.', 'Archive names Neri’s own map page as lost.'],
      summaryUpdate: 'Neri enters the floating archive. The archivist shows an index listing her own missing map page as lost tomorrow.',
    },
  },
  {
    key: 'gate-2', parentKey: 'gate-1', via: { kind: 'choice', choiceId: 'g1-next' },
    art: art('gate-2', ['p0']),
    response: {
      beat: {
        title: 'What Will Be Lost',
        narration:
          'Deeper in, the shelves thin to a single hovering page: Neri’s missing map, drawn in a hand she has ' +
          'not used yet. The archive keeps only what is about to be lost.',
        pacing: 'discovery', layoutTemplate: 'single-splash',
      },
      stateDelta: D({
        addFacts: ['The lost map page is drawn in Neri’s own future hand.'],
        addThreads: ['The two timelines are pulling the same page in opposite directions.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'A single map page hovers in a shaft of light; Neri recognizes her own future handwriting.',
          present: ['neri'], sketch: 'map', shot: 'medium', view: 'over-shoulder',
          subjects: [{ characterId: 'neri', at: { x: 0.3, y: 0.62 }, facing: 'right' }],
          focal: { x: 0.62, y: 0.44 }, keyProp: 'the lost map page', aspect: '3:2', palette: P_ARCHIVE,
          bg: 'A dim vault where one page floats in a shaft of pale light.',
          brief:
            'Over Neri’s shoulder: a single unrolled map page hangs in a shaft of pale light in a dim archive vault. ' +
            'Its coastline is inked in a confident hand. Neri, in mustard and teal, reaches toward it, recognizing the ' +
            'work as her own though she has not drawn it yet.',
          bubbles: [SP('neri', 'That’s my line work. I haven’t drawn it yet.', B_BOT, { x: 0.6, y: 0.5 })],
          alt: 'Neri reaches from shadow toward a single glowing map page hovering in a shaft of light.',
          motion: M('slow_push', { zoomEnd: 1.03, focalPoint: { x: 0.62, y: 0.44 } }),
        }),
      ],
      choices: [
        C({
          id: 'g2-next', label: 'Trace where the page tore', intent: 'Follow the torn edge back toward the sealed door.',
          panelId: 'p0', rect: { x: 0.58, y: 0.32, w: 0.3, h: 0.36 }, hint: 'Trace the tear',
        }),
        C({
          id: 'g2-alt', label: 'Ask what else will be lost', intent: 'Press the archive for the rest of what it records.',
          panelId: 'p0', rect: { x: 0.08, y: 0.4, w: 0.24, h: 0.3 }, hint: 'Ask the archive',
        }),
      ],
      continuityNotes: ['The lost page is in Neri’s future hand.'],
      summaryUpdate: 'Neri finds the lost map page drawn in her own future hand. The archive holds only what is about to be lost.',
    },
  },
  {
    key: 'gate-3', parentKey: 'gate-2', via: { kind: 'choice', choiceId: 'g2-next' },
    art: art('gate-3', ['p0']),
    response: {
      beat: {
        title: 'The Seam in the Light',
        narration:
          'The torn edge leads back to the gate, where the two timelines part like a seam. Through the tear Neri sees ' +
          'the sealed door from the other side, already ajar.',
        pacing: 'complication', layoutTemplate: 'single-splash',
      },
      stateDelta: D({
        location: 'The seam at the gate', pacing: 'complication',
        addFacts: ['In the tomorrow-timeline the sealed door already stands open.'],
        addThreads: ['To repair the future, the door must stay open on this side too.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'The gate splits into a bright seam; through it the sealed door appears ajar in the other timeline.',
          present: ['neri'], sketch: 'gate', shot: 'wide', view: 'eye-level',
          subjects: [{ characterId: 'neri', at: { x: 0.28, y: 0.62 }, facing: 'right' }],
          focal: { x: 0.6, y: 0.46 }, keyProp: 'the seam of light', aspect: '3:2', palette: P_GATE,
          bg: 'A vertical seam of brilliant light dividing two versions of the same courtyard.',
          brief:
            'A tall arch splits down the middle into a brilliant vertical seam of light, dividing two versions of the ' +
            'same courtyard. On the far side, glimpsed through the tear, the once-sealed door stands ajar. Neri in ' +
            'mustard and teal stands small before the seam.',
          bubbles: [CAP('On the far side, the door is already open.', B_BOT)],
          alt: 'A glowing vertical seam splits an archway; through it a previously sealed door is seen standing open.',
          motion: M('portal', { intensity: 0.36, zoomEnd: 1.03, focalPoint: { x: 0.6, y: 0.46 } }),
        }),
      ],
      choices: [
        C({
          id: 'g3-next', label: 'Reach into the seam', intent: 'Move toward the open door in the other timeline.',
          panelId: 'p0', rect: { x: 0.5, y: 0.3, w: 0.22, h: 0.44 }, hint: 'Reach through',
        }),
        C({
          id: 'g3-alt', label: 'Map the seam first', intent: 'Chart the tear before stepping through.',
          panelId: 'p0', rect: { x: 0.08, y: 0.4, w: 0.2, h: 0.3 }, hint: 'Chart it',
        }),
      ],
      continuityNotes: ['The door is open in tomorrow, sealed today.'],
      summaryUpdate: 'The torn page leads Neri to the seam at the gate, where she sees the door already open in the tomorrow-timeline.',
    },
  },
  {
    key: 'gate-4', parentKey: 'gate-3', via: { kind: 'choice', choiceId: 'g3-next' },
    art: art('gate-4', ['p0']),
    response: {
      beat: {
        title: 'Deeper Than the Index',
        narration:
          'Two doors, sealed and open, shimmer in the seam. But the archive is not finished with her: the index tugs ' +
          'downward, insisting there is a lower shelf where tomorrow is still being written by hand.',
        pacing: 'discovery', layoutTemplate: 'single-splash',
      },
      stateDelta: D({
        addThreads: ['The archive is not finished writing tomorrow.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'Two versions of the door overlap in the seam; Neri holds the recovered page, deciding.',
          present: ['neri'], sketch: 'gate', shot: 'medium', view: 'eye-level',
          subjects: [{ characterId: 'neri', at: { x: 0.4, y: 0.6 }, facing: 'camera' }],
          focal: { x: 0.5, y: 0.46 }, keyProp: 'the recovered map page', aspect: '3:2', palette: P_GATE,
          bg: 'Two overlapping doorways glowing in the seam, one sealed, one open.',
          brief:
            'Two overlapping doorways shimmer in a seam of light, one sealed and one open, their outlines not quite ' +
            'aligned. Neri stands centered, facing the viewer, holding the recovered map page, her teal scarf lifting ' +
            'in the draft from the seam. Quiet space above for lettering.',
          bubbles: [SP('neri', 'The record isn’t finished.', B_BOT, { x: 0.42, y: 0.55 })],
          alt: 'Neri stands holding a map page between two overlapping glowing doorways, one sealed and one open.',
          motion: M('energy_pulse', { intensity: 0.34, zoomEnd: 1.03 }),
        }),
      ],
      choices: [
        C({
          id: 'g4-descend', label: 'Descend to the deeper shelf', intent: 'Follow the tugging index down to where tomorrow is still being written.',
          panelId: 'p0', rect: { x: 0.55, y: 0.3, w: 0.24, h: 0.44 }, hint: 'Go deeper',
        }),
        C({
          id: 'g4-listen', label: 'Reread the lost-page record', intent: 'Study the archived lost-page entry once more before descending.',
          panelId: 'p0', rect: { x: 0.2, y: 0.32, w: 0.22, h: 0.42 }, hint: 'Reread it', facts: [FACT_ARCHIVE],
        }),
      ],
      continuityNotes: ['The archive is still writing tomorrow; the deeper shelf pulls Neri down.'],
      summaryUpdate: 'At the seam the archive keeps pulling; Neri descends toward the deeper shelf where tomorrow is still being written.',
    },
  },
  {
    key: 'gate-5', parentKey: 'gate-4', via: { kind: 'choice', choiceId: 'g4-descend' },
    art: art('root', ['p0', 'p1']),
    response: {
      beat: {
        title: 'Where Tomorrow Is Written',
        narration:
          'The deeper shelf is a writing-room. Index cards fill themselves with tomorrow’s entries, inked by a hand ' +
          'no one is holding. Each new line names something the citadel is about to lose.',
        pacing: 'discovery', layoutTemplate: 'duo-stack',
      },
      stateDelta: D({
        location: 'The deeper archive',
        addFacts: ['Tomorrow’s archive entries are being written now by an unseen hand.'],
        addThreads: ['Something writes tomorrow before it happens.'],
      }),
      panels: [
        P({
          id: 'p0', slot: 0, action: 'Neri and the archivist float in a deeper vault where cards write themselves in midair.',
          present: ['neri', 'archivist'], sketch: 'archive', shot: 'wide', view: 'eye-level',
          subjects: [
            { characterId: 'neri', at: { x: 0.3, y: 0.62 }, facing: 'right' },
            { characterId: 'archivist', at: { x: 0.7, y: 0.42 }, facing: 'left' },
          ],
          focal: { x: 0.6, y: 0.46 }, keyProp: 'a self-writing index card', aspect: '16:9', palette: P_ARCHIVE,
          bg: 'A deeper vault of turning shelves; cards hover and fill with fresh ink in the dark.',
          brief:
            'A deep archive vault seen wide: rings of shelves recede into blue dark around the faceless lantern keeper. ' +
            'Small index cards hover in the air, each filling with a line of fresh ink as if written by an invisible ' +
            'hand. Neri floats among them in mustard and teal, watching.',
          bubbles: [SP('archivist', 'Tomorrow is written here, before it arrives.', B_TOPL, { x: 0.7, y: 0.42 })],
          alt: 'Neri and a faceless lantern float in a deep archive where index cards write themselves in midair.',
          motion: M('slow_push', { zoomEnd: 1.03, intensity: 0.24 }),
        }),
        P({
          id: 'p1', slot: 1, action: 'Close on a single card as a line of ink appears, naming Neri’s map among tomorrow’s losses.',
          present: [], sketch: 'map', shot: 'close-up', view: 'top-down',
          focal: { x: 0.5, y: 0.48 }, keyProp: 'the self-writing card', aspect: '16:9', palette: P_ARCHIVE,
          bg: 'One index card lit in a shaft of light, ink crawling across it line by line.',
          brief:
            'Top-down close view of a single index card lit in a shaft of pale light. A line of dark ink crawls across ' +
            'it on its own, forming words, the newest entry among a stack of tomorrow’s losses. No hand is visible.',
          bubbles: [CAP('The newest line is her own map.', B_BOT)],
          alt: 'Close view of an index card as a line of ink writes itself across it with no hand present.',
          motion: M('energy_pulse', { intensity: 0.3, zoomEnd: 1.03 }),
        }),
      ],
      choices: [
        C({
          id: 'g5-next', label: 'Chase the unseen hand', intent: 'Follow the writing back toward today and the sealed door.',
          panelId: 'p0', rect: { x: 0.58, y: 0.3, w: 0.3, h: 0.4 }, hint: 'Follow the ink',
        }),
        C({
          id: 'g5-read', label: 'Read tomorrow’s entry', intent: 'Study the self-writing entry naming the lost page.',
          panelId: 'p1', rect: { x: 0.3, y: 0.3, w: 0.4, h: 0.4 }, hint: 'Read the card', facts: [FACT_ARCHIVE],
        }),
      ],
      continuityNotes: ['The archive writes tomorrow before it happens.'],
      summaryUpdate: 'Deeper in the archive, Neri finds tomorrow’s entries written by an unseen hand; the newest names her own map.',
    },
  },
  {
    key: 'gate-6', parentKey: 'gate-5', via: { kind: 'choice', choiceId: 'g5-next' },
    art: art('root', ['p0']),
    response: {
      beat: {
        title: 'The Erasing of Today',
        narration:
          'Chasing the ink back, Neri feels today thinning behind her. In her satchel the map is going blank, ' +
          'coastlines lifting off the paper the way the archive lifts what it records.',
        pacing: 'complication', layoutTemplate: 'single-splash',
      },
      stateDelta: D({
        pacing: 'complication',
        addFacts: ['The archive has begun to erase today; Neri’s own map is fading from her satchel.'],
        addThreads: ['If the erasing finishes, there will be no today for the door to open onto.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'Neri holds her own map as its inked coastlines lift and dissolve into drifting motes.',
          present: ['neri'], sketch: 'map', shot: 'medium', view: 'over-shoulder',
          subjects: [{ characterId: 'neri', at: { x: 0.34, y: 0.62 }, facing: 'right' }],
          focal: { x: 0.58, y: 0.46 }, keyProp: 'Neri’s fading map', aspect: '3:2', palette: P_ARCHIVE,
          bg: 'The archive edge where the vault meets the fading courtyard of today.',
          brief:
            'Over Neri’s shoulder: she holds her unrolled map in both hands as its inked coastlines lift off the paper ' +
            'and dissolve into drifting motes of light. Behind her the courtyard of today thins to pale nothing. She is ' +
            'in mustard and teal, alarmed but steady.',
          bubbles: [SP('neri', 'It’s taking today too.', B_BOT, { x: 0.4, y: 0.55 })],
          alt: 'Neri holds her map as its coastlines lift off the paper and dissolve while the scene behind her fades.',
          motion: M('drifting_dust', { intensity: 0.3, zoomEnd: 1.03, particleCount: 16 }),
        }),
      ],
      choices: [
        C({
          id: 'g6-next', label: 'Race to the seam', intent: 'Reach the seam before today is fully erased.',
          panelId: 'p0', rect: { x: 0.55, y: 0.3, w: 0.28, h: 0.4 }, hint: 'Hurry to the seam',
        }),
        C({
          id: 'g6-hold', label: 'Redraw one coastline', intent: 'Try to hold the fading map by re-inking what the archive named lost.',
          panelId: 'p0', rect: { x: 0.1, y: 0.36, w: 0.24, h: 0.3 }, hint: 'Redraw it', facts: [FACT_ARCHIVE],
        }),
      ],
      continuityNotes: ['Today is being erased; Neri’s map is fading.'],
      summaryUpdate: 'Racing back, Neri finds the archive erasing today; her own map begins to dissolve from her satchel.',
    },
  },
  {
    key: 'gate-7', parentKey: 'gate-6', via: { kind: 'choice', choiceId: 'g6-next' },
    art: art('root', ['p0']),
    response: {
      beat: {
        title: 'The Archivist’s Bargain',
        narration:
          'At the seam the archivist waits, holding the lost page like a lantern. It will give the page back, it says, ' +
          'for a single memory to keep in its place. Repair the future, or let the seam finish and drift free.',
        pacing: 'payoff', layoutTemplate: 'single-splash',
      },
      stateDelta: D({
        location: 'The seam at the gate', pacing: 'payoff',
        addThreads: ['Neri must trade a memory for the lost page to repair the future, or sever the citadel.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'The archivist extends the recovered page across the seam; Neri weighs the trade.',
          present: ['neri', 'archivist'], sketch: 'archive', shot: 'medium', view: 'eye-level',
          subjects: [
            { characterId: 'neri', at: { x: 0.32, y: 0.62 }, facing: 'right' },
            { characterId: 'archivist', at: { x: 0.68, y: 0.44 }, facing: 'left' },
          ],
          focal: { x: 0.55, y: 0.46 }, keyProp: 'the recovered lost page', aspect: '3:2', palette: P_ARCHIVE,
          bg: 'A bright seam of light; the faceless lantern holds a single glowing page across it.',
          brief:
            'At a vertical seam of light, the faceless lantern-keeper extends a single glowing map page toward Neri. ' +
            'She stands in mustard and teal, one hand half-raised, weighing whether to take it. Quiet dark space above ' +
            'for lettering.',
          bubbles: [
            SP('archivist', 'The page, for one memory to keep.', B_TOPL, { x: 0.68, y: 0.44 }),
            SP('neri', 'A fair trade, or a trap.', B_BOT, { x: 0.32, y: 0.6 }),
          ],
          alt: 'A faceless lantern holds out a glowing map page across a seam of light while Neri weighs whether to take it.',
          motion: M('energy_pulse', { intensity: 0.32, zoomEnd: 1.03 }),
        }),
      ],
      choices: [
        C({
          id: 'g7-future', label: 'Repair the future', intent: 'Trade a memory for the lost page and knit the timelines back together.',
          panelId: 'p0', rect: { x: 0.55, y: 0.3, w: 0.24, h: 0.44 }, hint: 'Take the page', facts: [FACT_ARCHIVE],
        }),
        C({
          id: 'g7-sever', label: 'Sever the citadel', intent: 'Refuse the trade and let the seam finish, cutting the timelines apart.',
          panelId: 'p0', rect: { x: 0.2, y: 0.32, w: 0.22, h: 0.42 }, hint: 'Cut them apart',
        }),
      ],
      continuityNotes: ['Repairing the future requires the archived lost-page fact.'],
      summaryUpdate: 'At the seam the archivist offers the lost page for a memory; Neri must repair the future or sever the citadel.',
    },
  },

  // ===== GUARDIAN ROUTE =====
  {
    key: 'guardian-1', parentKey: 'root', via: { kind: 'choice', choiceId: 'guardian' },
    art: art('guardian-1', ['p0']),
    response: {
      beat: {
        title: 'Spoken in Past Tense',
        narration:
          'Neri lets the guardian speak without arguing. It remembers a visitor from tomorrow who wore a teal scarf, ' +
          'and asked, exactly, the question Neri is about to ask.',
        pacing: 'discovery', layoutTemplate: 'single-splash',
      },
      stateDelta: D({
        pacing: 'discovery',
        relationshipChanges: [{ characterId: 'guardian', trustDelta: 1, note: 'Neri listened instead of arguing.' }],
        addFacts: [FACT_SCARF],
        addThreads: ['The visitor from tomorrow may have been Neri.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'Neri stands quietly before the guardian, who lowers its amber eye and remembers her.',
          present: ['neri', 'guardian'], sketch: 'guardian', shot: 'medium', view: 'low-angle',
          subjects: [
            { characterId: 'neri', at: { x: 0.32, y: 0.66 }, facing: 'right' },
            { characterId: 'guardian', at: { x: 0.7, y: 0.5 }, facing: 'left' },
          ],
          focal: { x: 0.6, y: 0.46 }, keyProp: 'the guardian’s amber eye', aspect: '3:2', palette: P_GUARDIAN,
          bg: 'The sealed door in shadow behind the towering stone guardian.',
          brief:
            'Low angle on a towering guardian of cracked basalt, moss in its seams, one eye lit amber, leaning slightly ' +
            'toward Neri who stands small and still in her mustard jacket and teal scarf. The sealed door waits in ' +
            'shadow behind them. Warm amber light, cool stone.',
          bubbles: [
            SP('guardian', 'The one who came tomorrow wore your scarf.', B_TOPR, { x: 0.7, y: 0.42 }),
            SP('neri', 'Describe her. Please.', B_BOT, { x: 0.32, y: 0.6 }),
          ],
          alt: 'Neri stands quietly before a towering cracked-stone guardian with a glowing amber eye, the sealed door behind them.',
          motion: M('still', { intensity: 0.18, zoomEnd: 1.02 }),
        }),
      ],
      choices: [
        C({
          id: 'gd1-next', label: 'Keep listening', intent: 'Let the guardian keep describing the visitor from tomorrow.',
          panelId: 'p0', rect: { x: 0.58, y: 0.3, w: 0.3, h: 0.4 }, hint: 'Listen on',
        }),
        C({
          id: 'gd1-ask', label: 'Ask what she opened', intent: 'Ask the guardian what the tomorrow-visitor unlocked.',
          panelId: 'p0', rect: { x: 0.08, y: 0.4, w: 0.24, h: 0.3 }, hint: 'Ask directly',
        }),
      ],
      continuityNotes: ['Guardian trust +1 for listening.', 'Visitor from tomorrow wore Neri’s scarf.'],
      summaryUpdate: 'Neri listens; the guardian trusts her more and recalls a tomorrow-visitor in a teal scarf who asked Neri’s own question.',
    },
  },
  {
    key: 'guardian-2', parentKey: 'guardian-1', via: { kind: 'choice', choiceId: 'gd1-next' },
    art: art('guardian-2', ['p0']),
    response: {
      beat: {
        title: 'The Visitor Was You',
        narration:
          'The guardian lifts a memory into the air like breath on cold glass: the visitor’s face. It is Neri’s ' +
          'own, one day older, with the same silver streak.',
        pacing: 'discovery', layoutTemplate: 'single-splash',
      },
      stateDelta: D({
        relationshipChanges: [{ characterId: 'guardian', trustDelta: 1, note: 'Shared the memory of the visitor.' }],
        addFacts: ['The tomorrow-visitor was Neri herself, one day older.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'The guardian exhales a shimmering memory showing Neri’s own face, a day older.',
          present: ['neri', 'guardian'], sketch: 'guardian', shot: 'close-up', view: 'eye-level',
          subjects: [
            { characterId: 'guardian', at: { x: 0.68, y: 0.5 }, facing: 'left' },
            { characterId: 'neri', at: { x: 0.28, y: 0.6 }, facing: 'right' },
          ],
          focal: { x: 0.5, y: 0.42 }, keyProp: 'a memory of Neri’s face', aspect: '3:2', palette: P_GUARDIAN,
          bg: 'A shimmering memory hovers between Neri and the guardian.',
          brief:
            'A shimmering translucent memory hovers in the air between Neri and the stone guardian, showing Neri’s ' +
            'own face a day older, the silver streak brighter. Neri, in mustard and teal, stares at it. The guardian’s ' +
            'amber eye reflects the vision.',
          bubbles: [SP('neri', 'That’s me. Tomorrow.', B_BOT, { x: 0.4, y: 0.5 })],
          alt: 'A glowing memory of Neri’s own older face hovers between her and the stone guardian.',
          motion: M('energy_pulse', { intensity: 0.32, zoomEnd: 1.03 }),
        }),
      ],
      choices: [
        C({
          id: 'gd2-next', label: 'Ask why you came back', intent: 'Ask the guardian why the future Neri returned.',
          panelId: 'p0', rect: { x: 0.55, y: 0.3, w: 0.3, h: 0.4 }, hint: 'Ask why',
        }),
        C({
          id: 'gd2-alt', label: 'Touch the memory', intent: 'Reach into the hovering memory of your future self.',
          panelId: 'p0', rect: { x: 0.36, y: 0.34, w: 0.24, h: 0.3 }, hint: 'Reach in',
        }),
      ],
      continuityNotes: ['Neri confirmed as the tomorrow-visitor.'],
      summaryUpdate: 'The guardian shows Neri that the tomorrow-visitor was her own future self. Trust deepens.',
    },
  },
  {
    key: 'guardian-3', parentKey: 'guardian-2', via: { kind: 'choice', choiceId: 'gd2-next' },
    art: art('guardian-3', ['p0']),
    response: {
      beat: {
        title: 'What the Door Remembers',
        narration:
          'The guardian turns to the sealed door. It opened for the visitor because the citadel remembered her. Today ' +
          'it has begun to forget, and the memory is what the timelines are losing.',
        pacing: 'complication', layoutTemplate: 'single-splash',
      },
      stateDelta: D({
        pacing: 'complication',
        addFacts: ['The citadel is forgetting Neri; the lost connection is its memory of her.'],
        addThreads: ['To reopen the door, the citadel must remember Neri again.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'The guardian rests a stone hand on the sealed door; faint carvings of Neri’s face fade from it.',
          present: ['neri', 'guardian'], sketch: 'door', shot: 'medium', view: 'eye-level',
          subjects: [
            { characterId: 'guardian', at: { x: 0.66, y: 0.5 }, facing: 'left' },
            { characterId: 'neri', at: { x: 0.3, y: 0.62 }, facing: 'right' },
          ],
          focal: { x: 0.55, y: 0.46 }, keyProp: 'the sealed door', aspect: '3:2', palette: P_DOOR,
          bg: 'A sealed door carved with a face that is slowly fading from the stone.',
          brief:
            'The stone guardian lays one cracked hand on a tall sealed door. Carved into the door is a face, Neri’s ' +
            'face, but the carving is fading from the stone as if being forgotten. Neri watches, unsettled, in mustard ' +
            'and teal. Cool light, warm amber eye.',
          bubbles: [SP('guardian', 'It opened because we remembered you.', B_TOPR, { x: 0.66, y: 0.42 })],
          alt: 'The guardian touches a sealed door carved with Neri’s slowly fading face while Neri watches.',
          motion: M('slow_push', { intensity: 0.24, zoomEnd: 1.03 }),
        }),
      ],
      choices: [
        C({
          id: 'gd3-next', label: 'Offer a memory to the door', intent: 'Give the citadel a memory so it remembers Neri.',
          panelId: 'p0', rect: { x: 0.5, y: 0.3, w: 0.28, h: 0.44 }, hint: 'Offer a memory',
        }),
        C({
          id: 'gd3-alt', label: 'Read the fading carving', intent: 'Study the fading carving of your own face.',
          panelId: 'p0', rect: { x: 0.52, y: 0.34, w: 0.2, h: 0.3 }, hint: 'Read the carving',
        }),
      ],
      continuityNotes: ['The lost connection is the citadel’s memory of Neri.'],
      summaryUpdate: 'The guardian reveals the door opened because the citadel remembered Neri; now it is forgetting her, and that memory is the lost connection.',
    },
  },
  {
    key: 'guardian-4', parentKey: 'guardian-3', via: { kind: 'choice', choiceId: 'gd3-next' },
    art: art('guardian-4', ['p0']),
    response: {
      beat: {
        title: 'The Door’s Other Face',
        narration:
          'Neri lifts her hand to the fading carving, but the guardian closes its own hand over hers. Before she trades ' +
          'anything away, it says, she should see the door’s other face, the one that already opened in the second timeline.',
        pacing: 'discovery', layoutTemplate: 'single-splash',
      },
      stateDelta: D({
        addThreads: ['The door wears a second face in the other timeline.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'Neri holds her hand to the door beside the guardian, ready to give it a memory.',
          present: ['neri', 'guardian'], sketch: 'door', shot: 'medium', view: 'eye-level',
          subjects: [
            { characterId: 'neri', at: { x: 0.4, y: 0.6 }, facing: 'right' },
            { characterId: 'guardian', at: { x: 0.72, y: 0.5 }, facing: 'left' },
          ],
          focal: { x: 0.5, y: 0.46 }, keyProp: 'the sealed door', aspect: '3:2', palette: P_DOOR,
          bg: 'The sealed door, its carved face almost gone, the guardian waiting beside it.',
          brief:
            'Neri raises her open hand toward the sealed door where her carved face has nearly vanished. The guardian ' +
            'stands close, amber eye steady, waiting. A faint cyan light gathers at Neri’s palm. Quiet space above ' +
            'for lettering.',
          bubbles: [SP('guardian', 'See its other face first.', B_TOPR, { x: 0.72, y: 0.42 })],
          alt: 'Neri raises a glowing hand toward a sealed door beside the waiting stone guardian.',
          motion: M('energy_pulse', { intensity: 0.3, zoomEnd: 1.03 }),
        }),
      ],
      choices: [
        C({
          id: 'gd4-descend', label: 'See the other face', intent: 'Follow the guardian to the door’s second-timeline face before deciding.',
          panelId: 'p0', rect: { x: 0.55, y: 0.3, w: 0.26, h: 0.44 }, hint: 'Follow the guardian',
        }),
        C({
          id: 'gd4-hold', label: 'Ask what it still holds', intent: 'Ask the guardian to recount what it remembers of you.',
          panelId: 'p0', rect: { x: 0.08, y: 0.4, w: 0.22, h: 0.3 }, hint: 'Ask it', minTrust: { characterId: 'guardian', trust: 1 },
        }),
      ],
      continuityNotes: ['The guardian offers to show the door’s second face.'],
      summaryUpdate: 'Before Neri gives a memory, the guardian offers to show the door’s other face in the second timeline.',
    },
  },
  {
    key: 'guardian-5', parentKey: 'guardian-4', via: { kind: 'choice', choiceId: 'gd4-descend' },
    art: art('root', ['p0', 'p1']),
    response: {
      beat: {
        title: 'The Face That Opened',
        narration:
          'The guardian turns the door on its hinge of years. Its other face belongs to the second timeline, where ' +
          'the carving of Neri is not fading but bright, and the door already stands open for her.',
        pacing: 'discovery', layoutTemplate: 'duo-side',
      },
      stateDelta: D({
        addFacts: ['In the second timeline the door already opened for Neri; there her carved face is bright, not fading.'],
        addThreads: ['Two yesterdays hold two versions of the same door.'],
      }),
      panels: [
        P({
          id: 'p0', slot: 0, action: 'The guardian turns the great door to show its second face to Neri.',
          present: ['neri', 'guardian'], sketch: 'door', shot: 'medium', view: 'low-angle',
          subjects: [
            { characterId: 'guardian', at: { x: 0.66, y: 0.5 }, facing: 'left' },
            { characterId: 'neri', at: { x: 0.3, y: 0.64 }, facing: 'right' },
          ],
          focal: { x: 0.55, y: 0.46 }, keyProp: 'the turning door', aspect: '4:3', palette: P_GUARDIAN,
          bg: 'The sealed door swinging on a deep hinge to reveal a second face beyond it.',
          brief:
            'Low angle: the stone guardian pushes the tall door on a deep hinge, turning it to reveal a second face of ' +
            'the same door. Neri, small in mustard and teal, watches from below. Warm amber light on cracked basalt, ' +
            'cool stone beyond.',
          bubbles: [SP('guardian', 'Its other face never closed.', B_TOPR, { x: 0.66, y: 0.42 })],
          alt: 'The stone guardian turns a great door to show a second face while Neri watches from below.',
          motion: M('slow_push', { intensity: 0.24, zoomEnd: 1.03 }),
        }),
        P({
          id: 'p1', slot: 1, action: 'The second-timeline door stands open, Neri’s carved face bright and whole in the stone.',
          present: [], sketch: 'door', shot: 'medium', view: 'eye-level',
          focal: { x: 0.5, y: 0.44 }, keyProp: 'the open second door', aspect: '3:4', palette: P_DOOR,
          bg: 'A tall open doorway spilling warm light, a bright carved face in the lintel.',
          brief:
            'A tall narrow view of an open doorway in the second timeline, warm light spilling through. Above it, ' +
            'carved sharp and bright in the stone, is Neri’s own face, whole and unfaded, unlike the vanishing carving ' +
            'on today’s door.',
          bubbles: [CAP('There, she is remembered.', B_BOT)],
          alt: 'A tall open doorway spilling light, a bright carved face of Neri sharp in the stone above it.',
          motion: M('slow_push', { intensity: 0.22, zoomEnd: 1.03 }),
        }),
      ],
      choices: [
        C({
          id: 'gd5-next', label: 'Turn back to today’s door', intent: 'Return to the fading door and the guardian’s failing memory.',
          panelId: 'p0', rect: { x: 0.5, y: 0.3, w: 0.28, h: 0.4 }, hint: 'Back to today',
        }),
        C({
          id: 'gd5-scarf', label: 'Point out the teal scarf', intent: 'Show the guardian the carved visitor wore your own scarf.',
          panelId: 'p1', rect: { x: 0.3, y: 0.3, w: 0.4, h: 0.4 }, hint: 'The scarf', facts: [FACT_SCARF],
        }),
      ],
      continuityNotes: ['The door’s second face opened for Neri in the other timeline.'],
      summaryUpdate: 'The guardian shows the door’s other face: in the second timeline it already opened for Neri, her carving bright and whole.',
    },
  },
  {
    key: 'guardian-6', parentKey: 'guardian-5', via: { kind: 'choice', choiceId: 'gd5-next' },
    art: art('root', ['p0']),
    response: {
      beat: {
        title: 'When the Guardian Forgets',
        narration:
          'Back at today’s door the guardian’s amber eye dims. It reaches for Neri’s name and finds a gap. Only the ' +
          'trust between them keeps her from slipping out of the citadel’s memory entirely.',
        pacing: 'complication', layoutTemplate: 'single-splash',
      },
      stateDelta: D({
        pacing: 'complication',
        relationshipChanges: [{ characterId: 'guardian', trustDelta: 1, note: 'Neri steadied the guardian as it began to forget.' }],
        addFacts: ['The guardian itself is beginning to forget Neri; only its trust in her still holds the memory.'],
        addThreads: ['If the guardian forgets Neri, no one is left to open the door.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'The guardian’s amber eye flickers and dims; Neri steadies its cracked hand.',
          present: ['neri', 'guardian'], sketch: 'guardian', shot: 'close-up', view: 'low-angle',
          subjects: [
            { characterId: 'guardian', at: { x: 0.64, y: 0.5 }, facing: 'left' },
            { characterId: 'neri', at: { x: 0.32, y: 0.64 }, facing: 'right' },
          ],
          focal: { x: 0.58, y: 0.44 }, keyProp: 'the dimming amber eye', aspect: '3:2', palette: P_GUARDIAN,
          bg: 'The sealed door in shadow; the guardian’s eye guttering like a low flame.',
          brief:
            'Close and low: the stone guardian’s single amber eye flickers and dims like a guttering flame, moss ' +
            'greying in its seams. Neri, in mustard and teal, lays both hands on its cracked wrist to steady it. The ' +
            'sealed door waits dark behind.',
          bubbles: [
            SP('guardian', 'Your name… I had it a moment ago.', B_TOPR, { x: 0.64, y: 0.42 }),
            SP('neri', 'I’m still here. Hold on.', B_BOT, { x: 0.32, y: 0.6 }),
          ],
          alt: 'The stone guardian’s amber eye dims while Neri steadies its cracked hand before the sealed door.',
          motion: M('still', { intensity: 0.18, zoomEnd: 1.02 }),
        }),
      ],
      choices: [
        C({
          id: 'gd6-next', label: 'Face the door together', intent: 'Bring the fading guardian with you to the sealed door.',
          panelId: 'p0', rect: { x: 0.5, y: 0.3, w: 0.28, h: 0.4 }, hint: 'To the door',
        }),
        C({
          id: 'gd6-steady', label: 'Give the guardian your name', intent: 'Speak your name into the guardian so its trust can hold it.',
          panelId: 'p0', rect: { x: 0.1, y: 0.36, w: 0.24, h: 0.3 }, hint: 'Say your name', minTrust: { characterId: 'guardian', trust: 1 },
        }),
      ],
      continuityNotes: ['Guardian trust +1 for steadying it.', 'The guardian is starting to forget Neri.'],
      summaryUpdate: 'Back at today’s door the guardian begins to forget Neri; only their trust holds her memory, and it deepens.',
    },
  },
  {
    key: 'guardian-7', parentKey: 'guardian-6', via: { kind: 'choice', choiceId: 'gd6-next' },
    art: art('root', ['p0']),
    response: {
      beat: {
        title: 'Which Yesterday to Keep',
        narration:
          'At the door the guardian cups two faint yesterdays in its palm: the day Neri arrived, and the brighter day ' +
          'it still opened for her. It asks her to choose which one the citadel will keep and hold.',
        pacing: 'payoff', layoutTemplate: 'single-splash',
      },
      stateDelta: D({
        pacing: 'payoff',
        addThreads: ['Neri must choose which yesterday the citadel keeps to repair the past.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'The guardian holds out two faint memories of yesterday; Neri reaches to choose.',
          present: ['neri', 'guardian'], sketch: 'door', shot: 'medium', view: 'eye-level',
          subjects: [
            { characterId: 'neri', at: { x: 0.36, y: 0.62 }, facing: 'right' },
            { characterId: 'guardian', at: { x: 0.7, y: 0.5 }, facing: 'left' },
          ],
          focal: { x: 0.55, y: 0.46 }, keyProp: 'two glowing yesterdays', aspect: '3:2', palette: P_DOOR,
          bg: 'The sealed door, its carved face nearly gone; two small memories glow in the guardian’s hand.',
          brief:
            'The stone guardian opens its cracked hand to show two small glowing memories side by side, two versions ' +
            'of yesterday. Neri, in mustard and teal, raises her hand toward them, choosing. The sealed door with its ' +
            'nearly vanished carving waits behind. Quiet space above.',
          bubbles: [SP('guardian', 'Choose the yesterday to keep.', B_TOPR, { x: 0.7, y: 0.42 })],
          alt: 'The guardian holds two small glowing memories of yesterday in its hand as Neri reaches to choose.',
          motion: M('energy_pulse', { intensity: 0.3, zoomEnd: 1.03 }),
        }),
      ],
      choices: [
        C({
          id: 'gd7-past', label: 'Repair the past', intent: 'Entrust a true memory to the guardian so the citadel remembers you.',
          panelId: 'p0', rect: { x: 0.55, y: 0.3, w: 0.26, h: 0.44 }, hint: 'Give the memory',
          minTrust: { characterId: 'guardian', trust: 1 },
        }),
        C({
          id: 'gd7-let', label: 'Let the door stay shut', intent: 'Step back and leave the door sealed, keeping the day you came from.',
          panelId: 'p0', rect: { x: 0.1, y: 0.36, w: 0.22, h: 0.3 }, hint: 'Walk away',
        }),
      ],
      continuityNotes: ['Repairing the past requires the guardian’s trust (>=1).'],
      summaryUpdate: 'The guardian asks Neri to choose which yesterday the citadel keeps; entrusting a memory repairs the past.',
    },
  },

  // ===== CUSTOM ACTION DEMO =====
  {
    key: 'custom-compass-1', parentKey: 'root',
    via: { kind: 'custom', match: /hold.*compass|compass.*hold|give.*compass|hand.*compass/i, label: 'Ask the guardian to hold the compass' },
    art: art('custom-compass-1', ['p0']),
    response: {
      beat: {
        title: 'A Compass in Two Hands',
        narration:
          'Neri sets the brass compass in the guardian’s open stone hand. The moment it lands there it exists in ' +
          'both timelines, and its single cyan needle splits into two, each pointing a different way.',
        pacing: 'discovery', layoutTemplate: 'single-splash',
      },
      stateDelta: D({
        pacing: 'discovery',
        inventoryChanges: [{ itemId: 'compass', toHolder: 'guardian', reason: 'Neri asked the guardian to hold the compass; it now exists in both timelines.' }],
        addFacts: [FACT_SPLIT],
        addThreads: ['The split needle points to two different connections at once.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'The guardian holds the brass compass in its stone hand; the needle splits in two while Neri reads her map.',
          present: ['neri', 'guardian'], sketch: 'compass', shot: 'medium', view: 'high-angle',
          subjects: [
            { characterId: 'guardian', at: { x: 0.66, y: 0.5 }, facing: 'left' },
            { characterId: 'neri', at: { x: 0.3, y: 0.62 }, facing: 'right' },
          ],
          focal: { x: 0.6, y: 0.5 }, keyProp: 'the brass compass in the guardian’s hand', aspect: '3:2', palette: P_COMPASS,
          bg: 'The courtyard, the sealed door behind, warm amber light on stone.',
          brief:
            'High angle: the stone guardian’s cracked open hand cradles a small brass compass whose cyan needle has ' +
            'split into two forks pointing apart. Nearby Neri, in mustard and teal, holds her unrolled map, glancing ' +
            'between the split needle and her chart. The sealed door waits behind.',
          bubbles: [
            SP('guardian', 'Now it is true in both days.', B_TOPR, { x: 0.66, y: 0.44 }),
            SP('neri', 'Two needles. Two connections.', B_BOT, { x: 0.32, y: 0.6 }),
          ],
          alt: 'A stone guardian’s hand holds a brass compass whose cyan needle has split in two, while Neri reads a map nearby.',
          motion: M('energy_pulse', { intensity: 0.34, zoomEnd: 1.03, focalPoint: { x: 0.6, y: 0.5 } }),
        }),
      ],
      choices: [
        C({
          id: 'cc-back', label: 'Ask for the compass back', intent: 'Take the brass compass back from the guardian.',
          panelId: 'p0', rect: { x: 0.55, y: 0.34, w: 0.24, h: 0.3 }, hint: 'Take it back',
        }),
        C({
          id: 'cc-split', label: 'Read the split needle', intent: 'Read where each fork of the split needle now points.',
          panelId: 'p0', rect: { x: 0.6, y: 0.4, w: 0.2, h: 0.22 }, hint: 'Read both needles', facts: [FACT_SPLIT],
        }),
      ],
      continuityNotes: ['Compass now held by the guardian; exists in both timelines.', 'Needle has split in two.'],
      summaryUpdate: 'Neri hands the compass to the guardian; it exists in both timelines and its needle splits, pointing at two connections.',
    },
  },
  {
    key: 'custom-compass-2', parentKey: 'custom-compass-1', via: { kind: 'choice', choiceId: 'cc-back' },
    art: art('custom-compass-2', ['p0']),
    response: {
      beat: {
        title: 'The Needle Remembers',
        narration:
          'The guardian returns the compass. One needle settles on the door again; the other keeps pointing back the ' +
          'way Neri came, toward a connection she has not made yet.',
        pacing: 'discovery', layoutTemplate: 'single-splash',
      },
      stateDelta: D({
        inventoryChanges: [{ itemId: 'compass', toHolder: 'neri', reason: 'The guardian returns the compass to Neri.' }],
        addThreads: ['One needle points back down the bridge, at a connection not yet made.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'Neri holds the returned compass; one needle points at the door, the other back down the bridge.',
          present: ['neri'], sketch: 'compass', shot: 'close-up', view: 'top-down',
          subjects: [{ characterId: 'neri', at: { x: 0.4, y: 0.6 }, facing: 'camera' }],
          focal: { x: 0.5, y: 0.5 }, keyProp: 'the brass compass with a split needle', aspect: '3:2', palette: P_COMPASS,
          bg: 'Neri’s hands cupping the compass; the courtyard soft behind.',
          brief:
            'Close top-down view of Neri’s cupped hands holding the brass compass. Its cyan needle is forked: one ' +
            'fork points ahead to the sealed door, the other points back over her shoulder down the bridge. Her teal ' +
            'scarf edges the frame. Soft courtyard behind.',
          bubbles: [SP('neri', 'One way forward. One way back.', B_BOT, { x: 0.42, y: 0.55 })],
          alt: 'Neri’s hands hold a brass compass with a forked cyan needle pointing two directions at once.',
          motion: M('energy_pulse', { intensity: 0.3, zoomEnd: 1.02 }),
        }),
      ],
      choices: [
        C({
          id: 'cc-return-a', label: 'Face the door again', intent: 'Turn back toward the sealed door and the guardian.',
          panelId: 'p0', rect: { x: 0.55, y: 0.32, w: 0.26, h: 0.4 }, hint: 'Back to the door',
        }),
        C({
          id: 'cc-return-b', label: 'Look back down the bridge', intent: 'Glance back the way you came, toward the second needle.',
          panelId: 'p0', rect: { x: 0.1, y: 0.34, w: 0.24, h: 0.36 }, hint: 'Look back',
        }),
      ],
      continuityNotes: ['Compass returned to Neri; needle still split.'],
      summaryUpdate: 'The guardian returns the split compass. One needle points to the door, the other back down the bridge.',
    },
  },

  // ===== ENDINGS =====
  {
    key: 'ending-repair-future', parentKey: 'gate-7', via: { kind: 'choice', choiceId: 'g7-future' },
    art: art('ending-repair-future', ['p0']),
    response: {
      beat: {
        title: 'The Timelines Rejoin',
        narration:
          'Neri presses the archived page into the seam. The tear closes; the two skies fold into one dawn. The door ' +
          'stands open, and tomorrow keeps the map it was about to lose.',
        pacing: 'payoff', layoutTemplate: 'ending-splash',
      },
      stateDelta: D({
        location: 'The rejoined citadel', timeline: 'one day, whole', pacing: 'payoff',
        resolveThreads: ['Why are the two timelines separating?', 'Neri must decide whether to repair the future or sever the citadel.'],
        addFacts: ['The timelines rejoined; the lost page was restored to tomorrow.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'The seam closes into a single dawn; the door stands open and Neri steps toward it.',
          present: ['neri'], sketch: 'ending', shot: 'wide', view: 'low-angle',
          subjects: [{ characterId: 'neri', at: { x: 0.42, y: 0.66 }, facing: 'right' }],
          focal: { x: 0.55, y: 0.4 }, keyProp: 'the open door', aspect: '16:9', palette: P_ENDING,
          bg: 'A single dawn sky over the citadel towers; the seam healed into warm light.',
          brief:
            'The two skies fold into one warm dawn over the citadel’s towers, the seam healed into a band of gold. ' +
            'A tall door stands open, spilling light. Neri, small and steady in mustard and teal, steps toward it, ' +
            'satchel at her side.',
          bubbles: [CAP('One day, whole again.', B_BOT)],
          alt: 'A single golden dawn over the citadel; an open door spills light as Neri steps toward it.',
          motion: M('slow_push', { intensity: 0.24, zoomEnd: 1.03, focalPoint: { x: 0.55, y: 0.4 } }),
        }),
      ],
      choices: [],
      continuityNotes: ['Timelines rejoined via the archived page.'],
      summaryUpdate: 'Neri repairs the future: the archived page closes the seam, the skies rejoin, and the door opens.',
      ending: {
        title: 'The Timelines Rejoin', kind: 'repair-future',
        epilogue:
          'Neri walks through the open door into a citadel that is only one day deep now, whole and quiet. The compass ' +
          'needle, single again, rests. She keeps the restored page; it points to more connections still unmade.',
        nextIssueHook: 'The compass finds a second unrepaired connection, far beyond the citadel.',
      },
    },
  },
  {
    key: 'ending-repair-past', parentKey: 'guardian-7', via: { kind: 'choice', choiceId: 'gd7-past' },
    art: art('ending-repair-past', ['p0']),
    response: {
      beat: {
        title: 'The Citadel Remembers',
        narration:
          'Neri gives the guardian a true memory to keep. The carved face returns to the door; the citadel remembers ' +
          'her, and the door swings open onto the day she first arrived.',
        pacing: 'payoff', layoutTemplate: 'ending-splash',
      },
      stateDelta: D({
        location: 'The remembering citadel', timeline: 'today, held', pacing: 'payoff',
        relationshipChanges: [{ characterId: 'guardian', trustDelta: 1, note: 'The guardian keeps Neri’s memory.' }],
        resolveThreads: ['Why are the two timelines separating?', 'To reopen the door, the citadel must remember Neri again.'],
        addFacts: ['The citadel remembers Neri; the past connection is repaired.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'The carved face returns to the door as it opens; the guardian holds the glowing memory.',
          present: ['neri', 'guardian'], sketch: 'ending', shot: 'wide', view: 'low-angle',
          subjects: [
            { characterId: 'neri', at: { x: 0.34, y: 0.66 }, facing: 'right' },
            { characterId: 'guardian', at: { x: 0.72, y: 0.5 }, facing: 'left' },
          ],
          focal: { x: 0.55, y: 0.42 }, keyProp: 'the opening door', aspect: '16:9', palette: P_ENDING,
          bg: 'The door swinging open on warm light; the guardian cradling a small glowing memory.',
          brief:
            'The sealed door swings open onto warm light, Neri’s carved face sharp in the stone again. The stone ' +
            'guardian cradles a small glowing memory in its hand, amber eye bright. Neri, in mustard and teal, stands ' +
            'in the doorway light, looking back once.',
          bubbles: [CAP('Remembered, the door opens.', B_BOT)],
          alt: 'A sealed door opens into warm light, a carved face restored, while the guardian holds a small glowing memory.',
          motion: M('slow_push', { intensity: 0.24, zoomEnd: 1.03, focalPoint: { x: 0.55, y: 0.42 } }),
        }),
      ],
      choices: [],
      continuityNotes: ['Guardian keeps Neri’s memory; door opens.'],
      summaryUpdate: 'Neri repairs the past: she entrusts a memory to the guardian, the citadel remembers her, and the door opens.',
      ending: {
        title: 'The Citadel Remembers', kind: 'repair-past',
        epilogue:
          'The guardian will hold Neri’s memory the way it holds everything, in the past tense, safe. She steps ' +
          'through the door into her own first day, changed, carrying a citadel that will not forget her again.',
        nextIssueHook: 'A second door, in another citadel, has already begun to forget someone else.',
      },
    },
  },
  {
    key: 'ending-sever', parentKey: 'gate-7', via: { kind: 'choice', choiceId: 'g7-sever' },
    art: art('ending-sever', ['p0']),
    response: {
      beat: {
        title: 'Cut Loose',
        narration:
          'Neri lets the seam tear the rest of the way. The two timelines part like a released breath, and the ' +
          'citadel drifts free into the dark, whole in itself, connected to nothing.',
        pacing: 'payoff', layoutTemplate: 'ending-splash',
      },
      stateDelta: D({
        location: 'The drifting citadel', timeline: 'severed', pacing: 'payoff',
        resolveThreads: ['Why are the two timelines separating?'],
        addFacts: ['The timelines were severed; the citadel drifts free of both days.'],
      }),
      panels: [
        P({
          id: 'p0', action: 'The seam tears fully; the citadel drifts free into a field of stars, alone.',
          present: ['neri'], sketch: 'void', shot: 'extreme-wide', view: 'high-angle',
          subjects: [{ characterId: 'neri', at: { x: 0.5, y: 0.68 }, facing: 'away' }],
          focal: { x: 0.5, y: 0.42 }, keyProp: 'the drifting citadel', aspect: '16:9', palette: P_VOID,
          bg: 'A deep starfield; the citadel small and lit, adrift from both skies.',
          brief:
            'The seam tears fully open into a deep starfield. The citadel, small and warmly lit, drifts free of both ' +
            'skies, untethered. Neri stands at its edge, seen from behind, a tiny figure in teal and mustard looking ' +
            'out at the dark.',
          bubbles: [CAP('Whole, and connected to nothing.', B_BOT)],
          alt: 'The citadel drifts alone in a deep starfield, a small figure standing at its edge looking outward.',
          motion: M('drifting_dust', { intensity: 0.3, zoomEnd: 1.03, panXPercent: -1.2, particleCount: 16 }),
        }),
      ],
      choices: [],
      continuityNotes: ['Timelines severed; citadel adrift.'],
      summaryUpdate: 'Neri severs the citadel: the timelines part and the citadel drifts free into the dark, connected to nothing.',
      ending: {
        title: 'Cut Loose', kind: 'sever',
        epilogue:
          'No more disagreement, because there is no one left to disagree with. Neri maps the drifting citadel from ' +
          'the inside now, the only cartographer of a place that touches no other day. The compass, at last, is still.',
        nextIssueHook: 'Something in the dark begins to drift toward the severed citadel.',
      },
    },
  },
];

// ---------- fallback for unmatched custom actions ----------
const fallbackCustom = (parent: FixtureBeat, parentState: StoryState, text: string): StoryResponse => {
  const clean = (text || '').replace(/[ -<>{}"]/g, ' ').replace(/\s+/g, ' ').trim() || 'look around';
  const short = clean.length > 90 ? `${clean.slice(0, 87)}...` : clean;
  const narration = `Neri tries to ${short}. The citadel answers only with a shiver of light, and the moment folds back on itself, changing nothing she can keep.`.slice(0, 320);
  const note = `Neri tried to ${short}; the citadel did not respond.`.slice(0, 160);
  const loc = parentState.location;
  return {
    beat: {
      title: 'A Held Breath', narration,
      pacing: parentState.pacing, layoutTemplate: 'single-splash',
    },
    stateDelta: D({ addFacts: [note] }),
    panels: [
      P({
        id: 'p0', action: `Neri attempts an untold action at ${loc}; nothing lasting changes.`,
        present: ['neri'], sketch: 'generic', shot: 'medium', view: 'eye-level',
        subjects: [{ characterId: 'neri', at: { x: 0.42, y: 0.62 }, facing: 'camera' }],
        focal: { x: 0.5, y: 0.46 }, keyProp: 'the still citadel', aspect: '3:2', palette: P_CITADEL,
        bg: `${loc}, quiet and unchanged, a horizon of pale light behind.`,
        brief:
          `A quiet wide-medium view of ${loc}. Neri, in mustard jacket and teal scarf, pauses mid-gesture as a ` +
          'shiver of pale light passes over the stone. Nothing in the scene is disturbed; the citadel holds its ' +
          'breath. Calm, wondrous, restrained.',
        bubbles: [CAP('The citadel holds its breath.', B_BOT)],
        alt: `Neri pauses mid-gesture at ${loc} as a shiver of pale light passes, the scene otherwise unchanged.`,
        motion: M('still', { intensity: 0.16, zoomEnd: 1.02 }),
      }),
    ],
    choices: [
      C({
        id: 'return-a', label: 'Steady yourself and look again', intent: `Return to the situation at ${loc} and reconsider.`,
        panelId: 'p0', rect: { x: 0.55, y: 0.34, w: 0.26, h: 0.36 }, hint: 'Look again',
      }),
      C({
        id: 'return-b', label: 'Trust the compass instead', intent: 'Let the compass, not the impulse, choose the next move.',
        panelId: 'p0', rect: { x: 0.1, y: 0.34, w: 0.24, h: 0.36 }, hint: 'Follow the needle',
      }),
    ],
    continuityNotes: [`Unmatched custom action at ${loc}; state largely unchanged.`],
    summaryUpdate: `${parentState.summary} Neri tried something the citadel would not answer.`.slice(0, 600),
  };
};

// ---------- Stage A sketches: viewBox 0 0 160 90, currentColor ink, var(--accent) accent ----------
const sketches: Record<SketchKey, string> = {
  gate:
    '<svg viewBox="0 0 160 90" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">' +
    '<path d="M46 82 V44 a34 30 0 0 1 68 0 V82"/><path d="M80 82 V20" stroke="var(--accent)"/>' +
    '<g stroke="var(--accent)" stroke-width="2"><path d="M80 16 V4"/><path d="M58 24 L49 13"/><path d="M102 24 L111 13"/>' +
    '<circle cx="80" cy="46" r="6"/></g><path d="M20 82 H140"/></svg>',
  guardian:
    '<svg viewBox="0 0 160 90" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round">' +
    '<path d="M62 84 V44 a18 18 0 0 1 36 0 V84 Z"/><path d="M70 44 V24 a10 10 0 0 1 20 0 V44"/>' +
    '<circle cx="80" cy="30" r="3.5" fill="var(--accent)" stroke="var(--accent)"/>' +
    '<path d="M62 60 H98 M74 44 V84 M86 44 V84" stroke-width="1.5"/></svg>',
  archive:
    '<svg viewBox="0 0 160 90" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">' +
    '<circle cx="80" cy="46" r="8" stroke="var(--accent)"/><path d="M80 38 V30 M80 62 V54" stroke="var(--accent)"/>' +
    '<rect x="24" y="20" width="34" height="12"/><rect x="30" y="58" width="34" height="12"/>' +
    '<rect x="100" y="24" width="34" height="12"/><rect x="98" y="56" width="34" height="12"/></svg>',
  compass:
    '<svg viewBox="0 0 160 90" fill="none" stroke="currentColor" stroke-width="3">' +
    '<circle cx="80" cy="45" r="30"/><circle cx="80" cy="45" r="24" stroke-width="1.5"/>' +
    '<circle cx="80" cy="45" r="5" fill="var(--accent)" stroke="var(--accent)"/>' +
    '<path d="M80 45 L104 30" stroke="var(--accent)" stroke-width="3"/><path d="M80 45 L60 62" stroke-width="2"/>' +
    '<path d="M80 12 v6 M80 72 v6 M47 45 h6 M107 45 h6" stroke-width="2"/></svg>',
  citadel:
    '<svg viewBox="0 0 160 90" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round">' +
    '<path d="M0 60 H60 M100 60 H160" stroke-width="2"/><path d="M60 60 h40 v20 h-40 Z"/>' +
    '<path d="M66 60 V34 h10 V60 M84 60 V28 h10 V60"/><path d="M62 34 l4 -8 4 8 M86 28 l4 -8 4 8" stroke="var(--accent)"/>' +
    '<circle cx="80" cy="80" r="2.5" fill="var(--accent)" stroke="var(--accent)"/></svg>',
  door:
    '<svg viewBox="0 0 160 90" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round">' +
    '<rect x="58" y="20" width="44" height="64" rx="4"/><path d="M80 20 V84" stroke-width="1.5"/>' +
    '<circle cx="80" cy="52" r="6" stroke="var(--accent)"/><path d="M40 84 H120" stroke-width="2"/>' +
    '<path d="M66 34 h28 M66 70 h28" stroke-width="1.5"/></svg>',
  map:
    '<svg viewBox="0 0 160 90" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round">' +
    '<path d="M34 24 q46 -8 92 0 v42 q-46 8 -92 0 Z"/><path d="M40 44 q30 -10 44 2 t36 -2" stroke="var(--accent)"/>' +
    '<circle cx="104" cy="40" r="3" fill="var(--accent)" stroke="var(--accent)"/><path d="M56 30 v34 M84 28 v38" stroke-width="1"/></svg>',
  void:
    '<svg viewBox="0 0 160 90" fill="none" stroke="currentColor" stroke-width="2">' +
    '<g fill="currentColor"><circle cx="30" cy="22" r="1.6"/><circle cx="120" cy="18" r="1.6"/><circle cx="52" cy="60" r="1.6"/>' +
    '<circle cx="138" cy="66" r="1.6"/><circle cx="96" cy="40" r="1.6"/></g>' +
    '<path d="M70 58 h20 v14 h-20 Z" stroke="currentColor"/><circle cx="80" cy="46" r="10" stroke="var(--accent)"/></svg>',
  ending:
    '<svg viewBox="0 0 160 90" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round">' +
    '<circle cx="80" cy="66" r="18" stroke="var(--accent)"/><path d="M0 66 H62 M98 66 H160" stroke-width="2"/>' +
    '<path d="M64 66 h32 v18 h-32 Z"/><path d="M70 66 V48 h8 V66 M86 66 V44 h8 V66"/>' +
    '<g stroke="var(--accent)" stroke-width="1.5"><path d="M80 40 V32 M56 50 l-6 -5 M104 50 l6 -5"/></g></svg>',
  generic:
    '<svg viewBox="0 0 160 90" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round">' +
    '<rect x="18" y="16" width="124" height="58" rx="4"/><path d="M18 54 q30 -14 62 0 t42 -4" stroke="var(--accent)"/>' +
    '<circle cx="112" cy="34" r="7" stroke="var(--accent)"/></svg>',
};

export const EPISODE: FixtureEpisode = { bible, initialState, beats, fallbackCustom, sketches };
export default EPISODE;
