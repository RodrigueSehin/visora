import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import { IsNull, Not, Repository } from 'typeorm';
import { AppError, notFound } from '../common/http';
import { config } from '../config';
import { MediaFile, Project, Publication } from '../database/entities';
import { AccessService } from '../orgs/access.service';
import { FORMATS, imageSize, looksLikePanorama, type MediaKind } from './media-kinds';
import { StorageService } from './storage.service';

export const sanitizeFileName = (name: string) =>
  name.replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_').replace(/^\.+/, '').slice(0, 200) || 'fichier';

const SIGNED_URL_TTL_S = 3600;

export type MediaDto = {
  id: string;
  name: string;
  kind: MediaKind;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  folder?: string;
  favorite: boolean;
  sha256: string;
  createdAt: string;
  deletedAt?: string;
};

const toDto = (f: MediaFile): MediaDto => ({
  id: f.id,
  name: f.originalName,
  kind: f.kind,
  mimeType: f.mimeType,
  size: f.size,
  width: f.width ?? undefined,
  height: f.height ?? undefined,
  folder: f.folder ?? undefined,
  favorite: f.favorite,
  sha256: f.sha256,
  createdAt: f.createdAt.toISOString(),
  deletedAt: f.deletedAt?.toISOString(),
});

/** A file id is referenced by a document when it appears in it (ids are UUIDs, so no false positives). */
const references = (doc: unknown, fileId: string) => JSON.stringify(doc ?? {}).includes(fileId);

@Injectable()
export class FilesService {
  private readonly log = new Logger('Files');
  constructor(
    private readonly access: AccessService,
    private readonly storage: StorageService,
    @InjectRepository(MediaFile) private readonly files: Repository<MediaFile>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(Publication) private readonly publications: Repository<Publication>,
  ) {}

