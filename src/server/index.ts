/** Fastify server + buildServer factory (used by tests via fastify.inject). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fstatic from '@fastify/static';
import { EPISODE } from '@content/episode';
import type { FixtureEpisode } from '@content/types';
import { loadConfig, type ServerConfig } from './config';
import { Db } from './db';
import { EventHub } from './events';
import { chooseProviders } from './providers/index';
import { Worker } from './worker';
import { registerRoutes } from './routes/api';
import type { AppContext } from './context';
import { ensureDir } from './util';

export interface BuildOptions {
  inMemory?: boolean;
  /** Deep-ish partial override of the loaded config (tests set caps, delays, etc.). */
  config?: Omit<Partial<ServerConfig>, 'caps' | 'models' | 'timeouts' | 'fixtureDelays' | 'keys' | 'panel'> & {
    caps?: Partial<ServerConfig['caps']>;
    models?: Partial<ServerConfig['models']>;
    timeouts?: Partial<ServerConfig['timeouts']>;
    fixtureDelays?: Partial<ServerConfig['fixtureDelays']>;
    keys?: Partial<ServerConfig['keys']>;
    panel?: Partial<ServerConfig['panel']>;
  };
  episode?: FixtureEpisode;
}

function mergeConfig(base: ServerConfig, over?: BuildOptions['config']): ServerConfig {
  if (!over) return base;
  return {
    ...base,
    ...over,
    caps: { ...base.caps, ...over.caps },
    models: { ...base.models, ...over.models },
    timeouts: { ...base.timeouts, ...over.timeouts },
    fixtureDelays: { ...base.fixtureDelays, ...over.fixtureDelays },
    keys: { ...base.keys, ...over.keys },
    panel: { ...base.panel, ...over.panel },
  };
}

export async function buildServer(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const inMemory = opts.inMemory ?? false;
  const dataDir = inMemory ? fs.mkdtempSync(path.join(os.tmpdir(), 'inkverse-test-')) : undefined;
  const config = mergeConfig(loadConfig({ inMemory, dataDir }), opts.config);
  ensureDir(config.assetsDir);

  const episode = opts.episode ?? EPISODE;
  const artRoot = path.resolve(process.cwd(), 'src/content/art');

  const db = new Db(config);
  const hub = new EventHub();
  const [demo, live] = await Promise.all([
    chooseProviders('demo', config, episode, artRoot),
    chooseProviders('live', config, episode, artRoot),
  ]);

  const ctx: AppContext = {
    config,
    db,
    hub,
    episode,
    artRoot,
    bundles: { demo, live },
    worker: undefined as unknown as Worker,
  };
  ctx.worker = new Worker(ctx);

  const app = Fastify({ logger: false, bodyLimit: 8 * 1024 * 1024 });
  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 6 * 1024 * 1024, files: 1 } });
  await app.register(fstatic, {
    root: config.assetsDir,
    prefix: '/assets/',
    decorateReply: false,
    maxAge: 31536000000,
    immutable: true,
  });

  // exposed for tests: app.inkverse.worker.whenIdle(), app.inkverse.db, etc.
  app.decorate('inkverse', ctx);
  registerRoutes(app, ctx);

  // production: serve built SPA with fallback
  if (process.env.NODE_ENV === 'production') {
    const webDir = path.resolve(process.cwd(), 'dist/web');
    if (fs.existsSync(webDir)) {
      await app.register(fstatic, { root: webDir, prefix: '/', decorateReply: false });
      app.setNotFoundHandler((req, reply) => {
        if (req.url.startsWith('/api') || req.url.startsWith('/assets')) {
          reply.code(404).send({ error: 'not_found' });
          return;
        }
        reply.type('text/html').send(fs.readFileSync(path.join(webDir, 'index.html')));
      });
    }
  }

  return app;
}

// Start when invoked directly (tsx src/server/index.ts).
const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const cfg = loadConfig();
  buildServer()
    .then((app) => app.listen({ port: cfg.port, host: '0.0.0.0' }))
    .then(() => console.log(`INKVERSE server on :${cfg.port}`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
