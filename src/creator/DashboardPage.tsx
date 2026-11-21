import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  BarChart3,
  ChevronDown,
  Clock,
  Layers,
  Loader2,
  MoreHorizontal,
  PlayCircle,
  Plus,
  Sparkles,
  Users,
  CircleDashed,
  Eye,
  Box,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { projectTypeLabel, PROJECT_TYPES } from '../lib/defaultProject';
import { formatDuration } from '../services/analytics';
import { navigate } from '../router';
import { tourStatus, useWorkspace } from '../store/workspace';
import type { ProjectType } from '../types';
import { cx } from '../components/common/ui';
import { ViewsLineChart, TypeDonut } from './charts';
import { CreateTourDialog, LightModal, TYPE_ICON } from './CreateTourDialog';
import { DEMO, type AiJob, type DashboardTour } from './demoData';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_18px_rgba(15,23,42,.05)]', className)}>{children}</section>;
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
      <h2 className="text-[19px] font-bold text-slate-900">{title}</h2>
      {action}
    </div>
  );
}

const SeeAll = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} className="flex items-center gap-1 text-sm font-medium text-[#1E6FE0] hover:underline focus-ring">
    Voir tout <ArrowRight size={15} />
  </button>
);

/** Dashboard figures: real local data, or the mockup dataset in explicit demo mode. */
export function useDashboardData(rangeDays: number) {
  const demo = useWorkspace((s) => s.demo);
  const projects = useWorkspace((s) => s.projects);
  const stats = useWorkspace((s) => s.stats);
  return useMemo(() => {
    if (demo) {
      const views = DEMO.views30.slice(-Math.min(rangeDays, 30));
      const series = views.map((v, i) => {
        const d = new Date(Date.now() - (views.length - 1 - i) * 86_400_000);
        return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, views: v };
      });
      return { demo, kpis: DEMO.kpis, tours: DEMO.tours.map((t) => ({ ...t, demo: true })), aiJobs: DEMO.aiJobs, breakdown: DEMO.breakdown, series };
    }
    // Real figures, computed by the API from PostgreSQL.
    const s = stats;
    return {
      demo,
      kpis: {
        created: s?.projects.created ?? 0,
        createdThisMonth: s?.projects.createdThisMonth ?? 0,
        published: s?.projects.published ?? 0,
        publishedThisMonth: s?.projects.publishedThisMonth ?? 0,
        aiRunning: s?.ai.running ?? 0,
        visitors: s?.audience.visitors ?? 0,
        visitorsTrend: s?.audience.visitorsTrend ?? null,
        avgDurationMs: s?.audience.avgDurationMs ?? 0,
        durationTrend: s?.audience.durationTrend ?? null,
      },
      tours: projects.slice(0, 4).map(
        (p): DashboardTour => ({ id: p.id, name: p.name, type: p.type ?? 'other', status: tourStatus(p), visitors: p.status === 'published' ? s?.visitorsAllTime[p.id] ?? 0 : null }),
      ),
      aiJobs: [] as AiJob[],
      breakdown: PROJECT_TYPES.map((t) => ({ type: t.id, count: s?.breakdown.find((b) => b.type === t.id)?.count ?? 0 })).filter((b) => b.count > 0),
      series: s?.series ?? [],
    };
  }, [demo, projects, stats, rangeDays]);
}

