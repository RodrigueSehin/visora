// `npm run dev`: starts local PostgreSQL + S3 emulator, then the compiled API.
// Development defaults only — never used in production.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startInfra } from './infra.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const infra = await startInfra({ name: 'dev' });
console.log(`PostgreSQL : ${infra.env.DATABASE_URL}\nS3 (s3rver) : ${infra.env.S3_ENDPOINT}`);

// A per-machine dev JWT secret, generated once and kept out of the repository (.dev is ignored).
const secretFile = resolve(ROOT, '.dev', 'jwt-secret');
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(48).toString('base64'));

const api = spawn(process.execPath, ['--enable-source-maps', resolve(ROOT, 'dist/src/main.js')], {
  stdio: 'inherit',
  env: {
    NODE_ENV: 'development',
    PORT: '3000',
    CORS_ORIGIN: 'http://localhost:5173',
    COOKIE_SECURE: 'false',
    JWT_SECRET: readFileSync(secretFile, 'utf8'),
    ...infra.env,
    ...process.env,
  },
});

let stopping = false;
const stop = async (code = 0) => {
  if (stopping) return;
  stopping = true;
  api.kill();
  await infra.stop().catch(() => {});
  process.exit(code);
};
api.on('exit', (code) => void stop(code ?? 0));
process.on('SIGINT', () => void stop(0));
process.on('SIGTERM', () => void stop(0));
