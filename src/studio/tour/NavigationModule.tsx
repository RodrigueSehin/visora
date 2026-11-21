import { AlertTriangle, ArrowLeftRight, ArrowRight, Clapperboard, Crosshair, Expand, Home, Map as MapIcon, Minus, MoreVertical, PlayCircle, Plus, Repeat, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Menu, MenuItem, MenuSeparator } from '../../components/common/Overlays';
import { Button, CommitInput, Field, IconButton, NumberField, Panel, Select, Toggle, cx, inputCls } from '../../components/common/ui';
import { PlanCanvas } from '../../components/plan/PlanCanvas';
import { sceneIcon } from '../../lib/sceneIcons';
import { useEditor } from '../../store/editor';
import { addConnection, homeSceneId, removeConnection, setBidirectional, unreachableScenes, updateNavLink } from '../../store/tourActions';
import type { NavLink, Scene } from '../../types';
import { SceneThumb, useSortedScenes } from './ScenesModule';

/** One entry per connection: a two-way pair is listed once. */
function useConnections() {
  const links = useEditor((s) => s.project?.navigation);
  return useMemo(() => {
    const seen = new Set<string>();
    const out: { link: NavLink; back?: NavLink }[] = [];
    for (const l of links ?? []) {
      if (l.pairId) {
        if (seen.has(l.pairId)) continue;
        seen.add(l.pairId);
        out.push({ link: l, back: links!.find((x) => x.pairId === l.pairId && x.id !== l.id) });
      } else out.push({ link: l });
    }
    return out;
  }, [links]);
}

const selectLink = (n: NavLink) => {
  const st = useEditor.getState();
  st.setActiveScene(n.sceneId);
  st.setFocus({ kind: 'nav', id: n.id });
};
const placeLink = (n: NavLink) => {
  selectLink(n);
  useEditor.getState().setPlacement({ kind: 'nav', id: n.id });
};

function PanelTabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-xl border border-navy-500/60 bg-navy-900/60 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            'flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors focus-ring',
            value === t.id ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-glow' : 'text-ink-muted hover:bg-white/5 hover:text-ink',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function NavigationPanel() {
  const scenes = useSortedScenes();
  const connections = useConnections();
  const links = useEditor((s) => s.project?.navigation ?? []);
  const focus = useEditor((s) => s.focus);
  const activeId = useEditor((s) => s.activeSceneId);
  const [tab, setTab] = useState<'connections' | 'points'>('connections');
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [both, setBoth] = useState(true);
  const byId = (id: string) => scenes.find((s) => s.id === id);
  const name = (id: string) => byId(id)?.name ?? 'Scène supprimée';
  const needle = q.trim().toLowerCase();
  const match = (n: NavLink) => !needle || `${name(n.sceneId)} ${name(n.targetSceneId)} ${n.label ?? ''}`.toLowerCase().includes(needle);
  const rows = connections.filter(({ link }) => match(link));
  const points = links.filter(match);
  const exists = from && to && connections.some(({ link, back }) => (link.sceneId === from && link.targetSceneId === to) || (back && back.sceneId === from && back.targetSceneId === to));

  return (
    <Panel className="h-full">
      <div className="space-y-3 px-4 pb-3 pt-4">
        <h2 className="text-lg font-semibold">Réseau de navigation</h2>
        <PanelTabs
          label="Réseau de navigation"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'connections', label: `Connexions (${connections.length})` },
            { id: 'points', label: `Points (${links.length})` },
          ]}
        />
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            className={cx(inputCls, 'pl-9')}
            placeholder={tab === 'connections' ? 'Rechercher une connexion…' : 'Rechercher un point…'}
            aria-label={tab === 'connections' ? 'Rechercher une connexion' : 'Rechercher un point'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-navy-500/40 overflow-y-auto px-2.5" aria-label={tab === 'connections' ? 'Connexions' : 'Points de navigation'}>
        {tab === 'connections' && rows.length === 0 && (
          <li className="px-2 py-6 text-center text-xs text-ink-faint">{connections.length ? 'Aucune connexion ne correspond.' : 'Aucune connexion : reliez vos scènes pour permettre la visite.'}</li>
        )}
        {tab === 'connections' &&
          rows.map(({ link, back }) => {
            const selected = focus?.kind === 'nav' && (focus.id === link.id || focus.id === back?.id);
            const src = byId(link.sceneId);
            return (
              <li key={link.id} className="relative py-1">
                <div className={cx('flex items-center gap-1 rounded-xl border p-1', selected ? 'border-blue-400/80 bg-blue-600/20' : 'border-transparent hover:bg-navy-700/60')}>
                  <button type="button" onClick={() => selectLink(link)} aria-current={selected} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus-ring">
                    {src ? <SceneThumb scene={src} badge={false} className="h-9 w-12 shrink-0 rounded-md" /> : <span className="h-9 w-12 shrink-0 rounded-md bg-navy-700" />}
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{name(link.sceneId)}</span>
                    {back ? <ArrowLeftRight size={16} className="shrink-0 text-emerald-400" aria-label="dans les deux sens" /> : <ArrowRight size={16} className="shrink-0 text-cyan" aria-label="sens unique" />}
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{name(link.targetSceneId)}</span>
                  </button>
                  <IconButton size="sm" label={`Actions de la connexion ${name(link.sceneId)} – ${name(link.targetSceneId)}`} active={menu === link.id} onClick={() => setMenu(menu === link.id ? null : link.id)}>
                    <MoreVertical size={15} />
                  </IconButton>
                </div>
                <Menu open={menu === link.id} onClose={() => setMenu(null)} className="w-60">
                  <MenuItem icon={<Crosshair size={14} />} onClick={() => (placeLink(link), setMenu(null))}>
                    Placer le point dans « {name(link.sceneId)} »
                  </MenuItem>
                  {back && (
                    <MenuItem icon={<Crosshair size={14} />} onClick={() => (placeLink(back), setMenu(null))}>
                      Placer le retour dans « {name(back.sceneId)} »
                    </MenuItem>
                  )}
                  <MenuItem icon={<Repeat size={14} />} onClick={() => (setBidirectional(link.id, !back), setMenu(null))}>
                    {back ? 'Passer en sens unique' : 'Rendre bidirectionnelle'}
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={<Trash2 size={14} />} danger onClick={() => (removeConnection(link.id), setMenu(null))}>
                    Supprimer la connexion
                  </MenuItem>
                </Menu>
              </li>
            );
          })}
        {tab === 'points' && points.length === 0 && <li className="px-2 py-6 text-center text-xs text-ink-faint">{links.length ? 'Aucun point ne correspond.' : 'Aucun point de navigation.'}</li>}
        {tab === 'points' &&
          points.map((n) => {
            const selected = focus?.kind === 'nav' && focus.id === n.id;
            const Icon = sceneIcon(byId(n.targetSceneId)?.icon);
            return (
              <li key={n.id} className="py-1">
                <button
                  type="button"
                  onClick={() => selectLink(n)}
                  aria-current={selected}
                  className={cx('flex w-full items-center gap-2.5 rounded-xl border px-2 py-1.5 text-left focus-ring', selected ? 'border-blue-400/80 bg-blue-600/20' : 'border-transparent hover:bg-navy-700/60')}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet to-blue-600 text-white">
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">{n.label || name(n.targetSceneId)}</span>
                    <span className="block truncate text-[11px] text-ink-muted">
                      Dans « {name(n.sceneId)} »{n.sceneId === activeId ? ' · scène affichée' : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
      </ul>
      <div className="p-3">
        {adding ? (
          <form
            className="space-y-2 rounded-xl border border-navy-500/60 p-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!from || !to || from === to || exists) return;
              addConnection(from, to, both);
              useEditor.getState().setActiveScene(from);
              setAdding(false);
            }}
          >
            <Select label="Depuis" value={from} onChange={setFrom} options={[{ value: '', label: 'Depuis la scène…' }, ...scenes.map((s) => ({ value: s.id, label: s.name }))]} />
            <Select label="Vers" value={to} onChange={setTo} options={[{ value: '', label: 'Vers la scène…' }, ...scenes.filter((s) => s.id !== from).map((s) => ({ value: s.id, label: s.name }))]} />
            <Toggle label="Dans les deux sens" hint="Crée aussi le point de retour" checked={both} onChange={setBoth} />
            {exists && <p className="text-xs text-amber-300">Cette connexion existe déjà.</p>}
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setAdding(false)}>
                Annuler
              </Button>
              <Button variant="primary" className="flex-1" type="submit" disabled={!from || !to || from === to || !!exists}>
                Créer
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            disabled={scenes.length < 2}
            title={scenes.length < 2 ? 'Il faut au moins deux scènes' : undefined}
            onClick={() => (setFrom(activeId), setTo(''), setAdding(true))}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-2.5 text-sm font-semibold text-white shadow-glow hover:brightness-110 focus-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={18} /> Ajouter une connexion
          </button>
        )}
      </div>
    </Panel>
  );
}

type InspectorTab = 'connection' | 'point' | 'tours';

function Switch({ label, checked, onChange, disabled, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  return (
    <div className={cx('flex items-center justify-between gap-3 py-1.5', disabled && 'opacity-60')} title={hint}>
      <span className="text-sm text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors focus-ring disabled:cursor-not-allowed', checked ? 'bg-blue-500' : 'bg-navy-500')}
      >
        <span className={cx('absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}

function IconSelect<T extends string>({ icon, label, value, onChange, options }: { icon: ReactNode; label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink">{icon}</span>
      <select aria-label={label} className={cx(inputCls, 'pl-10')} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

export function NavigationInspector() {
  const focus = useEditor((s) => s.focus);
  const links = useEditor((s) => s.project?.navigation);
  const scenes = useSortedScenes();
  const [tab, setTab] = useState<InspectorTab>('connection');
  const link = focus?.kind === 'nav' ? links?.find((n) => n.id === focus.id) : undefined;
  const close = () => useEditor.getState().togglePanel('inspector', false);
  const header = (
    <div className="flex items-center justify-between px-4 pb-3 pt-4">
      <h2 className="text-lg font-semibold">Propriétés de la navigation</h2>
      <IconButton label="Fermer le panneau" onClick={close}>
        <X size={18} />
      </IconButton>
    </div>
  );
  if (!link)
    return (
      <Panel className="h-full">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <ArrowLeftRight className="text-ink-faint" size={26} />
          <p className="text-sm text-ink">Aucune connexion sélectionnée</p>
          <p className="text-xs text-ink-muted">Sélectionnez une connexion dans la liste ou un point de navigation dans la vue.</p>
        </div>
      </Panel>
    );
  const back = link.pairId ? links?.find((n) => n.pairId === link.pairId && n.id !== link.id) : undefined;
  const src = scenes.find((s) => s.id === link.sceneId);
  const dst = scenes.find((s) => s.id === link.targetSceneId);
  const showTarget = link.showTarget !== false;

  return (
    <Panel className="h-full">
      {header}
      <div className="px-3 pb-3">
        <PanelTabs
          label="Propriétés de la navigation"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'connection', label: 'Connexion' },
            { id: 'point', label: 'Point' },
            { id: 'tours', label: 'Parcours' },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4" role="tabpanel">
        <section className="space-y-2">
          <h3 className="text-[15px] font-semibold text-ink">Connexion sélectionnée</h3>
          <div className="flex items-center gap-2 rounded-xl border border-navy-500/50 bg-navy-900/40 p-2">
            <SceneCard scene={src} />
            <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', back ? 'bg-emerald-500 text-navy-950' : 'bg-cyan text-navy-950')}>
              {back ? <ArrowLeftRight size={18} aria-label="dans les deux sens" /> : <ArrowRight size={18} aria-label="sens unique" />}
            </span>
            <SceneCard scene={dst} />
          </div>
        </section>

        {tab === 'connection' && (
          <>
            <Field label="Type de connexion">
              <IconSelect
                icon={<Repeat size={17} />}
                label="Type de connexion"
                value={back ? 'both' : 'one'}
                onChange={(v) => setBidirectional(link.id, v === 'both')}
                options={[
                  { value: 'both', label: 'Navigation bidirectionnelle' },
                  { value: 'one', label: 'Sens unique' },
                ]}
              />
            </Field>
            <Field label="Transition">
              <IconSelect
                icon={<Clapperboard size={17} />}
                label="Transition"
                value={link.transition}
                onChange={(t) => updateNavLink(link.id, { transition: t }, 'Transition')}
                options={[
                  { value: 'fade', label: 'Fondu doux' },
                  { value: 'none', label: 'Immédiate' },
                ]}
              />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink">Durée de transition</span>
              <span className="w-28">
                <NumberField
                  label="Durée de transition (secondes)"
                  value={link.transition === 'fade' ? link.durationMs / 1000 : 0}
                  step={0.1}
                  min={0.2}
                  suffix="s"
                  disabled={link.transition !== 'fade'}
                  onCommit={(v) => updateNavLink(link.id, { durationMs: Math.round(Math.max(0.2, Math.min(5, v)) * 1000) }, 'Durée de transition')}
                />
              </span>
            </div>
            <div>
              <Switch
                label="Afficher la flèche au sol"
                checked={link.showArrow}
                disabled={link.showArrow && !showTarget}
                hint={link.showArrow && !showTarget ? 'Un repère au moins doit rester visible' : undefined}
                onChange={(v) => updateNavLink(link.id, { showArrow: v }, 'Flèche au sol')}
              />
              <Switch
                label="Afficher la cible de navigation"
                checked={showTarget}
                disabled={showTarget && !link.showArrow}
                hint={showTarget && !link.showArrow ? 'Un repère au moins doit rester visible' : undefined}
                onChange={(v) => updateNavLink(link.id, { showTarget: v }, 'Cible de navigation')}
              />
              <Switch label="Autoriser le retour" checked={!!back} onChange={(v) => setBidirectional(link.id, v)} />
            </div>
          </>
        )}

        {tab === 'point' && (
          <>
            <Field label="Scène de destination">
              <Select
                label="Scène de destination"
                value={link.targetSceneId}
                onChange={(t) => updateNavLink(link.id, { targetSceneId: t }, 'Changer la destination')}
                options={scenes.filter((s) => s.id !== link.sceneId).map((s) => ({ value: s.id, label: s.name }))}
              />
            </Field>
            <Field label="Libellé du point" hint="Par défaut : nom de la scène de destination">
              <CommitInput value={link.label ?? ''} placeholder={dst?.name} maxLength={60} aria-label="Libellé" onCommit={(v) => updateNavLink(link.id, { label: v.trim() || undefined }, 'Libellé du point')} />
            </Field>
            <div className="space-y-2">
              <Button className="w-full" onClick={() => placeLink(link)}>
                <Crosshair size={14} /> Placer le point dans « {src?.name} »
              </Button>
              {back && (
                <Button className="w-full" onClick={() => placeLink(back)}>
                  <Crosshair size={14} /> Placer le retour dans « {dst?.name} »
                </Button>
              )}
              <p className="text-[11px] text-ink-faint">Cliquez ensuite sur le sol, un mur ou l’image 360° à l’endroit voulu.</p>
            </div>
          </>
        )}

        {tab === 'tours' && <ToursUsing link={link} back={back} />}
      </div>
      <div className="p-3">
        <button
          type="button"
          onClick={() => removeConnection(link.id)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/70 bg-red-500/10 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/20 focus-ring"
        >
          <Trash2 size={17} /> Supprimer cette connexion
        </button>
      </div>
    </Panel>
  );
}

function SceneCard({ scene }: { scene?: Scene }) {
  return (
    <div className="min-w-0 flex-1 text-center">
      {scene ? <SceneThumb scene={scene} className="h-[66px] w-full rounded-lg" /> : <div className="h-[66px] w-full rounded-lg bg-navy-700" />}
      <p className="mt-1 truncate text-[13px] text-ink">{scene?.name ?? 'Scène supprimée'}</p>
    </div>
  );
}

/** Guided tours whose consecutive steps follow this connection. */
function ToursUsing({ link, back }: { link: NavLink; back?: NavLink }) {
  const tours = useEditor((s) => s.project?.guidedTours ?? []);
  const pairs = [link, back].filter((n): n is NavLink => !!n).map((n) => `${n.sceneId}>${n.targetSceneId}`);
  const using = tours.filter((t) => t.steps.some((st, i) => i > 0 && pairs.includes(`${t.steps[i - 1].sceneId}>${st.sceneId}`)));
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-ink">Parcours guidés empruntant cette connexion</h3>
      {using.length ? (
        <ul className="space-y-1">
          {using.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-lg border border-navy-500/50 px-2.5 py-2 text-sm">
              <PlayCircle size={16} className="shrink-0 text-violet-400" />
              <span className="flex-1 truncate">{t.name}</span>
              <span className="text-xs text-ink-muted">{t.steps.length} étapes</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">{tours.length ? 'Aucun parcours ne passe par cette connexion.' : 'Aucun parcours guidé dans ce projet.'}</p>
      )}
      <Button size="sm" className="w-full" onClick={() => useEditor.getState().setModule('tour')}>
        <PlayCircle size={14} /> Ouvrir le module Parcours guidé
      </Button>
    </section>
  );
}

/** Below the viewport: site plan of the current floor and the navigation graph. */
export function NavigationBottom() {
  return (
    <div className="grid h-[210px] shrink-0 grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3">
      <SitePlanCard />
      <NavigationGraph />
    </div>
  );
}

function SitePlanCard() {
  const plans = useEditor((s) => s.project?.floorPlans);
  const scenes = useEditor((s) => s.project?.scenes);
  const navigation = useEditor((s) => s.project?.navigation);
  const active = useEditor((s) => s.activeSceneId);
  const [zoom, setZoom] = useState(1);
  const plan = (plans ?? []).find((p) => p.markers.some((m) => m.sceneId === active)) ?? (plans ?? []).find((p) => p.imageFileId);
  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-navy-500/50 bg-navy-800/90 p-2.5" aria-label="Plan 2D du site">
      <div className="flex items-center justify-between px-1 pb-1.5">
        <h3 className="truncate text-[15px] font-semibold">Plan 2D du site{plan && (plans?.length ?? 0) > 1 ? ` · ${plan.name}` : ''}</h3>
        <IconButton size="sm" label="Ouvrir le module Plan 2D" onClick={() => useEditor.getState().setModule('plan')}>
          <Expand size={15} />
        </IconButton>
      </div>
      {plan ? (
        <div className="relative min-h-0 flex-1 overflow-auto rounded-lg bg-white/95">
          <PlanCanvas plan={plan} scenes={scenes ?? []} navigation={navigation ?? []} activeSceneId={active} zoom={zoom} onSceneClick={(id) => useEditor.getState().setActiveScene(id)} />
          <div className="sticky bottom-1 float-right mr-1 flex flex-col overflow-hidden rounded-lg border border-navy-500 bg-navy-900/90">
            <button type="button" aria-label="Zoom avant sur le plan" className="p-1 text-ink hover:bg-navy-700" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
              <Plus size={14} />
            </button>
            <button type="button" aria-label="Zoom arrière sur le plan" className="p-1 text-ink hover:bg-navy-700" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
              <Minus size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <MapIcon size={22} className="text-ink-faint" />
          <p className="text-xs text-ink-muted">Aucun plan pour ce site.</p>
          <Button size="sm" onClick={() => useEditor.getState().setModule('plan')}>
            Ajouter un plan
          </Button>
        </div>
      )}
    </section>
  );
}

/** Layered graph from the home scene (BFS depth = column). Unreachable scenes are flagged. */
export function NavigationGraph() {
  const project = useEditor((s) => s.project);
  const active = useEditor((s) => s.activeSceneId);
  const layout = useMemo(() => {
    if (!project) return null;
    const home = homeSceneId(project)!;
    const depth = new Map<string, number>([[home, 0]]);
    const queue = [home];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of project.navigation ?? [])
        if (n.sceneId === cur && !depth.has(n.targetSceneId)) {
          depth.set(n.targetSceneId, depth.get(cur)! + 1);
          queue.push(n.targetSceneId);
        }
    }
    const maxDepth = Math.max(0, ...depth.values());
    const cols = new Map<number, string[]>();
    for (const s of [...project.scenes].sort((a, b) => a.order - b.order)) {
      const d = depth.has(s.id) ? depth.get(s.id)! : maxDepth + 1;
      cols.set(d, [...(cols.get(d) ?? []), s.id]);
    }
    const W = 104;
    const H = 40;
    const GAP = 30;
    const pos = new Map<string, { x: number; y: number }>();
    let maxRows = 1;
    for (const ids of cols.values()) maxRows = Math.max(maxRows, ids.length);
    const height = 16 + maxRows * (H + 10);
    for (const [d, ids] of cols) {
      const top = (height - ids.length * (H + 10)) / 2 + 5;
      ids.forEach((id, i) => pos.set(id, { x: 12 + d * (W + GAP), y: top + i * (H + 10) }));
    }
    return { home, pos, W, H, width: 24 + cols.size * (W + GAP), height, unreachable: new Set(unreachableScenes(project)) };
  }, [project]);
  if (!project || !layout) return null;
  const { pos, W, H } = layout;
  const edges = (project.navigation ?? []).filter((n) => pos.has(n.sceneId) && pos.has(n.targetSceneId) && (!n.pairId || n.sceneId < n.targetSceneId || !project.navigation!.some((x) => x.pairId === n.pairId && x.id !== n.id)));
  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-navy-500/50 bg-navy-800/90 p-2.5" aria-label="Graphe de navigation">
      <div className="flex items-center justify-between gap-2 px-1 pb-1">
        <h3 className="text-[15px] font-semibold">Graphe de navigation</h3>
        {layout.unreachable.size > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-300">
            <AlertTriangle size={11} /> {layout.unreachable.size} inaccessible(s)
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <svg width={layout.width} height={layout.height} role="img" aria-label="Graphe des connexions entre scènes">
          <defs>
            <marker id="nav-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#3B82F6" />
            </marker>
            {/* User-space region: a relative one collapses on straight horizontal edges (zero-height bounding box). */}
            <filter id="nav-glow" filterUnits="userSpaceOnUse" x={-20} y={-20} width={layout.width + 40} height={layout.height + 40}>
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {edges.map((n) => {
            const a = pos.get(n.sceneId)!;
            const b = pos.get(n.targetSceneId)!;
            const forward = b.x >= a.x;
            const x1 = forward ? a.x + W : a.x;
            const x2 = forward ? b.x : b.x + W;
            const y1 = a.y + H / 2;
            const y2 = b.y + H / 2;
            const mx = (x1 + x2) / 2;
            const two = !!n.pairId && project.navigation!.some((x) => x.pairId === n.pairId && x.id !== n.id);
            return (
              <path
                key={n.id}
                d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                fill="none"
                stroke="#3B82F6"
                strokeWidth={2}
                filter="url(#nav-glow)"
                markerEnd="url(#nav-arrow)"
                markerStart={two ? 'url(#nav-arrow)' : undefined}
              />
            );
          })}
          {project.scenes.map((s) => {
            const p = pos.get(s.id)!;
            const bad = layout.unreachable.has(s.id);
            const isHome = s.id === layout.home;
            const isActive = s.id === active;
            const Icon = isHome ? Home : sceneIcon(s.icon);
            return (
              <g key={s.id} transform={`translate(${p.x},${p.y})`} className="cursor-pointer" onClick={() => useEditor.getState().setActiveScene(s.id)}>
                <rect
                  width={W}
                  height={H}
                  rx={10}
                  fill={isHome ? '#1D4ED8' : isActive ? '#1E3A5F' : '#101827'}
                  stroke={bad ? '#F59E0B' : isActive || isHome ? '#60A5FA' : '#33496F'}
                  strokeWidth={isActive ? 2 : 1}
                  strokeDasharray={s.hidden ? '4 3' : undefined}
                  filter={isHome || isActive ? 'url(#nav-glow)' : undefined}
                />
                <Icon x={8} y={H / 2 - 7} width={14} height={14} color="#FFFFFF" />
                <text x={27} y={H / 2 + 4} className="fill-white text-[11px]">
                  {s.name.length > 12 ? `${s.name.slice(0, 11)}…` : s.name}
                </text>
                <title>{bad ? `${s.name} — inaccessible depuis la scène d’accueil` : s.name}</title>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
