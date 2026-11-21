import { Canvas } from '@react-three/fiber';
import {
  AlignCenterVertical,
  AlignHorizontalSpaceAround,
  ArrowDownToLine,
  Box,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crosshair,
  EyeOff,
  Footprints,
  Group,
  Images,
  Layers,
  Loader2,
  Lock,
  Magnet,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Minus,
  Move,
  MoreHorizontal,
  MousePointerClick,
  Orbit,
  Plus,
  Rotate3d,
  RotateCw,
  Scale3d,
  Scan,
  Trash2,
  Video,
  View,
  X,
} from 'lucide-react';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { isSafeUrl } from '../../lib/actions';
import { findAsset, useEditor, type ViewMode } from '../../store/editor';
import {
  deleteSelection,
  duplicateSelection,
  focusSelection,
  groupSelection,
  placeAt,
  placeOnGround,
  resetTransforms,
  toggleLock,
  toggleVisibility,
  ungroupSelection,
} from '../../store/objectActions';
import { onPendingLoads } from '../../three/assetCache';
import { dragState, viewport } from '../../three/registry';
import { webglAvailable } from '../../three/thumbnails';
import type { SceneObject3D, Vec3 } from '../../types';
import { Menu, MenuItem, MenuLabel, MenuSeparator, Modal } from '../common/Overlays';
import { Button, IconButton, Toggle, cx } from '../common/ui';
import { AnnotationMarkers, HotspotMarkers, NavMarkers, SceneBackdrop, useHotspotRunner, useSceneTransition } from './TourLayers';
import { setPosition } from '../../store/tourActions';
import { GuidedTourPlayer, usePlayback } from './GuidedTourPlayer';
import { SceneObjects } from './SceneObjects';
import { CameraRig, ContextToolbar, DropGhost, gizmoState, Measures, SelectionBoxes, SelectionGizmo, useViewportUi } from './ViewportScene';
import { ViewportFilmstrip, ViewportNavCluster } from './ViewportOverlays';

class CanvasBoundary extends Component<{ children: ReactNode }, { error?: string }> {
  state: { error?: string } = {};
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    if (this.state.error) return <ViewportError message={`Erreur du moteur 3D : ${this.state.error}`} />;
    return this.props.children;
  }
}

function ViewportError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="rounded-full bg-red-500/10 p-3 text-red-400">
        <X size={28} />
      </div>
      <p className="max-w-md text-sm text-ink">{message}</p>
      <p className="max-w-md text-xs text-ink-muted">
        Vérifiez que l’accélération matérielle est activée dans votre navigateur, puis rechargez la page. La bibliothèque, la hiérarchie et l’inspecteur restent utilisables.
      </p>
      <Button size="sm" onClick={() => location.reload()}>
        Recharger
      </Button>
    </div>
  );
}

/** Why a view mode is unavailable for the current scene kind (undefined = available). */
function modeDisabled(id: ViewMode, kind?: 'environment' | 'panorama'): string | undefined {
  if (kind === 'panorama') {
    if (id === 'plan') return 'Le plan 2D ne s’applique pas à une scène 360°.';
    if (id === '3d' || id === 'immersive') return 'Scène 360° : vue panoramique depuis le point de prise de vue.';
    return undefined;
  }
  return id === '360' ? 'Cette scène est un environnement 3D. Créez une scène 360° dans le module Scènes à partir d’un panorama.' : undefined;
}

const MODES: { id: ViewMode; label: string; icon: ReactNode; disabled?: string }[] = [
  { id: '3d', label: 'Vue 3D', icon: <Box size={15} /> },
  { id: 'immersive', label: 'Immersive', icon: <View size={15} /> },
  { id: '360', label: 'Vue 360°', icon: <Orbit size={15} /> },
  { id: 'plan', label: 'Plan 2D', icon: <MapIcon size={15} /> },
];

