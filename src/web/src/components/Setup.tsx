import { useEffect, useState } from 'react';
import type { ClientConfig, CreateRunRequest, ReaderCastInput, StoryStartCard, SetupDecks } from '@shared/api';
import type { StyleId, StorySetup, SetupCardKey, StoryStartId } from '@shared/schemas';
import { STYLES, DEFAULT_STYLE } from '@shared/styles';
import { styleVars } from './style';
import { api } from '../lib/api';
import { loadAllArt, iconFor } from '../lib/deckArt';
import { CameraCapture, type CastPerson } from './CameraCapture';

const TONES = ['wondrous', 'tense', 'melancholic', 'playful'] as const;
const STYLE_IDS = Object.keys(STYLES) as StyleId[];
const CARD_LABELS: Record<SetupCardKey, string> = { hero: 'Your hero', world: 'Their world', problem: 'The problem', mood: 'The mood' };
const CARD_MAX: Record<SetupCardKey, number> = { hero: 160, world: 160, problem: 200, mood: 120 };
const INVENT_ROWS: SetupCardKey[] = ['hero', 'world', 'problem'];

/** Shown when GET /api/setup/starts is unavailable (e.g. 404) so demo mode stays reachable. */
const FALLBACK_STARTS: StoryStartCard[] = [{
  id: 'citadel', title: 'The Citadel of Time and Space', requiresLive: false, sketchKey: 'citadel',
  teaser: 'A citadel suspended between two skies whose timelines disagree by one day.',
  firstChoices: ['Step through the gate', 'Question the guardian'],
  setup: {
    hero: 'Neri, a cartographer whose brass compass points at connections between timelines',
    world: 'A citadel suspended between two skies whose timelines disagree by one day',
    problem: 'A stone guardian insists the sealed door was opened tomorrow, and the timelines are pulling apart',
    mood: 'Wondrous mystery with quiet stakes',
  },
}];

type Tone = (typeof TONES)[number];
type Art = { sketches: Record<string, string>; deckArt: Record<string, string> };
const empty = (): CastPerson => ({ name: '', blob: null, url: null });

function Icon({ art, sketchKey, className }: { art: Art | null; sketchKey: string; className?: string }) {
  return <div className={className} aria-hidden dangerouslySetInnerHTML={{ __html: iconFor(art?.sketches ?? null, art?.deckArt ?? null, sketchKey) }} />;
}

function clip(s: string, max: number): string {
  const t = s.trim();
  return (t.length < 3 ? `${t} scene`.trim() : t).slice(0, max);
}
function startToSetup(c: StoryStartCard): StorySetup {
  if (c.setup) return c.setup; // authored cards; no model call
  return {
    hero: clip(`A young hero drawn into ${c.title}`, CARD_MAX.hero),
    world: clip(c.teaser, CARD_MAX.world),
    problem: clip(c.firstChoices[0] ? `You must decide: ${c.firstChoices[0]}` : c.teaser, CARD_MAX.problem),
    mood: 'wondrous and adventurous',
  };
}

