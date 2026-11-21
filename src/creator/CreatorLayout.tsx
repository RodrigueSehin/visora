import {
  BarChart3,
  Bell,
  Box,
  ChevronDown,
  Cloud,
  Compass,
  Crown,
  FlaskConical,
  HelpCircle,
  Home,
  LayoutList,
  Menu as MenuIcon,
  Send,
  Settings,
  Sparkles,
  Users,
  X,
  ArrowRight,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { formatBytes } from '../lib/format';
import { navigate, type Route } from '../router';
import { useSession } from '../store/session';
import { useWorkspace } from '../store/workspace';
import { DEMO } from './demoData';
import { cx } from '../components/common/ui';

type Page = Extract<Route, { space: 'creator' }>['page'];

const NAV: { id: Page | 'studio'; label: string; icon: ReactNode; badge?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Home size={19} /> },
  { id: 'tours', label: 'Mes visites', icon: <LayoutList size={19} /> },
  { id: 'ai-builder', label: 'AI Builder', icon: <Sparkles size={19} />, badge: 'IA' },
  { id: 'studio', label: 'Studio 3D', icon: <Box size={19} /> },
  { id: 'publications', label: 'Publications', icon: <Send size={19} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={19} /> },
  { id: 'team', label: 'Équipe & accès', icon: <Users size={19} /> },
  { id: 'subscription', label: 'Abonnement', icon: <Crown size={19} /> },
  { id: 'settings', label: 'Paramètres', icon: <Settings size={19} /> },
];

export function VisoraMark({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="vmark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#36C8F4" />
          <stop offset="1" stopColor="#7868F5" />
        </linearGradient>
      </defs>
      <path d="M6 4 L35 20 L6 36 L13 20 Z" fill="url(#vmark)" />
      <path d="M13 20 L35 20 L6 36 Z" fill="#0B1220" opacity="0.28" />
    </svg>
  );
}