export function Scene3DViewport() {
  const scene = useEditor((s) => s.project?.scenes.find((x) => x.id === s.activeSceneId));
  const viewMode = useEditor((s) => s.viewMode);
  const setViewMode = useEditor((s) => s.setViewMode);
  const overlays = useEditor((s) => s.overlays);
  const selectionCount = useEditor((s) => s.selection.length);
  const sceneObjectCount = useEditor((s) => s.project?.objects.filter((o) => o.sceneId === s.activeSceneId).length ?? 0);
  const [ghost, setGhost] = useState<{ point: THREE.Vector3; size: Vec3 } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [pending, setPending] = useState(0);
  const [action, setAction] = useState<SceneObject3D | null>(null);
  const [webgl] = useState(() => webglAvailable());
  const wrap = useRef<HTMLDivElement>(null);
  const visitor = viewMode === 'visitor';
  const module = useEditor((s) => s.module);
  const { autoRotate, filmstrip, set: setUi } = useViewportUi();

  useEffect(() => onPendingLoads(setPending), []);
  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === wrap.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/x-visora-asset') || visitor) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const st = useEditor.getState();
    const asset = findAsset(st.project, dragState.assetId);
    const p = viewport()?.pick(e.clientX, e.clientY, { surfaces: st.snap.surfaces });
    if (!p || !asset) return setGhost(null);
    if (!st.snap.ground) p.y = Math.max(p.y, 0);
    if (st.snap.grid) {
      p.x = Math.round(p.x / st.snap.gridSize) * st.snap.gridSize;
      p.z = Math.round(p.z / st.snap.gridSize) * st.snap.gridSize;
    }
    setGhost({ point: p, size: asset.size ?? { x: 1, y: 1, z: 1 } });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('application/x-visora-asset') || dragState.assetId;
    const point = ghost?.point;
    setGhost(null);
    dragState.assetId = null;
    if (!id || !point) return;
    useEditor.getState().addObject(id, { position: { x: +point.x.toFixed(3), y: +point.y.toFixed(3), z: +point.z.toFixed(3) } });
  };

  const { go, overlay } = useSceneTransition();
  const { run: runHotspot, dialog: hotspotDialog } = useHotspotRunner(go);
  const placement = useEditor((s) => s.placement);
  // Guided-tour preview only runs in the visitor preview.
  useEffect(() => {
    if (viewMode !== 'visitor') usePlayback.getState().stop();
  }, [viewMode]);
  const placementName = useEditor((s) =>
    s.placement?.kind === 'hotspot' ? s.project?.hotspots?.find((h) => h.id === s.placement!.id)?.title : s.placement ? 'le point de navigation' : undefined,
  );

  /** Placement mode: the next click on a surface (room, object, 360° sphere) positions the item. */
  const onPlaceClick = (e: React.MouseEvent) => {
    const st = useEditor.getState();
    if (!st.placement) return;
    e.stopPropagation();
    const p = viewport()?.pickSurface(e.clientX, e.clientY);
    if (!p) return st.toast({ kind: 'info', text: 'Cliquez sur une surface (mur, sol, objet ou image 360°).' });
    setPosition(st.placement, p);
    st.setPlacement(null);
  };

  const onVisitorAction = useCallback((o: SceneObject3D) => {
    const it = o.interaction;
    if (!it) return;
    if (it.type === 'scene' && it.targetId) {
      go(it.targetId);
      return;
    }
    if (it.type === 'link') {
      if (isSafeUrl(it.config?.url)) window.open(it.config!.url, '_blank', 'noopener,noreferrer');
      else useEditor.getState().toast({ kind: 'warning', text: 'Lien invalide ou non sécurisé.' });
      return;
    }
    setAction(o);
  }, [go]);

  if (!scene) return null;

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrap.current?.requestFullscreen?.();
  };

  return (
    <div ref={wrap} className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-navy-500/50 bg-navy-950">
      <div
        className={cx('relative min-h-0 flex-1', placement && 'cursor-crosshair')}
        onClickCapture={onPlaceClick}
        onDragOver={onDragOver}
        onDragLeave={() => setGhost(null)}
        onDrop={onDrop}
      >
        {webgl ? (
          <CanvasBoundary>
            <Canvas
              shadows
              frameloop="demand"
              dpr={[1, 1.75]}
              gl={{ antialias: true, powerPreference: 'high-performance' }}
              onCreated={({ gl }) => {
                gl.toneMapping = THREE.ACESFilmicToneMapping;
                gl.toneMappingExposure = 1.05;
              }}
              onPointerMissed={(e) => {
                if (e.type !== 'click' || gizmoState.dragging || performance.now() - gizmoState.lastEnd < 250) return;
                const st = useEditor.getState();
                if (st.viewMode !== 'visitor' && !(e.shiftKey || e.ctrlKey)) st.clearSelection();
              }}
              aria-label={`Viewport 3D de la scène ${scene.name}`}
            >
              <CameraRig scene={scene} />
              <SceneBackdrop scene={scene} showGrid={overlays.grid && !visitor} showAxes={overlays.axes && !visitor} />
              <SceneObjects onVisitorAction={onVisitorAction} />
              <HotspotMarkers visitor={visitor} onActivate={runHotspot} />
              <AnnotationMarkers visitor={visitor} />
              <NavMarkers visitor={visitor} onNavigate={(n) => go(n.targetSceneId, n.transition, n.durationMs)} />
              <SelectionBoxes />
              <SelectionGizmo />
              {overlays.gizmos && <ContextToolbar />}
              <Measures />
              <DropGhost ghost={ghost} />
            </Canvas>
          </CanvasBoundary>
        ) : (
          <ViewportError message="WebGL n’est pas disponible sur cet appareil : le viewport 3D ne peut pas s’afficher." />
        )}

        {/* Top bar: view modes + viewport menus */}
        {!visitor && (
          <div className="pointer-events-none absolute inset-x-3 top-3 z-40 flex items-start justify-between gap-2">
            <div className="pointer-events-auto flex flex-nowrap gap-1 rounded-full border border-white/10 bg-navy-950/75 p-1 shadow-panel backdrop-blur-md">
              {MODES.map((m) => ({ ...m, disabled: modeDisabled(m.id, scene.kind) })).map((m) => (
                <span key={m.id} className="group relative">
                  <button
                    type="button"
                    disabled={!!m.disabled}
                    aria-pressed={scene.kind === 'panorama' ? m.id === '360' : viewMode === m.id}
                    onClick={() => setViewMode(m.id)}
                    className={cx(
                      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-40',
                      (scene.kind === 'panorama' ? m.id === '360' : viewMode === m.id) ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-glow' : 'text-ink-muted hover:bg-white/10 hover:text-ink',
                    )}
                  >
                    {m.icon}
                    <span className="hidden whitespace-nowrap lg:inline">{m.label}</span>
                  </button>
                  {m.disabled && (
                    <span role="tooltip" className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 w-56 rounded-md border border-navy-500 bg-navy-950 px-2 py-1 text-xs text-ink opacity-0 shadow-panel transition-opacity group-hover:opacity-100">
                      {m.disabled}
                    </span>
                  )}
                </span>
              ))}
            </div>
            <div className="pointer-events-auto flex gap-1 rounded-2xl border border-white/10 bg-navy-950/75 p-1 shadow-panel backdrop-blur-md">
              <OverlaysMenu />
              <IconButton label={autoRotate ? 'Arrêter la rotation automatique' : 'Rotation automatique 360°'} active={autoRotate} disabled={viewMode === 'plan' && scene.kind !== 'panorama'} onClick={() => setUi({ autoRotate: !autoRotate })}>
                <Rotate3d size={16} />
              </IconButton>
              {!filmstrip && (
                <IconButton label="Afficher les vignettes des scènes" onClick={() => setUi({ filmstrip: true })}>
                  <Images size={16} />
                </IconButton>
              )}
              <SnapMenu />
              <IconButton label={fullscreen ? 'Quitter le plein écran' : 'Plein écran du viewport'} onClick={toggleFullscreen}>
                {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </IconButton>
              <Button size="sm" variant="secondary" onClick={() => setViewMode('visitor')} className="ml-1 hidden whitespace-nowrap 2xl:inline-flex">
                <Footprints size={14} /> Mode visiteur
              </Button>
            </div>
          </div>
        )}

        {!visitor && selectionCount > 1 && <MultiSelectionToolbar />}

        {/* Bottom stack: camera column, navigation cluster, scene filmstrip */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 flex flex-col gap-2">
          <div className="flex justify-end">
            <CameraControlsColumn compact={module !== 'objects'} />
          </div>
          {!visitor && module !== 'objects' && <ViewportNavCluster go={go} />}
          {!visitor && filmstrip && module !== 'navigation' && module !== 'hotspots' && <ViewportFilmstrip go={go} />}
        </div>

        {pending > 0 && (
          <div className="absolute left-3 top-16 flex items-center gap-2 rounded-lg border border-navy-500 bg-navy-900/90 px-2.5 py-1.5 text-xs text-ink-muted" role="status">
            <Loader2 size={14} className="animate-spin text-cyan" /> Chargement de {pending} modèle{pending > 1 ? 's' : ''}…
          </div>
        )}

        {sceneObjectCount === 0 && !visitor && webgl && scene.kind !== 'panorama' && useEditor.getState().module === 'objects' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-dashed border-cyan/40 bg-navy-900/70 px-6 py-4 text-center backdrop-blur">
              <MousePointerClick className="mx-auto mb-2 text-cyan" size={22} />
              <p className="text-sm font-medium text-ink">Scène vide</p>
              <p className="mt-1 text-xs text-ink-muted">Glissez un objet depuis la bibliothèque ou cliquez sur « Ajouter ».</p>
            </div>
          </div>
        )}

        {visitor && (
          <div className="absolute inset-x-0 top-3 flex justify-center">
            <div className="flex items-center gap-3 rounded-xl border border-navy-500 bg-navy-900/90 px-3 py-2 text-xs text-ink-muted backdrop-blur">
              <Footprints size={15} className="text-cyan" />
              <span>
                <b className="text-ink">Mode visiteur</b> — glisser pour regarder, ZQSD/flèches pour se déplacer, cliquer un objet interactif.
              </span>
              <Button size="sm" variant="secondary" onClick={() => setViewMode('3d')}>
                Quitter
              </Button>
            </div>
          </div>
        )}
        {overlay}
        <GuidedTourPlayer go={go} />
        {placement && (
          <div role="status" className="absolute inset-x-0 top-16 z-40 flex justify-center">
            <div className="flex items-center gap-3 rounded-xl border border-cyan/60 bg-navy-900/95 px-3 py-2 text-xs text-ink shadow-panel">
              Cliquez dans la vue pour placer <b>{placementName ?? 'l’élément'}</b>
              <Button size="sm" variant="ghost" onClick={() => useEditor.getState().setPlacement(null)}>
                Annuler (Échap)
              </Button>
            </div>
          </div>
        )}
        {viewMode === 'immersive' && scene.kind !== 'panorama' && (
          <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 whitespace-nowrap rounded-lg bg-navy-900/80 px-3 py-1.5 text-xs text-ink-muted">
            Vue à hauteur d’œil (1,60 m) — ZQSD / flèches pour se déplacer
          </div>
        )}
      </div>

      {!visitor && module === 'objects' && <ObjectTransformToolbar />}
      {action && <InteractionDialog obj={action} onClose={() => setAction(null)} />}
      {hotspotDialog}
    </div>
  );
}

