import type { StoryNode } from '@shared/schemas';

/** Accessible reading-order transcript: narration, then per panel its bubbles and alt text. */
export function Transcript({ node, onClose }: { node: StoryNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-4" role="dialog" aria-label="Transcript">
      <div className="paper rounded-xl border border-black/20 max-w-lg w-full max-h-[80vh] overflow-auto p-5 drawer-scroll">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">Transcript</h2>
          <button onClick={onClose} className="text-sm underline focus-ring">Close</button>
        </div>
        <p className="font-display text-lg mb-1">{node.beat.title}</p>
        <p className="mb-4">{node.beat.narration}</p>
        <ol className="space-y-4">
          {node.panels.map((p, i) => (
            <li key={p.id}>
              <p className="text-xs uppercase tracking-wide opacity-60">Panel {i + 1}</p>
              {p.bubbles?.map((b, j) => (
                <p key={j} className="text-sm"><span className="opacity-60">{b.kind}: </span>{b.text}</p>
              ))}
              <p className="text-sm mt-1">
                <span className="opacity-60">Scene: </span>{p.altText}
                {!p.altTextVerified && <span className="ml-1 text-xs italic opacity-60">(described from scene plan)</span>}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
