import { BarChart3, Box, Check, Copy, Crown, Eye, EyeOff, Globe2, Plus, Search, Sparkles, Trash2, Users } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { PROJECT_TYPES, projectTypeLabel } from '../lib/defaultProject';
import { formatBytes } from '../lib/format';
import { formatDuration } from '../services/analytics';
import { navigate } from '../router';
import { useSession } from '../store/session';
import { tourStatus, useWorkspace, type TourStatus } from '../store/workspace';
import type { ProjectType } from '../types';
import { cx } from '../components/common/ui';
import { ViewsLineChart } from './charts';
import { CreateTourDialog, LightModal } from './CreateTourDialog';
import { Card, CardHeader, DeleteTourDialog, LoadError, STATUS_PILL, TourCover } from './DashboardPage';

const PageTitle = ({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      {sub && <p className="text-sm text-slate-600">{sub}</p>}
    </div>
    {action}
  </div>
);

const PrimaryBtn = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E8BE0] to-[#36C8F4] px-4 py-2.5 text-sm font-semibold text-white shadow focus-ring">
    {children}
  </button>
);

export function tourUrl(id: string) {
  return `${location.origin}${location.pathname}#/visite/${encodeURIComponent(id)}`;
}

/** "Mes visites" (all) and "Publications" (published only). Always real data. */
export function ToursPage({ publishedOnly }: { publishedOnly?: boolean }) {
  const status = useWorkspace((s) => s.status);
  const error = useWorkspace((s) => s.error);
  const projects = useWorkspace((s) => s.projects);
  const stats = useWorkspace((s) => s.stats);
  const demo = useWorkspace((s) => s.demo);
  const [q, setQ] = useState('');
  const [type, setType] = useState<ProjectType | 'all'>('all');
  const [status_, setStatus] = useState<TourStatus | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [del, setDel] = useState<{ id: string; name: string } | null>(null);
  const [unpub, setUnpub] = useState<{ id: string; name: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const per = new Map(stats?.perProject.map((p) => [p.projectId, p]));
    return projects
      .filter((p) => (!publishedOnly || p.status === 'published') && (type === 'all' || p.type === type) && (status_ === 'all' || tourStatus(p) === status_) && (!needle || p.name.toLowerCase().includes(needle)))
      .map((p) => ({ p, views: per.get(p.id)?.views ?? 0, avgDurationMs: per.get(p.id)?.avgDurationMs ?? 0 }));
  }, [projects, stats, q, type, status_, publishedOnly]);

  const copy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(tourUrl(id));
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      prompt('Lien de la visite :', tourUrl(id));
    }
  };
  const toggleGallery = async (id: string, current?: 'unlisted' | 'public') => {
    setBusy(id);
    try {
      await useWorkspace.getState().setVisibility(id, current === 'public' ? 'unlisted' : 'public');
    } finally {
      setBusy(null);
    }
  };

  if (status === 'error') return <LoadError message={error} />;
  const days = stats?.days ?? 30;
  const sel = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#36C8F4]/40';
  return (
    <div>
      <PageTitle
        title={publishedOnly ? 'Publications' : 'Mes visites'}
        sub={publishedOnly ? 'Visites en ligne : lien de partage et présence dans la galerie publique.' : 'Toutes les visites de votre organisation, publiées ou en cours de création.'}
        action={
          <PrimaryBtn onClick={() => setCreating(true)}>
            <Plus size={17} /> Créer une visite
          </PrimaryBtn>
        }
      />
      {demo && <p className="mb-4 rounded-xl bg-violet-50 px-4 py-2 text-sm text-violet-800">Le mode démonstration ne s’applique qu’au tableau de bord : cette liste affiche vos visites réelles.</p>}
      <div className="mb-4 flex flex-wrap gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une visite…" aria-label="Rechercher une visite" className={cx(sel, 'w-full pl-9')} />
        </label>
        <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value as ProjectType | 'all')} className={sel}>
          <option value="all">Tous les types</option>
          {PROJECT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        {!publishedOnly && (
          <select aria-label="Statut" value={status_} onChange={(e) => setStatus(e.target.value as TourStatus | 'all')} className={sel}>
            <option value="all">Tous les statuts</option>
            <option value="published">Publiées</option>
            <option value="outdated">Publiées · à mettre à jour</option>
            <option value="draft">Brouillons</option>
          </select>
        )}
      </div>
      <Card>
        {status !== 'ready' ? (
          <p className="px-6 py-14 text-center text-sm text-slate-500" role="status">
            Chargement…
          </p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <Box className="text-slate-300" size={32} />
            <p className="font-medium text-slate-700">{projects.length ? 'Aucune visite ne correspond aux filtres' : publishedOnly ? 'Aucune visite publiée' : 'Aucune visite'}</p>
            <p className="text-sm text-slate-500">{publishedOnly ? 'Publiez une visite depuis le Studio 3D (bouton « Publier »).' : 'Créez votre première visite pour commencer.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 font-medium">Visite</th>
                  <th className="px-3 py-3 font-medium">Statut</th>
                  <th className="px-3 py-3 font-medium">Scènes</th>
                  <th className="px-3 py-3 font-medium">Objets 3D</th>
                  <th className="px-3 py-3 font-medium">Fichiers</th>
                  <th className="px-3 py-3 font-medium">Vues ({days} j)</th>
                  <th className="px-3 py-3 font-medium">Durée moy.</th>
                  <th className="px-3 py-3 font-medium">Modifiée</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ p, views, avgDurationMs }) => {
                  const pill = STATUS_PILL[tourStatus(p)];
                  const live = p.status === 'published';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <button type="button" onClick={() => navigate(`/studio/${p.id}`)} className="flex items-center gap-3 text-left">
                          <TourCover type={p.type} className="h-11 w-16 shrink-0" />
                          <span>
                            <span className="block font-semibold text-slate-900">{p.name}</span>
                            <span className="text-xs text-slate-500">
                              {projectTypeLabel(p.type)}
                              {live && (p.visibility === 'public' ? ' · Galerie publique' : ' · Lien uniquement')}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cx('inline-flex rounded-lg px-2 py-0.5 text-xs font-medium', pill.cls)}>{pill.label}</span>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-slate-700">{p.sceneCount}</td>
                      <td className="px-3 py-3 tabular-nums text-slate-700">{p.objectCount}</td>
                      <td className="px-3 py-3 tabular-nums text-slate-700">{p.storageBytes ? formatBytes(p.storageBytes) : '—'}</td>
                      <td className="px-3 py-3 tabular-nums text-slate-700">{live ? views : '—'}</td>
                      <td className="px-3 py-3 tabular-nums text-slate-700">{live ? formatDuration(avgDurationMs) : '—'}</td>
                      <td className="px-3 py-3 text-slate-600">{new Date(p.updatedAt).toLocaleDateString('fr-FR')}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <IconAction label="Ouvrir dans le Studio 3D" onClick={() => navigate(`/studio/${p.id}`)}>
                            <Box size={16} />
                          </IconAction>
                          <IconAction label="Voir dans l’espace visiteur" disabled={!live} onClick={() => navigate(`/visite/${p.id}`)}>
                            <Eye size={16} />
                          </IconAction>
                          <IconAction label={copied === p.id ? 'Lien copié' : 'Copier le lien de partage'} disabled={!live} onClick={() => void copy(p.id)}>
                            {copied === p.id ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                          </IconAction>
                          {publishedOnly && (
                            <>
                              <IconAction
                                label={p.visibility === 'public' ? 'Retirer de la galerie publique' : 'Afficher dans la galerie publique'}
                                disabled={busy === p.id}
                                active={p.visibility === 'public'}
                                onClick={() => void toggleGallery(p.id, p.visibility)}
                              >
                                <Globe2 size={16} />
                              </IconAction>
                              <IconAction label="Dépublier" onClick={() => setUnpub({ id: p.id, name: p.name })}>
                                <EyeOff size={16} />
                              </IconAction>
                            </>
                          )}
                          <IconAction label="Supprimer" danger onClick={() => setDel({ id: p.id, name: p.name })}>
                            <Trash2 size={16} />
                          </IconAction>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {creating && <CreateTourDialog onClose={() => setCreating(false)} />}
      {del && <DeleteTourDialog tour={del} onClose={() => setDel(null)} />}
      {unpub && <UnpublishDialog tour={unpub} onClose={() => setUnpub(null)} />}
    </div>
  );
}

function UnpublishDialog({ tour, onClose }: { tour: { id: string; name: string }; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  return (
    <LightModal
      title={`Dépublier « ${tour.name} » ?`}
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
              try {
                await useWorkspace.getState().unpublish(tour.id);
                onClose();
              } catch (e) {
                setErr(e instanceof Error ? e.message : String(e));
                setBusy(false);
              }
            }}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Dépublier
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">Le lien de partage cessera de fonctionner et la visite disparaîtra de la galerie. Le projet et ses statistiques sont conservés ; vous pourrez la republier.</p>
      {err && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
    </LightModal>
  );
}

function IconAction({ label, onClick, children, disabled, danger, active }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean; danger?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={disabled ? `${label} (visite non publiée)` : label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'rounded-lg p-2 disabled:opacity-30',
        active ? 'bg-cyan-50 text-[#1E8BE0]' : 'text-slate-600',
        danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-slate-100 hover:text-slate-900',
      )}
    >
      {children}
    </button>
  );
}

