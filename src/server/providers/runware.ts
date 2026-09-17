/**
 * Runware image provider. Uses @runware/sdk-js (v1.3.2) imageInference, which
 * cleanly exposes every field we need: referenceImages, includeCost, seed, steps,
 * base64 output, and customTaskUUID for post-timeout recovery. We therefore use the
 * SDK rather than raw REST (documented in docs/PROVIDERS.md).
 *
 * Never log the API key.
 */
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Runware, type IRequestImage, type ITextToImage } from '@runware/sdk-js';
import type { ImageProvider, ImageRequest, ImageResult, ModelCapability } from './types';
import { capabilityFor, modelForStage, snapDims, sendOnlyAccepted, familyOf } from './registry';
import { estimateImageCostUsd } from './pricing';

export interface RunwareConfig {
  apiKey: string;
  previewModel?: string;
  finalModel?: string;
  /** GPT Image quality for final stage. Default 'medium'. */
  defaultQuality?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 90_000;
const FLUX_PREVIEW_STEPS = 4;

function mimeFor(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

async function toDataUri(path: string): Promise<string> {
  const buf = await readFile(path);
  return `data:${mimeFor(path)};base64,${buf.toString('base64')}`;
}

export function createRunwareImageProvider(config: RunwareConfig): ImageProvider {
  if (!config.apiKey) throw new Error('Runware provider requires an apiKey');
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  type RunwareClientInstance = InstanceType<typeof Runware>;
  let clientPromise: Promise<RunwareClientInstance> | null = null;
  async function client(): Promise<RunwareClientInstance> {
    if (!clientPromise) {
      clientPromise = (async () => {
        const c = new Runware({ apiKey: config.apiKey });
        await c.ensureConnection();
        return c;
      })();
    }
    return clientPromise;
  }

  function modelFor(stage: ImageRequest['stage']): string {
    return modelForStage(stage, { previewModel: config.previewModel, finalModel: config.finalModel });
  }

  function capabilities(stage: ImageRequest['stage']): ModelCapability {
    return capabilityFor(modelFor(stage));
  }

  function estimateCostUsd(req: ImageRequest): number | null {
    return estimateImageCostUsd(modelFor(req.stage));
  }

  async function buildParams(req: ImageRequest, customTaskUUID: string): Promise<IRequestImage> {
    const model = modelFor(req.stage);
    const cap = capabilityFor(model);
    const { width, height } = snapDims(model, req.width, req.height);
    const isFinal = familyOf(model) === 'gpt-image';

    // Optional knobs that only some models accept. Filtered by capability below.
    const knobs: Record<string, unknown> = {};
    if (req.negativePrompt) knobs.negativePrompt = req.negativePrompt;
    if (req.seed != null) knobs.seed = req.seed;
    if (!isFinal) {
      knobs.steps = FLUX_PREVIEW_STEPS;
    }
    if (isFinal) {
      const quality = config.defaultQuality ?? (req.stage === 'preview' ? 'low' : 'medium');
      // Runware gpt-image quality is passed under settings.quality (docs); sent via SDK passthrough.
      knobs.settings = { quality };
    }
    if (cap.supportsReferenceImages && req.referenceImagePaths.length) {
      const paths = req.referenceImagePaths.slice(0, cap.maxReferenceImages);
      knobs.referenceImages = await Promise.all(paths.map(toDataUri));
    }

    const accepted = sendOnlyAccepted(model, knobs);

    return {
      positivePrompt: req.prompt,
      model,
      width,
      height,
      numberResults: 1,
      outputType: 'base64Data',
      outputFormat: 'PNG',
      includeCost: true,
      customTaskUUID,
      ...accepted,
    } as IRequestImage;
  }

  async function decode(img: ITextToImage): Promise<{ bytes: Buffer; mime: string }> {
    if (img.imageBase64Data) {
      return { bytes: Buffer.from(img.imageBase64Data, 'base64'), mime: 'image/png' };
    }
    if (img.imageDataURI) {
      const b64 = img.imageDataURI.split(',')[1] ?? '';
      return { bytes: Buffer.from(b64, 'base64'), mime: 'image/png' };
    }
    if (img.imageURL) {
      const res = await fetch(img.imageURL);
      const arr = Buffer.from(await res.arrayBuffer());
      return { bytes: arr, mime: res.headers.get('content-type') ?? 'image/png' };
    }
    throw new Error('Runware returned no image data');
  }

  async function lookupByTaskUUID(taskUUID: string): Promise<ITextToImage | null> {
    try {
      const c = await client();
      // getResponse polls a prior task by uuid; shape is loosely typed in the SDK.
      const results = await (c as unknown as {
        getResponse: <T>(payload: unknown) => Promise<T[]>;
      }).getResponse<ITextToImage>({ taskType: 'imageInference', taskUUID });
      return results?.[0] ?? null;
    } catch {
      return null;
    }
  }

  async function generate(req: ImageRequest, opts?: { signal?: AbortSignal }): Promise<ImageResult> {
    const model = modelFor(req.stage);
    const { width, height } = snapDims(model, req.width, req.height);
    const customTaskUUID = randomUUID();
    const params = await buildParams(req, customTaskUUID);
    const c = await client();
    const start = Date.now();

    let results: (ITextToImage[] | undefined) = undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Runware timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    const abort = new Promise<never>((_, reject) => {
      if (opts?.signal) {
        if (opts.signal.aborted) reject(new Error('aborted'));
        opts.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }
    });

    try {
      results = await Promise.race([c.imageInference(params), timeout, abort]);
    } catch (err) {
      // Ambiguous timeout/abort: the task may have completed. Recover by uuid to
      // avoid a duplicate charge on the caller's retry.
      const recovered = await lookupByTaskUUID(customTaskUUID);
      if (!recovered) throw err;
      results = [recovered];
    } finally {
      if (timer) clearTimeout(timer);
    }

    const img = results?.[0];
    if (!img) throw new Error('Runware returned no results');
    const { bytes, mime } = await decode(img);
    return {
      bytes,
      mime,
      width,
      height,
      providerTaskId: img.taskUUID ?? null,
      costUsd: typeof img.cost === 'number' ? img.cost : null,
      model,
      latencyMs: Date.now() - start,
    };
  }

  async function lookupTask(providerTaskId: string): Promise<ImageResult | null> {
    const img = await lookupByTaskUUID(providerTaskId);
    if (!img) return null;
    const { bytes, mime } = await decode(img);
    return {
      bytes,
      mime,
      width: 0,
      height: 0,
      providerTaskId: img.taskUUID ?? providerTaskId,
      costUsd: typeof img.cost === 'number' ? img.cost : null,
      model: 'unknown',
      latencyMs: 0,
    };
  }

  return { name: 'runware', capabilities, generate, estimateCostUsd, lookupTask };
}
