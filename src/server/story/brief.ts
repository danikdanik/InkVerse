/**
 * Deterministic image-brief composer. The model only supplies panel.sceneBrief; the server
 * assembles the full prompt from trusted style rules + canonical character descriptions +
 * composition, and appends hard prohibitions (no lettering, fixed wardrobe). Same brief for
 * preview and final so the two stages stay visually consistent.
 */
import { STYLES } from '@shared/styles';
import type { StoryBible, PanelSpec, CharacterDef, NormRect } from '@shared/schemas';

const thirds = (x: number): string => (x < 0.34 ? 'left third' : x > 0.66 ? 'right third' : 'center');
const bands = (y: number): string => (y < 0.34 ? 'upper' : y > 0.66 ? 'lower' : 'middle');

function placement(at: { x: number; y: number }, facing: string): string {
  return `${bands(at.y)} ${thirds(at.x)} facing ${facing}`;
}

function safeAreaWords(rect: NormRect): string {
  const v = rect.y < 0.5 ? 'upper' : 'lower';
  const h = rect.x < 0.5 ? 'left' : 'right';
  return `keep the ${v}-${h} region quiet and empty for lettering`;
}

export function composeImageBrief(bible: StoryBible, panel: PanelSpec): string {
  const style = STYLES[bible.styleId];
  const present: CharacterDef[] = panel.presentCharacterIds
    .map((id) => bible.characters.find((c) => c.id === id))
    .filter((c): c is CharacterDef => !!c);

  const characterLines = present.map((c) => {
    const traits = c.fixedTraits.length ? ` Fixed traits: ${c.fixedTraits.join(', ')}.` : '';
    return `- ${c.name}: ${c.canonicalDescription}${traits}`;
  });

  const comp = panel.composition;
  const subjectLines = comp.subjects.map((s) => {
    const who = bible.characters.find((c) => c.id === s.characterId)?.name ?? s.characterId;
    return `${who} ${placement(s.at, s.facing)}`;
  });

  const parts: string[] = [
    `Style: ${style.name}. ${style.rules.join('; ')}.`,
    `Scene: ${panel.sceneBrief}`,
    `Shot: ${comp.shot}, viewpoint ${comp.viewpoint}, aspect ${comp.aspect}.`,
    subjectLines.length ? `Subjects: ${subjectLines.join('; ')}.` : '',
    comp.keyProp ? `Key prop: ${comp.keyProp}.` : '',
    `Background: ${comp.background}.`,
    `Palette: ${comp.palette.join(', ')}.`,
    characterLines.length ? `Characters (keep exactly consistent):\n${characterLines.join('\n')}` : '',
    `Text-safe areas: ${comp.textSafeAreas.map(safeAreaWords).join('; ')}.`,
    'Prohibitions: no text, no lettering, no speech bubbles, no captions, no signatures. Keep every character wardrobe and design fixed across panels.',
  ];
  return parts.filter(Boolean).join('\n');
}

/** Negative prompt shared by all stages. */
export const NEGATIVE_PROMPT =
  'text, lettering, speech bubbles, captions, watermark, signature, deformed hands, extra fingers, inconsistent character design';
