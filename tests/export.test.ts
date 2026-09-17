import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { renderIssuePdf } from '../src/server/export/pdf';
import type { Asset, Bubble, Composition, MotionParams, PanelSpec, StoryBible, StoryNode, ExportSnapshot } from '../src/shared/schemas';

// ---------- tiny binary fixtures ----------
function makeSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200"><rect width="300" height="200" fill="${color}"/></svg>`;
}

/** Hand-rolled minimal 4x4 RGB PNG (no external deps needed for the fixture). */
function makeTinyPng(): Buffer {
  const width = 4;
  const height = 4;
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  const crc32 = (buf: Buffer) => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rowSize = width * 3 + 1;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < width; x++) {
      const o = y * rowSize + 1 + x * 3;
      raw[o] = 200;
      raw[o + 1] = 50;
      raw[o + 2] = 50;
    }
  }
  const idat = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const composition: Composition = {
  shot: 'medium',
  viewpoint: 'eye-level',
  subjects: [],
  focalPoint: { x: 0.5, y: 0.5 },
  background: 'a quiet street',
  palette: ['#111111', '#eeeeee'],
  textSafeAreas: [{ x: 0.05, y: 0.05, w: 0.3, h: 0.2 }],
  aspect: '3:2',
};

const motion: MotionParams = {
  preset: 'still',
  durationMs: 4800,
  focalPoint: { x: 0.5, y: 0.45 },
  zoomStart: 1,
  zoomEnd: 1.03,
  panXPercent: 0,
  panYPercent: 0,
  intensity: 0.25,
  particleCount: 12,
  seed: 1,
};

function makePanel(id: string, bubble: Bubble): PanelSpec {
  return {
    id,
    layoutSlot: 0,
    action: 'the hero looks up',
    presentCharacterIds: ['neri'],
    composition,
    sceneBrief: 'a moody establishing shot',
    bubbles: [bubble],
    altText: 'the hero looks up at a tall gate',
    altTextVerified: true,
    motion,
    sketchKey: 'generic',
  };
}

