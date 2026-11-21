// Share settings e2e: password protection, access tokens, expiry, gallery exclusion.
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
let token = '';
let projectId = '';
let fileId = '';
const auth = () => ({ Authorization: `Bearer ${token}` });

before(async () => {
  const { startInfra } = await importEsm(pathToFileURL(resolve(__dirname, '../../scripts/infra.mjs')).href);
  const started = await startInfra({ name: 'test-share', pgPort: 54333, s3Port: 4573, ephemeral: true });
  infra = started;
  Object.assign(process.env, started.env, { NODE_ENV: 'test', JWT_SECRET: 'test-secret-test-secret-test-secret-123', CORS_ORIGIN: 'http://localhost:5173', MAX_UPLOAD_MB: '5' });
  (await import('../src/config')).resetConfig();
  const { AppModule, configureApp } = await import('../src/app.module');
  app = (await Test.createTestingModule({ imports: [AppModule] }).compile()).createNestApplication({ bodyParser: false, logger: ['error'] });
  configureApp(app);
  await app.init();
  token = (await http().post('/api/auth/signup').send({ email: 'share@example.com', password: 'motdepasse-solide', name: 'Partage' }).expect(201)).body.accessToken;
  const me = await http().get('/api/auth/me').set(auth()).expect(200);
  const doc = { scenes: [{ id: 's1', name: 'Entrée' }], objects: [], assets: [], favorites: [], settings: {} };
  projectId = (await http().post(`/api/orgs/${me.body.organizations[0].id}/projects`).set(auth()).send({ name: 'Visite privée', type: 'other', document: doc }).expect(201)).body.id;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(56)]);
  fileId = (await http().post(`/api/projects/${projectId}/files`).set(auth()).attach('file', png, 'logo.png').expect(201)).body.id;
  const withLogo = { ...doc, settings: { appearance: { logoFileId: fileId } } };
  await http().put(`/api/projects/${projectId}`).set(auth()).send({ name: 'Visite privée', type: 'other', document: withLogo, baseRevision: 1 }).expect(200);
  await http().post(`/api/projects/${projectId}/publish`).set(auth()).send({ revision: 2 }).expect(200);
});

after(async () => {
  await app?.close();
  await infra?.stop();
});

describe('share settings', () => {
  it('requires settings changes to be made by an editor of a published tour', async () => {
    const r = await http().patch(`/api/projects/${projectId}/publication`).set(auth()).send({ password: 'abc' }).expect(400);
    assert.equal(r.body.error.code, 'validation_error');
    await http().patch(`/api/projects/${projectId}/publication`).set(auth()).send({ expiresAt: new Date(Date.now() - 1000).toISOString() }).expect(400);
  });

  it('protects the tour, its files and its sessions with a password', async () => {
    const s = await http().patch(`/api/projects/${projectId}/publication`).set(auth()).send({ password: 'entrepot-2026', visibility: 'public' }).expect(200);
    assert.deepEqual(s.body.share, { protected: true });
    const locked = await http().get(`/api/public/tours/${projectId}`).expect(401);
    assert.equal(locked.body.error.code, 'password_required');
    assert.equal(locked.body.error.name, 'Visite privée');
    await http().get(`/api/public/tours/${projectId}/files/${fileId}`).expect(401);
    await http().post(`/api/public/tours/${projectId}/sessions`).send({ id: '0b9f8c2a-1a1a-4c4c-8d8d-123456789abc', visitorId: 'vis_aaaaaa', durationMs: 1, scenesViewed: 1 }).expect(401);
    // Protected tours never appear in the public gallery, even with "public" visibility.
    assert.equal((await http().get('/api/public/tours').expect(200)).body.length, 0);
    const wrong = await http().post(`/api/public/tours/${projectId}/access`).send({ password: 'faux' }).expect(401);
    assert.equal(wrong.body.error.code, 'wrong_password');
    const ok = await http().post(`/api/public/tours/${projectId}/access`).send({ password: 'entrepot-2026' }).expect(200);
    const access = ok.body.token as string;
    await http().get(`/api/public/tours/${projectId}`).set('x-tour-access', access).expect(200);
    await http().get(`/api/public/tours/${projectId}/files/${fileId}?access=${encodeURIComponent(access)}`).expect(200);
    await http().get(`/api/public/tours/${projectId}`).set('x-tour-access', access.replace(/.$/, 'x')).expect(401);
    // Changing the password revokes tokens issued with the old one.
    await http().patch(`/api/projects/${projectId}/publication`).set(auth()).send({ password: 'nouveau-mdp' }).expect(200);
    await http().get(`/api/public/tours/${projectId}`).set('x-tour-access', access).expect(401);
    // Removing the password opens the tour again.
    await http().patch(`/api/projects/${projectId}/publication`).set(auth()).send({ password: null }).expect(200);
    await http().get(`/api/public/tours/${projectId}`).expect(200);
    assert.equal((await http().get('/api/public/tours').expect(200)).body.length, 1);
  });

  it('expires links at the chosen date', async () => {
    const soon = new Date(Date.now() + 1500).toISOString();
    const r = await http().patch(`/api/projects/${projectId}/publication`).set(auth()).send({ expiresAt: soon }).expect(200);
    assert.equal(r.body.share.expiresAt, soon);
    await http().get(`/api/public/tours/${projectId}`).expect(200);
    await new Promise((res) => setTimeout(res, 1800));
    const gone = await http().get(`/api/public/tours/${projectId}`).expect(410);
    assert.equal(gone.body.error.code, 'tour_expired');
    assert.equal((await http().get('/api/public/tours').expect(200)).body.length, 0);
    await http().patch(`/api/projects/${projectId}/publication`).set(auth()).send({ expiresAt: null }).expect(200);
    await http().get(`/api/public/tours/${projectId}`).expect(200);
  });
});
