import { useCallback, useState } from 'react';
import { api, ApiError } from '../lib/api';

/** Export to PDF. On 409 with pendingPanelIds, offer wait-for-final or export-draft. */
export function ExportDialog({ runId, endNodeId, onClose }: { runId: string; endNodeId?: string; onClose: () => void }) {
  const [status, setStatus] = useState<'idle' | 'working' | 'pending' | 'done' | 'error'>('idle');
  const [pending, setPending] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const run = useCallback(async (allowDraft: boolean) => {
    setStatus('working'); setMsg(null);
    try {
      const res = await api.export(runId, allowDraft, endNodeId);
      setPdfUrl(res.pdfUrl);
      setStatus('done');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const p = (e.body as any)?.pendingPanelIds ?? [];
        setPending(Array.isArray(p) ? p : []);
        setStatus('pending');
        return;
      }
      setMsg(e instanceof Error ? e.message : 'Export failed');
      setStatus('error');
    }
  }, [runId, endNodeId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-label="Export issue">
      <div className="paper rounded-xl border border-black/20 max-w-sm w-full p-5">
        <h2 className="font-display text-xl mb-3">Export issue</h2>

        {status === 'idle' && (
          <>
            <p className="text-sm opacity-80 mb-4">Assemble your issue as a PDF using finished artwork.</p>
            <button onClick={() => run(false)} className="w-full focus-ring rounded-lg bg-accent text-black font-semibold py-2.5">Export PDF</button>
          </>
        )}

        {status === 'working' && <p className="text-sm">Assembling…</p>}

        {status === 'pending' && (
          <>
            <p className="text-sm mb-3">{pending.length} panel(s) still rendering final artwork.</p>
            <div className="space-y-2">
              <button onClick={() => run(false)} className="w-full focus-ring rounded-lg border border-black/30 py-2">Wait for finished artwork</button>
              <button onClick={() => run(true)} className="w-full focus-ring rounded-lg bg-accent text-black font-semibold py-2">Export draft with previews</button>
            </div>
          </>
        )}

        {status === 'done' && (
          <>
            <p className="text-sm mb-3">Your issue is ready.</p>
            {pdfUrl
              ? <a href={pdfUrl} target="_blank" rel="noreferrer" className="block text-center focus-ring rounded-lg bg-accent text-black font-semibold py-2.5">Open PDF</a>
              : <p className="text-sm opacity-70">PDF link unavailable.</p>}
          </>
        )}

        {status === 'error' && <p className="text-sm text-red-700">{msg}</p>}

        <button onClick={onClose} className="mt-4 w-full text-sm underline focus-ring opacity-70">Close</button>
      </div>
    </div>
  );
}