export function AnalyticsPage() {
  const status = useWorkspace((s) => s.status);
  const error = useWorkspace((s) => s.error);
  const stats = useWorkspace((s) => s.stats);
  const projects = useWorkspace((s) => s.projects);
  if (status === 'error') return <LoadError message={error} />;
  const range = stats?.days ?? 30;
  const per = new Map(stats?.perProject.map((p) => [p.projectId, p]));
  const perTour = projects
    .filter((p) => p.status === 'published')
    .map((p) => ({ p, views: per.get(p.id)?.views ?? 0, visitors: per.get(p.id)?.visitors ?? 0, avgDurationMs: per.get(p.id)?.avgDurationMs ?? 0 }))
    .sort((a, b) => b.views - a.views);
  const a = stats?.audience;
  return (
    <div>
      <PageTitle
        title="Analytics"
        sub="Audience mesurée dans l’espace visiteur (sessions anonymes ; les visites de moins de 2 s ne comptent pas dans la durée)."
        action={
          <select aria-label="Période" value={range} onChange={(e) => void useWorkspace.getState().refresh(Number(e.target.value))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value={7}>7 derniers jours</option>
            <option value={30}>30 derniers jours</option>
            <option value={90}>90 derniers jours</option>
          </select>
        }
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {[
          ['Vues', (a?.views ?? 0).toLocaleString('fr-FR'), <Eye key="e" size={22} />],
          ['Visiteurs uniques', (a?.visitors ?? 0).toLocaleString('fr-FR'), <Users key="u" size={22} />],
          ['Durée moyenne', formatDuration(a?.avgDurationMs ?? 0), <BarChart3 key="b" size={22} />],
        ].map(([l, v, i]) => (
          <Card key={l as string} className="flex items-center gap-4 px-5 py-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">{i}</span>
            <span>
              <span className="block text-2xl font-bold text-slate-900">{v}</span>
              <span className="text-sm text-slate-600">{l}</span>
            </span>
          </Card>
        ))}
      </div>
      <Card className="mb-5">
        <CardHeader title="Vues par jour" />
        <div className="px-3 pb-4">{stats?.series.some((d) => d.views) ? <ViewsLineChart data={stats.series} height={240} /> : <p className="py-10 text-center text-sm text-slate-500">Aucune vue sur la période.</p>}</div>
      </Card>
      <Card>
        <CardHeader title="Par visite publiée" />
        {perTour.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-slate-500">Aucune visite publiée.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-5 py-2 font-medium">Visite</th>
                <th className="px-3 py-2 text-right font-medium">Vues</th>
                <th className="px-3 py-2 text-right font-medium">Visiteurs</th>
                <th className="px-5 py-2 text-right font-medium">Durée moy.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {perTour.map((r) => (
                <tr key={r.p.id}>
                  <td className="px-5 py-2.5 font-medium text-slate-900">{r.p.name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.views}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.visitors}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{formatDuration(r.avgDurationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const ROLE_LABEL = { owner: 'Propriétaire', admin: 'Administrateur', editor: 'Éditeur', viewer: 'Lecteur' } as const;

export function SettingsPage() {
  const me = useSession((s) => s.me);
  const org = useSession((s) => s.me?.organizations.find((o) => o.id === s.orgId));
  const demo = useWorkspace((s) => s.demo);
  const storage = useWorkspace((s) => s.stats?.storage);
  const [name, setName] = useState(me?.user.name ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [err, setErr] = useState<string>();
  const input = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#36C8F4]/40';
  return (
    <div className="max-w-2xl space-y-5">
      <PageTitle title="Paramètres" sub="Profil, organisation et mode démonstration." />
      <Card className="space-y-4 p-5">
        <h3 className="font-semibold text-slate-900">Profil</h3>
        <p className="text-sm text-slate-600">E-mail : {me?.user.email}</p>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-700">Nom affiché</span>
          <input className={input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>
        <button
          type="button"
          disabled={!name.trim() || state === 'saving'}
          onClick={async () => {
            setState('saving');
            try {
              await useSession.getState().updateName(name.trim());
              setState('saved');
              setTimeout(() => setState('idle'), 1500);
            } catch (e) {
              setErr(e instanceof Error ? e.message : String(e));
              setState('error');
            }
          }}
          className="rounded-xl bg-[#1E8BE0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {state === 'saving' ? 'Enregistrement…' : state === 'saved' ? 'Enregistré ✓' : 'Enregistrer le profil'}
        </button>
        {state === 'error' && <p role="alert" className="text-sm text-red-600">{err}</p>}
      </Card>
      <Card className="space-y-1 p-5">
        <h3 className="font-semibold text-slate-900">Organisation</h3>
        <p className="text-sm text-slate-600">
          {org?.name} · votre rôle : <b>{org ? ROLE_LABEL[org.role] : '—'}</b>
        </p>
        <p className="text-sm text-slate-600">Fichiers stockés : {storage ? formatBytes(storage.usedBytes) : '—'}. Les données sont hébergées par l’API VISORA (PostgreSQL et stockage S3).</p>
      </Card>
      <Card className="space-y-2 p-5">
        <h3 className="font-semibold text-slate-900">Mode démonstration</h3>
        <p className="text-sm text-slate-600">Affiche sur le tableau de bord un jeu de données fictif (12 visites, 842 visiteurs…) pour les présentations. Un bandeau le signale en permanence ; rien n’est enregistré.</p>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input type="checkbox" checked={demo} onChange={(e) => useWorkspace.getState().setDemo(e.target.checked)} className="h-4 w-4 accent-violet" />
          Activer les données de démonstration
        </label>
      </Card>
    </div>
  );
}

const UNAVAILABLE: Record<'ai-builder' | 'team' | 'subscription', { title: string; icon: ReactNode; text: string }> = {
  'ai-builder': {
    title: 'AI Builder',
    icon: <Sparkles size={30} />,
    text: 'La génération automatique de visites à partir de photos nécessite le pipeline de reconstruction IA (file de tâches, workers GPU), prévu dans une phase ultérieure. Les générations apparaîtront dans le tableau de bord dès qu’il sera branché.',
  },
  team: {
    title: 'Équipe & accès',
    icon: <Users size={30} />,
    text: 'Les rôles (propriétaire, administrateur, éditeur, lecteur) sont déjà appliqués par le serveur. Les invitations de membres arrivent dans la phase Collaboration : elles nécessitent l’envoi d’e-mails, non configuré.',
  },
  subscription: {
    title: 'Abonnement',
    icon: <Crown size={30} />,
    text: 'Aucun fournisseur de paiement n’est connecté : il n’existe ni plan, ni quota, ni facture. Aucune transaction fictive n’est affichée.',
  },
};

export function UnavailablePage({ id }: { id: keyof typeof UNAVAILABLE }) {
  const u = UNAVAILABLE[id];
  return (
    <Card className="mx-auto mt-6 flex max-w-xl flex-col items-center gap-3 px-8 py-12 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-[#6D5DF5]">{u.icon}</span>
      <h2 className="text-xl font-bold text-slate-900">{u.title}</h2>
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Non disponible dans cette version</span>
      <p className="text-sm leading-relaxed text-slate-600">{u.text}</p>
      <button type="button" onClick={() => navigate('/')} className="mt-2 rounded-xl bg-[#1E8BE0] px-4 py-2 text-sm font-semibold text-white">
        Retour au tableau de bord
      </button>
    </Card>
  );
}
