import { describe, it, expect } from 'vitest';
import { createSvgImageProvider } from '../src/server/providers/svg-renderer';
import { chooseProviders } from '../src/server/providers/index';
import { loadConfig } from '../src/server/config';
import { EPISODE } from '../src/content/episode';
import type { ImageRequest } from '../src/server/providers/types';
import type { PanelSpec } from '../src/shared/schemas';

function basePanel(): PanelSpec {
  const p = EPISODE.beats[0].response.panels[0];
  return p;
}

function baseReq(overrides: Partial<ImageRequest> = {}): ImageRequest {
  return {
    stage: 'preview',
    prompt: 'A test scene prompt for the renderer.',
    width: 512,
    height: 288,
    referenceImagePaths: [],
    seed: 7,
    idempotencyKey: 'k1',
    timeoutMs: 5000,
    panelSpec: basePanel(),
    styleId: 'inked-svg',
    ...overrides,
  };
}

describe('svg image provider', () => {
  it('renders an svg string with the requested dimensions and mime', async () => {
    const provider = createSvgImageProvider();
    const req = baseReq();
    const result = await provider.generate(req);
    const svg = result.bytes.toString('utf8');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(result.mime).toBe('image/svg+xml');
    expect(result.width).toBe(req.width);
    expect(result.height).toBe(req.height);
    expect(result.costUsd).toBe(0);
    expect(result.model).toBe('svg-renderer');
  });

  it('draws one <g class="figure"> per composition subject', async () => {
    const provider = createSvgImageProvider();
    const panel = basePanel();
    const req = baseReq({ panelSpec: panel });
    const result = await provider.generate(req);
    const svg = result.bytes.toString('utf8');
    const figureCount = (svg.match(/<g class="figure"/g) ?? []).length;
    expect(figureCount).toBe(panel.composition.subjects.length);
  });

  it('is deterministic: same seed/request yields byte-identical output', async () => {
    const provider = createSvgImageProvider();
    const req = baseReq();
    const a = await provider.generate(req);
    const b = await provider.generate(req);
    expect(a.bytes.equals(b.bytes)).toBe(true);
  });

  it('estimateCostUsd is always 0', () => {
    const provider = createSvgImageProvider();
    expect(provider.estimateCostUsd(baseReq())).toBe(0);
  });

  it('provider name and model are honest, never runware', () => {
    const provider = createSvgImageProvider();
    expect(provider.name).toBe('svg');
    expect(provider.capabilities('preview').model).toBe('svg-renderer');
  });
});

describe('provider selection for inked-svg', () => {
  it('chooseProviders returns the svg image provider for styleId "inked-svg" in demo mode', async () => {
    const config = loadConfig({ inMemory: true });
    const artRoot = process.cwd() + '/src/content/art';
    const bundle = await chooseProviders('demo', config, EPISODE, artRoot, 'inked-svg');
    expect(bundle.image.name).toBe('svg');
  });

  it('does not use svg for other styles in demo mode', async () => {
    const config = loadConfig({ inMemory: true });
    const artRoot = process.cwd() + '/src/content/art';
    const bundle = await chooseProviders('demo', config, EPISODE, artRoot, 'clear-line');
    expect(bundle.image.name).toBe('fixture');
  });
});
