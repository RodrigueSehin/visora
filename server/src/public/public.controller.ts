// Unauthenticated visitor API. Only published snapshots are reachable, subject to their share
// settings: expiry date (410) and optional password (401 until an access token is presented).
import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req, Res } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { z } from 'zod';
import { verifyPassword } from '../auth/password';
import { AppError, notFound, Public, ZodPipe } from '../common/http';
import { config } from '../config';
import { Publication } from '../database/entities';
import { FilesService } from '../files/files.service';

const uuid = new ParseUUIDPipe({ version: '4' });
const MAX_SESSION_MS = 4 * 3600 * 1000;
const ACCESS_TTL_S = 12 * 3600;

const sessionSchema = z.object({
  id: z.string().uuid(),
  visitorId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/),
  durationMs: z.number().int().min(0).max(MAX_SESSION_MS * 10),
  scenesViewed: z.number().int().min(0).max(10_000),
});
const accessSchema = z.object({ password: z.string().min(1).max(200) });

const tourDto = (p: Publication) => ({
  ...p.document,
  id: p.projectId,
  name: p.name,
  type: p.type,
  description: p.description ?? undefined,
  revision: p.revision,
  status: 'published' as const,
  publishedRevision: p.revision,
  publishedAt: p.publishedAt.toISOString(),
  visibility: p.visibility,
  createdAt: p.publishedAt.toISOString(),
  updatedAt: p.publishedAt.toISOString(),
});

const sign = (payload: string) => createHmac('sha256', config().JWT_SECRET).update(`tour-access:${payload}`).digest('base64url');

/** Token bound to the tour and its password version (a password change revokes it). */
export function issueAccessToken(projectId: string, accessVersion: number, ttlS = ACCESS_TTL_S) {
  const exp = Math.floor(Date.now() / 1000) + ttlS;
  return { token: `${exp}.${accessVersion}.${sign(`${projectId}.${accessVersion}.${exp}`)}`, expiresAt: new Date(exp * 1000).toISOString() };
}

function validToken(pub: Publication, token?: string) {
  if (!token) return false;
  const [exp, version, sig] = token.split('.');
  if (!exp || !version || !sig || Number(exp) < Date.now() / 1000 || Number(version) !== pub.accessVersion) return false;
  const expected = Buffer.from(sign(`${pub.projectId}.${version}.${exp}`));
  const given = Buffer.from(sig);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

@Public()
@Controller('api/public')
export class PublicController {
  constructor(
    private readonly files: FilesService,
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(Publication) private readonly publications: Repository<Publication>,
  ) {}

  /** Loads a publication and enforces its share settings. */
  private async gate(id: string, token?: string, opts: { allowLocked?: boolean } = {}) {
    const pub = await this.publications.findOne({ where: { projectId: id } });
    if (!pub) throw notFound('Visite');
    if (pub.expiresAt && pub.expiresAt.getTime() < Date.now()) throw new AppError(HttpStatus.GONE, 'tour_expired', 'Ce lien de visite a expiré.');
    if (pub.passwordHash && !opts.allowLocked && !validToken(pub, token))
      throw new AppError(HttpStatus.UNAUTHORIZED, 'password_required', 'Cette visite est protégée par un mot de passe.', { name: pub.name });
    return pub;
  }

  /** Visitor gallery: only tours their owners listed publicly, without password, not expired. */
  @Get('tours')
  async list() {
    const rows = await this.publications
      .createQueryBuilder('p')
      .where(`p.visibility = 'public' AND p.password_hash IS NULL AND (p.expires_at IS NULL OR p.expires_at > now())`)
      .orderBy('p.published_at', 'DESC')
      .take(100)
      .getMany();
    return rows.map((p) => ({
      id: p.projectId,
      name: p.name,
      type: p.type,
      description: p.description ?? undefined,
      sceneCount: (p.document.scenes ?? []).length,
      publishedAt: p.publishedAt.toISOString(),
    }));
  }

  @Get('tours/:id')
  async get(@Param('id', uuid) id: string, @Headers('x-tour-access') token?: string) {
    return tourDto(await this.gate(id, token));
  }

  /** Exchanges the tour password for a time-limited access token (rate-limited against guessing). */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('tours/:id/access')
  async access(@Param('id', uuid) id: string, @Body(new ZodPipe(accessSchema)) body: z.infer<typeof accessSchema>) {
    const pub = await this.gate(id, undefined, { allowLocked: true });
    if (pub.passwordHash && !(await verifyPassword(body.password, pub.passwordHash)))
      throw new AppError(HttpStatus.UNAUTHORIZED, 'wrong_password', 'Mot de passe incorrect.');
    return issueAccessToken(id, pub.accessVersion);
  }

  /** `access` query parameter: <img>/<video> tags cannot send headers. */
  @Get('tours/:id/files/:fileId')
  async file(
    @Param('id', uuid) id: string,
    @Param('fileId', uuid) fileId: string,
    @Query('access') access: string | undefined,
    @Headers('x-tour-access') header: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.gate(id, header ?? access);
    await this.files.streamPublic(id, fileId, req, res);
  }

  /** Idempotent upsert: the viewer re-sends the same session id with a growing duration. */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('tours/:id/sessions')
  async session(@Param('id', uuid) id: string, @Body(new ZodPipe(sessionSchema)) s: z.infer<typeof sessionSchema>, @Headers('x-tour-access') token?: string) {
    await this.gate(id, token);
    // started_at is server time; an existing session can only grow and never moves to another tour.
    await this.ds.query(
      `INSERT INTO viewer_sessions (id, project_id, visitor_id, started_at, duration_ms, scenes_viewed)
       VALUES ($1::uuid, $2::uuid, $3::text, now(), LEAST($4::int, $6::int), $5::int)
       ON CONFLICT (id) DO UPDATE SET
         duration_ms = GREATEST(viewer_sessions.duration_ms, LEAST(EXCLUDED.duration_ms, $6::int)),
         scenes_viewed = GREATEST(viewer_sessions.scenes_viewed, EXCLUDED.scenes_viewed)
       WHERE viewer_sessions.project_id = EXCLUDED.project_id AND viewer_sessions.visitor_id = EXCLUDED.visitor_id`,
      [s.id, id, s.visitorId, s.durationMs, s.scenesViewed, MAX_SESSION_MS],
    );
  }
}
