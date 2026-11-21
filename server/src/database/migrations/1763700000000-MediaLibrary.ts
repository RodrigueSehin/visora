import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Media library: typed files, folders, favorites, trash (soft delete) and image dimensions. */
export class MediaLibrary1763700000000 implements MigrationInterface {
  name = 'MediaLibrary1763700000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE media_files ADD COLUMN kind text NOT NULL DEFAULT 'model'
      CHECK (kind IN ('model','image','panorama','texture','video','document','audio'))`);
    await q.query(`ALTER TABLE media_files ADD COLUMN folder text CHECK (folder IS NULL OR length(folder) BETWEEN 1 AND 80)`);
    await q.query(`ALTER TABLE media_files ADD COLUMN favorite boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE media_files ADD COLUMN width int CHECK (width IS NULL OR width > 0)`);
    await q.query(`ALTER TABLE media_files ADD COLUMN height int CHECK (height IS NULL OR height > 0)`);
    await q.query(`ALTER TABLE media_files ADD COLUMN deleted_at timestamptz`);
    await q.query(`CREATE INDEX media_files_project_active_idx ON media_files(project_id, created_at DESC) WHERE deleted_at IS NULL`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS media_files_project_active_idx`);
    for (const c of ['deleted_at', 'height', 'width', 'favorite', 'folder', 'kind']) await q.query(`ALTER TABLE media_files DROP COLUMN ${c}`);
  }
}
