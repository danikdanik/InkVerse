import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RunBundle } from '@shared/api';
import type { AppEvent, Asset, BudgetLedger } from '@shared/schemas';
import { api, eventsUrl } from '../lib/api';

export type ConnState = 'connecting' | 'open' | 'closed';
export type Stage = 'sketch' | 'preview' | 'final';
const STAGE_IDX: Record<Stage, number> = { sketch: 0, preview: 1, final: 2 };

export interface PanelBest { stage: Stage; requestVersion: number; assetId?: string; failedStage?: string }

/** A choice the reader just submitted; shown optimistically until the child node arrives. */
export interface Pending { operationId?: string; parentNodeId: string; sketchKey?: string; nodeId?: string }

export interface RunController {
  bundle: RunBundle | null;
  conn: ConnState;
  error: string | null;
  budget: BudgetLedger | null;
  refetch: () => Promise<void>;
  best: Record<string, PanelBest>;
  pending: Pending | null;
  clearPending: () => void;
  setPending: (p: Pending | null) => void;
  assetUrl: (assetId?: string | null) => string | undefined;
  lastEventAt: number;
}

export function useRun(runId: string | null): RunController {
  const [bundle, setBundle] = useState<RunBundle | null>(null);
  const [conn, setConn] = useState<ConnState>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState<BudgetLedger | null>(null);
  const [best, setBest] = useState<Record<string, PanelBest>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [lastEventAt, setLastEventAt] = useState(0);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    if (!runId) return;
    try {
      const b = await api.getRun(runId);
      setBundle(b);
      setBudget(b.run.budget);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load run');
    }
  }, [runId]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(() => { void refetch(); }, 180);
  }, [refetch]);

  // Forward-only per-panel stage; ignore stale requestVersions.
  const advance = useCallback((panelId: string, stage: Stage, rv: number, assetId?: string) => {
    setBest((prev) => {
      const cur = prev[panelId];
      if (cur && rv < cur.requestVersion) return prev; // stale
      if (cur && STAGE_IDX[stage] < STAGE_IDX[cur.stage] && rv <= cur.requestVersion) return prev; // never backwards
      return { ...prev, [panelId]: { stage, requestVersion: Math.max(rv, cur?.requestVersion ?? rv), assetId: assetId ?? cur?.assetId } };
    });
  }, []);

  const markFailed = useCallback((panelId: string, stage: string, rv: number) => {
    setBest((prev) => {
      const cur = prev[panelId];
      if (cur && rv < cur.requestVersion) return prev;
      return { ...prev, [panelId]: { stage: cur?.stage ?? 'sketch', requestVersion: cur?.requestVersion ?? rv, assetId: cur?.assetId, failedStage: stage } };
    });
  }, []);

  useEffect(() => {
    if (!runId) return;
    let closed = false;
    void refetch();
    setConn('connecting');
    const es = new EventSource(eventsUrl(runId));
    es.onopen = () => { if (!closed) { setConn('open'); void refetch(); } };
    es.onerror = () => { if (!closed) setConn('closed'); };
    // The server frames each event as `event: <type>`; EventSource.onmessage only fires for
    // unnamed events, so every type must be registered by name or nothing is ever received.
    const EVENT_TYPES = ['choice.accepted', 'story.ready', 'story.failed', 'panel.preview.ready', 'panel.final.ready', 'panel.art.failed', 'budget.updated', 'cursor.moved'] as const;
    const onEvent = (msg: MessageEvent) => {
      setLastEventAt(Date.now());
      let ev: AppEvent;
      try { ev = JSON.parse(msg.data) as AppEvent; } catch { return; }
      switch (ev.type) {
        case 'choice.accepted':
          setPending((p) => (p ? { ...p, operationId: ev.operationId, nodeId: ev.nodeId, sketchKey: ev.sketchKey } : p));
          scheduleRefetch();
          break;
        case 'story.ready':
          setPending((p) => (p && p.nodeId === ev.nodeId ? null : p));
          scheduleRefetch();
          break;
        case 'story.failed':
          scheduleRefetch();
          break;
        case 'panel.preview.ready':
          advance(`${ev.nodeId}:${ev.panelId}`, 'preview', ev.requestVersion, ev.assetId);
          scheduleRefetch();
          break;
        case 'panel.final.ready':
          advance(`${ev.nodeId}:${ev.panelId}`, 'final', ev.requestVersion, ev.assetId);
          scheduleRefetch();
          break;
        case 'panel.art.failed':
          markFailed(`${ev.nodeId}:${ev.panelId}`, ev.stage, ev.requestVersion);
          break;
        case 'budget.updated':
          setBudget(ev.budget);
          break;
        case 'cursor.moved':
          scheduleRefetch();
          break;
      }
    };
    for (const t of EVENT_TYPES) es.addEventListener(t, onEvent as EventListener);
    es.onmessage = onEvent;
    // Safety net: if the event stream drops (server restart, proxy hiccup), a missed
    // panel.*.ready must not strand a panel on its sketch. Poll the persisted bundle while
    // any job is still unfinished; the bundle seeding effect below advances stages forward-only.
    // Unconditional: the bundle is small and this guarantees the page converges on the server
    // state (cursor, new nodes, finished art) even if an event is missed. Events still make
    // updates feel instant; polling is the floor, not the mechanism.
    const poll = setInterval(() => {
      if (!closed) void refetch();
    }, 3000);
    return () => {
      closed = true;
      es.close();
      clearInterval(poll);
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    };
  }, [runId, refetch, scheduleRefetch, advance, markFailed]);

  // Clear the optimistic pending state from persisted data too, not only from the story.ready event.
  // If that event is missed, a stuck pending flag disables every choice button on the page.
  useEffect(() => {
    if (!bundle) return;
    setPending((p) => {
      if (!p) return p;
      const child = p.nodeId ? bundle.nodes.find((n) => n.id === p.nodeId) : undefined;
      if (child && child.storyStatus !== 'pending') return null;
      if (bundle.run.activeNodeId && bundle.run.activeNodeId !== p.parentNodeId) {
        const active = bundle.nodes.find((n) => n.id === bundle.run.activeNodeId);
        if (active && active.storyStatus !== 'pending') return null;
      }
      return p;
    });
  }, [bundle]);

  // Seed best from persisted jobs so a reload keeps the furthest stage already reached.
  useEffect(() => {
    if (!bundle) return;
    setBest((prev) => {
      const next = { ...prev };
      for (const j of bundle.jobs) {
        if (j.status !== 'succeeded' || !j.assetId) continue;
        const stage: Stage | null = j.stage === 'final' ? 'final' : j.stage === 'preview' ? 'preview' : null;
        if (!stage) continue;
        // Keyed by node AND panel: every beat reuses panel ids like p0, so a per-panel key made siblings share art.
        const key = `${j.nodeId}:${j.panelId}`;
        const cur = next[key];
        if (!cur || STAGE_IDX[stage] > STAGE_IDX[cur.stage] || (STAGE_IDX[stage] === STAGE_IDX[cur.stage] && j.requestVersion > cur.requestVersion)) {
          next[key] = { stage, requestVersion: Math.max(j.requestVersion, cur?.requestVersion ?? 0), assetId: j.assetId, failedStage: cur?.failedStage };
        }
      }
      return next;
    });
  }, [bundle]);

  const assetIndex = useMemo(() => {
    const m = new Map<string, Asset>();
    for (const a of bundle?.assets ?? []) m.set(a.id, a);
    return m;
  }, [bundle]);

  const assetUrl = useCallback((id?: string | null) => (id ? assetIndex.get(id)?.url : undefined), [assetIndex]);

  return {
    bundle, conn, error, budget, refetch, best, pending,
    clearPending: () => setPending(null), setPending, assetUrl, lastEventAt,
  };
}
