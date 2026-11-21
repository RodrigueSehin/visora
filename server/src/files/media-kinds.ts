// Accepted media formats, recognised by their first bytes (never by the client MIME type),
// plus image dimension parsing for PNG / JPEG / WebP.

export type MediaKind = 'model' | 'image' | 'panorama' | 'texture' | 'video' | 'document' | 'audio';
export const MEDIA_KINDS: MediaKind[] = ['model', 'image', 'panorama', 'texture', 'video', 'document', 'audio'];

type Format = { mime: string; ext: string[]; kind: MediaKind; magic: (h: Buffer) => boolean };

const str = (h: Buffer, a: number, b: number) => h.subarray(a, b).toString('latin1');

export const FORMATS: Format[] = [
  { mime: 'model/gltf-binary', ext: ['glb'], kind: 'model', magic: (h) => str(h, 0, 4) === 'glTF' },
  { mime: 'image/png', ext: ['png'], kind: 'image', magic: (h) => h.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', ext: ['jpg', 'jpeg'], kind: 'image', magic: (h) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff },
  { mime: 'image/webp', ext: ['webp'], kind: 'image', magic: (h) => str(h, 0, 4) === 'RIFF' && str(h, 8, 12) === 'WEBP' },
  { mime: 'video/mp4', ext: ['mp4', 'm4v', 'mov'], kind: 'video', magic: (h) => str(h, 4, 8) === 'ftyp' },
  { mime: 'video/webm', ext: ['webm'], kind: 'video', magic: (h) => h.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
  { mime: 'application/pdf', ext: ['pdf'], kind: 'document', magic: (h) => str(h, 0, 5) === '%PDF-' },
  { mime: 'audio/mpeg', ext: ['mp3'], kind: 'audio', magic: (h) => str(h, 0, 3) === 'ID3' || (h[0] === 0xff && (h[1] & 0xe0) === 0xe0) },
  { mime: 'audio/wav', ext: ['wav'], kind: 'audio', magic: (h) => str(h, 0, 4) === 'RIFF' && str(h, 8, 12) === 'WAVE' },
];

export const ACCEPTED_EXT = FORMATS.flatMap((f) => f.ext);

/** Dimensions from the file header, or null when not an image, not parseable or implausible. */
export function imageSize(mime: string, h: Buffer): { width: number; height: number } | null {
  const s = rawImageSize(mime, h);
  // A malformed header can declare 0 or absurd sizes: treat as unknown rather than storing nonsense.
  return s && s.width > 0 && s.height > 0 && s.width <= 65_535 && s.height <= 65_535 ? s : null;
}

function rawImageSize(mime: string, h: Buffer): { width: number; height: number } | null {
  try {
    if (mime === 'image/png' && h.length >= 24) return { width: h.readUInt32BE(16), height: h.readUInt32BE(20) };
    if (mime === 'image/webp' && h.length >= 30) {
      const chunk = str(h, 12, 16);
      if (chunk === 'VP8 ') return { width: h.readUInt16LE(26) & 0x3fff, height: h.readUInt16LE(28) & 0x3fff };
      if (chunk === 'VP8L') {
        const b = h.readUInt32LE(21);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
      if (chunk === 'VP8X') return { width: 1 + h.readUIntLE(24, 3), height: 1 + h.readUIntLE(27, 3) };
    }
    if (mime === 'image/jpeg') {
      let i = 2;
      while (i + 9 < h.length) {
        if (h[i] !== 0xff) return null;
        const marker = h[i + 1];
        const len = h.readUInt16BE(i + 2);
        // SOF0..SOF15 except DHT (C4), JPG (C8), DAC (CC)
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: h.readUInt16BE(i + 5), width: h.readUInt16BE(i + 7) };
        i += 2 + len;
      }
    }
  } catch {
    /* truncated header */
  }
  return null;
}

/** Equirectangular 360° images are 2:1. Small 2:1 images are more likely banners than panoramas. */
export const looksLikePanorama = (s: { width: number; height: number } | null) =>
  !!s && s.width >= 2000 && Math.abs(s.width / s.height - 2) < 0.02;
