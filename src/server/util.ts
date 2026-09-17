/** Small server-side helpers: hashing, sleeping, mime/dimension parsing for stored assets. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';

export const sha256 = (buf: Buffer | Uint8Array): string => createHash('sha256').update(buf).digest('hex');

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const nowIso = (): string => new Date().toISOString();

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function mimeByExt(p: string): string {
  const ext = p.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

export function extByMime(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/svg+xml':
      return 'svg';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}

/** Parse intrinsic dimensions from PNG or JPEG headers. Returns null if not recognizable. */
export function imageSize(buf: Buffer): { width: number; height: number } | null {
  // PNG: 8-byte signature, IHDR width@16 height@20 (big-endian).
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: scan for SOF marker.
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off++;
        continue;
      }
      const marker = buf[off + 1];
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) {
        const height = buf.readUInt16BE(off + 5);
        const width = buf.readUInt16BE(off + 7);
        return { width, height };
      }
      const segLen = buf.readUInt16BE(off + 2);
      off += 2 + segLen;
    }
  }
  return null;
}
