/** Typed fetch helpers for every route in src/shared/api.ts. */
import type {
  ClientConfig, Metrics, RunBundle, CreateRunRequest, ChooseRequest, ChooseResponse,
  ExportResponse, StoryStartCard, SetupDecks, ProposeSetupRequest, ProposeSetupResponse, ShuffleCardRequest,
} from '@shared/api';
import type { Run, GenerationJob, Asset } from '@shared/schemas';
import { getSessionId } from './session';

function headers(extra?: Record<string, string>): Record<string, string> {
  return { 'x-inkverse-session': getSessionId(), ...(extra ?? {}) };
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: unknown = undefined;
    try { body = await res.json(); } catch { /* ignore */ }
    const err = new ApiError(res.status, (body as any)?.message ?? res.statusText, body);
    throw err;
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = {
  getConfig: () => fetch('/api/config', { headers: headers() }).then(json<ClientConfig>),
  getStarts: () => fetch('/api/setup/starts', { headers: headers() }).then(json<StoryStartCard[]>),
  getDecks: () => fetch('/api/setup/decks', { headers: headers() }).then(json<SetupDecks>),
  proposeSetup: (body: ProposeSetupRequest) =>
    fetch('/api/setup/propose', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body) })
      .then(json<ProposeSetupResponse>),
  shuffleCard: (body: ShuffleCardRequest) =>
    fetch('/api/setup/shuffle', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body) })
      .then(json<ProposeSetupResponse>),
  getMetrics: () => fetch('/api/metrics', { headers: headers() }).then(json<Metrics>),
  listRuns: () => fetch('/api/runs', { headers: headers() }).then(json<Run[]>),
  getRun: (runId: string) => fetch(`/api/runs/${runId}`, { headers: headers() }).then(json<RunBundle>),

  createRun: (body: CreateRunRequest) =>
    fetch('/api/runs', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body) })
      .then(json<RunBundle>),

  choose: (runId: string, body: ChooseRequest) =>
    fetch(`/api/runs/${runId}/choose`, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body) })
      .then(json<ChooseResponse>),

  cursor: (runId: string, nodeId: string) =>
    fetch(`/api/runs/${runId}/cursor`, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ nodeId }) })
      .then(json<Run>),

  revise: (runId: string, nodeId: string, clientOpId: string) =>
    fetch(`/api/runs/${runId}/nodes/${nodeId}/revise`, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ clientOpId }) })
      .then(json<ChooseResponse>),

  retryStory: (runId: string, nodeId: string) =>
    fetch(`/api/runs/${runId}/nodes/${nodeId}/retry-story`, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: '{}' })
      .then(json<ChooseResponse>),

  retryArt: (runId: string, nodeId: string, panelId: string, stage: 'preview' | 'final') =>
    fetch(`/api/runs/${runId}/nodes/${nodeId}/panels/${panelId}/retry`, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ stage }) })
      .then(json<GenerationJob>),

  export: (runId: string, allowDraft: boolean, endNodeId?: string) =>
    fetch(`/api/runs/${runId}/export`, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ allowDraft, endNodeId }) })
      .then(json<ExportResponse>),

  uploadAsset: (file: Blob, filename = 'capture.jpg') => {
    const fd = new FormData();
    fd.append('file', file, filename);
    return fetch('/api/assets/upload', { method: 'POST', headers: headers(), body: fd }).then(json<Asset>);
  },
};

export function eventsUrl(runId: string): string {
  // EventSource cannot set headers, so the session travels as a query param.
  return `/api/runs/${runId}/events?session=${encodeURIComponent(getSessionId())}`;
}