  async upload(userId: string, projectId: string, file: Express.Multer.File | undefined, folder?: string) {
    try {
      if (!file) throw new AppError(HttpStatus.BAD_REQUEST, 'file_missing', 'Aucun fichier reçu (champ « file »).');
      const { project } = await this.access.project(userId, projectId, 'editor');
      const name = sanitizeFileName(file.originalname);
      const ext = name.toLowerCase().split('.').pop() ?? '';
      const format = FORMATS.find((k) => k.ext.includes(ext));
      if (!format)
        throw new AppError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'unsupported_format', `Format .${ext || '?'} non accepté (images, vidéos MP4/WebM, PDF, MP3/WAV, GLB).`);
      // 64 KB is enough for the magic bytes and the JPEG SOF segment in practice.
      const head = Buffer.alloc(Math.min(file.size, 64 * 1024));
      const fh = await open(file.path, 'r');
      await fh.read(head, 0, head.length, 0);
      await fh.close();
      if (!format.magic(head)) throw new AppError(HttpStatus.UNPROCESSABLE_ENTITY, 'corrupted_file', 'Le contenu du fichier ne correspond pas à son format (fichier corrompu ?).');
      const dims = format.kind === 'image' ? imageSize(format.mime, head) : null;
      const kind: MediaKind = format.kind === 'image' && looksLikePanorama(dims) ? 'panorama' : format.kind;
      const sha256 = await new Promise<string>((res, rej) => {
        const h = createHash('sha256');
        createReadStream(file.path).on('data', (d) => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej);
      });
      const id = randomUUID();
      // Internal key: never returned to clients.
      const storageKey = `org/${project.organizationId}/projects/${projectId}/${id}.${format.ext[0]}`;
      await this.storage.putFile(storageKey, file.path, file.size, format.mime);
      const saved = await this.files.save(
        this.files.create({
          id,
          organizationId: project.organizationId,
          projectId,
          uploadedBy: userId,
          storageKey,
          originalName: name,
          mimeType: format.mime,
          size: file.size,
          sha256,
          kind,
          folder: folder?.trim().slice(0, 80) || null,
          favorite: false,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
          deletedAt: null,
        }),
      );
      return toDto(saved);
    } finally {
      if (file?.path) await unlink(file.path).catch(() => {});
    }
  }

  async list(userId: string, projectId: string, trash: boolean) {
    await this.access.project(userId, projectId);
    const rows = await this.files.find({ where: { projectId, deletedAt: trash ? Not(IsNull()) : IsNull() }, order: { createdAt: 'DESC' } });
    return rows.map(toDto);
  }

  private async editable(userId: string, fileId: string) {
    const f = await this.files.findOne({ where: { id: fileId } });
    if (!f) throw notFound('Fichier');
    await this.access.project(userId, f.projectId, 'editor').catch((e) => {
      throw e instanceof AppError && e.getStatus() === 403 ? e : notFound('Fichier');
    });
    return f;
  }

  async update(userId: string, fileId: string, patch: { name?: string; folder?: string | null; favorite?: boolean; kind?: MediaKind }) {
    const f = await this.editable(userId, fileId);
    if (patch.kind) {
      // Only reinterpretations of the same bytes are allowed (an image can be a 360° panorama or a texture).
      const imageKinds: MediaKind[] = ['image', 'panorama', 'texture'];
      if (!imageKinds.includes(f.kind) || !imageKinds.includes(patch.kind))
        throw new AppError(HttpStatus.UNPROCESSABLE_ENTITY, 'invalid_kind', 'Ce type ne correspond pas au fichier.');
    }
    await this.files.update(
      { id: f.id },
      {
        ...(patch.name !== undefined && { originalName: sanitizeFileName(patch.name) }),
        ...(patch.folder !== undefined && { folder: patch.folder?.trim().slice(0, 80) || null }),
        ...(patch.favorite !== undefined && { favorite: patch.favorite }),
        ...(patch.kind !== undefined && { kind: patch.kind }),
      },
    );
    return toDto(await this.files.findOneOrFail({ where: { id: f.id } }));
  }

  async trash(userId: string, fileId: string) {
    const f = await this.editable(userId, fileId);
    await this.files.update({ id: f.id }, { deletedAt: new Date() });
  }

  async restore(userId: string, fileId: string) {
    const f = await this.editable(userId, fileId);
    await this.files.update({ id: f.id }, { deletedAt: null });
    return toDto(await this.files.findOneOrFail({ where: { id: f.id } }));
  }

  /** Permanent deletion is refused while the draft or the publication still uses the file. */
  async destroy(userId: string, fileId: string) {
    const f = await this.editable(userId, fileId);
    const project = await this.projects.findOne({ where: { id: f.projectId } });
    const pub = await this.publications.findOne({ where: { projectId: f.projectId } });
    if (references(project?.document, f.id) || references(pub?.document, f.id))
      throw new AppError(HttpStatus.CONFLICT, 'file_in_use', 'Ce média est encore utilisé par le projet ou par la version publiée.');
    await this.files.delete({ id: f.id });
    await this.storage.delete(f.storageKey).catch((e) => this.log.warn(`Suppression S3 différée pour ${f.id}: ${e}`));
  }

  /** Short-lived HMAC-signed URL so <img>, <video> and <audio> can load media without the token. */
  async signedUrl(userId: string, fileId: string) {
    const f = await this.files.findOne({ where: { id: fileId } });
    if (!f) throw notFound('Fichier');
    await this.access.project(userId, f.projectId).catch(() => {
      throw notFound('Fichier');
    });
    const exp = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_S;
    return { url: `/api/media/${f.id}?exp=${exp}&sig=${this.sign(f.id, exp)}`, expiresAt: new Date(exp * 1000).toISOString() };
  }

  private sign(fileId: string, exp: number) {
    return createHmac('sha256', config().JWT_SECRET).update(`media:${fileId}:${exp}`).digest('base64url');
  }

  async streamSigned(fileId: string, exp: string | undefined, sig: string | undefined, req: Request, res: Response) {
    const e = Number(exp);
    const expected = Number.isFinite(e) ? Buffer.from(this.sign(fileId, e)) : Buffer.alloc(0);
    const given = Buffer.from(String(sig ?? ''));
    if (!Number.isFinite(e) || e < Date.now() / 1000 || given.length !== expected.length || !timingSafeEqual(given, expected))
      throw new AppError(HttpStatus.FORBIDDEN, 'link_expired', 'Lien de média invalide ou expiré.');
    const f = await this.files.findOne({ where: { id: fileId } });
    if (!f) throw notFound('Fichier');
    await this.pipe(f, req, res, 'private, max-age=3000');
  }

  async streamForMember(userId: string, fileId: string, req: Request, res: Response) {
    const f = await this.files.findOne({ where: { id: fileId } });
    if (!f) throw notFound('Fichier');
    await this.access.project(userId, f.projectId).catch(() => {
      throw notFound('Fichier');
    });
    await this.pipe(f, req, res, 'private, max-age=3600');
  }

  /** Public access only for files referenced by the published snapshot of that project. */
  async streamPublic(projectId: string, fileId: string, req: Request, res: Response) {
    const pub = await this.publications.findOne({ where: { projectId } });
    const f = pub && references(pub.document, fileId) ? await this.files.findOne({ where: { id: fileId, projectId } }) : null;
    if (!f) throw notFound('Fichier');
    // A file id always maps to the same bytes: safe to cache aggressively.
    await this.pipe(f, req, res, 'public, max-age=31536000, immutable');
  }

  private async pipe(f: MediaFile, req: Request, res: Response, cache: string) {
    // Single byte-range support (video/audio seeking).
    let range: { start: number; end: number } | undefined;
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''));
    if (m && (m[1] || m[2])) {
      const start = m[1] ? Number(m[1]) : Math.max(0, f.size - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), f.size - 1) : f.size - 1;
      if (start > end || start >= f.size) {
        res.status(416).setHeader('Content-Range', `bytes */${f.size}`);
        res.end();
        return;
      }
      range = { start, end };
    }
    const obj = await this.storage.get(f.storageKey, range && `bytes=${range.start}-${range.end}`).catch(() => {
      throw new AppError(HttpStatus.BAD_GATEWAY, 'storage_unavailable', 'Fichier temporairement indisponible.');
    });
    res.status(range ? 206 : 200);
    res.setHeader('Content-Type', f.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', String(range ? range.end - range.start + 1 : f.size));
    if (range) res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${f.size}`);
    res.setHeader('Cache-Control', cache);
    res.setHeader('ETag', `"${f.sha256}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.originalName)}`);
    await new Promise<void>((resolve, reject) => {
      obj.body.on('error', reject).pipe(res).on('finish', resolve).on('error', reject);
    });
  }
}
