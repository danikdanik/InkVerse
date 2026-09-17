/**
 * SQLite persistence via node:sqlite (Node 26 built-in). Complex records are stored as JSON
 * columns and re-validated with Zod on read, so a corrupt/legacy row fails loud instead of
 * silently corrupting state. Migrations are idempotent (CREATE TABLE IF NOT EXISTS).
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {
  Run,
  StoryBible,
  StoryNode,
  GenerationJob,
  Asset,
} from '@shared/schemas';
import type {
  Run as TRun,
  StoryBible as TBible,
  StoryNode as TNode,
  GenerationJob as TJob,
  Asset as TAsset,
} from '@shared/schemas';
import type { ServerConfig } from './config';

export interface MetricRecord {
  runId: string;
  kind: 'storyReadyMs' | 'previewReadyMs' | 'finalReadyMs' | 'costPerBeat' | 'retry' | 'tokens';
  value?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  uncachedInputTokens?: number;
}

export interface OperationRow {
  runId: string;
  clientOpId: string;
  operationId: string;
  nodeId: string;
}

export class Db {
  readonly raw: DatabaseSync;

  constructor(config: ServerConfig) {
    if (config.dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
    }
    this.raw = new DatabaseSync(config.dbPath);
    this.raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.migrate();
  }

  private migrate(): void {
    this.raw.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        owner_session TEXT NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS bibles (
        id TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        parent_id TEXT,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_nodes_run ON nodes(run_id);
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        panel_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_run ON jobs(run_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_node ON jobs(node_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idem ON jobs(idempotency_key);
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        run_id TEXT,
        node_id TEXT,
        panel_id TEXT,
        stage TEXT NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_assets_node ON assets(node_id);
      CREATE TABLE IF NOT EXISTS operations (
        run_id TEXT NOT NULL,
        client_op_id TEXT NOT NULL,
        operation_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        UNIQUE(run_id, client_op_id)
      );
      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        value REAL,
        cache_read INTEGER,
        cache_write INTEGER,
        uncached_input INTEGER
      );
    `);
  }

  // ---- runs ----
  insertRun(run: TRun): void {
    this.raw
      .prepare('INSERT INTO runs (id, owner_session, created_at, data) VALUES (?, ?, ?, ?)')
      .run(run.id, run.ownerSessionId, run.createdAt, JSON.stringify(run));
  }
  updateRun(run: TRun): void {
    this.raw.prepare('UPDATE runs SET data = ? WHERE id = ?').run(JSON.stringify(run), run.id);
  }
  getRun(id: string): TRun | null {
    const row = this.raw.prepare('SELECT data FROM runs WHERE id = ?').get(id) as { data: string } | undefined;
    return row ? Run.parse(JSON.parse(row.data)) : null;
  }
  listRunsBySession(session: string): TRun[] {
    const rows = this.raw
      .prepare('SELECT data FROM runs WHERE owner_session = ? ORDER BY created_at DESC')
      .all(session) as { data: string }[];
    return rows.map((r) => Run.parse(JSON.parse(r.data)));
  }

  // ---- bibles ----
  insertBible(b: TBible): void {
    this.raw
      .prepare('INSERT OR REPLACE INTO bibles (id, version, data) VALUES (?, ?, ?)')
      .run(b.id, b.version, JSON.stringify(b));
  }
  getBible(id: string): TBible | null {
    const row = this.raw.prepare('SELECT data FROM bibles WHERE id = ?').get(id) as { data: string } | undefined;
    return row ? StoryBible.parse(JSON.parse(row.data)) : null;
  }

  // ---- nodes ----
  insertNode(n: TNode): void {
    this.raw
      .prepare('INSERT INTO nodes (id, run_id, parent_id, created_at, data) VALUES (?, ?, ?, ?, ?)')
      .run(n.id, n.runId, n.parentId, n.createdAt, JSON.stringify(n));
  }
  updateNode(n: TNode): void {
    this.raw.prepare('UPDATE nodes SET data = ? WHERE id = ?').run(JSON.stringify(n), n.id);
  }
  getNode(id: string): TNode | null {
    const row = this.raw.prepare('SELECT data FROM nodes WHERE id = ?').get(id) as { data: string } | undefined;
    return row ? StoryNode.parse(JSON.parse(row.data)) : null;
  }
  listNodes(runId: string): TNode[] {
    const rows = this.raw
      .prepare('SELECT data FROM nodes WHERE run_id = ? ORDER BY created_at ASC')
      .all(runId) as { data: string }[];
    return rows.map((r) => StoryNode.parse(JSON.parse(r.data)));
  }

  // ---- jobs ----
  insertJob(j: TJob): void {
    this.raw
      .prepare(
        'INSERT INTO jobs (id, run_id, node_id, panel_id, stage, status, idempotency_key, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(j.id, j.runId, j.nodeId, j.panelId, j.stage, j.status, j.idempotencyKey, j.createdAt, JSON.stringify(j));
  }
  updateJob(j: TJob): void {
    this.raw
      .prepare('UPDATE jobs SET status = ?, data = ? WHERE id = ?')
      .run(j.status, JSON.stringify(j), j.id);
  }
  getJob(id: string): TJob | null {
    const row = this.raw.prepare('SELECT data FROM jobs WHERE id = ?').get(id) as { data: string } | undefined;
    return row ? GenerationJob.parse(JSON.parse(row.data)) : null;
  }
  getJobByIdempotency(key: string): TJob | null {
    const row = this.raw
      .prepare('SELECT data FROM jobs WHERE idempotency_key = ?')
      .get(key) as { data: string } | undefined;
    return row ? GenerationJob.parse(JSON.parse(row.data)) : null;
  }
  listJobs(runId: string): TJob[] {
    const rows = this.raw
      .prepare('SELECT data FROM jobs WHERE run_id = ? ORDER BY created_at ASC')
      .all(runId) as { data: string }[];
    return rows.map((r) => GenerationJob.parse(JSON.parse(r.data)));
  }
  listJobsForNode(nodeId: string): TJob[] {
    const rows = this.raw
      .prepare('SELECT data FROM jobs WHERE node_id = ? ORDER BY created_at ASC')
      .all(nodeId) as { data: string }[];
    return rows.map((r) => GenerationJob.parse(JSON.parse(r.data)));
  }

  // ---- assets ----
  insertAsset(a: TAsset, ctx: { runId?: string | null; nodeId?: string | null; panelId?: string | null }): void {
    this.raw
      .prepare('INSERT INTO assets (id, run_id, node_id, panel_id, stage, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(a.id, ctx.runId ?? null, ctx.nodeId ?? null, ctx.panelId ?? null, a.stage, a.createdAt, JSON.stringify(a));
  }
  getAsset(id: string): TAsset | null {
    const row = this.raw.prepare('SELECT data FROM assets WHERE id = ?').get(id) as { data: string } | undefined;
    return row ? Asset.parse(JSON.parse(row.data)) : null;
  }
  listAssets(runId: string): TAsset[] {
    const rows = this.raw
      .prepare('SELECT data FROM assets WHERE run_id = ? ORDER BY created_at ASC')
      .all(runId) as { data: string }[];
    return rows.map((r) => Asset.parse(JSON.parse(r.data)));
  }
  listAssetsForNode(nodeId: string): TAsset[] {
    const rows = this.raw
      .prepare('SELECT data FROM assets WHERE node_id = ? ORDER BY created_at ASC')
      .all(nodeId) as { data: string }[];
    return rows.map((r) => Asset.parse(JSON.parse(r.data)));
  }

  // ---- operations (idempotent choose) ----
  findOperation(runId: string, clientOpId: string): OperationRow | null {
    const row = this.raw
      .prepare('SELECT run_id as runId, client_op_id as clientOpId, operation_id as operationId, node_id as nodeId FROM operations WHERE run_id = ? AND client_op_id = ?')
      .get(runId, clientOpId) as OperationRow | undefined;
    return row ?? null;
  }
  findOperationByNode(nodeId: string): OperationRow | null {
    const row = this.raw
      .prepare('SELECT run_id as runId, client_op_id as clientOpId, operation_id as operationId, node_id as nodeId FROM operations WHERE node_id = ?')
      .get(nodeId) as OperationRow | undefined;
    return row ?? null;
  }
  insertOperation(op: OperationRow): void {
    this.raw
      .prepare('INSERT OR IGNORE INTO operations (run_id, client_op_id, operation_id, node_id) VALUES (?, ?, ?, ?)')
      .run(op.runId, op.clientOpId, op.operationId, op.nodeId);
  }

  // ---- metrics ----
  recordMetric(m: MetricRecord): void {
    this.raw
      .prepare('INSERT INTO metrics (run_id, kind, value, cache_read, cache_write, uncached_input) VALUES (?, ?, ?, ?, ?, ?)')
      .run(m.runId, m.kind, m.value ?? null, m.cacheReadTokens ?? null, m.cacheWriteTokens ?? null, m.uncachedInputTokens ?? null);
  }
  allMetrics(): MetricRecord[] {
    const rows = this.raw
      .prepare('SELECT run_id as runId, kind, value, cache_read as cacheReadTokens, cache_write as cacheWriteTokens, uncached_input as uncachedInputTokens FROM metrics')
      .all() as unknown as MetricRecord[];
    return rows;
  }

  transaction<T>(fn: () => T): T {
    this.raw.exec('BEGIN');
    try {
      const out = fn();
      this.raw.exec('COMMIT');
      return out;
    } catch (e) {
      this.raw.exec('ROLLBACK');
      throw e;
    }
  }

  close(): void {
    this.raw.close();
  }
}