export function CreatorLayout({ page, children }: { page: Page; children: ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false);
  const demo = useWorkspace((s) => s.demo);

  useEffect(() => setMobileNav(false), [page]);

  const go = (id: (typeof NAV)[number]['id']) => {
    if (id === 'studio') return navigate('/studio');
    navigate(id === 'dashboard' ? '/' : `/${id}`);
  };

  const sidebar = (
    <aside className="flex h-full w-[288px] flex-col bg-gradient-to-b from-[#0B1530] via-[#0E1A33] to-[#0B1220] px-3 pb-3 pt-5 text-white">
      <button type="button" onClick={() => navigate('/')} className="mb-6 flex items-center gap-2.5 px-2 text-left focus-ring">
        <VisoraMark />
        <span>
          <span className="block text-[26px] font-bold leading-none tracking-wide">VISORA</span>
          <span className="block text-[11px] text-slate-300">Explore spaces. From anywhere.</span>
        </span>
      </button>
      <nav aria-label="Espace créateur" className="flex-1 space-y-1 overflow-y-auto">
        {NAV.map((n) => {
          const active = n.id === page;
          return (
            <button
              key={n.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => go(n.id)}
              className={cx(
                'flex w-full items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-[15px] font-medium transition-colors focus-ring',
                active ? 'bg-gradient-to-r from-[#1E8BE0] to-[#36C8F4] text-white shadow-[0_6px_20px_rgba(54,200,244,.35)]' : 'text-slate-200 hover:bg-white/5',
              )}
            >
              <span className={active ? 'text-white' : 'text-slate-300'}>{n.icon}</span>
              <span className="flex-1 text-left">{n.label}</span>
              {n.badge && <span className="rounded-full bg-violet px-2 py-0.5 text-[11px] font-semibold text-white">{n.badge}</span>}
            </button>
          );
        })}
      </nav>
      <StorageCard />
      <PlanCard />
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F3F6FB]">
      <div className="hidden lg:block">{sidebar}</div>
      {mobileNav && (
        <div className="fixed inset-0 z-50 flex lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setMobileNav(false)} style={{ background: 'rgba(11,18,32,.5)' }}>
          <div className="relative h-full">
            {sidebar}
            <button type="button" aria-label="Fermer le menu" onClick={() => setMobileNav(false)} className="absolute right-3 top-4 rounded-md p-1 text-slate-300 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {demo && (
          <div role="status" className="flex items-center justify-center gap-2 bg-violet px-4 py-1.5 text-center text-xs font-medium text-white">
            <FlaskConical size={14} /> Mode démonstration : les chiffres affichés sont fictifs et ne sont pas enregistrés.
            <button type="button" className="underline underline-offset-2" onClick={() => useWorkspace.getState().setDemo(false)}>
              Désactiver
            </button>
          </div>
        )}
        <CreatorHeader onMenu={() => setMobileNav(true)} />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 pb-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

function CreatorHeader({ onMenu }: { onMenu: () => void }) {
  const demo = useWorkspace((s) => s.demo);
  const me = useSession((s) => s.me);
  const org = useSession((s) => s.me?.organizations.find((o) => o.id === s.orgId));
  const profile = demo ? DEMO.profile : { name: me?.user.name ?? '', organization: org?.name ?? '' };
  const [open, setOpen] = useState<'bell' | 'help' | 'profile' | null>(null);
  const initials = (profile.name || 'Créateur')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const toggle = (m: typeof open) => setOpen((o) => (o === m ? null : m));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !(e.target as HTMLElement).closest('[data-header-menu]') && setOpen(null);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  const pop = 'absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 text-sm text-slate-700 shadow-xl';
  const iconBtn = 'relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus-ring';

  return (
    <header className="mx-auto flex w-full max-w-[1500px] items-center gap-3 px-4 pb-4 pt-5 sm:px-6">
      <button type="button" aria-label="Ouvrir le menu" onClick={onMenu} className="rounded-lg p-2 text-slate-700 hover:bg-white lg:hidden">
        <MenuIcon size={22} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold text-slate-900 sm:text-[28px]">
          Bonjour{profile.name ? ` ${profile.name.split(' ').slice(-1)[0]}` : ''} <span aria-hidden>👋</span>
        </h1>
        <p className="hidden text-[15px] text-slate-600 sm:block">Bienvenue sur VISORA, votre plateforme de visites virtuelles immersives.</p>
      </div>
      <button type="button" onClick={() => navigate('/explorer')} className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-ring md:flex">
        <Compass size={16} className="text-cyan-600" /> Espace visiteur
      </button>
      <div className="relative" data-header-menu>
        <button type="button" aria-label="Notifications" aria-expanded={open === 'bell'} className={iconBtn} onClick={() => toggle('bell')}>
          <Bell size={19} />
        </button>
        {open === 'bell' && (
          <div className={pop}>
            <p className="px-2 py-1 font-semibold text-slate-900">Notifications</p>
            <p className="px-2 py-3 text-slate-500">Aucune notification. Les alertes de publication et de traitement IA apparaîtront ici.</p>
          </div>
        )}
      </div>
      <div className="relative hidden sm:block" data-header-menu>
        <button type="button" aria-label="Aide" aria-expanded={open === 'help'} className={iconBtn} onClick={() => toggle('help')}>
          <HelpCircle size={19} />
        </button>
        {open === 'help' && (
          <div className={pop}>
            <p className="px-2 py-1 font-semibold text-slate-900">Bien démarrer</p>
            <ol className="list-decimal space-y-1.5 py-2 pl-7 pr-2 text-slate-600">
              <li>Créez une visite et choisissez son type.</li>
              <li>Composez les scènes dans le Studio 3D.</li>
              <li>Publiez, puis partagez le lien de l’espace visiteur.</li>
            </ol>
          </div>
        )}
      </div>
      <div className="relative" data-header-menu>
        <button
          type="button"
          aria-expanded={open === 'profile'}
          onClick={() => toggle('profile')}
          className="flex items-center gap-3 rounded-full py-1 pl-1 pr-2 hover:bg-white focus-ring sm:border-l sm:border-slate-200 sm:pl-4"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#1E8BE0] to-violet text-sm font-bold text-white">{initials}</span>
          <span className="hidden text-left md:block">
            <span className="block text-[15px] font-semibold text-slate-900">{profile.name || 'Mon profil'}</span>
            <span className="block max-w-[180px] truncate text-xs uppercase text-slate-500">{profile.organization}</span>
          </span>
          <ChevronDown size={18} className="hidden text-slate-500 md:block" />
        </button>
        {open === 'profile' && (
          <div className={pop}>
            <button type="button" className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-slate-100" onClick={() => (navigate('/settings'), setOpen(null))}>
              Profil et paramètres
            </button>
            <button type="button" className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-slate-100" onClick={() => (navigate('/explorer'), setOpen(null))}>
              Ouvrir l’espace visiteur
            </button>
            <label className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 hover:bg-slate-100">
              Mode démonstration
              <input type="checkbox" checked={demo} onChange={(e) => useWorkspace.getState().setDemo(e.target.checked)} className="h-4 w-4 accent-violet" />
            </label>
            <div className="my-1 h-px bg-slate-200" />
            {me && <p className="truncate px-2.5 py-1 text-xs text-slate-500">{me.user.email}</p>}
            <button
              type="button"
              className="w-full rounded-lg px-2.5 py-2 text-left text-red-600 hover:bg-red-50"
              onClick={async () => {
                setOpen(null);
                await useSession.getState().logout();
                navigate('/login');
              }}
            >
              Se déconnecter
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function StorageCard() {
  const demo = useWorkspace((s) => s.demo);
  const real = useWorkspace((s) => s.stats?.storage);
  const st = demo ? DEMO.storage : { used: real?.usedBytes, quota: real?.quotaBytes ?? undefined };
  const pct = st.used != null && st.quota ? Math.min(100, (st.used / st.quota) * 100) : 0;
  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-3">
        <Cloud size={30} className="text-cyan" />
        <div className="min-w-0">
          <p className="font-semibold">Stockage</p>
          <p className="truncate text-sm text-slate-300">
            {st.used == null ? '—' : st.quota ? `${formatBytes(st.used)} / ${formatBytes(st.quota)}` : `${formatBytes(st.used)} utilisés`}
          </p>
        </div>
      </div>
      {/* No plan quota exists yet: the bar is only shown when a quota is known. */}
      {st.quota ? <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Stockage utilisé">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan to-[#1E8BE0]" style={{ width: `${Math.max(pct, st.used ? 2 : 0)}%` }} />
        </div>
        <span className="text-sm tabular-nums">{pct < 1 && pct > 0 ? '<1' : Math.round(pct)} %</span>
      </div> : <p className="mt-2 text-xs text-slate-400">Aucun quota défini (pas d’abonnement)</p>}
    </div>
  );
}

function PlanCard() {
  const demo = useWorkspace((s) => s.demo);
  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-3">
        <Crown size={30} className="text-amber-400" />
        <div>
          <p className="font-semibold">{demo ? DEMO.plan.name : 'Aucun abonnement'}</p>
          <p className="text-sm text-slate-300">{demo ? `Échéance : ${DEMO.plan.renewal}` : 'Facturation non connectée'}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate('/subscription')}
        className="mt-3 flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium hover:bg-white/15 focus-ring"
      >
        Gérer mon abonnement <ArrowRight size={17} />
      </button>
    </div>
  );
}
