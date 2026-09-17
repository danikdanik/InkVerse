/** Per-run SSE hub. One stream per run; events are the AppEvent discriminated union. */
import type { FastifyReply } from 'fastify';
import type { AppEvent } from '@shared/schemas';

export class EventHub {
  private streams = new Map<string, Set<FastifyReply>>();

  subscribe(runId: string, reply: FastifyReply): void {
    let set = this.streams.get(runId);
    if (!set) {
      set = new Set();
      this.streams.set(runId, set);
    }
    set.add(reply);
    reply.raw.on('close', () => {
      set!.delete(reply);
      if (set!.size === 0) this.streams.delete(runId);
    });
  }

  publish(runId: string, event: AppEvent): void {
    const set = this.streams.get(runId);
    if (!set || set.size === 0) return;
    // SSE frame: named event + JSON payload. Web listens per event.type.
    const frame = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const reply of set) {
      try {
        reply.raw.write(frame);
      } catch {
        set.delete(reply);
      }
    }
  }

  subscriberCount(runId: string): number {
    return this.streams.get(runId)?.size ?? 0;
  }
}
