import { describe, expect, it } from 'vitest';
import {
  checkSignature,
  checkSize,
  heavyWarnings,
  MAX_FILE_BYTES,
  pickMainFile,
  sanitizeName,
  suggestUnitScale,
} from '../src/services/importValidation';

const bytes = (s: string) => new TextEncoder().encode(s);

describe('import validation', () => {
  it('picks the model among sidecar files', () => {
    const { main, issues } = pickMainFile([{ name: 'tex.png' }, { name: 'scene.bin' }, { name: 'Scene.GLTF' }]);
    expect(main?.name).toBe('Scene.GLTF');
    expect(issues).toHaveLength(0);
  });

  it('explains unsupported formats explicitly', () => {
    expect(pickMainFile([{ name: 'model.usdz' }]).issues[0].message).toMatch(/USDZ/);
    expect(pickMainFile([{ name: 'doc.pdf' }]).issues[0].code).toBe('unsupported-format');
    expect(pickMainFile([{ name: 'only.png' }]).issues[0].message).toMatch(/Aucun fichier/);
  });

  it('enforces size limits', () => {
    expect(checkSize(0)[0].code).toBe('empty');
    expect(checkSize(MAX_FILE_BYTES + 1)[0].level).toBe('error');
    expect(checkSize(20 * 1024 * 1024)[0].level).toBe('warning');
    expect(checkSize(1024)).toHaveLength(0);
  });

  it('checks file signatures against the extension', () => {
    expect(checkSignature('glb', bytes('glTF\u0002\u0000'))).toHaveLength(0);
    expect(checkSignature('glb', bytes('PK\u0003\u0004'))[0].code).toBe('corrupted');
    expect(checkSignature('gltf', bytes('  {"asset":{}}'))).toHaveLength(0);
    expect(checkSignature('gltf', bytes('<html>'))).toHaveLength(1);
    expect(checkSignature('obj', bytes('# cube\nv 0 0 0\n'))).toHaveLength(0);
    expect(checkSignature('obj', bytes('hello world'))).toHaveLength(1);
    expect(checkSignature('fbx', bytes('Kaydara FBX Binary  \u0000'))).toHaveLength(0);
    expect(checkSignature('stl', bytes('solid x'))).toHaveLength(0);
    expect(checkSignature('stl', bytes('abc'))).toHaveLength(1);
  });

  it('flags heavy models and guesses units', () => {
    expect(heavyWarnings({ triangles: 900_000, maxTexture: 4096 })).toHaveLength(2);
    expect(suggestUnitScale(1800).scale).toBe(0.001);
    expect(suggestUnitScale(180).scale).toBe(0.01);
    expect(suggestUnitScale(3).scale).toBe(1);
  });

  it('sanitizes display names', () => {
    expect(sanitizeName('../evil<script>_forklift-v2.glb')).toBe('.. evil script forklift v2');
    expect(sanitizeName('.glb')).toBe('Modèle importé');
  });
});
