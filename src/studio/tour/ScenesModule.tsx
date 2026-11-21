import { AlertTriangle, Box, Camera, Copy, EyeOff, GripVertical, Home, ImagePlus, Info, Loader2, Orbit, Plus, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Menu, MenuItem } from '../../components/common/Overlays';
import { Button, CommitInput, Field, IconButton, NumberField, Panel, Select, cx, inputCls } from '../../components/common/ui';
import { SceneThumb } from '../../components/viewport/SceneThumb';
import { SCENE_ICONS, sceneIcon } from '../../lib/sceneIcons';
import { viewport } from '../../three/registry';
import { useEditor } from '../../store/editor';
import { addScene, deleteSceneDeep, duplicateScene, homeSceneId, reorderScene, setHomeScene, unreachableScenes, updateNavLink, updateScene } from '../../store/tourActions';
import type { EnvironmentPreset, Scene, SceneIcon, SceneTransition } from '../../types';
import { MediaField, MediaPicker } from '../media/MediaPicker';
import { useMedia } from '../media/mediaStore';

export { SceneThumb };

const ENV_LABEL: Record<EnvironmentPreset, string> = { warehouse: 'Entrepôt', office: 'Bureau', showroom: 'Showroom', empty: 'Vide' };

/** Confirmed, undoable deletion of a scene with everything that belongs to it. */
async function confirmDeleteScene(s: Scene) {
  const p = useEditor.getState().project;
  if (!p) return;
  const objects = p.objects.filter((o) => o.sceneId === s.id && o.kind === 'object').length;
  const hotspots = (p.hotspots ?? []).filter((h) => h.sceneId === s.id).length;
  const ok = await useEditor.getState().confirm({
    title: `Supprimer la scène « ${s.name} » ?`,
    message: `Ses ${objects} objet(s), ${hotspots} hotspot(s) et les points de navigation qui y mènent seront supprimés. Action annulable avec Ctrl+Z.`,
    confirmLabel: 'Supprimer',
    danger: true,
  });
  if (ok) deleteSceneDeep(s.id);
}

const sceneMatches = (s: Scene, q: string) => {
  const n = q.trim().toLowerCase();
  return !n || s.name.toLowerCase().includes(n) || (s.tags ?? []).some((t) => t.toLowerCase().includes(n));
};

