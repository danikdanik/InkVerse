import { useEffect, useMemo, useState } from 'react';
import type { ClientConfig } from '@shared/api';
import type { StoryNode } from '@shared/schemas';
import { LAYOUTS, aspectRatio } from '@shared/layouts';
import type { RunController } from '../hooks/useRun';
import { api } from '../lib/api';
import { styleVars } from './style';
import { loadSketches, sketchFor } from '../lib/sketches';
import { Panel } from './Panel';
import { StoryMap } from './StoryMap';
import { DevDrawer } from './DevDrawer';
import { ExportDialog } from './ExportDialog';
import { Transcript } from './Transcript';

const ISSUE_TITLE = 'The Citadel of Time and Space';

/** Overall width/height ratio of a layout, so the desktop page can scale down to fit height. */
function pageAspect(template: (typeof LAYOUTS)[keyof typeof LAYOUTS]): number {
  const rows = new Map<string, number>();
  for (const s of template.slots) {
    const [c1, c2] = s.col.split('/').map((x) => parseInt(x.trim(), 10));
    const colspan = Math.max(1, c2 - c1);
    const h = (colspan / 12) / aspectRatio(s.aspect); // slot height as a fraction of page width
    rows.set(s.row, Math.max(rows.get(s.row) ?? 0, h)); // row height = tallest slot in the row
  }
  let hOverW = 0;
  for (const h of rows.values()) hOverW += h;
  return hOverW > 0 ? 1 / hOverW : 1.5;
}

