// Visitor statistics computed from sessions recorded by the visitor space.
/** Anonymous visitor session (server table viewer_sessions; IndexedDB in unit tests). */
export type VisitSession = { id: string; projectId: string; visitorId: string; startedAt: string; durationMs: number; scenesViewed: number };

const DAY = 86_400_000;
/** Sessions shorter than this are bounces/reloads and excluded from durations. */
export const MIN_SESSION_MS = 2_000;

export type DayPoint = { date: string; views: number };

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function viewsPerDay(sessions: VisitSession[], days: number, now = new Date()): DayPoint[] {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    const k = dayKey(new Date(s.startedAt));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY);
    out.push({ date: dayKey(d), views: counts.get(dayKey(d)) ?? 0 });
  }
  return out;
}

export function inRange(sessions: VisitSession[], fromDaysAgo: number, toDaysAgo: number, now = Date.now()) {
  return sessions.filter((s) => {
    const t = new Date(s.startedAt).getTime();
    return t > now - fromDaysAgo * DAY && t <= now - toDaysAgo * DAY;
  });
}

export function summarize(sessions: VisitSession[]) {
  const counted = sessions.filter((s) => s.durationMs >= MIN_SESSION_MS);
  return {
    views: sessions.length,
    visitors: new Set(sessions.map((s) => s.visitorId)).size,
    avgDurationMs: counted.length ? counted.reduce((a, s) => a + s.durationMs, 0) / counted.length : 0,
  };
}

/** Percentage change, or null when there is no previous period to compare with. */
export function trend(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function formatDuration(ms: number): string {
  if (!ms) return '—';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
}