export function ScenesPanel() {
  const project = useEditor((s) => s.project);
  const active = useEditor((s) => s.activeSceneId);
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const [picking, setPicking] = useState(false);
  const [drag, setDrag] = useState<{ id: string; over: number } | null>(null);
  if (!project) return null;
  const home = homeSceneId(project);
  const isolated = new Set(unreachableScenes(project));
  const all = [...project.scenes].sort((a, b) => a.order - b.order);
  const scenes = all.filter((s) => sceneMatches(s, q));
  const filtering = !!q.trim();

  return (
    <Panel className="h-full">
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <h2 className="text-lg font-semibold">Scènes ({project.scenes.length})</h2>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label="Ajouter une scène"
            title="Ajouter une scène"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-glow hover:brightness-110 focus-ring"
          >
            <Plus size={20} />
          </button>
          <Menu open={menu} onClose={() => setMenu(false)}>
            <MenuItem icon={<Box size={14} />} onClick={() => (addScene('environment'), setMenu(false))}>
              Scène 3D (environnement modélisé)
            </MenuItem>
            <MenuItem icon={<Orbit size={14} />} onClick={() => (setPicking(true), setMenu(false))}>
              Scène 360° (panorama)
            </MenuItem>
          </Menu>
        </div>
      </div>
      <div className="relative px-4 pb-3">
        <Search size={15} className="pointer-events-none absolute left-7 top-[18px] -translate-y-1/2 text-ink-muted" />
        <input className={cx(inputCls, 'pl-9')} placeholder="Rechercher une scène…" aria-label="Rechercher une scène (nom ou tag)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2.5 pb-3" aria-label="Scènes, dans l’ordre de la visite">
        {scenes.map((s) => {
          const index = all.indexOf(s);
          const isHome = s.id === home;
          const isActive = s.id === active;
          const dropHere = drag && drag.over === index && drag.id !== s.id;
          return (
            <li
              key={s.id}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                if (drag.over !== index) setDrag({ ...drag, over: index });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (drag) reorderScene(drag.id, index);
                setDrag(null);
              }}
              className={cx('relative', dropHere && 'before:absolute before:inset-x-2 before:-top-0.5 before:h-0.5 before:rounded before:bg-blue-400')}
            >
              <div
                className={cx(
                  'group flex items-center gap-2 rounded-xl border p-1 pr-0.5 transition-colors',
                  isActive ? 'border-blue-400/80 bg-gradient-to-r from-blue-600/90 to-violet/80 shadow-glow' : 'border-transparent hover:bg-navy-700/60',
                  drag?.id === s.id && 'opacity-40',
                )}
              >
                <button
                  type="button"
                  onClick={() => useEditor.getState().setActiveScene(s.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus-ring"
                  aria-current={isActive}
                >
                  <SceneThumb scene={s} className="h-[46px] w-[76px] shrink-0 rounded-lg" />
                  {isHome ? (
                    <Home size={18} className="shrink-0 text-white" aria-label="Scène d’accueil" />
                  ) : (
                    <span className={cx('flex h-6 min-w-[26px] shrink-0 items-center justify-center rounded-md text-[12px] font-semibold tabular-nums', isActive ? 'bg-white/20 text-white' : 'bg-navy-700 text-ink-muted')}>
                      {String(all.filter((x) => x.id !== home).indexOf(s) + 1).padStart(2, '0')}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cx('flex items-center gap-1 text-[14px] font-medium leading-tight', isActive ? 'text-white' : 'text-ink')}>
                      <span className="line-clamp-2">{s.name}</span>
                      {s.hidden && <EyeOff size={12} className="shrink-0 opacity-70" aria-label="Masquée aux visiteurs" />}
                      {isolated.has(s.id) && !s.hidden && <AlertTriangle size={12} className="shrink-0 text-amber-400" aria-label="Inaccessible depuis l’accueil" />}
                    </span>
                    {isHome && <span className={cx('block text-[12px]', isActive ? 'text-white/85' : 'text-ink-muted')}>Accueil</span>}
                  </span>
                </button>
                <button
                  type="button"
                  draggable={!filtering}
                  disabled={filtering}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', s.id);
                    setDrag({ id: s.id, over: index });
                  }}
                  onDragEnd={() => setDrag(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      reorderScene(s.id, index + (e.key === 'ArrowUp' ? -1 : 1));
                    }
                  }}
                  aria-label={`Réorganiser « ${s.name} » (glisser, ou flèches haut/bas)`}
                  title={filtering ? 'Effacez la recherche pour réorganiser' : 'Glisser pour réorganiser · flèches haut/bas'}
                  className={cx('flex h-9 w-6 shrink-0 cursor-grab items-center justify-center rounded-md focus-ring active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30', isActive ? 'text-white/80' : 'text-ink-faint hover:text-ink')}
                >
                  <GripVertical size={16} />
                </button>
              </div>
            </li>
          );
        })}
        {!scenes.length && <li className="px-3 py-6 text-center text-sm text-ink-muted">Aucune scène ne correspond à « {q} ».</li>}
      </ul>
      {picking && (
        <MediaPicker
          kinds={['panorama']}
          title="Choisir le panorama 360° de la nouvelle scène"
          onClose={() => setPicking(false)}
          onPick={(m) => {
            addScene('panorama', { panoramaFileId: m.id, name: m.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') });
            setPicking(false);
          }}
        />
      )}
    </Panel>
  );
}

type Tab = 'general' | 'camera' | 'transitions' | 'advanced';
const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'Général' },
  { id: 'camera', label: 'Vue & caméra' },
  { id: 'transitions', label: 'Transitions' },
  { id: 'advanced', label: 'Avancé' },
];

