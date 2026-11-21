// Media library e2e: formats, metadata, folders, trash, signed URLs, ranges, in-use protection.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

const importEsm = new Function('s', 'return import(s)') as (s: string) => Promise<any>;
let app: INestApplication;
let infra: { stop: () => Promise<void> };
const http = () => request(app.getHttpServer());

/** PNG header with an IHDR chunk declaring width × height (content is not decoded server-side). */
function png(width: number, height: number) {
  const b = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12);
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}
/** Minimal JPEG: SOI, APP0, SOF0 with dimensions. */
function jpeg(width: number, height: number) {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const sof = Buffer.alloc(19);
  sof.writeUInt16BE(0xffc0, 0);
  sof.writeUInt16BE(17, 2);
  sof[4] = 8;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.alloc(20)]);
}
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(200, 7)]);
const pdf = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVEfmt '), Buffer.alloc(40)]);

let token = '';
let projectId = '';
const auth = () => ({ Authorization: `Bearer ${token}` });
const upload = (buf: Buffer, name: string, folder?: string) =>
  http().post(`/api/projects/${projectId}/files${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`).set(auth()).attach('file', buf, name);
const binary = (r: request.Test) =>
  r.buffer(true).parse((res, cb) => {
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  });

before(async () => {
  const { startInfra } = await importEsm(pathToFileURL(resolve(__dirname, '../../scripts/infra.mjs')).href);
  const started = await startInfra({ name: 'test-media', pgPort: 54332, s3Port: 4572, ephemeral: true });
  infra = started;
  Object.assign(process.env, started.env, { NODE_ENV: 'test', JWT_SECRET: 'test-secret-test-secret-test-secret-123', CORS_ORIGIN: 'http://localhost:5173', MAX_UPLOAD_MB: '5' });
  const { resetConfig } = await import('../src/config');
  resetConfig();
  const { AppModule, configureApp } = await import('../src/app.module');
  app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication({ bodyParser: false, logger: ['error'] });
  configureApp(app);
  await app.init();
  const s = await http().post('/api/auth/signup').send({ email: 'media@example.com', password: 'motdepasse-solide', name: 'Média' }).expect(201);
  token = s.body.accessToken;
  const me = await http().get('/api/auth/me').set(auth()).expect(200);
  const doc = { scenes: [{ id: 's1', name: 'Entrée' }, { id: 's2', name: 'Stock' }], objects: [], assets: [], favorites: [], settings: {} };
  const p = await http().post(`/api/orgs/${me.body.organizations[0].id}/projects`).set(auth()).send({ name: 'Médias', type: 'logistics', document: doc }).expect(201);
  projectId = p.body.id;
});

after(async () => {
  await app?.close();
  await infra?.stop();
});

