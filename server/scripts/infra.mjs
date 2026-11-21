// Local infrastructure without Docker: real PostgreSQL (embedded-postgres binaries) and an
// S3-compatible emulator (s3rver). Used by `npm run dev` and the e2e tests only — production
// points DATABASE_URL / S3_* at managed services.
import EmbeddedPostgres from 'embedded-postgres';
import S3rver from 's3rver';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

/**
 * @param {{ name?: string, pgPort?: number, s3Port?: number, ephemeral?: boolean }} opts
 * @returns {Promise<{ env: Record<string,string>, stop: () => Promise<void> }>}
 */
export async function startInfra({ name = 'dev', pgPort = 54320, s3Port = 4569, ephemeral = false } = {}) {
  const base = resolve(ROOT, '.dev', name);
  if (ephemeral) rmSync(base, { recursive: true, force: true });
  mkdirSync(resolve(base, 's3'), { recursive: true });
  const pgDir = resolve(base, 'pg');
  const pg = new EmbeddedPostgres({ databaseDir: pgDir, user: 'visora', password: 'visora', port: pgPort, persistent: !ephemeral, onLog: () => {} });
  if (!existsSync(resolve(pgDir, 'PG_VERSION'))) await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase('visora');
  } catch {
    /* already exists */
  }
  const s3 = new S3rver({ port: s3Port, address: '127.0.0.1', directory: resolve(base, 's3'), silent: true });
  await s3.run();
  return {
    env: {
      DATABASE_URL: `postgres://visora:visora@127.0.0.1:${pgPort}/visora`,
      S3_ENDPOINT: `http://127.0.0.1:${s3Port}`,
      S3_REGION: 'us-east-1',
      S3_BUCKET: 'visora',
      S3_ACCESS_KEY: 'S3RVER',
      S3_SECRET_KEY: 'S3RVER',
      S3_FORCE_PATH_STYLE: 'true',
    },
    async stop() {
      await s3.close();
      await pg.stop();
    },
  };
}
