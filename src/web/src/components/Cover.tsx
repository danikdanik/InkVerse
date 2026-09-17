import { useEffect, useState } from 'react';
import type { Run } from '@shared/schemas';
import { loadSketches, sketchFor } from '../lib/sketches';

const ISSUE_TITLE = 'Issue #1: The Citadel of Time and Space';

/** Runware GPT Image 2.5 render of the opening scene, generated once and stored with the app. */
const DEFAULT_COVER_URL = '/covers/citadel-cover.png';

/** Opens directly on the comic cover. Continue appears when a saved run exists for this session. */
export function Cover({ runs, coverUrl, onBegin, onContinue, onOpenArchive }: {
  runs: Run[];
  coverUrl?: string;
  onBegin: () => void;
  onContinue: (runId: string) => void;
  onOpenArchive: () => void;
}) {
  const [citadel, setCitadel] = useState<string>('');
  useEffect(() => { void loadSketches().then((s) => setCitadel(sketchFor(s, 'citadel'))); }, []);
  const recent = runs[0];

  return (
    <div className="min-h-full w-full flex items-center justify-center p-6" style={{ background: '#0b0a09' }}>
      <div className="w-full max-w-md paper rounded-xl shadow-2xl overflow-hidden border border-black/20">
        <div className="relative aspect-[3/4] w-full bg-black/80">
          {(coverUrl ?? DEFAULT_COVER_URL) ? (
            <img src={coverUrl ?? DEFAULT_COVER_URL} alt={`Cover of ${ISSUE_TITLE}`} className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 grid place-items-center p-6">
              <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: citadel }} />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/80 to-transparent">
            <p className="font-letter text-accent text-xs tracking-widest uppercase">INKVERSE</p>
            <h1 className="font-display text-3xl leading-tight text-white">The Citadel of Time and Space</h1>
            <p className="text-white/70 text-sm mt-1">Issue #1</p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <button onClick={onBegin} className="w-full focus-ring rounded-lg bg-accent text-black font-semibold py-3 text-lg">Begin Issue</button>
          {recent && (
            <button onClick={() => onContinue(recent.id)} className="w-full focus-ring rounded-lg border border-black/30 py-2.5 font-medium">
              Continue: {recent.title || recent.protagonistName}
            </button>
          )}
          <div className="text-center">
            <button onClick={onOpenArchive} className="text-sm underline focus-ring opacity-75">My Issues</button>
          </div>
        </div>
      </div>
    </div>
  );
}