describe('media library', () => {
  const ids: Record<string, string> = {};

  it('detects kinds and dimensions from file content', async () => {
    const pano = await upload(png(4096, 2048), 'entree_360.png', 'Entrée & Accueil').expect(201);
    assert.equal(pano.body.kind, 'panorama');
    assert.deepEqual([pano.body.width, pano.body.height], [4096, 2048]);
    assert.equal(pano.body.folder, 'Entrée & Accueil');
    ids.pano = pano.body.id;
    const photo = await upload(jpeg(1920, 1080), 'reception.jpg').expect(201);
    assert.equal(photo.body.kind, 'image');
    assert.deepEqual([photo.body.width, photo.body.height], [1920, 1080]);
    ids.photo = photo.body.id;
    ids.video = (await upload(mp4, 'process.mp4').expect(201)).body.id;
    const d = await upload(pdf, 'fiche.pdf').expect(201);
    assert.equal(d.body.kind, 'document');
    ids.pdf = d.body.id;
    assert.equal((await upload(wav, 'son.wav').expect(201)).body.kind, 'audio');
    // Extension and content must agree.
    await upload(pdf, 'deguise.mp4').expect(422);
  });

  it('lists, renames, files into folders, favorites and reinterprets images', async () => {
    const list = await http().get(`/api/projects/${projectId}/files`).set(auth()).expect(200);
    assert.equal(list.body.length, 5);
    const r = await http().patch(`/api/files/${ids.photo}`).set(auth()).send({ name: 'Hall/../accueil.jpg', folder: 'Bureaux', favorite: true }).expect(200);
    assert.equal(r.body.name, 'Hall_.._accueil.jpg');
    assert.equal(r.body.folder, 'Bureaux');
    assert.equal(r.body.favorite, true);
    await http().patch(`/api/files/${ids.photo}`).set(auth()).send({ kind: 'texture' }).expect(200);
    const bad = await http().patch(`/api/files/${ids.video}`).set(auth()).send({ kind: 'panorama' }).expect(422);
    assert.equal(bad.body.error.code, 'invalid_kind');
  });

  it('serves media through expiring signed URLs, with byte ranges', async () => {
    const u = await http().get(`/api/files/${ids.video}/url`).set(auth()).expect(200);
    assert.match(u.body.url, /^\/api\/media\/.+\?exp=\d+&sig=/);
    const full = await binary(http().get(u.body.url)).expect(200);
    assert.equal(Buffer.compare(full.body, mp4), 0);
    assert.equal(full.headers['accept-ranges'], 'bytes');
    const part = await binary(http().get(u.body.url).set('Range', 'bytes=4-11')).expect(206);
    assert.equal(part.body.toString('latin1'), 'ftypisom');
    assert.equal(part.headers['content-range'], `bytes 4-11/${mp4.length}`);
    await http().get(u.body.url).set('Range', `bytes=${mp4.length + 5}-`).expect(416);
    await http().get(u.body.url.replace(/sig=[^&]+/, 'sig=forged')).expect(403);
    await http().get(u.body.url.replace(/exp=\d+/, 'exp=1')).expect(403);
  });

  it('stores hotspots and navigation in the document and publishes their media', async () => {
    const doc = {
      scenes: [{ id: 's1', name: 'Entrée', kind: 'panorama', panoramaFileId: ids.pano }, { id: 's2', name: 'Stock' }],
      objects: [],
      assets: [],
      favorites: [],
      settings: {},
      hotspots: [{ id: 'h1', sceneId: 's1', type: 'document', title: 'Fiche', mediaId: ids.pdf }],
      navigation: [{ id: 'n1', sceneId: 's1', targetSceneId: 's2' }],
      floorPlans: [{ id: 'f1', name: 'RDC', imageFileId: ids.photo, order: 0, markers: [{ sceneId: 's1', x: 0.2, y: 0.4 }], texts: [], calibration: { a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, meters: 40 } }],
      guidedTours: [{ id: 'g1', name: 'Visite express', steps: [{ id: 'st1', sceneId: 's1', title: 'Accueil', durationS: 8 }] }],
    };
    const saved = await http().put(`/api/projects/${projectId}`).set(auth()).send({ name: 'Médias', type: 'logistics', document: doc, baseRevision: 1 }).expect(200);
    assert.equal(saved.body.hotspots[0].mediaId, ids.pdf);
    assert.equal(saved.body.navigation[0].targetSceneId, 's2');
    assert.equal(saved.body.floorPlans[0].calibration.meters, 40);
    assert.equal(saved.body.guidedTours[0].steps[0].title, 'Accueil');
    await http().post(`/api/projects/${projectId}/publish`).set(auth()).send({ revision: 2 }).expect(200);
    await http().get(`/api/public/tours/${projectId}/files/${ids.pano}`).expect(200);
    await http().get(`/api/public/tours/${projectId}/files/${ids.pdf}`).expect(200);
    // Plan image referenced by the published floor plan is public too.
    await http().get(`/api/public/tours/${projectId}/files/${ids.photo}`).expect(200);
    const pub = await http().get(`/api/public/tours/${projectId}`).expect(200);
    assert.equal(pub.body.guidedTours[0].name, 'Visite express');
    // Not referenced by the publication: not public.
    await http().get(`/api/public/tours/${projectId}/files/${ids.video}`).expect(404);
  });

  it('trashes and restores; refuses permanent deletion while in use', async () => {
    await http().delete(`/api/files/${ids.video}`).set(auth()).expect(204);
    let trash = await http().get(`/api/projects/${projectId}/files?trash=1`).set(auth()).expect(200);
    assert.deepEqual(trash.body.map((f: { id: string }) => f.id), [ids.video]);
    await http().post(`/api/files/${ids.video}/restore`).set(auth()).expect(200);
    trash = await http().get(`/api/projects/${projectId}/files?trash=1`).set(auth()).expect(200);
    assert.equal(trash.body.length, 0);
    const inUse = await http().delete(`/api/files/${ids.pdf}/permanent`).set(auth()).expect(409);
    assert.equal(inUse.body.error.code, 'file_in_use');
    await http().delete(`/api/files/${ids.video}/permanent`).set(auth()).expect(204);
    await http().get(`/api/files/${ids.video}/url`).set(auth()).expect(404);
  });

  it('keeps media private to the organization', async () => {
    const other = await http().post('/api/auth/signup').send({ email: 'intrus@example.com', password: 'motdepasse-solide', name: 'Intrus' }).expect(201);
    const h = { Authorization: `Bearer ${other.body.accessToken}` };
    await http().get(`/api/projects/${projectId}/files`).set(h).expect(404);
    await http().get(`/api/files/${ids.photo}/url`).set(h).expect(404);
    await http().patch(`/api/files/${ids.photo}`).set(h).send({ favorite: false }).expect(404);
    await http().delete(`/api/files/${ids.photo}`).set(h).expect(404);
  });
});
