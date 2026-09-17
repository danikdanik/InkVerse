/** Shared server context wired once at boot and handed to routes + worker. */
import type { RunMode } from '@shared/schemas';
import type { FixtureEpisode } from '@content/types';
import type { ServerConfig } from './config';
import type { Db } from './db';
import type { EventHub } from './events';
import type { ProviderBundle } from './providers/index';
import type { Worker } from './worker';

export interface AppContext {
  config: ServerConfig;
  db: Db;
  hub: EventHub;
  episode: FixtureEpisode;
  artRoot: string;
  bundles: Record<RunMode, ProviderBundle>;
  worker: Worker;
}