export function Setup({ config, onCreate, onBack }: {
  config: ClientConfig | null;
  onCreate: (runId: string) => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [art, setArt] = useState<Art | null>(null);
  const [starts, setStarts] = useState<StoryStartCard[] | null>(null);
  const [decks, setDecks] = useState<SetupDecks | null>(null);
  const [entry, setEntry] = useState<'cards' | 'idea' | 'invent'>('cards');
  const [idea, setIdea] = useState('');
  const [picks, setPicks] = useState<Partial<Record<SetupCardKey, string>>>({});
  const [pickIds, setPickIds] = useState<Partial<Record<SetupCardKey, string>>>({});

  const [startId, setStartId] = useState<StoryStartId>('citadel');
  const [setup, setSetup] = useState<StorySetup | null>(null);
  const [locked, setLocked] = useState<Set<SetupCardKey>>(new Set());
  const [editing, setEditing] = useState<SetupCardKey | null>(null);

  const [name, setName] = useState('Neri');
  const [tone, setTone] = useState<Tone>('wondrous');
  const [styleId, setStyleId] = useState<StyleId>(DEFAULT_STYLE);
  const [mode, setMode] = useState<'live' | 'demo'>('demo');
  const [genMode, setGenMode] = useState<'parallel' | 'reference_refine'>('parallel');
  const [cast, setCast] = useState<CastPerson[]>([]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const liveOff = !config?.liveAvailable;

  useEffect(() => {
    void loadAllArt().then(setArt);
    void api.getStarts().then((l) => setStarts(l.length ? l : FALLBACK_STARTS)).catch(() => setStarts(FALLBACK_STARTS));
  }, []);

  function chooseStart(c: StoryStartCard) {
    setStartId(c.id);
    setSetup(startToSetup(c));
    setLocked(new Set());
    setStep(2);
  }

  async function submitIdea() {
    setBusy(true); setErr(null);
    try {
      const res = await api.proposeSetup({ idea: idea.trim(), locked: [] });
      setStartId('custom'); setSetup(res.setup); setLocked(new Set()); setStep(2);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not draft a setup'); }
    finally { setBusy(false); }
  }

  async function openInvent() {
    setEntry('invent');
    if (!decks) await api.getDecks().then(setDecks).catch(() => {});
  }
  function surprise(row: SetupCardKey) {
    const list = decks?.[row] ?? [];
    if (!list.length) return;
    const c = list[Math.floor(Math.random() * list.length)];
    setPicks((p) => ({ ...p, [row]: c.text }));
    setPickIds((p) => ({ ...p, [row]: c.id }));
  }
  async function submitPicks() {
    setBusy(true); setErr(null);
    try {
      const res = await api.proposeSetup({ picks, locked: [] });
      setStartId('custom'); setSetup(res.setup); setLocked(new Set()); setStep(2);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not invent a setup'); }
    finally { setBusy(false); }
  }

  function editCard(key: SetupCardKey, value: string) {
    setSetup((s) => (s ? { ...s, [key]: value.slice(0, CARD_MAX[key]) } : s));
    setLocked((l) => new Set(l).add(key)); // reader-edited cards lock
  }
  async function shuffle(key: SetupCardKey) {
    if (!setup) return;
    try {
      const res = await api.shuffleCard({ card: key, current: setup });
      setSetup((s) => (s ? { ...s, [key]: res.setup[key] } : s)); // replace only this card
      setLocked((l) => { const n = new Set(l); n.delete(key); return n; }); // server-generated => unlocked
    } catch { /* ignore */ }
  }

  async function begin() {
    if (!setup) return;
    setBusy(true); setErr(null);
    try {
      const readerCast: ReaderCastInput[] = [];
      for (const p of cast) {
        if (!p.blob || !p.name.trim()) continue;
        const asset = await api.uploadAsset(p.blob, `${p.name || 'cast'}.jpg`);
        readerCast.push({ displayName: p.name.trim().slice(0, 40), photoAssetId: asset.id, hint: p.hint });
      }
      const body: CreateRunRequest = {
        protagonistName: name.trim() || 'Neri',
        tone, genre: 'cosmic-mystery', styleId,
        startId, setup,
        mode: liveOff ? 'demo' : mode,
        generationMode: genMode, readerCast,
      };
      const bundle = await api.createRun(body);
      onCreate(bundle.run.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start the issue');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full w-full overflow-auto" style={{ ...styleVars(styleId), background: '#0b0a09' }}>
      <div className="mx-auto max-w-lg p-5">
        <div className="paper rounded-xl border border-black/20 p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">{step === 1 ? 'Pick a story start' : step === 2 ? 'Your story setup' : 'Look and cast'}</h2>
            <button onClick={step === 1 ? onBack : () => setStep((s) => (s === 3 ? 2 : 1))} className="text-sm underline focus-ring opacity-70">Back</button>
          </div>
          <ol className="flex gap-2 text-xs" aria-label="Steps">
            {[1, 2, 3].map((n) => (
              <li key={n} className={`flex-1 h-1.5 rounded-full ${step >= n ? 'bg-accent' : 'bg-black/15'}`} />
            ))}
          </ol>

          {step === 1 && (
            <Step1
              art={art} starts={starts} entry={entry} setEntry={setEntry} liveOff={liveOff}
              liveMsg={config?.liveSetupMessage ?? null} idea={idea} setIdea={setIdea} busy={busy}
              onChooseStart={chooseStart} onSubmitIdea={submitIdea} onOpenInvent={openInvent}
              decks={decks} picks={picks} pickIds={pickIds}
              onPick={(row, c) => { setPicks((p) => ({ ...p, [row]: c.text })); setPickIds((p) => ({ ...p, [row]: c.id })); }}
              onSurprise={surprise} onSubmitPicks={submitPicks} />
          )}

          {step === 2 && setup && (
            <div className="space-y-3">
              {(Object.keys(CARD_LABELS) as SetupCardKey[]).map((key) => (
                <div key={key} className="rounded-lg border border-black/15 p-3" style={{ background: 'color-mix(in srgb, var(--paper) 94%, black)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-letter text-sm">{CARD_LABELS[key]}{locked.has(key) && <span className="ml-1 text-[10px] opacity-60">(yours)</span>}</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditing(editing === key ? null : key)} className="text-xs underline focus-ring">{editing === key ? 'Done' : 'Edit'}</button>
                      <button type="button" onClick={() => shuffle(key)} className="text-xs underline focus-ring">Shuffle</button>
                    </div>
                  </div>
                  {editing === key ? (
                    <textarea autoFocus value={setup[key]} maxLength={CARD_MAX[key]} onChange={(e) => editCard(key, e.target.value)}
                      className="w-full rounded border border-black/25 bg-transparent px-2 py-1 text-sm focus-ring" rows={3} />
                  ) : (
                    <p className="text-sm">{setup[key]}</p>
                  )}
                </div>
              ))}
              <button onClick={() => setStep(3)} className="w-full focus-ring rounded-lg bg-accent text-black font-semibold py-2.5">Continue</button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <label className="block">
                <span className="text-sm font-medium">Protagonist name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
                  className="mt-1 w-full rounded border border-black/25 bg-transparent px-3 py-2 focus-ring" />
              </label>

              <div>
                <span className="text-sm font-medium">Finish</span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {STYLE_IDS.map((id) => {
                    const s = STYLES[id];
                    return (
                      <button key={id} type="button" onClick={() => setStyleId(id)}
                        className={`focus-ring text-left rounded-lg border p-3 ${styleId === id ? 'border-2' : 'border-black/20'}`}
                        style={styleId === id ? { borderColor: s.accent } : undefined}>
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-4 h-4 rounded-full" style={{ background: s.accent }} />
                          <span className="font-medium text-sm">{s.name}</span>
                        </div>
                        <p className="text-xs opacity-70 mt-1">{s.blurb}</p>
                        <p className="text-[11px] italic opacity-60 mt-1">Good for: {s.fit}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-sm font-medium">Tone</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {TONES.map((t) => (
                    <button key={t} type="button" onClick={() => setTone(t)}
                      className={`focus-ring rounded-full px-3 py-1.5 text-sm border ${tone === t ? 'bg-accent text-black border-transparent' : 'border-black/25'}`}>{t}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium">Playback</span>
                  <div className="mt-1 flex gap-2">
                    <button type="button" onClick={() => !liveOff && setMode('live')} disabled={liveOff}
                      className={`focus-ring rounded-full px-3 py-1.5 text-sm border ${mode === 'live' && !liveOff ? 'bg-accent text-black border-transparent' : 'border-black/25'} disabled:opacity-50`}>Live</button>
                    <button type="button" onClick={() => setMode('demo')}
                      className={`focus-ring rounded-full px-3 py-1.5 text-sm border ${mode === 'demo' || liveOff ? 'bg-accent text-black border-transparent' : 'border-black/25'}`}>Demo replay</button>
                  </div>
                  {liveOff && config?.liveSetupMessage && <p className="text-xs opacity-70 mt-1">{config.liveSetupMessage}</p>}
                </div>
                <div>
                  <span className="text-sm font-medium">Generation</span>
                  <div className="mt-1 flex gap-2">
                    <button type="button" onClick={() => setGenMode('parallel')}
                      className={`focus-ring rounded-full px-3 py-1.5 text-sm border ${genMode === 'parallel' ? 'bg-accent text-black border-transparent' : 'border-black/25'}`}>parallel</button>
                    <button type="button" onClick={() => setGenMode('reference_refine')}
                      className={`focus-ring rounded-full px-3 py-1.5 text-sm border ${genMode === 'reference_refine' ? 'bg-accent text-black border-transparent' : 'border-black/25'}`}>reference refine</button>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-sm font-medium">Add yourself to the comic <span className="opacity-60">(up to 2)</span></span>
                <div className="mt-2 space-y-3">
                  {cast.map((p, i) => (
                    <CameraCapture key={i} title={`Cast member ${i + 1}`} person={p}
                      onChange={(np) => setCast((c) => c.map((x, j) => (j === i ? np : x)))}
                      onRemove={() => setCast((c) => c.filter((_, j) => j !== i))} />
                  ))}
                  {cast.length < 2 && (
                    <button type="button" onClick={() => setCast((c) => [...c, empty()])}
                      className="focus-ring rounded border border-dashed border-black/30 w-full py-2 text-sm">
                      {cast.length === 0 ? 'Add a person' : 'Add a second person'}
                    </button>
                  )}
                </div>
              </div>

              {err && <p className="text-sm text-red-700">{err}</p>}
              <button onClick={begin} disabled={busy}
                className="w-full focus-ring rounded-lg bg-accent text-black font-semibold py-3 disabled:opacity-60">
                {busy ? 'Preparing…' : 'Begin Issue'}
              </button>
            </div>
          )}

          {step === 1 && err && <p className="text-sm text-red-700">{err}</p>}
        </div>
      </div>
    </div>
  );
}

function Step1(props: {
  art: Art | null; starts: StoryStartCard[] | null; entry: 'cards' | 'idea' | 'invent';
  setEntry: (e: 'cards' | 'idea' | 'invent') => void; liveOff: boolean; liveMsg: string | null;
  idea: string; setIdea: (s: string) => void; busy: boolean;
  onChooseStart: (c: StoryStartCard) => void; onSubmitIdea: () => void; onOpenInvent: () => void;
  decks: SetupDecks | null; picks: Partial<Record<SetupCardKey, string>>; pickIds: Partial<Record<SetupCardKey, string>>;
  onPick: (row: SetupCardKey, c: { id: string; text: string }) => void; onSurprise: (row: SetupCardKey) => void; onSubmitPicks: () => void;
}) {
  const { art, starts, entry, setEntry, liveOff, liveMsg, idea, setIdea, busy, decks } = props;

  if (entry === 'idea') {
    return (
      <div className="space-y-3">
        <button onClick={() => setEntry('cards')} className="text-sm underline focus-ring opacity-70">Story starts</button>
        <label className="block">
          <span className="text-sm font-medium">Your idea, in one sentence</span>
          <textarea value={idea} maxLength={300} onChange={(e) => setIdea(e.target.value)} rows={3}
            placeholder="A girl discovers that her doodles can escape her notebook."
            className="mt-1 w-full rounded border border-black/25 bg-transparent px-3 py-2 text-sm focus-ring" />
        </label>
        <button onClick={props.onSubmitIdea} disabled={busy || idea.trim().length < 3}
          className="w-full focus-ring rounded-lg bg-accent text-black font-semibold py-2.5 disabled:opacity-60">
          {busy ? 'Drafting…' : 'Draft my setup'}
        </button>
      </div>
    );
  }

  if (entry === 'invent') {
    return (
      <div className="space-y-4">
        <button onClick={() => setEntry('cards')} className="text-sm underline focus-ring opacity-70">Story starts</button>
        {INVENT_ROWS.map((row) => (
          <div key={row}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{CARD_LABELS[row]}</span>
              <button type="button" onClick={() => props.onSurprise(row)} className="text-xs underline focus-ring">Surprise me</button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(decks?.[row] ?? []).map((c) => (
                <button key={c.id} type="button" onClick={() => props.onPick(row, c)}
                  className={`focus-ring shrink-0 w-32 text-left rounded-lg border p-2 ${props.pickIds[row] === c.id ? 'border-2' : 'border-black/20'}`}
                  style={props.pickIds[row] === c.id ? { borderColor: 'var(--accent)' } : undefined}>
                  <Icon art={art} sketchKey={c.sketchKey} className="w-full aspect-[16/9] rounded overflow-hidden mb-1" />
                  <p className="text-xs font-medium truncate">{c.title}</p>
                  <p className="text-[11px] opacity-70 line-clamp-2">{c.text}</p>
                </button>
              ))}
              {!decks && <p className="text-xs opacity-60">Loading cards…</p>}
            </div>
          </div>
        ))}
        <button onClick={props.onSubmitPicks} disabled={busy || INVENT_ROWS.some((r) => !props.picks[r])}
          className="w-full focus-ring rounded-lg bg-accent text-black font-semibold py-2.5 disabled:opacity-60">
          {busy ? 'Inventing…' : 'Continue'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {starts === null && <p className="text-sm opacity-60">Loading starts…</p>}
      {starts?.map((c) => {
        const disabled = c.requiresLive && liveOff;
        return (
          <div key={c.id}>
            <button type="button" disabled={disabled} onClick={() => props.onChooseStart(c)}
              className="w-full focus-ring text-left rounded-lg border border-black/20 p-3 flex gap-3 disabled:opacity-50">
              <Icon art={art} sketchKey={c.sketchKey} className="w-20 h-16 shrink-0 rounded overflow-hidden bg-black/40" />
              <div className="min-w-0">
                <p className="font-display text-lg">{c.title}</p>
                <p className="text-sm opacity-75">{c.teaser}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.firstChoices.slice(0, 3).map((fc, i) => (
                    <span key={i} className="text-[11px] rounded-full border border-black/20 px-2 py-0.5">{fc}</span>
                  ))}
                </div>
              </div>
            </button>
            {disabled && liveMsg && <p className="text-xs opacity-70 mt-1 px-1">{liveMsg}</p>}
          </div>
        );
      })}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <div>
          <button type="button" disabled={liveOff} onClick={() => setEntry('idea')}
            className="w-full focus-ring rounded-lg border border-dashed border-black/30 p-3 text-left disabled:opacity-50">
            <p className="font-medium text-sm">I have an idea</p>
            <p className="text-xs opacity-70">Describe it in a sentence.</p>
          </button>
          {liveOff && <p className="text-[11px] opacity-70 mt-1">{liveMsg ?? 'Needs Live mode.'}</p>}
        </div>
        <div>
          <button type="button" disabled={liveOff} onClick={props.onOpenInvent}
            className="w-full focus-ring rounded-lg border border-dashed border-black/30 p-3 text-left disabled:opacity-50">
            <p className="font-medium text-sm">Help me invent one</p>
            <p className="text-xs opacity-70">Mix hero, world, and problem.</p>
          </button>
          {liveOff && <p className="text-[11px] opacity-70 mt-1">{liveMsg ?? 'Needs Live mode.'}</p>}
        </div>
      </div>
    </div>
  );
}