function Switch({ label, checked, onChange, disabled, info }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; info?: string }) {
  return (
    <div className={cx('flex items-center justify-between gap-3 py-1.5', disabled && 'opacity-60')}>
      <span className="flex items-center gap-1.5 text-sm text-ink">
        {label}
        {info && (
          <span title={info} className="text-ink-muted" aria-label={info} role="img">
            <Info size={14} />
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors focus-ring disabled:cursor-not-allowed', checked ? 'bg-emerald-500' : 'bg-navy-500')}
      >
        <span className={cx('absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}

function Card({ title, icon, children }: { title?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-navy-500/50 bg-navy-900/40 p-3">
      {title && (
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          {icon}
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

export function SceneInspector() {
  const project = useEditor((s) => s.project);
  const scene = useEditor((s) => s.project?.scenes.find((x) => x.id === s.activeSceneId));
  const [tab, setTab] = useState<Tab>('general');
  if (!project || !scene) return null;
  return (
    <Panel className="h-full">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-lg font-semibold">Propriétés de la scène</h2>
        <IconButton label="Fermer le panneau" onClick={() => useEditor.getState().togglePanel('inspector', false)}>
          <X size={18} />
        </IconButton>
      </div>
      <div role="tablist" aria-label="Propriétés de la scène" className="mx-3 mb-3 flex gap-0.5 border-b border-navy-500/50">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              'mb-1.5 flex-1 whitespace-nowrap rounded-lg px-1.5 py-1.5 text-[12.5px] font-medium transition-colors focus-ring',
              tab === t.id ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-glow' : 'text-ink-muted hover:bg-white/5 hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" role="tabpanel" aria-label={TABS.find((t) => t.id === tab)!.label}>
        {tab === 'general' && <GeneralTab scene={scene} />}
        {tab === 'camera' && <CameraTab scene={scene} />}
        {tab === 'transitions' && <TransitionsTab scene={scene} />}
        {tab === 'advanced' && <AdvancedTab scene={scene} />}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-navy-500/50 p-3">
        <Button onClick={() => duplicateScene(scene.id)}>
          <Copy size={15} /> Dupliquer
        </Button>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/70 px-3 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10 focus-ring disabled:cursor-not-allowed disabled:opacity-40"
          disabled={project.scenes.length <= 1}
          title={project.scenes.length <= 1 ? 'Une visite garde au moins une scène' : undefined}
          onClick={() => void confirmDeleteScene(scene)}
        >
          <Trash2 size={15} /> Supprimer
        </button>
      </div>
    </Panel>
  );
}

const set = (scene: Scene, patch: Partial<Scene>, label?: string, key?: string) => updateScene(scene.id, patch, label, key);

function GeneralTab({ scene }: { scene: Scene }) {
  const project = useEditor((s) => s.project)!;
  const home = homeSceneId(project) === scene.id;
  const sorted = [...project.scenes].sort((a, b) => a.order - b.order);
  const Icon = sceneIcon(scene.icon ?? (home ? 'home' : undefined));
  return (
    <div className="space-y-3">
      <Card title="Informations de la scène" icon={<Home size={18} className="text-ink-muted" />}>
        <Field label="Nom de la scène" required>
          <CommitInput value={scene.name} maxLength={120} aria-label="Nom de la scène" onCommit={(v) => v.trim() && set(scene, { name: v.trim() }, 'Renommer la scène')} />
        </Field>
        <Field label="Description">
          <CommitInput multiline value={scene.description ?? ''} aria-label="Description de la scène" onCommit={(v) => set(scene, { description: v }, 'Modifier la description')} />
        </Field>
        <ThumbnailField scene={scene} />
        <div className="grid grid-cols-[1fr_112px] gap-2">
          <Field label="Icône">
            <span className="relative block">
              <Icon size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink" />
              <select
                aria-label="Icône de la scène"
                className={cx(inputCls, 'appearance-auto pl-8')}
                value={scene.icon ?? (home ? 'home' : 'pin')}
                onChange={(e) => set(scene, { icon: e.target.value as SceneIcon }, 'Changer l’icône')}
              >
                {SCENE_ICONS.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </span>
          </Field>
          <Field label="Ordre dans la visite">
            <NumberField label="Ordre dans la visite" value={sorted.findIndex((s) => s.id === scene.id) + 1} min={1} step={1} onCommit={(v) => reorderScene(scene.id, v - 1)} />
          </Field>
        </div>
        <div>
          <Switch label="Scène d’accueil (point de départ)" checked={home} disabled={home} onChange={() => setHomeScene(scene.id)} />
          <Switch label="Visible dans la visite" checked={!scene.hidden} disabled={home} onChange={(v) => set(scene, { hidden: !v }, v ? 'Afficher la scène' : 'Masquer la scène')} />
          <Switch
            label="Verrouiller la position de la caméra"
            info={scene.kind === 'panorama' ? 'Une scène 360° est toujours vue depuis son point de prise de vue.' : 'Le visiteur peut regarder autour de lui mais pas se déplacer.'}
            checked={scene.kind === 'panorama' || !!scene.lockCamera}
            disabled={scene.kind === 'panorama'}
            onChange={(v) => set(scene, { lockCamera: v }, v ? 'Verrouiller la caméra' : 'Déverrouiller la caméra')}
          />
        </div>
        <TagsField scene={scene} />
      </Card>
    </div>
  );
}

function ThumbnailField({ scene }: { scene: Scene }) {
  const [picking, setPicking] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const viewMode = useEditor((s) => s.viewMode);
  const capture = async () => {
    const v = viewport();
    if (!v) return;
    setCapturing(true);
    try {
      const blob = await v.capture();
      if (!blob) throw new Error('Capture impossible.');
      const safe = scene.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'scene';
      const [m] = await useMedia.getState().upload([new File([blob], `vignette-${safe}.jpg`, { type: 'image/jpeg' })], 'Vignettes');
      if (m) set(scene, { thumbnailFileId: m.id }, 'Capturer la vignette');
    } catch (e) {
      useEditor.getState().toast({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setCapturing(false);
    }
  };
  return (
    <Field group label="Vignette (couverture)">
      <div className="flex items-center gap-2">
        <SceneThumb scene={scene} className="h-[74px] w-[124px] shrink-0 rounded-lg border border-navy-500/60" />
        <div className="flex flex-1 flex-wrap gap-1.5">
          <Button size="sm" onClick={() => setPicking(true)}>
            <ImagePlus size={14} /> Changer
          </Button>
          <Button size="sm" onClick={() => void capture()} disabled={capturing || viewMode === 'visitor'} title="Utilise la vue actuelle du viewport comme vignette">
            {capturing ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} Capturer la vue
          </Button>
          {scene.thumbnailFileId && (
            <IconButton size="sm" tone="danger" label="Retirer la vignette" onClick={() => set(scene, { thumbnailFileId: undefined }, 'Retirer la vignette')}>
              <Trash2 size={14} />
            </IconButton>
          )}
        </div>
      </div>
      {!scene.thumbnailFileId && <p className="mt-1 text-[11px] text-ink-faint">{scene.kind === 'panorama' && scene.panoramaFileId ? 'Par défaut : l’image 360° de la scène.' : 'Aucune vignette : choisissez une image ou capturez la vue.'}</p>}
      {picking && <MediaPicker kinds={['image', 'panorama']} title="Choisir la vignette de la scène" onClose={() => setPicking(false)} onPick={(m) => (set(scene, { thumbnailFileId: m.id }, 'Changer la vignette'), setPicking(false))} />}
    </Field>
  );
}

function TagsField({ scene }: { scene: Scene }) {
  const [adding, setAdding] = useState(false);
  const tags = scene.tags ?? [];
  const add = (raw: string) => {
    const t = raw.trim().slice(0, 30);
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase()) && tags.length < 12) set(scene, { tags: [...tags, t] }, 'Ajouter un tag');
  };
  return (
    <Field group label="Tags" hint="Utilisés par la recherche de scènes.">
      <div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-lg border border-navy-500 bg-navy-900/60 p-1.5">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md border border-navy-500 bg-navy-700 py-0.5 pl-2 pr-1 text-xs text-ink">
            {t}
            <button type="button" aria-label={`Retirer le tag ${t}`} onClick={() => set(scene, { tags: tags.filter((x) => x !== t) }, 'Retirer un tag')} className="rounded p-0.5 text-ink-muted hover:text-ink">
              <X size={11} />
            </button>
          </span>
        ))}
        {adding ? (
          <input
            autoFocus
            aria-label="Nouveau tag"
            maxLength={30}
            className="min-w-[90px] flex-1 bg-transparent px-1 text-xs text-ink outline-none"
            onBlur={(e) => (add(e.target.value), setAdding(false))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                add((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = '';
              }
              if (e.key === 'Escape') setAdding(false);
            }}
          />
        ) : (
          <button type="button" aria-label="Ajouter un tag" onClick={() => setAdding(true)} disabled={tags.length >= 12} className="ml-auto flex h-7 w-7 items-center justify-center rounded-md border border-navy-500 text-ink-muted hover:text-ink disabled:opacity-40">
            <Plus size={14} />
          </button>
        )}
      </div>
    </Field>
  );
}

function CameraTab({ scene }: { scene: Scene }) {
  const viewMode = useEditor((s) => s.viewMode);
  const view = scene.initialView ?? { yaw: 0, pitch: 0, fov: 70 };
  const firstPerson = scene.kind === 'panorama' || viewMode === 'immersive' || viewMode === 'visitor';
  return (
    <div className="space-y-3">
      <Card title="Vue initiale">
        <p className="text-xs text-ink-muted">Orientation de la caméra à l’arrivée du visiteur{scene.kind === 'panorama' ? '' : ' (vue à hauteur d’œil, 1,60 m)'}.</p>
        <div className="grid grid-cols-3 gap-1.5">
          <NumberField label="Cap (°)" value={view.yaw} step={15} suffix="cap" onCommit={(yaw) => set(scene, { initialView: { ...view, yaw: ((((yaw + 180) % 360) + 360) % 360) - 180 } }, 'Vue initiale')} />
          <NumberField label="Inclinaison (°)" value={view.pitch} step={5} suffix="incl." onCommit={(pitch) => set(scene, { initialView: { ...view, pitch: Math.max(-85, Math.min(85, pitch)) } }, 'Vue initiale')} />
          <NumberField label="Champ (°)" value={view.fov} step={5} suffix="fov" onCommit={(fov) => set(scene, { initialView: { ...view, fov: Math.max(30, Math.min(110, fov)) } }, 'Vue initiale')} />
        </div>
        <Button
          className="w-full"
          disabled={!firstPerson}
          title={firstPerson ? undefined : 'Passez en vue Immersive pour cadrer la vue de départ'}
          onClick={() => {
            const v = viewport()?.getView();
            if (v) set(scene, { initialView: v }, 'Définir la vue initiale');
          }}
        >
          <Camera size={14} /> Utiliser la vue actuelle
        </Button>
        {!firstPerson && <p className="text-[11px] text-ink-faint">Passez en vue « Immersive » pour cadrer la vue de départ à la souris.</p>}
      </Card>
      <Card title="Déplacements du visiteur">
        <Switch
          label="Verrouiller la position de la caméra"
          checked={scene.kind === 'panorama' || !!scene.lockCamera}
          disabled={scene.kind === 'panorama'}
          onChange={(v) => set(scene, { lockCamera: v }, v ? 'Verrouiller la caméra' : 'Déverrouiller la caméra')}
        />
        <p className="text-[11px] text-ink-faint">
          {scene.kind === 'panorama' ? 'Scène 360° : le visiteur regarde autour du point de prise de vue.' : 'Déverrouillée, le visiteur se déplace avec ZQSD / flèches ou les boutons de marche. Testez avec « Aperçu visite ».'}
        </p>
      </Card>
    </div>
  );
}

function TransitionsTab({ scene }: { scene: Scene }) {
  const project = useEditor((s) => s.project)!;
  const nav = project.navigation ?? [];
  const out = nav.filter((n) => n.sceneId === scene.id);
  const incoming = nav.filter((n) => n.targetSceneId === scene.id);
  const name = (id: string) => project.scenes.find((s) => s.id === id)?.name ?? 'Scène supprimée';
  const applyAll = (patch: { transition: SceneTransition; durationMs: number }) => {
    const ids = out.map((n) => n.id);
    useEditor.getState().apply('Transitions de la scène', (d) => {
      const pairs = new Set((d.navigation ?? []).filter((n) => ids.includes(n.id) && n.pairId).map((n) => n.pairId));
      return { ...d, navigation: (d.navigation ?? []).map((n) => (ids.includes(n.id) || (n.pairId && pairs.has(n.pairId)) ? { ...n, ...patch } : n)) };
    });
  };
  return (
    <div className="space-y-3">
      <Card title="Départs depuis cette scène">
        {!out.length && <p className="text-sm text-ink-muted">Aucun point de navigation dans cette scène. Ajoutez-en dans le module Navigation.</p>}
        <ul className="space-y-2">
          {out.map((n) => (
            <li key={n.id} className="space-y-1.5 rounded-lg border border-navy-500/50 p-2">
              <p className="truncate text-sm font-medium text-ink">→ {name(n.targetSceneId)}</p>
              <div className="grid grid-cols-[1fr_96px] gap-1.5">
                <Select<SceneTransition>
                  label={`Transition vers ${name(n.targetSceneId)}`}
                  value={n.transition}
                  onChange={(transition) => updateNavLink(n.id, { transition }, 'Changer la transition')}
                  options={[
                    { value: 'fade', label: 'Fondu' },
                    { value: 'none', label: 'Immédiate' },
                  ]}
                />
                <NumberField label="Durée (ms)" value={n.durationMs} min={0} step={100} suffix="ms" onCommit={(v) => updateNavLink(n.id, { durationMs: Math.max(0, Math.min(3000, v)) }, 'Durée de transition')} />
              </div>
            </li>
          ))}
        </ul>
        {out.length > 1 && (
          <div className="flex gap-1.5">
            <Button size="sm" className="flex-1" onClick={() => applyAll({ transition: 'fade', durationMs: 800 })}>
              Toutes en fondu
            </Button>
            <Button size="sm" className="flex-1" onClick={() => applyAll({ transition: 'none', durationMs: 0 })}>
              Toutes immédiates
            </Button>
          </div>
        )}
      </Card>
      <Card title="Arrivées">
        <p className="text-sm text-ink-muted">
          {incoming.length ? `${incoming.length} point(s) de navigation mènent ici : ${[...new Set(incoming.map((n) => name(n.sceneId)))].join(', ')}.` : 'Aucune scène ne mène ici.'}
        </p>
      </Card>
    </div>
  );
}

function AdvancedTab({ scene }: { scene: Scene }) {
  const project = useEditor((s) => s.project)!;
  return (
    <div className="space-y-3">
      <Card title="Type de scène">
        <Select
          label="Type de scène"
          value={scene.kind ?? 'environment'}
          onChange={(kind) => set(scene, { kind }, 'Changer le type de scène')}
          options={[
            { value: 'environment', label: 'Environnement 3D' },
            { value: 'panorama', label: 'Panorama 360°' },
          ]}
        />
        {scene.kind === 'panorama' ? (
          <Field group label="Image 360°" hint="Image équirectangulaire (rapport 2:1) de la bibliothèque de médias.">
            <MediaField label="Panorama" kinds={['panorama']} value={scene.panoramaFileId} onChange={(id) => set(scene, { panoramaFileId: id }, 'Changer le panorama')} />
          </Field>
        ) : (
          <>
            <Field label="Ambiance">
              <Select<EnvironmentPreset> label="Ambiance" value={scene.environment} onChange={(environment) => set(scene, { environment }, 'Changer l’ambiance')} options={Object.entries(ENV_LABEL).map(([value, label]) => ({ value: value as EnvironmentPreset, label }))} />
            </Field>
            <div>
              <div className="mb-1 text-xs text-ink-muted">Dimensions (m) — largeur · profondeur · hauteur</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['width', 'depth', 'height'] as const).map((k) => (
                  <NumberField key={k} label={k} value={scene.size[k]} min={k === 'height' ? 2 : 4} step={1} onCommit={(v) => set(scene, { size: { ...scene.size, [k]: Math.min(200, v) } }, 'Redimensionner la scène')} />
                ))}
              </div>
            </div>
          </>
        )}
      </Card>
      <Card title="Contenu">
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-ink-muted">Objets 3D</dt>
          <dd className="text-right tabular-nums">{project.objects.filter((o) => o.sceneId === scene.id && o.kind === 'object').length}</dd>
          <dt className="text-ink-muted">Hotspots</dt>
          <dd className="text-right tabular-nums">{(project.hotspots ?? []).filter((h) => h.sceneId === scene.id).length}</dd>
          <dt className="text-ink-muted">Points de navigation</dt>
          <dd className="text-right tabular-nums">{(project.navigation ?? []).filter((n) => n.sceneId === scene.id).length}</dd>
          <dt className="text-ink-muted">Annotations</dt>
          <dd className="text-right tabular-nums">{(project.annotations ?? []).filter((a) => a.sceneId === scene.id).length}</dd>
        </dl>
        <p className="select-all break-all text-[11px] text-ink-faint">Identifiant : {scene.id}</p>
      </Card>
    </div>
  );
}

// Re-exported for the navigation module.
export const useSortedScenes = () => {
  const scenes = useEditor((s) => s.project?.scenes);
  return useMemo(() => [...(scenes ?? [])].sort((a, b) => a.order - b.order), [scenes]);
};