function CameraControlsColumn({ compact }: { compact?: boolean }) {
  const viewMode = useEditor((s) => s.viewMode);
  const [presetOpen, setPresetOpen] = useState(false);
  const canPreset = viewMode === '3d';
  if (compact)
    return (
      <div className="pointer-events-auto flex flex-col gap-1 rounded-2xl border border-white/10 bg-navy-950/75 p-1 shadow-panel backdrop-blur-md">
        <IconButton label="Zoom avant" tooltipSide="left" onClick={() => viewport()?.zoom(1.25)}>
          <Plus size={17} />
        </IconButton>
        <IconButton label="Zoom arrière" tooltipSide="left" onClick={() => viewport()?.zoom(0.8)}>
          <Minus size={17} />
        </IconButton>
        <IconButton label="Recadrer la vue" tooltipSide="left" onClick={() => viewport()?.reset()}>
          <Scan size={16} />
        </IconButton>
      </div>
    );
  return (
    <div className="pointer-events-auto flex flex-col gap-1 rounded-2xl border border-white/10 bg-navy-950/75 p-1 shadow-panel backdrop-blur-md">
      <IconButton label="Zoom avant" tooltipSide="left" onClick={() => viewport()?.zoom(1.25)}>
        <Plus size={16} />
      </IconButton>
      <IconButton label="Zoom arrière" tooltipSide="left" onClick={() => viewport()?.zoom(0.8)}>
        <Minus size={16} />
      </IconButton>
      <IconButton label="Cadrer la sélection" shortcut="F" tooltipSide="left" onClick={focusSelection}>
        <Scan size={16} />
      </IconButton>
      <IconButton label="Réinitialiser la caméra" tooltipSide="left" onClick={() => viewport()?.reset()}>
        <Crosshair size={16} />
      </IconButton>
      <div className="relative">
        <IconButton label="Vues prédéfinies" tooltipSide="left" disabled={!canPreset} onClick={() => setPresetOpen((v) => !v)}>
          <Video size={16} />
        </IconButton>
        <Menu open={presetOpen} onClose={() => setPresetOpen(false)} className="!bottom-0 !top-auto right-11 min-w-[160px]">
          <MenuLabel>Vues</MenuLabel>
          {(
            [
              ['top', 'Vue de dessus'],
              ['front', 'Vue frontale'],
              ['side', 'Vue latérale'],
              ['iso', 'Perspective'],
            ] as const
          ).map(([k, l]) => (
            <MenuItem key={k} onClick={() => (viewport()?.preset(k), setPresetOpen(false))}>
              {l}
            </MenuItem>
          ))}
        </Menu>
      </div>
      <IconButton label="Vue précédente" tooltipSide="left" onClick={() => viewport()?.back()}>
        <ChevronLeft size={16} />
      </IconButton>
      <IconButton label="Vue suivante" tooltipSide="left" onClick={() => viewport()?.forward()}>
        <ChevronRight size={16} />
      </IconButton>
    </div>
  );
}

