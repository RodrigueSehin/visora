// End-to-end API tests against real PostgreSQL (embedded) and an S3 emulator.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { DataSource } from 'typeorm';

// Native dynamic import (the compiled test is CommonJS; infra.mjs and its deps are ESM).
const importEsm = new Function('s', 'return import(s)') as (s: string) => Promise<any>;

let app: INestApplication;
let infra: { stop: () => Promise<void> };
let ds: DataSource;
const http = () => request(app.getHttpServer());

const GLB = (() => {
  const json = Buffer.from(JSON.stringify({ asset: { version: '2.0' } }).padEnd(28, ' '));
  const header = Buffer.alloc(12);
  header.write('glTF', 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length, 8);
  const chunk = Buffer.alloc(8);
  chunk.writeUInt32LE(json.length, 0);
  chunk.write('JSON', 4);
  return Buffer.concat([header, chunk, json]);
})();

const emptyDoc = (sceneId = 'scn_1') => ({
  scenes: [{ id: sceneId, name: 'Entrée', environment: 'warehouse', size: { width: 10, depth: 10, height: 4 }, order: 0 }],
  objects: [],
  assets: [],
  favorites: [],
  settings: { autosaveSeconds: 0 },
});

async function signup(email: string, name = 'Testeur') {
  const res = await http().post('/api/auth/signup').send({ email, password: 'motdepasse-solide', name }).expect(201);
  const token: string = res.body.accessToken;
  const me = await http().get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  return { token, cookie: res.headers['set-cookie'] as unknown as string[], orgId: me.body.organizations[0].id as string, userId: me.body.user.id as string };
}

