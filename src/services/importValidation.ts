// Pure, environment-independent validation of imported 3D files (unit-tested).
// Server-side validation must mirror these rules once a backend exists.

export const SUPPORTED_FORMATS = ['glb', 'gltf', 'obj', 'fbx', 'stl'] as const;
export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];
/** Formats users commonly try that the web pipeline does not handle yet. */
export const KNOWN_UNSUPPORTED = ['usd', 'usdz', 'usda', 'usdc', 'dae', '3ds', 'blend', 'max', 'skp', 'c4d', 'ma', 'mb'];
/** Sidecar files accepted alongside a .gltf or .obj (buffers, textures, materials). */
export const SIDECAR_EXT = ['bin', 'png', 'jpg', 'jpeg', 'webp', 'ktx2', 'mtl', 'tga'];

export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const HEAVY_FILE_BYTES = 15 * 1024 * 1024;
export const HEAVY_TRIANGLES = 500_000;
export const HEAVY_TEXTURE_PX = 2048;

export type ImportIssue = {
  level: 'error' | 'warning';
  code:
    | 'unsupported-format'
    | 'too-large'
    | 'heavy'
    | 'corrupted'
    | 'parse-error'
    | 'missing-textures'
    | 'timeout'
    | 'empty'
    | 'no-main-file';
  message: string;
};

export const extOf = (name: string) => name.toLowerCase().split('.').pop() ?? '';

/** Keeps only safe characters for display/storage names; never used as a storage path. */
export function sanitizeName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[\u0000-\u001f<>:"/\\|?*]+/g, ' ').replace(/[_-]+/g, ' ');
  return base.replace(/\s+/g, ' ').trim().slice(0, 80) || 'Modèle importé';
}

export function pickMainFile<T extends { name: string }>(files: T[]): { main?: T; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  const main = files.find((f) => (SUPPORTED_FORMATS as readonly string[]).includes(extOf(f.name)));
  if (!main) {
    const unsupported = files.find((f) => !SIDECAR_EXT.includes(extOf(f.name)));
    const ext = unsupported ? extOf(unsupported.name) : '';
    issues.push({
      level: 'error',
      code: 'unsupported-format',
      message: KNOWN_UNSUPPORTED.includes(ext)
        ? `Le format .${ext.toUpperCase()} n’est pas encore pris en charge par le pipeline Web. Exportez en GLB ou GLTF.`
        : unsupported
          ? `Format non pris en charge (.${ext || '?'}). Formats acceptés : GLB, GLTF, OBJ, FBX, STL.`
          : 'Aucun fichier de modèle principal (GLB, GLTF, OBJ, FBX, STL) dans la sélection.',
    });
  }
  return { main, issues };
}

export function checkSize(bytes: number): ImportIssue[] {
  if (bytes === 0) return [{ level: 'error', code: 'empty', message: 'Le fichier est vide.' }];
  if (bytes > MAX_FILE_BYTES)
    return [{ level: 'error', code: 'too-large', message: `Fichier trop volumineux (limite ${MAX_FILE_BYTES / 1024 / 1024} Mo).` }];
  if (bytes > HEAVY_FILE_BYTES)
    return [{ level: 'warning', code: 'heavy', message: 'Fichier lourd : une optimisation est recommandée pour le Web.' }];
  return [];
}

/** Verifies that the file content matches its extension (magic bytes / structure). */
export function checkSignature(format: SupportedFormat, head: Uint8Array): ImportIssue[] {
  const ascii = (from: number, len: number) => String.fromCharCode(...head.slice(from, from + len));
  const text = new TextDecoder().decode(head.slice(0, 512)).trimStart();
  const bad = (msg: string): ImportIssue[] => [{ level: 'error', code: 'corrupted', message: msg }];
  switch (format) {
    case 'glb':
      return ascii(0, 4) === 'glTF' ? [] : bad('Fichier GLB invalide ou corrompu (en-tête « glTF » absent).');
    case 'gltf':
      return text.startsWith('{') ? [] : bad('Fichier GLTF invalide : le contenu n’est pas du JSON.');
    case 'fbx':
      return ascii(0, 18) === 'Kaydara FBX Binary' || /FBXHeaderExtension|; FBX/.test(text)
        ? []
        : bad('Fichier FBX invalide ou corrompu.');
    case 'stl':
      // ASCII STL starts with "solid"; binary STL has an 80-byte header, no fixed magic.
      return head.length >= 84 || text.startsWith('solid') ? [] : bad('Fichier STL tronqué ou corrompu.');
    case 'obj':
      return /(^|\n)\s*(v|vn|vt|f|o|g|mtllib|#)\s/.test(text) || head.length === 0
        ? []
        : bad('Fichier OBJ invalide : aucune donnée de géométrie reconnue.');
  }
}

export function heavyWarnings(stats: { triangles: number; maxTexture: number }): ImportIssue[] {
  const out: ImportIssue[] = [];
  if (stats.triangles > HEAVY_TRIANGLES)
    out.push({ level: 'warning', code: 'heavy', message: `${stats.triangles.toLocaleString('fr-FR')} triangles : modèle lourd pour une visite Web.` });
  if (stats.maxTexture > HEAVY_TEXTURE_PX)
    out.push({ level: 'warning', code: 'heavy', message: `Textures jusqu’à ${stats.maxTexture} px : réduction recommandée.` });
  return out;
}

/** Suggested unit multiplier to convert native units into metres. */
export function suggestUnitScale(largestDim: number): { scale: number; reason?: string } {
  if (!Number.isFinite(largestDim) || largestDim <= 0) return { scale: 1 };
  if (largestDim > 500) return { scale: 0.001, reason: 'Unités probablement en millimètres' };
  if (largestDim > 50) return { scale: 0.01, reason: 'Unités probablement en centimètres' };
  return { scale: 1 };
}