function OverlaysMenu() {
  const [open, setOpen] = useState(false);
  const overlays = useEditor((s) => s.overlays);
  const setOverlay = useEditor((s) => s.setOverlay);
  const items: { k: keyof typeof overlays; label: string; unavailable?: string }[] = [
    { k: 'grid', label: 'Grille' },
    { k: 'axes', label: 'Axes' },
    { k: 'gizmos', label: 'Gizmos' },
    { k: 'objects', label: 'Objets 3D' },
    { k: 'labels', label: 'Étiquettes' },
    { k: 'measures', label: 'Mesures (sélection)' },
    { k: 'hotspots', label: 'Hotspots' },
    { k: 'navigation', label: 'Points de navigation' },
    { k: 'annotations', label: 'Annotations' },
    { k: 'zones', label: 'Zones', unavailable: 'Aucune zone' },
  ];
  return (
    <div className="relative">
      <IconButton label="Affichage des calques" active={open} onClick={() => setOpen((v) => !v)}>
        <Layers size={16} />
      </IconButton>
      <Menu open={open} onClose={() => setOpen(false)} className="w-64 p-2">
        <MenuLabel>Calques du viewport</MenuLabel>
        {items.map((i) => (
          <Toggle key={i.k} label={i.label} hint={i.unavailable} disabled={!!i.unavailable} checked={!i.unavailable && overlays[i.k]} onChange={(v) => setOverlay(i.k, v)} />
        ))}
      </Menu>
    </div>
  );
}

