import { useEffect, useState } from 'react';
import type { Run } from '@shared/schemas';
import { api } from '../lib/api';
import { loadSketches, sketchFor } from '../lib/sketches';

/** My Issues: saved runs for this session. Progress is best-effort from persisted endings. */
export function Archive({ onOpen, onBack }: { onOpen: (runId: string) => void; onBack: () => void }) {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [thumb, setThumb] = useState('');
  useEffect(() => {
    void api.listRuns().then(setRuns).catch(() => setRuns([]));
    void loadSketches().then((s) => setThumb(sketchFor(s, 'citadel')));
  }, []);

  return (
    <div className="min-h-full w-full overflow-auto" style={{ background: '#0b0a09' }}>
      <div className="mx-auto max-w-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-white">My Issues</h2>
          <button onClick={onBack} className="text-sm underline focus-ring text-white/80">Back to cover</button>
        </div>
        {runs === null && <p className="text-white/60">Loading…</p>}
        {runs && runs.length === 0 && <p className="text-white/60">No saved issues yet.</p>}
        <ul className="space-y-3">
          {runs?.map((r) => (
            <li key={r.id}>
              <button onClick={() => onOpen(r.id)} className="w-full focus-ring text-left paper rounded-lg border border-black/20 p-3 flex gap-3">
                <div className="w-16 h-20 shrink-0 rounded overflow-hidden bg-black/60" dangerouslySetInnerHTML={{ __html: thumb }} />
                <div className="min-w-0">
                  <p className="font-display text-lg truncate">{r.title || 'The Citadel of Time and Space'}</p>
                  <p className="text-sm opacity-70">{r.protagonistName} · {r.mode === 'demo' ? 'Demo replay' : 'Live'} · {r.styleId}</p>
                  <p className="text-xs opacity-60 mt-1">Endings reached: {r.endingsReached.length}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
