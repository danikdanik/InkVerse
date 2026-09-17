import type { StoryBible, StoryResponse, StoryState, SketchKey } from '@shared/schemas';

/** One authored beat of the demo episode: exactly the shape Fable would return, plus prepared art. */
export interface FixtureBeat {
  /** Stable key, e.g. 'root', 'gate-1', 'guardian-1', 'custom-compass-1', 'gate-2', 'ending-repair-future'. */
  key: string;
  parentKey: string | null;
  /** How the reader reaches this beat from the parent. Custom beats match reader text. */
  via: { kind: 'root' } | { kind: 'choice'; choiceId: string } | { kind: 'custom'; match: RegExp; label: string };
  response: StoryResponse;
  /** panelId -> relative paths under src/content/art/ (svg or png). Preview ~512px, final ~1024px+. */
  art: Record<string, { preview: string; final: string }>;
}

export interface FixtureEpisode {
  bible: StoryBible;
  initialState: StoryState;
  beats: FixtureBeat[];
  /** Demo-mode custom actions with no authored match get a generic but action-aware consequence. */
  fallbackCustom: (parent: FixtureBeat, parentState: StoryState, text: string) => StoryResponse;
  /** Stage A sketches: inline SVG strings, viewBox 0 0 160 90, use currentColor for ink and var(--accent) for accent. */
  sketches: Record<SketchKey, string>;
}
