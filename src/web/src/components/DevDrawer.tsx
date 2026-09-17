import { useEffect, useState } from 'react';
import type { ClientConfig, Metrics } from '@shared/api';
import type { BudgetLedger, GenerationJob } from '@shared/schemas';
import { api } from '../lib/api';
import { MOTION_PLAYER } from '../motion/templates';
import type { ConnState } from '../hooks/useRun';

const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);

function Ledger({ name, l }: { name: string; l: BudgetLedger['anthropic'] }) {
  return (
    <tr className="border-t border-white/10">
      <td className="py-1 pr-2">{name}</td>
      <td className="tabular-nums">${l.capUsd.toFixed(2)}</td>
      <td className="tabular-nums">${l.actualUsd.toFixed(3)}</td>
      <td className="tabular-nums">${l.reservedUsd.toFixed(3)}</td>
      <td className="tabular-nums">{l.unknownCount}</td>
    </tr>
  );
}

export function DevDrawer({ config, budget, jobs, conn, clickToSketchMs, onClose }: {
  config: ClientConfig | null;
  budget: BudgetLedger | null;
  jobs: GenerationJob[];
  conn: ConnState;
  clickToSketchMs: number | null;
  onClose: () => void;
}) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  useEffect(() => { void api.getMetrics().then(setMetrics).catch(() => {}); }, []);

  return (
    <div className="fixed right-0 top-0 z-40 h-full w-full max-w-sm bg-neutral-950 text-neutral-200 shadow-2xl overflow-auto drawer-scroll p-4 text-xs">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Dev drawer</h2>
        <button onClick={onClose} className="underline focus-ring">Close</button>
      </div>

      <section className="mb-4">
        <h3 className="uppercase tracking-wide text-neutral-400 mb-1">Config</h3>
        <div>story: {config?.storyModel ?? '?'}</div>
        <div>preview: {config?.previewModel ?? '?'}</div>
        <div>final: {config?.finalModel ?? '?'}</div>
        <div>gen mode: {config?.generationMode ?? '?'}</div>
        <div>motion player (config): {config?.motionPlayer ?? '?'}</div>
        <div>motion player (active): <b>{MOTION_PLAYER}</b></div>
        <div>SSE: <span className={conn === 'open' ? 'text-green-400' : conn === 'connecting' ? 'text-yellow-400' : 'text-red-400'}>{conn}</span></div>
        <div>click to sketch: {clickToSketchMs != null ? `${clickToSketchMs} ms` : '—'}</div>
      </section>

      <section className="mb-4">
        <h3 className="uppercase tracking-wide text-neutral-400 mb-1">Budget ledger</h3>
        <table className="w-full">
          <thead><tr className="text-neutral-400"><th className="text-left">provider</th><th className="text-left">cap</th><th className="text-left">actual</th><th className="text-left">reserved</th><th className="text-left">?</th></tr></thead>
          <tbody>
            {budget && <Ledger name="anthropic" l={budget.anthropic} />}
            {budget && <Ledger name="runware" l={budget.runware} />}
          </tbody>
        </table>
      </section>

      <section className="mb-4">
        <h3 className="uppercase tracking-wide text-neutral-400 mb-1">Jobs (active node)</h3>
        <table className="w-full">
          <thead><tr className="text-neutral-400"><th className="text-left">stage</th><th className="text-left">status</th><th className="text-left">ms</th><th className="text-left">$</th></tr></thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t border-white/10">
                <td>{j.stage}</td>
                <td>{j.status}</td>
                <td className="tabular-nums">{j.latencyMs ?? '—'}</td>
                <td className="tabular-nums">{j.actualCostUsd != null ? `$${j.actualCostUsd.toFixed(3)}` : `~$${j.reservedCostUsd.toFixed(3)}`}</td>
              </tr>
            ))}
            {jobs.length === 0 && <tr><td colSpan={4} className="text-neutral-500 py-1">no jobs</td></tr>}
          </tbody>
        </table>
      </section>

      <section>
        <h3 className="uppercase tracking-wide text-neutral-400 mb-1">Metrics</h3>
        {metrics ? (
          <div className="space-y-0.5">
            <div>story ready avg: {avg(metrics.storyReadyMs)} ms</div>
            <div>preview ready avg: {avg(metrics.previewReadyMs)} ms</div>
            <div>final ready avg: {avg(metrics.finalReadyMs)} ms</div>
            <div>retries: {metrics.retryCount}</div>
            <div>cache read/write tok: {metrics.cacheReadTokens}/{metrics.cacheWriteTokens}</div>
            <div>cost per beat avg: ${avg(metrics.costPerBeatUsd.map((x) => x * 1000)) / 1000}</div>
          </div>
        ) : <div className="text-neutral-500">loading…</div>}
      </section>
    </div>
  );
}