function SnapMenu() {
  const [open, setOpen] = useState(false);
  const snap = useEditor((s) => s.snap);
  const setSnap = useEditor((s) => s.setSnap);
  const any = snap.grid || snap.ground || snap.rotation;
  return (
    <div className="relative">
      <IconButton label="Magnétisme et placement" active={open || any} onClick={() => setOpen((v) => !v)}>
        <Magnet size={16} />
      </IconButton>
      <Menu open={open} onClose={() => setOpen(false)} className="w-72 p-2">
        <MenuLabel>Magnétisme</MenuLabel>
        <Toggle label="Snap à la grille" checked={snap.grid} onChange={(v) => setSnap({ grid: v })} />
        {snap.grid && (
          <div className="mb-1 flex gap-1 pl-1">
            {[0.1, 0.25, 0.5, 1].map((g) => (
              <button key={g} type="button" onClick={() => setSnap({ gridSize: g })} className={cx('rounded-md px-2 py-0.5 text-xs', snap.gridSize === g ? 'bg-cyan text-navy-950' : 'bg-navy-600 text-ink-muted')}>
                {String(g).replace('.', ',')} m
              </button>
            ))}
          </div>
        )}
        <Toggle label="Snap au sol" hint="Verrouille la hauteur : l’objet repose au sol" checked={snap.ground} onChange={(v) => setSnap({ ground: v })} />
        <Toggle label="Snap aux surfaces et objets" hint="Pose sur le dessus des objets survolés" checked={snap.surfaces} onChange={(v) => setSnap({ surfaces: v })} />
        <Toggle label="Rotation incrémentale" checked={snap.rotation} onChange={(v) => setSnap({ rotation: v })} />
        {snap.rotation && (
          <div className="mb-1 flex gap-1 pl-1">
            {[5, 15, 45, 90].map((g) => (
              <button key={g} type="button" onClick={() => setSnap({ rotationStep: g })} className={cx('rounded-md px-2 py-0.5 text-xs', snap.rotationStep === g ? 'bg-cyan text-navy-950' : 'bg-navy-600 text-ink-muted')}>
                {g}°
              </button>
            ))}
          </div>
        )}
      </Menu>
    </div>
  );
}

