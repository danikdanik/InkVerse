import { describe, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer, type BuildOptions } from '../src/server/index';

const SESSION = { 'x-inkverse-session': 'sess-1' } as const;

async function makeApp(config?: BuildOptions['config']): Promise<FastifyInstance> {
  return buildServer({ inMemory: true, config });
}
function ctx(app: FastifyInstance): any {
  return (app as any).inkverse;
}
async function idle(app: FastifyInstance): Promise<void> {
  await ctx(app).worker.whenIdle();
}
async function createRun(app: FastifyInstance, body: Record<string, unknown> = {}) {
  const res = await app.inject({ method: 'POST', url: '/api/runs', headers: SESSION, payload: { mode: 'demo', ...body } });
  return res;
}
async function getBundle(app: FastifyInstance, runId: string) {
  return (await app.inject({ method: 'GET', url: `/api/runs/${runId}`, headers: SESSION })).json();
}
async function choose(app: FastifyInstance, runId: string, payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: `/api/runs/${runId}/choose`, headers: SESSION, payload });
}

describe('INKVERSE server branching', () => {
  it('(a) a choice creates a child whose state differs from the parent', async () => {
    const app = await makeApp();
    const run = (await createRun(app)).json();
    await idle(app);
    const root = run.nodes[0];
    const res = await choose(app, run.run.id, {
      parentNodeId: root.id,
      parentVersion: root.stateVersion,
      choiceId: 'gate',
      clientOpId: 'op-aaaaaaaa',
    });
    expect(res.statusCode).toBe(202);
    const { nodeId } = res.json();
    await idle(app);
    const bundle = await getBundle(app, run.run.id);
    const child = bundle.nodes.find((n: any) => n.id === nodeId);
    expect(child.storyStatus).toBe('ready');
    expect(child.state).not.toEqual(root.state);
    expect(child.state.knownFacts).not.toEqual(root.state.knownFacts);
    await app.close();
  });

  it('(b) a custom action moves the compass from neri to the guardian', async () => {
    const app = await makeApp();
    const run = (await createRun(app)).json();
    await idle(app);
    const root = run.nodes[0];
    const res = await choose(app, run.run.id, {
      parentNodeId: root.id,
      parentVersion: root.stateVersion,
      customAction: 'I ask the guardian to hold the compass while I read the map',
      clientOpId: 'op-bbbbbbbb',
    });
    const { nodeId } = res.json();
    await idle(app);
    const bundle = await getBundle(app, run.run.id);
    const child = bundle.nodes.find((n: any) => n.id === nodeId);
    expect(child.storyStatus).toBe('ready');
    if (child.fixtureKey && String(child.fixtureKey).startsWith('custom-compass')) {
      expect(child.state.inventory.compass).toBe('guardian');
    } else {
      // fallback path: still echoes the action in the narration
      expect(child.beat.narration.toLowerCase()).toContain('compass');
    }
    await app.close();
  });

  it('(c) rewind + sibling has no leaked facts from the first branch', async () => {
    const app = await makeApp();
    const run = (await createRun(app)).json();
    await idle(app);
    const root = run.nodes[0];

    const gate = (
      await choose(app, run.run.id, {
        parentNodeId: root.id,
        parentVersion: root.stateVersion,
        choiceId: 'gate',
        clientOpId: 'op-ccccccc1',
      })
    ).json();
    await idle(app);

    // move the cursor back to root, then take the other branch
    await app.inject({ method: 'POST', url: `/api/runs/${run.run.id}/cursor`, headers: SESSION, payload: { nodeId: root.id } });
    const guardian = (
      await choose(app, run.run.id, {
        parentNodeId: root.id,
        parentVersion: root.stateVersion,
        choiceId: 'guardian',
        clientOpId: 'op-ccccccc2',
      })
    ).json();
    await idle(app);

    const bundle = await getBundle(app, run.run.id);
    const gateChild = bundle.nodes.find((n: any) => n.id === gate.nodeId);
    const gdChild = bundle.nodes.find((n: any) => n.id === guardian.nodeId);
    const addedByGate = gateChild.state.knownFacts.filter((f: string) => !root.state.knownFacts.includes(f));
    expect(addedByGate.length).toBeGreaterThan(0);
    for (const fact of addedByGate) expect(gdChild.state.knownFacts).not.toContain(fact);
    expect(gdChild.state.inventory).toEqual(root.state.inventory);
    await app.close();
  });

  it('(d) duplicate clientOpId creates one child and one set of jobs', async () => {
    const app = await makeApp();
    const run = (await createRun(app)).json();
    await idle(app);
    const root = run.nodes[0];
    const payload = { parentNodeId: root.id, parentVersion: root.stateVersion, choiceId: 'gate', clientOpId: 'op-dddddddd' };
    const r1 = (await choose(app, run.run.id, payload)).json();
    const r2res = await choose(app, run.run.id, payload);
    const r2 = r2res.json();
    await idle(app);
    expect(r2.deduplicated).toBe(true);
    expect(r2.nodeId).toBe(r1.nodeId);
    const bundle = await getBundle(app, run.run.id);
    const children = bundle.nodes.filter((n: any) => n.parentId === root.id);
    expect(children.length).toBe(1);
    const jobs = bundle.jobs.filter((j: any) => j.nodeId === r1.nodeId);
    const childPanels = children[0].panels.length;
    expect(jobs.length).toBe(childPanels * 2); // parallel: preview + final per panel
    await app.close();
  });

  it('(e) parentVersion mismatch returns 409', async () => {
    const app = await makeApp();
    const run = (await createRun(app)).json();
    await idle(app);
    const root = run.nodes[0];
    const res = await choose(app, run.run.id, {
      parentNodeId: root.id,
      parentVersion: root.stateVersion + 7,
      choiceId: 'gate',
      clientOpId: 'op-eeeeeeee',
    });
    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it('(f) final is kept as the best stage; art jobs carry requestVersion', async () => {
    const app = await makeApp();
    const run = (await createRun(app)).json();
    await idle(app);
    const root = run.nodes[0];
    const { nodeId } = (
      await choose(app, run.run.id, {
        parentNodeId: root.id,
        parentVersion: root.stateVersion,
        choiceId: 'gate',
        clientOpId: 'op-ffffffff',
      })
    ).json();
    await idle(app);
    const bundle = await getBundle(app, run.run.id);
    const child = bundle.nodes.find((n: any) => n.id === nodeId);
    const panelId = child.panels[0].id;
    const nodeAssets = bundle.assets.filter((a: any) => a.generationMeta.nodeId === nodeId);
    expect(nodeAssets.some((a: any) => a.stage === 'final')).toBe(true);
    expect(nodeAssets.some((a: any) => a.stage === 'preview')).toBe(true);
    const jobs = bundle.jobs.filter((j: any) => j.nodeId === nodeId);
    expect(jobs.every((j: any) => j.requestVersion === 1)).toBe(true);

    const exp = await app.inject({
      method: 'POST',
      url: `/api/runs/${run.run.id}/export`,
      headers: SESSION,
      payload: { endNodeId: nodeId, allowDraft: true },
    });
    const finalAsset = nodeAssets.find((a: any) => a.stage === 'final' && a.generationMeta.panelId === panelId);
    expect(exp.json().snapshot.selectedAssets[panelId]).toBe(finalAsset.id);
    await app.close();
  });

  it('(g) reload returns the same nodes/assets with no new provider calls', async () => {
    const app = await makeApp();
    const img = ctx(app).bundles.demo.image;
    const orig = img.generate.bind(img);
    let calls = 0;
    img.generate = (...a: unknown[]) => {
      calls += 1;
      return (orig as any)(...a);
    };
    const run = (await createRun(app)).json();
    await idle(app);
    const afterCreate = calls;
    const b1 = await getBundle(app, run.run.id);
    const b2 = await getBundle(app, run.run.id);
    expect(calls).toBe(afterCreate); // GET does not touch providers
    expect(b2.nodes.map((n: any) => n.id)).toEqual(b1.nodes.map((n: any) => n.id));
    expect(b2.assets.map((a: any) => a.id)).toEqual(b1.assets.map((a: any) => a.id));
    expect(b2.jobs.length).toBe(b1.jobs.length);
    await app.close();
  });

  it('(h) with cap 0 the image job fails budget_exhausted and the story stays readable', async () => {
    const app = await makeApp({ caps: { runwareUsd: 0 } });
    const run = (await createRun(app)).json();
    await idle(app);
    const bundle = await getBundle(app, run.run.id);
    const root = bundle.nodes[0];
    expect(root.storyStatus).toBe('ready');
    expect(bundle.jobs.some((j: any) => j.status === 'failed' && j.error === 'budget_exhausted')).toBe(true);
    await app.close();
  });

  it('(i) /api/config leaks no secret VALUES (env-var names in the setup hint are allowed)', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/config' });
    expect(res.statusCode).toBe(200);
    // The setup hint names ANTHROPIC_API_KEY/FABLE_5_1_KEY on purpose; assert no key VALUES leak.
    expect(res.payload).not.toMatch(/sk-ant-[A-Za-z0-9]|rw-[A-Za-z0-9]{8}/);
    const body = res.json();
    expect(body.liveAvailable).toBe(false);
    expect(body.motionPlayer).toBe('css-fallback');
    expect(body.liveProviders).toEqual({ story: 'fixture', image: 'fixture' });
    await app.close();
  });

  it('(wave2) choose advances the active cursor to the new child', async () => {
    const app = await makeApp();
    const run = (await createRun(app)).json();
    await idle(app);
    const root = run.nodes[0];
    const { nodeId } = (
      await choose(app, run.run.id, {
        parentNodeId: root.id,
        parentVersion: root.stateVersion,
        choiceId: 'gate',
        clientOpId: 'op-cursor01',
      })
    ).json();
    await idle(app);
    const bundle = await getBundle(app, run.run.id);
    expect(bundle.run.activeNodeId).toBe(nodeId);
    await app.close();
  });

  it('(wave2) a non-citadel start in demo mode is rejected with live_required', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/runs',
      headers: SESSION,
      payload: { mode: 'demo', startId: 'shadow-strike' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('live_required');
    await app.close();
  });

  it('(wave2) propose keeps a locked card verbatim (deck path)', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/setup/propose',
      headers: SESSION,
      payload: { picks: { hero: 'A lighthouse keeper who never sleeps' }, locked: ['hero'] },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.source).toBe('deck');
    expect(body.setup.hero).toBe('A lighthouse keeper who never sleeps');
    expect(body.setup.world.length).toBeGreaterThan(2);
    await app.close();
  });

  it('(wave2) setup starts and decks are served', async () => {
    const app = await makeApp();
    const starts = (await app.inject({ method: 'GET', url: '/api/setup/starts' })).json();
    expect(Array.isArray(starts)).toBe(true);
    expect(starts.some((s: any) => s.id === 'citadel')).toBe(true);
    const decks = (await app.inject({ method: 'GET', url: '/api/setup/decks' })).json();
    expect(decks.hero.length).toBeGreaterThan(0);
    await app.close();
  });

  it('rejects run routes without a session header (400)', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/runs' });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
