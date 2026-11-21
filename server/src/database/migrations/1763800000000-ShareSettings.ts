import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Share settings of a publication: optional password (scrypt hash) and expiry date. */
export class ShareSettings1763800000000 implements MigrationInterface {
  name = 'ShareSettings1763800000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE publications ADD COLUMN password_hash text`);
    await q.query(`ALTER TABLE publications ADD COLUMN expires_at timestamptz`);
    // Bumped on every password change: invalidates access tokens issued with the old password.
    await q.query(`ALTER TABLE publications ADD COLUMN access_version int NOT NULL DEFAULT 1`);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const c of ['access_version', 'expires_at', 'password_hash']) await q.query(`ALTER TABLE publications DROP COLUMN ${c}`);
  }
}