export function Reader({ ctrl, config, onExit }: {
  ctrl: RunController;
  config: ClientConfig | null;
  onExit: () => void;
}) {
  const { bundle } = ctrl;
  const [sketches, setSketches] = useState<Record<string, string> | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showDev, setShowDev] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [ambient, setAmbient] = useState(false);
  const [customFor, setCustomFor] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [clickMs, setClickMs] = useState<number | null>(null);
  const [waited, setWaited] = useState(false);

  const prefersReduced = useMemo(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const [motionOn, setMotionOn] = useState(!prefersReduced);

  const [vh, setVh] = useState(typeof window !== 'undefined' ? window.innerHeight : 900);
  useEffect(() => {
    const on = () => setVh(window.innerHeight);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  useEffect(() => { void loadSketches().then(setSketches); }, []);

  const run = bundle?.run;
  const node: StoryNode | undefined = useMemo(
    () => bundle?.nodes.find((n) => n.id === run?.activeNodeId) ?? bundle?.nodes.find((n) => n.id === run?.rootNodeId),
    [bundle, run]);

  const nodeJobs = useMemo(
    () => bundle?.jobs.filter((j) => j.nodeId === node?.id) ?? [], [bundle, node]);

  // 45s slow-story hint
  useEffect(() => {
    setWaited(false);
    if (node?.storyStatus !== 'pending') return;
    const t = setTimeout(() => setWaited(true), 45000);
    return () => clearTimeout(t);
  }, [node?.id, node?.storyStatus]);

  if (!bundle || !run || !node) {
    return <div className="min-h-full grid place-items-center text-white/70" style={{ background: '#0b0a09' }}>Loading issue…</div>;
  }

  const badge = modeBadge();
  const template = LAYOUTS[node.beat.layoutTemplate] ?? LAYOUTS['single-splash'];
  const slotFor = (slot: number) => template.slots.find((s) => s.slot === slot) ?? template.slots[0];
  // Fit the page to the viewport height on desktop: cap width from the layout aspect so it never scrolls.
  const availH = Math.max(320, vh - 220); // top bar + narration + choice list
  const pageMaxW = Math.min(960, Math.round(availH * pageAspect(template)));
  const disabled = ctrl.pending !== null;

  async function submitChoice(choiceId?: string, customAction?: string) {
    if (!run || !node) return;
    const t0 = performance.now();
    const clientOpId = crypto.randomUUID();
    const sketchKey = choiceId ? node.panels.find((p) => p.sketchKey)?.sketchKey : 'generic';
    ctrl.setPending({ parentNodeId: node.id, sketchKey: sketchKey ?? 'generic' });
    requestAnimationFrame(() => setClickMs(Math.round(performance.now() - t0)));
    try {
        await api.choose(run.id, { parentNodeId: node.id, parentVersion: node.stateVersion, choiceId, customAction, clientOpId });
    } catch {
      ctrl.clearPending();
    }
  }

  async function revise() {
    if (!run || !node) return;
    await api.revise(run.id, node.id, crypto.randomUUID()).catch(() => {});
  }

  async function retryStory() {
    if (!run || !node) return;
    await api.retryStory(run.id, node.id).catch(() => {});
  }

  async function retryArt(panelId: string, stage: 'preview' | 'final') {
    if (!run || !node) return;
    await api.retryArt(run.id, node.id, panelId, stage).catch(() => {});
  }

  function modeBadge(): string {
    const r = bundle?.run;
    if (!r || r.mode === 'demo') return 'Demo replay';
    const lp = config?.liveProviders;
    if (lp) {
      if (lp.story === 'anthropic') return 'Live';
      if (lp.story === 'fixture' && lp.image === 'runware') return 'Hybrid';
    }
    return config?.liveAvailable ? 'Live' : 'Hybrid'; // heuristic fallback when liveProviders absent
  }

  const pendingStory = node.storyStatus === 'pending';
  const failedStory = node.storyStatus === 'failed';

  return (
    <div className="min-h-full w-full flex flex-col" style={{ ...styleVars(run.styleId), background: '#0b0a09' }}>
      {/* Top bar */}
      <header className="flex items-center gap-2 px-3 py-2 text-white/90 border-b border-white/10">
        <button onClick={onExit} className="focus-ring text-sm underline opacity-70">Cover</button>
        <h1 className="font-display text-lg truncate flex-1">{ISSUE_TITLE}</h1>
        <span className="text-[11px] rounded-full px-2 py-0.5 bg-white/10">{badge}</span>
        <button onClick={() => setShowMap(true)} className="focus-ring text-sm px-2">Map</button>
        <button onClick={() => setMotionOn((m) => !m)} className="focus-ring text-sm px-2" aria-pressed={motionOn}>{motionOn ? 'Motion on' : 'Motion off'}</button>
        <button onClick={() => setShowTranscript(true)} className="focus-ring text-sm px-2">Transcript</button>
        <button onClick={() => setShowExport(true)} className="focus-ring text-sm px-2">Save/Export</button>
        <button onClick={() => setShowDev((d) => !d)} className="focus-ring text-sm px-2">Dev</button>
      </header>

      {/* Comic */}
      <main className="flex-1 overflow-auto p-3 sm:p-5">
        <div className="mx-auto max-w-4xl">
          {node.beat.narration && <p className="font-display text-white/80 mb-3">{node.beat.narration}</p>}

          {pendingStory && node.panels.length === 0 ? (
            <PendingBlock sketchKey={ctrl.pending?.sketchKey} sketches={sketches} waited={waited} />
          ) : (
            <>
              {/* Desktop grid / mobile stack */}
              <div className="hidden md:grid gap-3 mx-auto"
                style={{ gridTemplateColumns: 'repeat(12, 1fr)', gridTemplateRows: template.rows, maxWidth: pageMaxW, maxHeight: availH }}>
                {node.panels.map((p) => {
                  const slot = slotFor(p.layoutSlot);
                  return (
                    <div key={p.id} style={{ gridColumn: slot.col, gridRow: slot.row }}>
                      <Panel panel={p} best={ctrl.best[p.id]} aspect={aspectRatio(slot.aspect)} sketches={sketches}
                        assetUrl={ctrl.assetUrl} choices={node.choices.filter((c) => c.hotspot.panelId === p.id)}
                        motionOn={motionOn} ambient={ambient} disabled={disabled}
                        onChoose={(id) => submitChoice(id)} onCustom={(pid) => setCustomFor(pid)} onRetryArt={retryArt} />
                    </div>
                  );
                })}
              </div>
              <div className="md:hidden flex flex-col gap-3">
                {node.panels.map((p) => {
                  const slot = slotFor(p.layoutSlot);
                  return (
                    <Panel key={p.id} panel={p} best={ctrl.best[p.id]} aspect={aspectRatio(slot.aspect)} sketches={sketches}
                      assetUrl={ctrl.assetUrl} choices={node.choices.filter((c) => c.hotspot.panelId === p.id)}
                      motionOn={motionOn} ambient={ambient} disabled={disabled}
                      onChoose={(id) => submitChoice(id)} onCustom={(pid) => setCustomFor(pid)} onRetryArt={retryArt} />
                  );
                })}
              </div>

              {pendingStory && (
                <p className="text-white/60 text-sm mt-3" role="status">
                  Composing the next page…{waited && ' This is taking a while.'}
                  {waited && <button onClick={retryStory} className="ml-2 underline focus-ring">Retry</button>}
                </p>
              )}
              {failedStory && (
                <div className="text-sm mt-3 text-white/80" role="alert">
                  Something interrupted this page. <button onClick={retryStory} className="underline focus-ring">Retry</button>
                </div>
              )}
            </>
          )}

          {/* Compact text-choice list (always rendered for assistive tech) */}
          {node.choices.length > 0 && (
            <nav aria-label="Choices" className="mt-4">
              <ul className="flex flex-wrap gap-2">
                {node.choices.map((c) => (
                  <li key={c.id}>
                    <button disabled={disabled} onClick={() => submitChoice(c.id)}
                      className="focus-ring rounded-full border border-white/25 text-white/90 text-sm px-3 py-1.5 disabled:opacity-50">
                      {c.label}
                    </button>
                  </li>
                ))}
                <li>
                  <button disabled={disabled} onClick={() => setCustomFor(node.panels[0]?.id ?? 'x')}
                    className="focus-ring rounded-full border border-dashed border-white/25 text-white/70 text-sm px-3 py-1.5 disabled:opacity-50">
                    Try another approach
                  </button>
                </li>
              </ul>
            </nav>
          )}

          {/* Custom action input */}
          {customFor && (
            <form className="mt-3 flex gap-2" onSubmit={(e) => {
              e.preventDefault();
              const t = customText.trim();
              if (t.length < 3 || t.length > 200) return;
              void submitChoice(undefined, t);
              setCustomFor(null); setCustomText('');
            }}>
              <input autoFocus value={customText} onChange={(e) => setCustomText(e.target.value)}
                minLength={3} maxLength={200} placeholder="Describe what you do (3-200 chars)"
                className="flex-1 rounded border border-white/25 bg-transparent text-white px-3 py-2 focus-ring" />
              <button type="submit" className="focus-ring rounded bg-accent text-black px-3 font-medium">Go</button>
              <button type="button" onClick={() => setCustomFor(null)} className="focus-ring text-white/70 text-sm px-2">Cancel</button>
            </form>
          )}

          {/* Ending card */}
          {node.ending && (
            <div className="mt-5 paper rounded-xl border border-black/20 p-5">
              <p className="text-xs uppercase tracking-wide opacity-60">Ending</p>
              <h2 className="font-display text-2xl">{node.ending.title}</h2>
              <p className="mt-2">{node.ending.epilogue}</p>
              <p className="mt-3 text-sm italic opacity-75">Next issue: {node.ending.nextIssueHook}</p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => setShowExport(true)} className="focus-ring rounded-lg bg-accent text-black font-semibold px-4 py-2">Export issue</button>
                <button onClick={revise} className="focus-ring rounded-lg border border-black/30 px-4 py-2">Try another version</button>
              </div>
            </div>
          )}

          {!node.ending && node.choices.length > 0 && (
            <div className="mt-3">
              <button onClick={revise} className="text-white/60 text-sm underline focus-ring">Try another version of this page</button>
            </div>
          )}
        </div>
      </main>

      {showMap && <StoryMap bundle={bundle} activeNodeId={run.activeNodeId}
        onCursor={async (id) => { await api.cursor(run.id, id).catch(() => {}); setShowMap(false); }}
        onClose={() => setShowMap(false)} />}
      {showDev && <DevDrawer config={config} budget={ctrl.budget} jobs={nodeJobs} conn={ctrl.conn} clickToSketchMs={clickMs} onClose={() => setShowDev(false)} />}
      {showExport && <ExportDialog runId={run.id} endNodeId={node.ending ? node.id : undefined} onClose={() => setShowExport(false)} />}
      {showTranscript && <Transcript node={node} onClose={() => setShowTranscript(false)} />}

      {/* ambient motion toggle in a corner when motion is on */}
      {motionOn && (
        <button onClick={() => setAmbient((a) => !a)}
          className="fixed bottom-3 left-3 text-[11px] rounded-full bg-black/60 text-white px-3 py-1.5 focus-ring">
          {ambient ? 'Ambient motion: on' : 'Ambient motion: off'}
        </button>
      )}
    </div>
  );
}

function PendingBlock({ sketchKey, sketches, waited }: { sketchKey?: string; sketches: Record<string, string> | null; waited: boolean }) {
  return (
    <div>
      <div className="relative w-full max-w-2xl mx-auto rounded-md overflow-hidden border border-white/15" style={{ aspectRatio: '16 / 9' }}>
        <div className="absolute inset-0" dangerouslySetInnerHTML={{ __html: sketchFor(sketches, sketchKey) }} />
      </div>
      <p className="text-white/60 text-sm mt-3" role="status">
        Sketching the scene…{waited && ' Still working. You can keep waiting or retry.'}
      </p>
    </div>
  );
}
