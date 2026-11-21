import { BUILTINS, builtinSize } from '../three/procedural';
import type { Asset3D } from '../types';

const EPOCH = '2026-01-01T00:00:00.000Z';

let cached: Asset3D[] | undefined;

/** Built-in procedural assets, available in every project (not stored per project). */
export function builtinAssets(): Asset3D[] {
  return (cached ??= BUILTINS.map((b) => ({
    id: `builtin:${b.key}`,
    projectId: '*',
    name: b.name,
    category: b.category,
    source: { kind: 'builtin', key: b.key },
    format: 'VISORA',
    tags: b.tags,
    size: builtinSize(b.key),
    imported: false,
    createdAt: EPOCH,
    updatedAt: EPOCH,
  })));
}

export const isBuiltinId = (id: string) => id.startsWith('builtin:');
