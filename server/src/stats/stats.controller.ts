// Dashboard statistics for an organization, computed in SQL from real data.
import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { CurrentUser, ZodPipe, type AuthUser } from '../common/http';
import { AccessService } from '../orgs/access.service';

/** Sessions shorter than this are bounces/reloads and excluded from average durations. */
export const MIN_SESSION_MS = 2000;
const querySchema = z.object({ days: z.coerce.number().int().refine((d) => [7, 30, 90].includes(d)).default(30) });

@Controller('api/orgs/:orgId/stats')
export class StatsController {
  constructor(
    private readonly access: AccessService,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  @Get()
  async stats(@CurrentUser() u: AuthUser, @Param('orgId', new ParseUUIDPipe({ version: '4' })) orgId: string, @Query(new ZodPipe(querySchema)) q: z.infer<typeof querySchema>) {
    await this.access.orgRole(u.id, orgId);
    const days = q.days;
    const [projects] = await this.ds.query(
      `SELECT count(*)::int AS created,
              count(*) FILTER (WHERE date_trunc('month', p.created_at) = date_trunc('month', now()))::int AS created_this_month,
              count(pub.project_id)::int AS published,
              count(pub.project_id) FILTER (WHERE date_trunc('month', pub.published_at) = date_trunc('month', now()))::int AS published_this_month
         FROM projects p LEFT JOIN publications pub ON pub.project_id = p.id
        WHERE p.organization_id = $1 AND p.deleted_at IS NULL`,
      [orgId],
    );
    // Current period vs the previous period of the same length.
    const periods: Array<{ period: string; views: number; visitors: number; avg_ms: number | null }> = await this.ds.query(
      `SELECT CASE WHEN s.started_at > now() - make_interval(days => $2) THEN 'cur' ELSE 'prev' END AS period,
              count(*)::int AS views,
              count(DISTINCT s.visitor_id)::int AS visitors,
              avg(s.duration_ms) FILTER (WHERE s.duration_ms >= $3)::float AS avg_ms
         FROM viewer_sessions s JOIN projects p ON p.id = s.project_id
        WHERE p.organization_id = $1 AND p.deleted_at IS NULL AND s.started_at > now() - make_interval(days => $2 * 2)
        GROUP BY 1`,
      [orgId, days, MIN_SESSION_MS],
    );
    const cur = periods.find((p) => p.period === 'cur');
    const prev = periods.find((p) => p.period === 'prev');
    const series: Array<{ date: string; views: number }> = await this.ds.query(
      `SELECT to_char(d, 'YYYY-MM-DD') AS date, count(s.id)::int AS views
         FROM generate_series(date_trunc('day', now()) - make_interval(days => $2 - 1), date_trunc('day', now()), interval '1 day') d
         LEFT JOIN viewer_sessions s ON date_trunc('day', s.started_at) = d
              AND s.project_id IN (SELECT id FROM projects WHERE organization_id = $1 AND deleted_at IS NULL)
        GROUP BY d ORDER BY d`,
      [orgId, days],
    );
    const perProject: Array<{ project_id: string; views: number; visitors: number; avg_ms: number | null }> = await this.ds.query(
      `SELECT s.project_id, count(*)::int AS views, count(DISTINCT s.visitor_id)::int AS visitors,
              avg(s.duration_ms) FILTER (WHERE s.duration_ms >= $3)::float AS avg_ms
         FROM viewer_sessions s JOIN projects p ON p.id = s.project_id
        WHERE p.organization_id = $1 AND p.deleted_at IS NULL AND s.started_at > now() - make_interval(days => $2)
        GROUP BY s.project_id`,
      [orgId, days, MIN_SESSION_MS],
    );
    const allTime: Array<{ project_id: string; visitors: number }> = await this.ds.query(
      `SELECT s.project_id, count(DISTINCT s.visitor_id)::int AS visitors
         FROM viewer_sessions s JOIN projects p ON p.id = s.project_id
        WHERE p.organization_id = $1 AND p.deleted_at IS NULL GROUP BY s.project_id`,
      [orgId],
    );
    const breakdown: Array<{ type: string; count: number }> = await this.ds.query(
      `SELECT type, count(*)::int AS count FROM projects WHERE organization_id = $1 AND deleted_at IS NULL GROUP BY type`,
      [orgId],
    );
    const [storage] = await this.ds.query(`SELECT coalesce(sum(size), 0)::bigint AS bytes FROM media_files WHERE organization_id = $1`, [orgId]);
    const trend = (c?: number | null, p?: number | null) => (c != null && p ? Math.round(((c - p) / p) * 100) : null);
    return {
      days,
      projects: {
        created: projects.created,
        createdThisMonth: projects.created_this_month,
        published: projects.published,
        publishedThisMonth: projects.published_this_month,
      },
      audience: {
        views: cur?.views ?? 0,
        visitors: cur?.visitors ?? 0,
        avgDurationMs: Math.round(cur?.avg_ms ?? 0),
        visitorsTrend: trend(cur?.visitors, prev?.visitors),
        durationTrend: trend(cur?.avg_ms, prev?.avg_ms),
      },
      series,
      perProject: perProject.map((r) => ({ projectId: r.project_id, views: r.views, visitors: r.visitors, avgDurationMs: Math.round(r.avg_ms ?? 0) })),
      visitorsAllTime: Object.fromEntries(allTime.map((r) => [r.project_id, r.visitors])),
      breakdown,
      storage: { usedBytes: Number(storage.bytes), quotaBytes: null as number | null },
      ai: { running: 0, available: false },
    };
  }
}
