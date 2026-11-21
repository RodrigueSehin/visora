import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { z } from 'zod';
import { AppError } from '../common/http';
import { Project, PROJECT_TYPES, Publication, type ProjectDocument, type Visibility } from '../database/entities';
import { AccessService } from '../orgs/access.service';
import { hashPassword } from '../auth/password';

/** Bounded, structural validation of the editable document (contents are owned by the Studio). */
export const documentSchema = z.object({
  scenes: z.array(z.object({ id: z.string().max(100), name: z.string().max(200) }).passthrough()).max(500),
  objects: z.array(z.object({ id: z.string().max(100), sceneId: z.string().max(100) }).passthrough()).max(20_000),
  assets: z.array(z.object({ id: z.string().max(100), name: z.string().max(200) }).passthrough()).max(5_000),
  favorites: z.array(z.string().max(100)).max(5_000),
  floorPlans: z.array(z.object({ id: z.string().max(100), name: z.string().max(200) }).passthrough()).max(100).default([]),
  guidedTours: z.array(z.object({ id: z.string().max(100), name: z.string().max(200), steps: z.array(z.object({ id: z.string().max(100), sceneId: z.string().max(100) }).passthrough()).max(500) }).passthrough()).max(100).default([]),
  annotations: z.array(z.object({ id: z.string().max(100), sceneId: z.string().max(100) }).passthrough()).max(10_000).default([]),
  hotspots: z.array(z.object({ id: z.string().max(100), sceneId: z.string().max(100) }).passthrough()).max(10_000).default([]),
  navigation: z.array(z.object({ id: z.string().max(100), sceneId: z.string().max(100), targetSceneId: z.string().max(100) }).passthrough()).max(10_000).default([]),
  settings: z.record(z.unknown()),
});

export const projectMetaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(PROJECT_TYPES as [string, ...string[]]),
  description: z.string().trim().max(2000).nullish(),
});

/** Wire format, identical to the front-end ProjectDoc. */
export type ProjectDto = ProjectDocument & {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  description?: string;
  revision: number;
  status: 'draft' | 'published';
  publishedRevision?: number;
  publishedAt?: string;
  visibility?: Visibility;
  /** Share settings (server-owned). */
  share?: { protected: boolean; expiresAt?: string };
  createdAt: string;
  updatedAt: string;
};