describe('renderIssuePdf', () => {
  let tmpDir: string;
  let pngBuffer: Buffer;
  const assetsById = new Map<string, Buffer>();

  const bible: StoryBible = {
    id: 'bible-1',
    version: 1,
    issueTitle: 'The Archive Gate',
    premise: 'a reader explores a strange archive',
    characters: [
      { id: 'neri', name: 'Neri', role: 'protagonist', canonicalDescription: 'a curious archivist', fixedTraits: ['brave'], referenceAssetIds: [], source: 'authored' },
    ],
    worldRules: [],
    styleId: 'clear-line',
    styleRules: [],
    tone: 'wondrous',
    genre: 'archive-heist',
    episodeArc: [],
  };

  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'inkverse-export-test-'));
    const rootSvgPath = path.join(tmpDir, 'root.svg');
    const bSvgPath = path.join(tmpDir, 'b.svg');
    const cSvgPath = path.join(tmpDir, 'c.svg');
    writeFileSync(rootSvgPath, makeSvg('#2bb3c0'));
    writeFileSync(bSvgPath, makeSvg('#c0472b'));
    writeFileSync(cSvgPath, makeSvg('#333333'));
    pngBuffer = makeTinyPng();
    assetsById.set('asset-root', readFileSync(rootSvgPath));
    assetsById.set('asset-b', readFileSync(bSvgPath));
    assetsById.set('asset-c', readFileSync(cSvgPath));
    assetsById.set('asset-a', pngBuffer);
  });

  function buildFixture() {
    const baseState = {
      location: 'archive',
      timeline: 'day one',
      inventory: {},
      relationships: [],
      knownFacts: [],
      promises: [],
      openThreads: [],
      pacing: 'setup' as const,
      beatIndex: 0,
      summary: 'the story so far',
    };

    const speech: Bubble = { kind: 'speech', speakerId: 'neri', text: 'We should not be here.', rect: { x: 0.1, y: 0.1, w: 0.4, h: 0.15 } };
    const thought: Bubble = { kind: 'thought', text: 'This place remembers me.', rect: { x: 0.1, y: 0.1, w: 0.4, h: 0.15 } };
    const caption: Bubble = { kind: 'caption', text: 'Three days later.', rect: { x: 0.0, y: 0.0, w: 1, h: 0.12 } };

    const rootPanel = makePanel('panel-root', speech);
    const aPanel = makePanel('panel-a', thought);
    const bPanel = makePanel('panel-b', caption);
    const cPanel = makePanel('panel-c', caption);

    const root: StoryNode = {
      id: 'node-root',
      runId: 'run-1',
      parentId: null,
      originatingChoice: { kind: 'root', label: 'Begin' },
      revisionOf: null,
      stateVersion: 1,
      stateHash: 'h0',
      state: baseState,
      beat: { title: 'The Gate', narration: 'Neri finds the archive gate standing ajar.', pacing: 'setup', layoutTemplate: 'single-splash' },
      panels: [rootPanel],
      choices: [],
      continuityNotes: [],
      ending: null,
      storyStatus: 'ready',
      storyError: null,
      createdAt: new Date().toISOString(),
      source: 'fixture',
      fixtureKey: null,
    };

    const a: StoryNode = {
      ...root,
      id: 'node-a',
      parentId: root.id,
      originatingChoice: { kind: 'preset', choiceId: 'ch-a', label: 'Step through the gate' },
      beat: { title: 'Through the Gate', narration: 'The air hums with old paper and static.', pacing: 'discovery', layoutTemplate: 'single-splash' },
      panels: [aPanel],
    };

    const b: StoryNode = {
      ...root,
      id: 'node-b',
      parentId: a.id,
      originatingChoice: { kind: 'preset', choiceId: 'ch-b', label: 'Follow the whispering shelves' },
      beat: { title: 'The Whispering Shelves', narration: 'Names spill from the shelves like dust.', pacing: 'payoff', layoutTemplate: 'single-splash' },
      panels: [bPanel],
      ending: { title: 'The Archive Remembers', kind: 'open', epilogue: 'Neri leaves the archive with a name that is not their own.', nextIssueHook: 'Who else is missing?' },
    };

    // Sibling of `a` (also a child of root) that must NOT appear in the exported path.
    const c: StoryNode = {
      ...root,
      id: 'node-c',
      parentId: root.id,
      originatingChoice: { kind: 'preset', choiceId: 'ch-c', label: 'Slam the gate shut' },
      beat: { title: 'SIBLING_ONLY_TITLE_SHOULD_NOT_RENDER', narration: 'Neri backs away and bars the gate.', pacing: 'discovery', layoutTemplate: 'single-splash' },
      panels: [cPanel],
    };

    const assets: Asset[] = [
      { id: 'asset-root', url: '/assets/asset-root.svg', mime: 'image/svg+xml', width: 300, height: 200, sha256: 'a', model: 'fixture', stage: 'sketch', generationMeta: {}, referenceAssetIds: [], createdAt: new Date().toISOString() },
      { id: 'asset-a', url: '/assets/asset-a.png', mime: 'image/png', width: 4, height: 4, sha256: 'b', model: 'fixture', stage: 'sketch', generationMeta: {}, referenceAssetIds: [], createdAt: new Date().toISOString() },
      { id: 'asset-b', url: '/assets/asset-b.svg', mime: 'image/svg+xml', width: 300, height: 200, sha256: 'c', model: 'fixture', stage: 'sketch', generationMeta: {}, referenceAssetIds: [], createdAt: new Date().toISOString() },
      { id: 'asset-c', url: '/assets/asset-c.svg', mime: 'image/svg+xml', width: 300, height: 200, sha256: 'd', model: 'fixture', stage: 'sketch', generationMeta: {}, referenceAssetIds: [], createdAt: new Date().toISOString() },
    ];

    const snapshot: ExportSnapshot = {
      id: 'snap-1',
      runId: 'run-1',
      pathNodeIds: [root.id, a.id, b.id],
      selectedAssets: { 'panel-root': 'asset-root', 'panel-a': 'asset-a', 'panel-b': 'asset-b' },
      dialogueVersions: {},
      issue: { title: 'The Archive Gate', number: 1, protagonistName: 'Neri', styleId: 'clear-line', endingTitle: null },
      isDraft: true,
      createdAt: new Date().toISOString(),
    };

    return { bible, nodes: [root, a, b, c], assets, snapshot, cId: c.id };
  }

  it('renders a valid PDF with one page per cover/path-node/ending and skips off-path nodes', async () => {
    const { nodes, assets, snapshot, cId } = buildFixture();
    const renderedNodeIds: (string | null)[] = [];

    const bytes = await renderIssuePdf({
      snapshot,
      nodes,
      assets,
      bible,
      readAsset: async (asset) => assetsById.get(asset.id)!,
      onPage: (info) => {
        renderedNodeIds[info.index] = info.nodeId;
      },
    });

    const header = Buffer.from(bytes.slice(0, 5)).toString('latin1');
    expect(header).toBe('%PDF-');

    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(5); // cover + root + a + b + ending

    expect(renderedNodeIds).toEqual([null, 'node-root', 'node-a', 'node-b', null]);
    expect(renderedNodeIds).not.toContain(cId);
  });

  it('throws a named-panel error when a selected asset is missing', async () => {
    const { nodes, assets, snapshot } = buildFixture();
    delete (snapshot.selectedAssets as Record<string, string>)['panel-a'];

    await expect(
      renderIssuePdf({
        snapshot,
        nodes,
        assets,
        bible,
        readAsset: async (asset) => assetsById.get(asset.id)!,
      }),
    ).rejects.toThrow(/panel-a/);
  });
});