export function DashboardPage() {
  const status = useWorkspace((s) => s.status);
  const error = useWorkspace((s) => s.error);
  const range = useWorkspace((s) => s.statsDays);
  const setRange = (d: number) => void useWorkspace.getState().refresh(d);
  const [creating, setCreating] = useState(false);
  const data = useDashboardData(range);

  if (status === 'error') return <LoadError message={error} />;
  if (status !== 'ready')
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-slate-500" role="status">
        <Loader2 className="animate-spin" size={18} /> Chargement de vos visites…
      </div>
    );

  const k = data.kpis;
  return (
    <div className="space-y-5">
      <Hero onCreate={() => setCreating(true)} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <Kpi icon={<Layers size={26} />} tone="cyan" value={k.created} label="Visites créées" delta={k.createdThisMonth ? `+${k.createdThisMonth} ce mois` : undefined} />
        <Kpi icon={<PlayCircle size={26} />} tone="blue" value={k.published} label="Visites publiées" delta={k.publishedThisMonth ? `+${k.publishedThisMonth} ce mois` : undefined} />
        <Kpi icon={<Sparkles size={26} />} tone="violet" value={k.aiRunning} label="Générations en cours" highlight />
        <Kpi icon={<Users size={26} />} tone="blue" value={k.visitors.toLocaleString('fr-FR')} label="Visiteurs totaux" trend={k.visitorsTrend} hint="30 derniers jours" />
        <Kpi icon={<Clock size={26} />} tone="violet" value={formatDuration(k.avgDurationMs)} label="Durée moyenne" trend={k.durationTrend} hint="30 derniers jours" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_1fr_0.85fr]">
        <div className="space-y-5">
          <RecentTours tours={data.tours} onCreate={() => setCreating(true)} />
          <Card>
            <CardHeader title="Répartition par type de visite" />
            <div className="px-5 pb-5 pt-1">
              {data.breakdown.length ? <TypeDonut data={data.breakdown} /> : <p className="py-6 text-center text-sm text-slate-500">Aucune visite pour le moment.</p>}
            </div>
          </Card>
        </div>
        <div className="space-y-5">
          <AiJobs jobs={data.aiJobs} />
          <Card>
            <CardHeader
              title="Statistiques des visites"
              action={
                <label className="relative">
                  <span className="sr-only">Période</span>
                  <select
                    value={range}
                    onChange={(e) => setRange(Number(e.target.value))}
                    className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#36C8F4]/40"
                  >
                    <option value={7}>7 derniers jours</option>
                    <option value={30}>30 derniers jours</option>
                    <option value={90} disabled={data.demo}>
                      90 derniers jours
                    </option>
                  </select>
                  <ChevronDown size={15} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" />
                </label>
              }
            />
            <div className="px-3 pb-4">
              {data.series.some((d) => d.views > 0) ? (
                <ViewsLineChart data={data.series} height={240} />
              ) : (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <BarChart3 className="text-slate-300" size={30} />
                  <p className="text-sm font-medium text-slate-700">Aucune vue sur la période</p>
                  <p className="text-xs text-slate-500">Publiez une visite puis partagez son lien de l’espace visiteur : chaque ouverture est comptabilisée ici.</p>
                </div>
              )}
            </div>
          </Card>
        </div>
        <QuickAccess onCreate={() => setCreating(true)} />
      </div>
      {creating && <CreateTourDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

export function LoadError({ message }: { message?: string }) {
  return (
    <Card className="mx-auto mt-8 flex max-w-lg flex-col items-center gap-3 px-8 py-10 text-center" >
      <p role="alert" className="font-semibold text-slate-900">
        Impossible de charger vos données
      </p>
      <p className="text-sm text-slate-600">{message ?? 'Le serveur VISORA ne répond pas.'}</p>
      <button type="button" onClick={() => void useWorkspace.getState().refresh()} className="rounded-xl bg-[#1E8BE0] px-4 py-2 text-sm font-semibold text-white">
        Réessayer
      </button>
    </Card>
  );
}

function Hero({ onCreate }: { onCreate: () => void }) {
  // Static file pre-rendered from VISORA's own 3D assets (src/creator/heroImage.ts): rendering it in the
  // browser blocked the page for seconds on machines without 3D acceleration.
  const img = '/visora-hero.webp';
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#0A1230] text-white shadow-[0_12px_40px_rgba(15,23,42,.25)]">
      <div className="absolute inset-0 bg-[radial-gradient(800px_320px_at_75%_120%,rgba(120,104,245,.55),transparent_60%),radial-gradient(600px_300px_at_55%_-20%,rgba(54,200,244,.35),transparent_60%)]" />
      {img && <img src={img} alt="" className="pointer-events-none absolute -right-6 bottom-0 hidden h-full max-w-none object-contain opacity-95 md:block" />}
      <div className="absolute right-6 top-5 hidden items-center gap-1 text-3xl font-semibold text-white/90 lg:flex" aria-hidden>
        360°
      </div>
      <div className="relative max-w-xl px-7 py-8 sm:px-10 sm:py-9">
        <h2 className="text-3xl font-bold leading-tight sm:text-[34px]">Créez des visites virtuelles immersives avec l’IA</h2>
        <p className="mt-3 text-[17px] text-slate-200">Transformez vos photos en expérience 3D interactive, accessible partout et sur tous les appareils.</p>
        <button type="button" onClick={onCreate} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#22E1F5] px-5 py-3 text-base font-semibold text-[#06213A] shadow-[0_8px_24px_rgba(34,225,245,.35)] hover:brightness-105 focus-ring">
          <Plus size={20} /> Créer une visite
        </button>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  tone,
  value,
  label,
  delta,
  trend: t,
  hint,
  highlight,
}: {
  icon: ReactNode;
  tone: 'cyan' | 'blue' | 'violet';
  value: ReactNode;
  label: string;
  delta?: string;
  trend?: number | null;
  hint?: string;
  highlight?: boolean;
}) {
  const bg = { cyan: 'bg-cyan-50 text-[#1E8BE0]', blue: 'bg-blue-50 text-[#2563EB]', violet: 'bg-violet-50 text-[#6D5DF5]' }[tone];
  return (
    <Card className={cx('flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5', highlight && 'bg-gradient-to-br from-white to-violet-50')}>
      <span className={cx('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl', bg)}>{icon}</span>
      <div className="min-w-0">
        <p className="whitespace-nowrap text-2xl font-bold leading-tight text-slate-900 sm:text-[26px] 2xl:text-[28px]" title={typeof value === "string" ? value : undefined}>{value}</p>
        <p className="text-sm leading-snug text-slate-600 2xl:text-[15px]">{label}</p>
        {delta && (
          <p className="mt-0.5 flex items-center gap-1 text-sm font-medium text-emerald-600">
            <ArrowUp size={14} /> {delta}
          </p>
        )}
        {t != null && (
          <p className={cx('mt-0.5 flex items-center gap-1 text-sm font-medium', t >= 0 ? 'text-emerald-600' : 'text-red-600')} title={hint ? `vs ${hint} précédents` : undefined}>
            {t >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />} {t >= 0 ? '+' : ''}
            {t} %
          </p>
        )}
        {t == null && !delta && hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
    </Card>
  );
}

export const STATUS_PILL: Record<DashboardTour['status'], { label: string; cls: string; icon?: ReactNode }> = {
  published: { label: 'Publiée', cls: 'bg-emerald-50 text-emerald-700' },
  outdated: { label: 'Publiée · à mettre à jour', cls: 'bg-amber-50 text-amber-700' },
  processing: { label: 'En traitement', cls: 'bg-sky-50 text-sky-700', icon: <CircleDashed size={13} className="animate-spin" /> },
  draft: { label: 'Brouillon', cls: 'bg-slate-100 text-slate-700' },
};

export function TourCover({ type, className }: { type: ProjectType; className?: string }) {
  const Icon = TYPE_ICON[type];
  const color = PROJECT_TYPES.find((t) => t.id === type)!.color;
  return (
    <span className={cx('flex items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#0E1A33] to-[#26385A]', className)} style={{ boxShadow: `inset 0 -3px 0 ${color}` }} aria-hidden>
      <Icon size={26} style={{ color }} />
    </span>
  );
}

function RecentTours({ tours, onCreate }: { tours: DashboardTour[]; onCreate: () => void }) {
  const [menu, setMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<DashboardTour | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !(e.target as HTMLElement).closest('[data-row-menu]') && setMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);
  return (
    <Card>
      <CardHeader title="Mes visites récentes" action={<SeeAll onClick={() => navigate('/tours')} />} />
      {tours.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 pb-8 pt-4 text-center">
          <Layers className="text-slate-300" size={30} />
          <p className="text-sm font-medium text-slate-700">Aucune visite pour le moment</p>
          <p className="text-xs text-slate-500">Créez votre première visite pour commencer.</p>
          <button type="button" onClick={onCreate} className="mt-1 rounded-lg bg-[#1E8BE0] px-3.5 py-2 text-sm font-semibold text-white">
            Créer une visite
          </button>
          <button type="button" onClick={() => useWorkspace.getState().setDemo(true)} className="text-xs text-violet hover:underline">
            ou afficher des données de démonstration
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 px-3 pb-2">
          {tours.map((t) => {
            const pill = STATUS_PILL[t.status];
            return (
              <li key={t.id} className="flex items-center gap-3 px-2 py-2.5">
                <button
                  type="button"
                  disabled={t.demo}
                  onClick={() => navigate(`/studio/${t.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                  title={t.demo ? 'Donnée de démonstration' : 'Ouvrir dans le Studio 3D'}
                >
                  <TourCover type={t.type} className="h-14 w-24 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-900">{t.name}</span>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{projectTypeLabel(t.type)}</span>
                  </span>
                </button>
                <span className={cx('hidden shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-medium sm:inline-flex', pill.cls)}>
                  {pill.icon}
                  {pill.label}
                </span>
                <span className="hidden w-14 shrink-0 items-center gap-1 text-sm text-slate-700 md:flex" title="Visiteurs uniques">
                  {t.visitors != null && (
                    <>
                      <Users size={15} /> {t.visitors}
                    </>
                  )}
                </span>
                <div className="relative" data-row-menu>
                  <button
                    type="button"
                    aria-label={`Actions pour ${t.name}`}
                    disabled={t.demo}
                    title={t.demo ? 'Donnée de démonstration' : undefined}
                    onClick={() => setMenu(menu === t.id ? null : t.id)}
                    className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                  >
                    <MoreHorizontal size={20} />
                  </button>
                  {menu === t.id && (
                    <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-xl">
                      <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-slate-100" onClick={() => navigate(`/studio/${t.id}`)}>
                        <Box size={15} /> Ouvrir dans le Studio 3D
                      </button>
                      <button
                        type="button"
                        disabled={t.status === 'draft' || t.status === 'processing'}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-slate-100 disabled:opacity-40"
                        onClick={() => navigate(`/visite/${t.id}`)}
                      >
                        <Eye size={15} /> Voir dans l’espace visiteur
                      </button>
                      <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-red-600 hover:bg-red-50" onClick={() => (setConfirm(t), setMenu(null))}>
                        <Trash2 size={15} /> Supprimer
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {confirm && <DeleteTourDialog tour={confirm} onClose={() => setConfirm(null)} />}
    </Card>
  );
}

export function DeleteTourDialog({ tour, onClose }: { tour: { id: string; name: string }; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <LightModal
      title={`Supprimer « ${tour.name} » ?`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Annuler
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await useWorkspace.getState().deleteProject(tour.id);
              onClose();
            }}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Supprimer définitivement
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">La visite, sa version publiée et ses modèles importés seront supprimés de ce navigateur. Cette action est irréversible.</p>
    </LightModal>
  );
}

function AiJobs({ jobs }: { jobs: AiJob[] }) {
  return (
    <Card>
      <CardHeader title="Générations IA en cours" action={jobs.length ? <SeeAll onClick={() => navigate('/ai-builder')} /> : undefined} />
      {jobs.length === 0 ? (
        <div className="flex items-center gap-3 px-5 pb-5 pt-1">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-[#6D5DF5]">
            <Sparkles size={22} />
          </span>
          <p className="text-sm text-slate-600">
            Aucune génération en cours. <span className="text-slate-500">Le service AI Builder n’est pas encore connecté à cet espace.</span>
          </p>
        </div>
      ) : (
        <ul className="space-y-1 px-5 pb-4">
          {jobs.map((j) => (
            <li key={j.id} className="flex items-center gap-3 py-2">
              <TourCover type={j.type} className="h-14 w-20 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{j.name}</p>
                <p className="truncate text-sm text-slate-600">{j.step}</p>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={j.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progression ${j.name}`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#7868F5]" style={{ width: `${j.progress}%` }} />
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">{j.progress} %</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function QuickAccess({ onCreate }: { onCreate: () => void }) {
  const items = [
    { title: 'Créer une visite', sub: 'Nouveau projet de visite', icon: <Plus size={22} />, cls: 'bg-[#2563EB] text-white', on: onCreate },
    { title: 'Lancer l’AI Builder', sub: 'Générer automatiquement une visite', icon: <Sparkles size={26} />, cls: 'text-[#6D5DF5]', on: () => navigate('/ai-builder') },
    { title: 'Voir une visite', sub: 'Explorer une visite publiée', icon: <PlayCircle size={28} />, cls: 'text-[#6D5DF5]', on: () => navigate('/explorer') },
    { title: 'Consulter les statistiques', sub: 'Performances et audience', icon: <BarChart3 size={28} />, cls: 'text-[#6D5DF5]', on: () => navigate('/analytics') },
  ];
  return (
    <Card className="h-fit">
      <CardHeader title="Accès rapide" />
      <ul className="space-y-2.5 px-4 pb-4">
        {items.map((i) => (
          <li key={i.title}>
            <button type="button" onClick={i.on} className="flex w-full items-center gap-4 rounded-xl bg-slate-50 px-3.5 py-3 text-left transition-colors hover:bg-slate-100 focus-ring">
              <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', i.cls)}>{i.icon}</span>
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900">{i.title}</span>
                <span className="block truncate text-sm text-slate-600">{i.sub}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