export function toDto(p: Project, pub?: Publication | null): ProjectDto {
  return {
    ...p.document,
    id: p.id,
    organizationId: p.organizationId,
    name: p.name,
    type: p.type,
    description: p.description ?? undefined,
    revision: p.revision,
    status: pub ? 'published' : 'draft',
    publishedRevision: pub ? pub.revision : undefined,
    publishedAt: pub ? pub.publishedAt.toISOString() : undefined,
    visibility: pub?.visibility,
    share: pub ? { protected: !!pub.passwordHash, expiresAt: pub.expiresAt?.toISOString() } : undefined,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly access: AccessService,
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(Publication) private readonly publications: Repository<Publication>,
  ) {}

  async list(userId: string, orgId: string) {
    await this.access.orgRole(userId, orgId);
    const rows: Array<Record<string, unknown>> = await this.ds.query(
      `SELECT p.id, p.name, p.type, p.description, p.revision, p.created_at, p.updated_at,
              jsonb_array_length(p.document->'scenes') AS scene_count,
              (SELECT count(*) FROM jsonb_array_elements(p.document->'objects') o WHERE o->>'kind' = 'object')::int AS object_count,
              pub.revision AS published_revision, pub.published_at, pub.visibility, pub.password_hash IS NOT NULL AS protected, pub.expires_at,
              (SELECT coalesce(sum(size), 0) FROM media_files f WHERE f.project_id = p.id)::bigint AS storage_bytes
         FROM projects p
         LEFT JOIN publications pub ON pub.project_id = p.id
        WHERE p.organization_id = $1 AND p.deleted_at IS NULL
        ORDER BY p.updated_at DESC`,
      [orgId],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      description: r.description ?? undefined,
      revision: r.revision,
      status: r.published_revision != null ? 'published' : 'draft',
      publishedRevision: r.published_revision ?? undefined,
      publishedAt: r.published_at ? new Date(r.published_at as string).toISOString() : undefined,
      visibility: r.visibility ?? undefined,
      share: r.published_revision != null ? { protected: !!r.protected, expiresAt: r.expires_at ? new Date(r.expires_at as string).toISOString() : undefined } : undefined,
      sceneCount: Number(r.scene_count),
      objectCount: Number(r.object_count),
      storageBytes: Number(r.storage_bytes),
      createdAt: new Date(r.created_at as string).toISOString(),
      updatedAt: new Date(r.updated_at as string).toISOString(),
    }));
  }

  async create(userId: string, orgId: string, input: z.infer<typeof projectMetaSchema> & { document: ProjectDocument }) {
    await this.access.orgRole(userId, orgId, 'editor');
    const p = await this.projects.save(
      this.projects.create({
        organizationId: orgId,
        createdBy: userId,
        name: input.name,
        type: input.type as Project['type'],
        description: input.description ?? null,
        document: input.document,
        revision: 1,
      }),
    );
    return toDto(p, null);
  }

  async get(userId: string, id: string) {
    const { project } = await this.access.project(userId, id);
    return toDto(project, await this.publications.findOne({ where: { projectId: id } }));
  }

  /**
   * Saves only if the stored revision still equals `baseRevision` (optimistic concurrency).
   * On conflict, returns 409 with the current server version so the client can choose.
   */
  async save(userId: string, id: string, input: z.infer<typeof projectMetaSchema> & { document: ProjectDocument; baseRevision: number; force?: boolean }) {
    await this.access.project(userId, id, 'editor');
    const params = [input.name, input.type, input.description ?? null, JSON.stringify(input.document), id];
    const rows: Array<{ revision: number }> = await this.ds.query(
      `UPDATE projects SET name = $1, type = $2, description = $3, document = $4::jsonb, revision = revision + 1, updated_at = now()
        WHERE id = $5 AND deleted_at IS NULL ${input.force ? '' : 'AND revision = $6'}
        RETURNING revision`,
      input.force ? params : [...params, input.baseRevision],
    ).then((r: [Array<{ revision: number }>, number] | Array<{ revision: number }>) => (Array.isArray(r[0]) ? (r[0] as Array<{ revision: number }>) : (r as Array<{ revision: number }>)));
    if (!rows.length) {
      const current = await this.get(userId, id);
      throw new AppError(HttpStatus.CONFLICT, 'revision_conflict', 'Le projet a été modifié ailleurs.', { current });
    }
    return this.get(userId, id);
  }

  async remove(userId: string, id: string) {
    await this.access.project(userId, id, 'admin');
    await this.ds.transaction(async (tx) => {
      await tx.delete(Publication, { projectId: id });
      await tx.softDelete(Project, { id });
    });
  }

  /** Publishes the saved revision `revision` (the client must save first). */
  async publish(userId: string, id: string, revision: number, visibility?: Visibility) {
    const { project } = await this.access.project(userId, id, 'editor');
    if (project.revision !== revision)
      throw new AppError(HttpStatus.CONFLICT, 'revision_conflict', 'Enregistrez la dernière version avant de publier.', { current: await this.get(userId, id) });
    const existing = await this.publications.findOne({ where: { projectId: id } });
    await this.publications.save(
      this.publications.create({
        projectId: id,
        revision: project.revision,
        name: project.name,
        type: project.type,
        description: project.description,
        document: project.document,
        visibility: visibility ?? existing?.visibility ?? 'unlisted',
        publishedAt: new Date(),
      }),
    );
    return this.get(userId, id);
  }

  async unpublish(userId: string, id: string) {
    await this.access.project(userId, id, 'editor');
    await this.publications.delete({ projectId: id });
    return this.get(userId, id);
  }

  /** visibility / password (null removes it) / expiry (null removes it). */
  async updateShare(userId: string, id: string, patch: { visibility?: Visibility; password?: string | null; expiresAt?: string | null }) {
    await this.access.project(userId, id, 'editor');
    const pub = await this.publications.findOne({ where: { projectId: id } });
    if (!pub) throw new AppError(HttpStatus.CONFLICT, 'not_published', 'Publiez la visite avant de régler son partage.');
    if (patch.expiresAt && new Date(patch.expiresAt).getTime() <= Date.now())
      throw new AppError(HttpStatus.BAD_REQUEST, 'invalid_expiry', 'La date d’expiration doit être dans le futur.');
    const changes: { visibility?: Visibility; expiresAt?: Date | null; passwordHash?: string | null; accessVersion?: number } = {};
    if (patch.visibility) changes.visibility = patch.visibility;
    if (patch.expiresAt !== undefined) changes.expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : null;
    if (patch.password !== undefined) {
      changes.passwordHash = patch.password ? await hashPassword(patch.password) : null;
      changes.accessVersion = pub.accessVersion + 1;
    }
    await this.publications.update({ projectId: id }, changes);
    return this.get(userId, id);
  }

  async setVisibility(userId: string, id: string, visibility: Visibility) {
    await this.access.project(userId, id, 'editor');
    const r = await this.publications.update({ projectId: id }, { visibility });
    if (!r.affected) throw new AppError(HttpStatus.CONFLICT, 'not_published', 'Publiez la visite avant de régler sa visibilité.');
    return this.get(userId, id);
  }
}
