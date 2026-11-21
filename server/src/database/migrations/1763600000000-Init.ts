import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1763600000000 implements MigrationInterface {
  name = 'Init1763600000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS citext`);
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await q.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email citext NOT NULL UNIQUE,
        password_hash text NOT NULL,
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`
      CREATE TABLE organizations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`
      CREATE TABLE memberships (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role text NOT NULL CHECK (role IN ('owner','admin','editor','viewer')),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (organization_id, user_id)
      )`);
    await q.query(`CREATE INDEX memberships_user_idx ON memberships(user_id)`);
    await q.query(`
      CREATE TABLE auth_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        user_agent text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id)`);
    await q.query(`
      CREATE TABLE projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        created_by uuid REFERENCES users(id) ON DELETE SET NULL,
        name text NOT NULL,
        type text NOT NULL DEFAULT 'other' CHECK (type IN ('real-estate','logistics','laboratory','industry','other')),
        description text,
        revision int NOT NULL DEFAULT 1,
        document jsonb NOT NULL,
        published_revision int,
        published_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz
      )`);
    await q.query(`CREATE INDEX projects_org_updated_idx ON projects(organization_id, updated_at DESC) WHERE deleted_at IS NULL`);
    await q.query(`
      CREATE TABLE publications (
        project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
        revision int NOT NULL,
        name text NOT NULL,
        type text NOT NULL,
        description text,
        document jsonb NOT NULL,
        visibility text NOT NULL DEFAULT 'unlisted' CHECK (visibility IN ('unlisted','public')),
        published_at timestamptz NOT NULL
      )`);
    await q.query(`CREATE INDEX publications_public_idx ON publications(published_at DESC) WHERE visibility = 'public'`);
    await q.query(`
      CREATE TABLE media_files (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
        storage_key text NOT NULL UNIQUE,
        original_name text NOT NULL,
        mime_type text NOT NULL,
        size bigint NOT NULL CHECK (size > 0),
        sha256 text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX media_files_org_idx ON media_files(organization_id)`);
    await q.query(`CREATE INDEX media_files_project_idx ON media_files(project_id)`);
    await q.query(`
      CREATE TABLE viewer_sessions (
        id uuid PRIMARY KEY,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        visitor_id text NOT NULL,
        started_at timestamptz NOT NULL,
        duration_ms int NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
        scenes_viewed int NOT NULL DEFAULT 0 CHECK (scenes_viewed >= 0)
      )`);
    await q.query(`CREATE INDEX viewer_sessions_project_started_idx ON viewer_sessions(project_id, started_at)`);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const t of ['viewer_sessions', 'media_files', 'publications', 'projects', 'auth_sessions', 'memberships', 'organizations', 'users'])
      await q.query(`DROP TABLE IF EXISTS ${t}`);
  }
}