export function ObjectTransformToolbar() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const selection = useEditor((s) => s.selection);
  const objs = useEditor((s) => s.project?.objects);
  const [more, setMore] = useState(false);
  const sel = objs?.filter((o) => selection.includes(o.id)) ?? [];
  const has = sel.length > 0;
  const allLocked = has && sel.every((o) => o.locked);
  const multi = sel.length > 1;
  const isGroup = sel.length === 1 && sel[0].kind === 'group';
  const tb = (active: boolean) =>
    cx(
      'flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[84px]',
      active ? 'bg-cyan/15 text-cyan ring-1 ring-cyan/60' : 'text-ink-muted hover:bg-navy-600 hover:text-ink',
    );
  return (
    <div className="flex items-center justify-center border-t border-navy-500/50 bg-navy-900/80 px-2 py-1.5">
      <div className="flex items-center gap-1" role="toolbar" aria-label="Outils de transformation">
        <button type="button" className={tb(tool === 'translate')} aria-pressed={tool === 'translate'} onClick={() => setTool('translate')} title="Déplacer (W)">
          <Move size={17} /> Déplacer
        </button>
        <button type="button" className={cx(tb(tool === 'rotate'), 'hidden sm:flex')} aria-pressed={tool === 'rotate'} disabled={multi} onClick={() => setTool('rotate')} title={multi ? 'Indisponible en sélection multiple' : 'Tourner (E)'}>
          <RotateCw size={17} /> Tourner
        </button>
        <button type="button" className={cx(tb(tool === 'scale'), 'hidden sm:flex')} aria-pressed={tool === 'scale'} disabled={multi} onClick={() => setTool('scale')} title={multi ? 'Indisponible en sélection multiple' : 'Redimensionner (R)'}>
          <Scale3d size={17} /> Redimensionner
        </button>
        <div className="mx-1 h-8 w-px bg-navy-500/60" />
        <button type="button" className={tb(false)} disabled={!has} onClick={duplicateSelection} title="Dupliquer (Ctrl+D)">
          <Copy size={17} /> Dupliquer
        </button>
        <button type="button" className={cx(tb(false), 'hover:!text-red-400')} disabled={!has || allLocked} onClick={() => void deleteSelection()} title={allLocked ? 'Objet verrouillé' : 'Supprimer (Suppr)'}>
          <Trash2 size={17} /> Supprimer
        </button>
        <div className="relative">
          <button type="button" className={tb(more)} disabled={!has} onClick={() => setMore((v) => !v)} aria-haspopup="menu" aria-expanded={more}>
            <MoreHorizontal size={17} /> Plus
          </button>
          <Menu open={more} onClose={() => setMore(false)} className="!bottom-full !top-auto mb-1" align="right">
            <ObjectMenuItems close={() => setMore(false)} isGroup={isGroup} multi={multi} />
          </Menu>
        </div>
      </div>
    </div>
  );
}

