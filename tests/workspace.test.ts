import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createProject } from '../src/lib/defaultProject';
import { formatDuration, inRange, summarize, trend, viewsPerDay } from '../src/services/analytics';
import { deleteLocalProject as deleteProject, listLocalProjects as listProjects, loadLocalSessions as loadSessions, localBackend, upsertLocalSession as upsertSession, type VisitSession } from '../src/services/localBackend';
const saveProject = localBackend.saveProject;
const loadPublished = localBackend.loadPublished;
import { tourStatus } from '../src/store/workspace';

const DAY = 86_400_000;
const ses = (daysAgo: number, visitorId: string, durationMs: number, projectId = 'p1'): VisitSession => ({
  id: `${visitorId}-${daysAgo}-${durationMs}`,
  projectId,
  visitorId,
  startedAt: new Date(Date.now() - daysAgo * DAY).toISOString(),
  durationMs,
  scenesViewed: 1,
});

describe('analytics', () => {
  const sessions = [ses(0, 'a', 60_000), ses(0, 'b', 120_000), ses(1, 'a', 500), ses(40, 'c', 30_000)];

  it('buckets views per day, oldest first, ending today', () => {
    const d = viewsPerDay(sessions, 7);
    expect(d).toHaveLength(7);
    expect(d[6].views).toBe(2);
    expect(d[5].views).toBe(1);
  });

  it('counts unique visitors and ignores bounces in the average duration', () => {
    const s = summarize(inRange(sessions, 30, 0));
    expect(s.views).toBe(3);
    expect(s.visitors).toBe(2);
    expect(s.avgDurationMs).toBe(90_000);
  });

  it('reports no trend without a previous period', () => {
    expect(trend(10, 0)).toBeNull();
    expect(trend(12, 10)).toBe(20);
    expect(trend(5, 10)).toBe(-50);
  });

  it('formats durations like the dashboard', () => {
    expect(formatDuration(388_000)).toBe('6 min 28 s');
    expect(formatDuration(42_000)).toBe('42 s');
    expect(formatDuration(0)).toBe('—');
  });
});

describe('projects', () => {
  it('creates typed projects with starter scenes, lists and deletes them with their publication', async () => {
    const a = await saveProject(createProject({ name: 'Villa', type: 'real-estate' }), 0);
    const b = await saveProject(createProject({ name: 'Entrepôt', type: 'logistics' }), 0);
    expect(a.scenes.length).toBeGreaterThan(0);
    await localBackend.publishProject(b.id, b.revision);
    const ids = (await listProjects()).map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining([a.id, b.id]));
    await deleteProject(b.id);
    expect((await listProjects()).some((p) => p.id === b.id)).toBe(false);
    expect(await loadPublished(b.id)).toBeUndefined();
  });

  it('derives tour status from publication revision', () => {
    const p = createProject({ name: 'x', type: 'other' });
    expect(tourStatus(p)).toBe('draft');
    expect(tourStatus({ ...p, status: 'published', revision: 3, publishedRevision: 3 })).toBe('published');
    expect(tourStatus({ ...p, status: 'published', revision: 4, publishedRevision: 3 })).toBe('outdated');
  });

  it('upserts sessions by id (duration updates do not duplicate views)', async () => {
    const s = ses(0, 'v', 1000, 'pX');
    await upsertSession(s);
    await upsertSession({ ...s, durationMs: 9000 });
    const mine = (await loadSessions()).filter((x) => x.projectId === 'pX');
    expect(mine).toHaveLength(1);
    expect(mine[0].durationMs).toBe(9000);
  });
});
