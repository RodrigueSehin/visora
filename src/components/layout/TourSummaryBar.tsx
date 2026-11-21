// Studio footer from the scene editor mockup: visit quality, key counts and project size.
// Every figure is computed from the project document and the project's stored files.
import { Box, CheckCircle2, Circle, Database, Info, Link2, Map as MapIcon, MonitorPlay, PlayCircle, Share2, Target } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatBytes } from '../../lib/format';
import { useEditor } from '../../store/editor';
import { brokenSteps } from '../../store/planActions';
import { navigationQuality, planQuality, tourQuality } from '../../studio/tour/quality';
import { useMedia } from '../../studio/media/mediaStore';
import { controlOn } from '../../studio/settings/AppearanceModule';
import { cx } from '../common/ui';

const card = 'flex items-center rounded-2xl border border-navy-500/50 bg-navy-800/90';

function Gauge({ score }: { score: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? '#22C55E' : score >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14 shrink-0 -rotate-90" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke="#26385A" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
      <text x="32" y="37" textAnchor="middle" className="rotate-90 fill-ink text-[14px] font-bold" style={{ transformOrigin: '32px 32px' }}>
        {score} %
      </text>
    </svg>
  );
}

function Kpi({ icon, value, label, extra }: { icon: ReactNode; value: number; label: string; extra?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
      <span className="shrink-0 text-ink-muted">{icon}</span>
      <span className="min-w-0 leading-tight">
        <span className="block text-xl font-semibold tabular-nums text-ink">{value}</span>
        <span className="block truncate text-[13px] text-ink-muted">{label}</span>
      </span>
      {extra}
    </div>
  );
}

export function TourSummaryBar() {
  const project = useEditor((s) => s.project);
  const setModule = useEditor((s) => s.setModule);
  const mode = useEditor((s) => s.module);
  const navMode = mode === 'navigation';
  const items = useMedia((s) => s.items);
  const trash = useMedia((s) => s.trash);
  const mediaStatus = useMedia((s) => s.status);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    void useMedia.getState().load();
  }, [project?.id]);
  const quality = useMemo(() => (project ? (navMode ? navigationQuality(project) : mode === 'plan' ? planQuality(project) : tourQuality(project)) : null), [project, navMode, mode]);
  if (!project || !quality) return null;

  const tours = project.guidedTours ?? [];
  const playable = tours.filter((t) => t.steps.length > brokenSteps(t, project.scenes).length);
  const toursShown = controlOn(project.settings.appearance, 'tours');
  const files = [...items, ...trash];
  const bytes = files.reduce((a, m) => a + m.size, 0);
  const failing = quality.checks.filter((c) => !c.ok);
  const nav = project.navigation ?? [];
  const connections = nav.filter((n) => !n.pairId || !nav.some((x) => x.pairId === n.pairId && x.id < n.id)).length;
  const title = navMode ? 'Qualité de la navigation' : mode === 'plan' ? 'Qualité du plan' : 'Qualité de la visite';
  const plans = project.floorPlans ?? [];
  const grade = quality.score >= 80 ? 'Bonne' : quality.score >= 50 ? 'Moyenne' : 'À améliorer';

  return (
    <footer className="hidden shrink-0 gap-3 px-3 pb-3 pt-1 lg:flex" aria-label="Synthèse de la visite">
      <div className={cx(card, 'relative w-[300px] shrink-0 gap-3 px-4 py-2.5')}>
        <Gauge score={quality.score} />
        <span className="flex-1 leading-tight">
          <span className="block text-[15px] font-semibold text-ink">{title}</span>
          <span className={cx('block text-[13px] font-medium', quality.score >= 80 ? 'text-emerald-400' : quality.score >= 50 ? 'text-amber-400' : 'text-red-400')}>{grade}</span>
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`Détail de la qualité : ${quality.score} %, ${failing.length} point(s) à améliorer`}
          onClick={() => setOpen((v) => !v)}
          className="rounded-full p-1 text-ink-muted hover:text-ink focus-ring"
        >
          <Info size={18} />
        </button>
        {open && (
          <div role="dialog" aria-label={title} className="absolute bottom-full left-0 z-50 mb-2 w-[340px] rounded-xl border border-navy-500 bg-navy-950 p-3 shadow-panel">
            <p className="mb-2 text-xs text-ink-muted">Score calculé sur le contenu de la visite. Cliquez un point pour ouvrir le module concerné.</p>
            <ul className="space-y-1">
              {quality.checks.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={c.ok}
                    onClick={() => (setModule(c.module), setOpen(false))}
                    className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm enabled:hover:bg-navy-700"
                  >
                    {c.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" aria-label="Validé" /> : <Circle size={16} className="mt-0.5 shrink-0 text-amber-400" aria-label="À améliorer" />}
                    <span>
                      <span className="text-ink">{c.label}</span>
                      {c.issue && <span className="block text-xs text-amber-300">{c.issue}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className={cx(card, 'min-w-0 flex-1 divide-x divide-navy-500/60 py-3')}>
        <Kpi icon={<Box size={30} strokeWidth={1.5} />} value={project.scenes.length} label="Scènes" />
        <Kpi icon={<Share2 size={30} strokeWidth={1.5} />} value={nav.length} label="Points de navigation" />
        {navMode ? (
          <Kpi icon={<Link2 size={30} strokeWidth={1.5} />} value={connections} label="Connexions" />
        ) : (
          <Kpi icon={<Target size={30} strokeWidth={1.5} />} value={(project.hotspots ?? []).length} label="Hotspots" />
        )}
        {mode === 'media' ? (
          <Kpi icon={<MonitorPlay size={30} strokeWidth={1.5} />} value={items.length} label={items.length > 1 ? 'Médias' : 'Média'} />
        ) : mode === 'plan' ? (
          <Kpi icon={<MapIcon size={30} strokeWidth={1.5} />} value={plans.length} label={plans.length > 1 ? `Plans (${plans.map((p) => p.name).slice(0, 3).join(', ')})` : 'Plan'} />
        ) : (
          <Kpi
            icon={<PlayCircle size={30} strokeWidth={1.5} className="text-violet-400" />}
            value={tours.length}
            label="Parcours guidé"
            extra={
              playable.length > 0 && (
                <span
                  className={cx('ml-auto shrink-0 rounded-md px-2 py-0.5 text-xs font-medium', toursShown ? 'bg-emerald-500/15 text-emerald-300' : 'bg-navy-600 text-ink-muted')}
                  title={toursShown ? 'Proposé aux visiteurs' : 'Masqué aux visiteurs (module Apparence)'}
                >
                  {toursShown ? 'Actif' : 'Masqué'}
                </span>
              )
            }
          />
        )}
      </div>

      <div className={cx(card, 'w-[300px] shrink-0 gap-3 px-4 py-2.5')}>
        <Database size={30} strokeWidth={1.5} className="shrink-0 text-ink-muted" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[13px] text-ink-muted">{mode === 'media' ? 'Stockage du projet' : 'Taille du projet'}</span>
          <span className="block text-lg font-semibold tabular-nums text-ink">{mediaStatus === 'ready' ? formatBytes(bytes) : '…'}</span>
          <span className="block text-[11px] text-ink-faint">
            {mediaStatus === 'ready' ? `${files.length} fichier${files.length > 1 ? 's' : ''} stocké${files.length > 1 ? 's' : ''}${trash.length ? ` (dont ${trash.length} en corbeille)` : ''} · aucun quota défini` : mediaStatus === 'error' ? 'Taille indisponible' : 'Calcul…'}
          </span>
        </span>
      </div>
    </footer>
  );
}