/** Actions shared by the "Plus" menu and the hierarchy context menu. */
export function ObjectMenuItems({ close, isGroup, multi }: { close: () => void; isGroup: boolean; multi: boolean }) {
  const scenes = useEditor((s) => s.project?.scenes ?? []);
  const activeSceneId = useEditor((s) => s.activeSceneId);
  const run = (f: () => void) => () => {
    f();
    close();
  };
  return (
    <>
      <MenuItem icon={<Scan size={14} />} hint="F" onClick={run(focusSelection)}>
        Cadrer
      </MenuItem>
      <MenuItem icon={<ArrowDownToLine size={14} />} onClick={run(() => placeOnGround())}>
        Poser au sol
      </MenuItem>
      <MenuItem icon={<Crosshair size={14} />} onClick={run(() => placeAt('center'))}>
        Centrer dans la scène
      </MenuItem>
      <MenuItem onClick={run(() => placeAt('origin'))}>Placer à l’origine</MenuItem>
      <MenuItem onClick={run(() => resetTransforms())}>Réinitialiser rotation / échelle</MenuItem>
      <MenuSeparator />
      <MenuItem icon={<EyeOff size={14} />} hint="H" onClick={run(() => toggleVisibility())}>
        Masquer / afficher
      </MenuItem>
      <MenuItem icon={<Lock size={14} />} hint="L" onClick={run(() => toggleLock())}>
        Verrouiller / déverrouiller
      </MenuItem>
      <MenuItem icon={<Group size={14} />} hint="Ctrl+G" disabled={!multi} onClick={run(groupSelection)}>
        Grouper
      </MenuItem>
      <MenuItem hint="Ctrl+Maj+G" disabled={!isGroup} onClick={run(ungroupSelection)}>
        Dégrouper
      </MenuItem>
      <MenuSeparator />
      <MenuLabel>Copier vers la scène</MenuLabel>
      {scenes
        .filter((s) => s.id !== activeSceneId)
        .map((s) => (
          <MenuItem
            key={s.id}
            onClick={run(() => {
              const st = useEditor.getState();
              st.duplicateObjects(st.selection, s.id);
              st.toast({ kind: 'success', text: `Copié vers « ${s.name} ».` });
            })}
          >
            {s.name}
          </MenuItem>
        ))}
    </>
  );
}

