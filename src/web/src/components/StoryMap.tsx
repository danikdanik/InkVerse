import { useMemo, useState } from 'react';
import { ReactFlow, Background, type Node as FlowNode, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { RunBundle } from '@shared/api';
import type { StoryNode } from '@shared/schemas';

/** Story map: graph of committed nodes, root at top, active path highlighted, plus a keyboard list. */
export function StoryMap({ bundle, activeNodeId, onCursor, onClose }: {
  bundle: RunBundle;
  activeNodeId: string | null;
  onCursor: (nodeId: string) => void;
  onClose: () => void;
}) {
  const nodes = bundle.nodes;
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const activePath = useMemo(() => {
    const path = new Set<string>();
    let cur = activeNodeId ? byId.get(activeNodeId) : undefined;
    while (cur) { path.add(cur.id); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
    return path;
  }, [activeNodeId, byId]);

  const [selectedId, setSelectedId] = useState<string | null>(activeNodeId);
  const selected = selectedId ? byId.get(selectedId) : undefined;

  const { flowNodes, edges } = useMemo(() => {
    const depth = new Map<string, number>();
    const perDepth = new Map<number, number>();
    const order = [...nodes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const fn: FlowNode[] = [];
    const es: Edge[] = [];
    for (const n of order) {
      const d = n.parentId && depth.has(n.parentId) ? (depth.get(n.parentId)! + 1) : 0;
      depth.set(n.id, d);
      const col = perDepth.get(d) ?? 0;
      perDepth.set(d, col + 1);
      const onPath = activePath.has(n.id);
      fn.push({
        id: n.id,
        position: { x: col * 190, y: d * 120 },
        data: { label: `${n.originatingChoice.label}${n.storyStatus === 'pending' ? ' …' : ''}` },
        style: {
          width: 168, fontSize: 12, padding: 6, borderRadius: 8,
          border: n.id === activeNodeId ? '2px solid var(--accent)' : onPath ? '2px solid rgba(43,179,192,0.5)' : '1px solid #999',
          background: onPath ? 'var(--paper)' : '#efe9dd', color: '#141210',
        },
      });
      if (n.parentId) es.push({ id: `${n.parentId}-${n.id}`, source: n.parentId, target: n.id, animated: activePath.has(n.id) });
    }
    return { flowNodes: fn, edges: es };
  }, [nodes, activePath, activeNodeId]);

  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex" role="dialog" aria-label="Story map">
      <div className="flex-1 relative">
        <div className="absolute inset-0">
          <ReactFlow nodes={flowNodes} edges={edges} fitView
            onNodeClick={(_, n) => setSelectedId(n.id)} proOptions={{ hideAttribution: true }}>
            <Background />
          </ReactFlow>
        </div>
      </div>

      <aside className="w-full max-w-xs bg-neutral-950 text-neutral-200 p-4 overflow-auto drawer-scroll">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Story map</h2>
          <button onClick={onClose} className="underline text-sm focus-ring">Close</button>
        </div>

        {selected ? <Inspector node={selected} onCursor={onCursor} /> : <p className="text-xs text-neutral-400">Select a node.</p>}

        <h3 className="text-xs uppercase tracking-wide text-neutral-400 mt-5 mb-2">History (keyboard)</h3>
        <ol className="space-y-1">
          {nodes.filter((n) => activePath.has(n.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((n) => (
            <li key={n.id}>
              <button onClick={() => setSelectedId(n.id)}
                className={`w-full text-left text-xs rounded px-2 py-1 focus-ring ${n.id === activeNodeId ? 'bg-white/10' : ''}`}>
                {n.beat.title || n.originatingChoice.label}
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

function Inspector({ node, onCursor }: { node: StoryNode; onCursor: (id: string) => void }) {
  return (
    <div className="text-xs">
      <p className="font-display text-base text-white mb-1">{node.beat.title}</p>
      <p className="text-neutral-400 mb-1">via {node.originatingChoice.label}</p>
      <p className="text-neutral-300 mb-2">{node.beat.narration}</p>
      {node.choices.length > 0 && (
        <ul className="list-disc pl-4 mb-3 text-neutral-400">
          {node.choices.map((c) => <li key={c.id}>{c.label}</li>)}
        </ul>
      )}
      <button onClick={() => onCursor(node.id)} className="w-full focus-ring rounded bg-accent text-black py-1.5 font-medium">Continue from here</button>
    </div>
  );
}
