/**
 * Bounds the director prompt, calls the provider, then validates: Zod shape first, one repair
 * attempt passing the Zod error text as repairHint, then business rules. The model proposes;
 * this module decides whether the proposal is acceptable.
 */
import { StoryResponse } from '@shared/schemas';
import type { StoryState, StoryBible, Choice, CharacterDef } from '@shared/schemas';
import type { StoryProvider, StoryDirectorInput, StoryDirectorResult, Effort } from '../providers/types';
import { validateStory } from './validate';

export type DirectorAction =
  | { kind: 'preset'; choice: Choice }
  | { kind: 'custom'; customText: string }
  | { kind: 'revision'; previousTitle: string; choiceLabel: string };

export interface DirectorRequest {
  bible: StoryBible;
  parentState: StoryState;
  recentBeats: { title: string; narration: string; choiceLabel: string }[];
  pathSummary: string;
  action: DirectorAction;
  readerCast: CharacterDef[];
  parentFixtureKey: string | null;
  isOpening: boolean;
}

export type DirectorOutcome =
  | { ok: true; response: StoryResponse; result: StoryDirectorResult }
  | { ok: false; error: string };

function pickEffort(req: DirectorRequest): Effort {
  const nextBeat = req.parentState.beatIndex + 1;
  if (req.action.kind === 'custom' || nextBeat >= 5) return 'high';
  return nextBeat <= 1 ? 'low' : 'medium';
}

export async function directBeat(
  provider: StoryProvider,
  req: DirectorRequest,
  opts: { signal?: AbortSignal } = {},
): Promise<DirectorOutcome> {
  const input: StoryDirectorInput = {
    bible: req.bible,
    state: req.parentState,
    recentBeats: req.recentBeats.slice(-3),
    pathSummary: req.pathSummary,
    action: req.action,
    effort: pickEffort(req),
    readerCast: req.readerCast,
    parentFixtureKey: req.parentFixtureKey,
  };

  let result: StoryDirectorResult;
  try {
    result = await provider.direct(input, { signal: opts.signal });
  } catch (e) {
    return { ok: false, error: `director call failed: ${(e as Error).message}` };
  }

  let parsed = StoryResponse.safeParse(result.response);
  if (!parsed.success) {
    // one repair attempt with the Zod error as the hint
    try {
      const repairHint = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      result = await provider.direct(input, { repairHint, signal: opts.signal });
      parsed = StoryResponse.safeParse(result.response);
    } catch (e) {
      return { ok: false, error: `repair call failed: ${(e as Error).message}` };
    }
  }
  if (!parsed.success) {
    return { ok: false, error: `schema validation failed: ${parsed.error.issues.map((i) => i.message).join('; ')}` };
  }

  const business = validateStory(parsed.data, {
    parentState: req.parentState,
    bible: req.bible,
    isOpening: req.isOpening,
  });
  if (!business.ok) {
    return { ok: false, error: `business validation failed: ${business.errors.join('; ')}` };
  }

  return { ok: true, response: parsed.data, result };
}