function MultiSelectionToolbar() {
  const count = useEditor((s) => s.selection.length);
  const align = useEditor((s) => s.align);
  const distribute = useEditor((s) => s.distribute);
  const sel = () => useEditor.getState().selection;
  return (
    <div className="absolute left-1/2 top-16 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-violet/40 bg-navy-900/90 p-1 backdrop-blur" role="toolbar" aria-label="Actions de sélection multiple">
      <span className="px-2 text-xs font-medium text-violet-400">{count} objets</span>
      <IconButton size="sm" label="Aligner sur X (centre)" onClick={() => align(sel(), 'x', 'center')}>
        <AlignCenterVertical size={14} />
      </IconButton>
      <IconButton size="sm" label="Aligner sur Z (centre)" onClick={() => align(sel(), 'z', 'center')}>
        <AlignCenterVertical size={14} className="rotate-90" />
      </IconButton>
      <IconButton size="sm" label="Répartir sur X (3 objets min.)" disabled={count < 3} onClick={() => distribute(sel(), 'x')}>
        <AlignHorizontalSpaceAround size={14} />
      </IconButton>
      <IconButton size="sm" label="Répartir sur Z (3 objets min.)" disabled={count < 3} onClick={() => distribute(sel(), 'z')}>
        <AlignHorizontalSpaceAround size={14} className="rotate-90" />
      </IconButton>
      <IconButton size="sm" label="Grouper" shortcut="Ctrl+G" onClick={groupSelection}>
        <Group size={14} />
      </IconButton>
      <IconButton size="sm" label="Masquer / afficher" shortcut="H" onClick={() => toggleVisibility()}>
        <EyeOff size={14} />
      </IconButton>
      <IconButton size="sm" label="Verrouiller" shortcut="L" onClick={() => toggleLock()}>
        <Lock size={14} />
      </IconButton>
      <IconButton size="sm" label="Dupliquer" shortcut="Ctrl+D" onClick={duplicateSelection}>
        <Copy size={14} />
      </IconButton>
      <IconButton size="sm" tone="danger" label="Supprimer" shortcut="Suppr" onClick={() => void deleteSelection()}>
        <Trash2 size={14} />
      </IconButton>
    </div>
  );
}

export function InteractionDialog({ obj, onClose }: { obj: SceneObject3D; onClose: () => void }) {
  const it = obj.interaction!;
  const title = it.config?.title || obj.name;
  const url = it.config?.url;
  const safe = isSafeUrl(url);
  return (
    <Modal title={title} onClose={onClose} width={it.type === 'video' ? 'max-w-2xl' : 'max-w-md'}>
      {(it.config?.text || obj.description) && <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{it.config?.text || obj.description}</p>}
      {it.type === 'sheet' && !!it.config?.details?.length && (
        <dl className="mt-3 divide-y divide-navy-500/60 rounded-lg border border-navy-500/60">
          {it.config.details.map((d, i) => (
            <div key={i} className="flex justify-between gap-4 px-3 py-2 text-sm">
              <dt className="text-ink-muted">{d.label}</dt>
              <dd className="text-right text-ink">{d.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {it.type === 'video' &&
        (safe ? (
          <video className="mt-3 w-full rounded-lg bg-black" src={url} controls autoPlay />
        ) : (
          <p className="mt-3 text-sm text-amber-300">Aucune vidéo valide n’est associée à cet objet.</p>
        ))}
      {it.type === 'document' &&
        (safe ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-cyan px-3 py-2 text-sm font-medium text-navy-950">
            Ouvrir le document
          </a>
        ) : (
          <p className="mt-3 text-sm text-amber-300">Aucun document valide n’est associé à cet objet.</p>
        ))}
    </Modal>
  );
}