before(async () => {
  const { startInfra } = await importEsm(pathToFileURL(resolve(__dirname, '../../scripts/infra.mjs')).href);
  const started = await startInfra({ name: 'test', pgPort: 54331, s3Port: 4571, ephemeral: true });
  infra = started;
  Object.assign(process.env, started.env, {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-test-secret-test-secret-123',
    CORS_ORIGIN: 'http://localhost:5173',
    MAX_UPLOAD_MB: '5',
  });
  const { AppModule, configureApp } = await import('../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication({ bodyParser: false, logger: ['error'] });
  configureApp(app);
  await app.init();
  ds = app.get((await import('typeorm')).DataSource);
});

after(async () => {
  await app?.close();
  await infra?.stop();
});

describe('auth', () => {
  it('reports health with the database reachable', async () => {
    await http().get('/api/health').expect(200, { status: 'ok' });
  });

  it('validates signup input with field details', async () => {
    const r = await http().post('/api/auth/signup').send({ email: 'pas-un-email', password: 'court', name: '' }).expect(400);
    assert.equal(r.body.error.code, 'validation_error');
    assert.deepEqual(r.body.error.details.map((d: { path: string }) => d.path).sort(), ['email', 'name', 'password']);
  });

  it('signs up (organization + owner), rejects duplicates case-insensitively, logs in', async () => {
    const a = await signup('alice@example.com', 'Alice');
    assert.ok(a.token);
    assert.ok(a.cookie.some((c) => c.startsWith('visora_rt=') && /HttpOnly/i.test(c) && /SameSite=Strict/i.test(c) && /Path=\/api\/auth/.test(c)));
    const me = await http().get('/api/auth/me').set('Authorization', `Bearer ${a.token}`).expect(200);
    assert.equal(me.body.organizations[0].role, 'owner');
    const dup = await http().post('/api/auth/signup').send({ email: 'ALICE@example.com', password: 'motdepasse-solide', name: 'A' }).expect(409);
    assert.equal(dup.body.error.code, 'email_taken');
    await http().post('/api/auth/login').send({ email: 'alice@example.com', password: 'mauvais-mot-de-passe' }).expect(401);
    await http().post('/api/auth/login').send({ email: 'inconnu@example.com', password: 'x' }).expect(401);
    const ok = await http().post('/api/auth/login').send({ email: 'Alice@Example.com', password: 'motdepasse-solide' }).expect(200);
    assert.ok(ok.body.accessToken);
  });

  it('requires a valid access token on private routes', async () => {
    const r = await http().get('/api/auth/me').expect(401);
    assert.equal(r.body.error.code, 'unauthenticated');
    await http().get('/api/auth/me').set('Authorization', 'Bearer forged.token.value').expect(401);
  });

  it('rotates refresh tokens and revokes all sessions when a used token is replayed', async () => {
    const u = await signup('rotation@example.com');
    const cookie = u.cookie.find((c) => c.startsWith('visora_rt='))!.split(';')[0];
    const r1 = await http().post('/api/auth/refresh').set('Cookie', cookie).expect(200);
    const cookie2 = (r1.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('visora_rt='))!.split(';')[0];
    assert.notEqual(cookie2, cookie);
    // Replay of the old token: rejected, and the newer session is revoked too.
    await http().post('/api/auth/refresh').set('Cookie', cookie).expect(401);
    await http().post('/api/auth/refresh').set('Cookie', cookie2).expect(401);
  });

  it('rejects cookie endpoints from a foreign origin', async () => {
    const u = await signup('origin@example.com');
    const cookie = u.cookie.find((c) => c.startsWith('visora_rt='))!.split(';')[0];
    const r = await http().post('/api/auth/refresh').set('Cookie', cookie).set('Origin', 'https://evil.example').expect(403);
    assert.equal(r.body.error.code, 'bad_origin');
  });
});

describe('projects, permissions and publication', () => {
  let alice: Awaited<ReturnType<typeof signup>>;
  let bob: Awaited<ReturnType<typeof signup>>;
  let projectId: string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  before(async () => {
    alice = await signup('alice.projects@example.com', 'Alice');
    bob = await signup('bob@example.com', 'Bob');
  });

  it('creates, lists and reads a project', async () => {
    const c = await http().post(`/api/orgs/${alice.orgId}/projects`).set(auth(alice.token)).send({ name: 'Entrepôt Abidjan', type: 'logistics', document: emptyDoc() }).expect(201);
    projectId = c.body.id;
    assert.equal(c.body.revision, 1);
    assert.equal(c.body.status, 'draft');
    const list = await http().get(`/api/orgs/${alice.orgId}/projects`).set(auth(alice.token)).expect(200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].sceneCount, 1);
    const g = await http().get(`/api/projects/${projectId}`).set(auth(alice.token)).expect(200);
    assert.equal(g.body.scenes[0].name, 'Entrée');
  });

  it('isolates organizations: another user gets 404, never the data', async () => {
    await http().get(`/api/projects/${projectId}`).set(auth(bob.token)).expect(404);
    await http().get(`/api/orgs/${alice.orgId}/projects`).set(auth(bob.token)).expect(404);
    await http().put(`/api/projects/${projectId}`).set(auth(bob.token)).send({ name: 'x', type: 'other', document: emptyDoc(), baseRevision: 1 }).expect(404);
    await http().delete(`/api/projects/${projectId}`).set(auth(bob.token)).expect(404);
    await http().get('/api/projects/not-a-uuid').set(auth(alice.token)).expect(400);
  });

  it('saves with optimistic concurrency (409 returns the current version)', async () => {
    const s = await http().put(`/api/projects/${projectId}`).set(auth(alice.token)).send({ name: 'Entrepôt Abidjan', type: 'logistics', document: emptyDoc('scn_2'), baseRevision: 1 }).expect(200);
    assert.equal(s.body.revision, 2);
    const stale = await http().put(`/api/projects/${projectId}`).set(auth(alice.token)).send({ name: 'Ancien', type: 'logistics', document: emptyDoc(), baseRevision: 1 }).expect(409);
    assert.equal(stale.body.error.code, 'revision_conflict');
    assert.equal(stale.body.error.current.revision, 2);
    const forced = await http().put(`/api/projects/${projectId}`).set(auth(alice.token)).send({ name: 'Entrepôt Abidjan', type: 'logistics', document: emptyDoc(), baseRevision: 1, force: true }).expect(200);
    assert.equal(forced.body.revision, 3);
  });

  it('enforces roles server-side (viewer cannot write)', async () => {
    await ds.query(`INSERT INTO memberships (organization_id, user_id, role) VALUES ($1, $2, 'viewer')`, [alice.orgId, bob.userId]);
    await http().get(`/api/projects/${projectId}`).set(auth(bob.token)).expect(200);
    const w = await http().put(`/api/projects/${projectId}`).set(auth(bob.token)).send({ name: 'x', type: 'other', document: emptyDoc(), baseRevision: 3 }).expect(403);
    assert.equal(w.body.error.code, 'forbidden');
    await http().post(`/api/projects/${projectId}/files`).set(auth(bob.token)).attach('file', GLB, 'a.glb').expect(403);
    await ds.query(`DELETE FROM memberships WHERE organization_id = $1 AND user_id = $2`, [alice.orgId, bob.userId]);
  });

  let fileId: string;
  it('validates uploads by content and serves them to members only', async () => {
    const bad = await http().post(`/api/projects/${projectId}/files`).set(auth(alice.token)).attach('file', Buffer.from('pas un glb'), 'faux.glb').expect(422);
    assert.equal(bad.body.error.code, 'corrupted_file');
    await http().post(`/api/projects/${projectId}/files`).set(auth(alice.token)).attach('file', Buffer.from('x'), 'script.exe').expect(415);
    await http().post(`/api/projects/${projectId}/files`).set(auth(alice.token)).attach('file', Buffer.alloc(6 * 1024 * 1024, 1), 'gros.glb').expect(413);
    const up = await http().post(`/api/projects/${projectId}/files`).set(auth(alice.token)).attach('file', GLB, '../../etc/modèle.glb').expect(201);
    fileId = up.body.id;
    assert.equal(up.body.size, GLB.length);
    assert.ok(!JSON.stringify(up.body).includes('org/'), 'storage key must not leak');
    const got = await http().get(`/api/files/${fileId}/content`).set(auth(alice.token)).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(200);
    assert.ok(Buffer.compare(got.body, GLB) === 0);
    assert.equal(got.headers['content-type'], 'model/gltf-binary');
    await http().get(`/api/files/${fileId}/content`).set(auth(bob.token)).expect(404);
  });

  it('publishes the saved revision only; public access is limited to referenced files', async () => {
    const stale = await http().post(`/api/projects/${projectId}/publish`).set(auth(alice.token)).send({ revision: 1 }).expect(409);
    assert.equal(stale.body.error.code, 'revision_conflict');
    const p = await http().post(`/api/projects/${projectId}/publish`).set(auth(alice.token)).send({ revision: 3 }).expect(200);
    assert.equal(p.body.status, 'published');
    assert.equal(p.body.publishedRevision, 3);
    const pub = await http().get(`/api/public/tours/${projectId}`).expect(200);
    assert.equal(pub.body.name, 'Entrepôt Abidjan');
    // File exists but the publication does not reference it yet.
    await http().get(`/api/public/tours/${projectId}/files/${fileId}`).expect(404);
    const doc = { ...emptyDoc(), assets: [{ id: 'ast_1', name: 'Modèle', source: { kind: 'file', fileId, originalFormat: 'glb' } }] };
    await http().put(`/api/projects/${projectId}`).set(auth(alice.token)).send({ name: 'Entrepôt Abidjan', type: 'logistics', document: doc, baseRevision: 3 }).expect(200);
    // Draft changes are not visible publicly until republished.
    await http().get(`/api/public/tours/${projectId}/files/${fileId}`).expect(404);
    await http().post(`/api/projects/${projectId}/publish`).set(auth(alice.token)).send({ revision: 4 }).expect(200);
    const f = await http().get(`/api/public/tours/${projectId}/files/${fileId}`).expect(200);
    assert.match(String(f.headers['cache-control']), /immutable/);
  });

  it('lists only tours whose owner chose public visibility', async () => {
    let list = await http().get('/api/public/tours').expect(200);
    assert.ok(!list.body.some((t: { id: string }) => t.id === projectId), 'unlisted by default');
    await http().patch(`/api/projects/${projectId}/publication`).set(auth(alice.token)).send({ visibility: 'public' }).expect(200);
    list = await http().get('/api/public/tours').expect(200);
    assert.ok(list.body.some((t: { id: string }) => t.id === projectId));
  });

  it('records visitor sessions idempotently and computes statistics', async () => {
    const s1 = randomUUID();
    const send = (id: string, visitorId: string, durationMs: number) =>
      http().post(`/api/public/tours/${projectId}/sessions`).send({ id, visitorId, durationMs, scenesViewed: 1 }).expect(204);
    await send(s1, 'vis_aaaaaa', 1000);
    await send(s1, 'vis_aaaaaa', 60_000); // same session grows, not a new view
    await send(s1, 'vis_aaaaaa', 30_000); // never shrinks
    await send(randomUUID(), 'vis_bbbbbb', 120_000);
    await send(randomUUID(), 'vis_bbbbbb', 500); // bounce: counted as a view, excluded from duration
    await http().post(`/api/public/tours/${randomUUID()}/sessions`).send({ id: randomUUID(), visitorId: 'vis_cccccc', durationMs: 1, scenesViewed: 0 }).expect(404);
    await http().post(`/api/public/tours/${projectId}/sessions`).send({ id: 'nope', visitorId: 'x', durationMs: -1, scenesViewed: 0 }).expect(400);
    const st = await http().get(`/api/orgs/${alice.orgId}/stats?days=30`).set(auth(alice.token)).expect(200);
    assert.equal(st.body.projects.created, 1);
    assert.equal(st.body.projects.published, 1);
    assert.equal(st.body.audience.views, 3);
    assert.equal(st.body.audience.visitors, 2);
    assert.equal(st.body.audience.avgDurationMs, 90_000);
    assert.equal(st.body.series.length, 30);
    assert.equal(st.body.series.at(-1).views, 3);
    assert.equal(st.body.visitorsAllTime[projectId], 2);
    assert.equal(st.body.storage.usedBytes, GLB.length);
    await http().get(`/api/orgs/${alice.orgId}/stats?days=12`).set(auth(alice.token)).expect(400);
    await http().get(`/api/orgs/${alice.orgId}/stats`).set(auth(bob.token)).expect(404);
  });

  it('unpublishes and soft-deletes (public links stop working)', async () => {
    await http().post(`/api/projects/${projectId}/unpublish`).set(auth(alice.token)).expect(200);
    await http().get(`/api/public/tours/${projectId}`).expect(404);
    await http().post(`/api/projects/${projectId}/publish`).set(auth(alice.token)).send({ revision: 4 }).expect(200);
    await http().delete(`/api/projects/${projectId}`).set(auth(alice.token)).expect(204);
    await http().get(`/api/projects/${projectId}`).set(auth(alice.token)).expect(404);
    await http().get(`/api/public/tours/${projectId}`).expect(404);
    const list = await http().get(`/api/orgs/${alice.orgId}/projects`).set(auth(alice.token)).expect(200);
    assert.equal(list.body.length, 0);
  });
});
