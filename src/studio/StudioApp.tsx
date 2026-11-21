import { FolderTree, Library, Loader2, PanelLeft, PanelRight, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { ConfirmDialog, ConflictDialog, Toasts } from '../components/common/Overlays';
import { Button, IconButton, cx } from '../components/common/ui';
import { ObjectHierarchyPanel } from '../components/hierarchy/ObjectHierarchyPanel';
import { ObjectPropertiesInspector } from '../components/inspector/ObjectPropertiesInspector';
import { ObjectLibraryPanel } from '../components/library/ObjectLibraryPanel';
import { ObjectStatusBar } from '../components/layout/ObjectStatusBar';
import { TourSummaryBar } from '../components/layout/TourSummaryBar';
import { MODULES, ModuleUnavailable, StudioNav, type ModuleId } from '../components/layout/StudioNav';
import { TopBar } from '../components/layout/TopBar';
import { Scene3DViewport } from '../components/viewport/Scene3DViewport';
import { useAutosave, useKeyboardShortcuts, useMediaQuery, useRemoteSaveNotice, useUnsavedGuard } from '../hooks';
import { useEditor, type StudioModule } from '../store/editor';
import { navigate, setNavigationGuard } from '../router';
import { lastProjectId, loadProject, rememberLastProject } from '../services/persistence';
import { MediaModule } from './media/MediaModule';
import { HotspotInspector, HotspotsBottom, HotspotsPanel } from './tour/HotspotsModule';
import { NavigationBottom, NavigationInspector, NavigationPanel } from './tour/NavigationModule';
import { SceneInspector, ScenesPanel } from './tour/ScenesModule';
import { PlanModule } from './plan/PlanModule';
import { SettingsModule } from './settings/SettingsModule';
import { AppearanceModule } from './settings/AppearanceModule';
import { AnnotationInspector, AnnotationsPanel } from './tour/AnnotationsModule';
import { GuidedTourInspector, GuidedToursPanel } from './tour/GuidedTourModule';

/** Opens a project in the Studio: by id, otherwise the last opened one. */
async function openProject(projectId?: string): Promise<'ok' | 'missing'> {
  if (!projectId) {
    const last = lastProjectId();
    navigate(last ? `/studio/${last}` : '/tours');
    return 'ok';
  }
  const doc = await loadProject(projectId);
  if (!doc) return 'missing';
  rememberLastProject(projectId);
  await useEditor.getState().init(doc);
  return 'ok';
}

const IMPLEMENTED: StudioModule[] = ['scenes', 'navigation', 'hotspots', 'media', 'objects', 'plan', 'tour', 'annotations', 'appearance', 'settings'];

export default function StudioApp({ projectId }: { projectId?: string }) {
  const loadState = useEditor((s) => s.loadState);
  const loadError = useEditor((s) => s.loadError);
  const readOnly = useEditor((s) => s.readOnly);
  const storeModule = useEditor((s) => s.module);
  // Modules not implemented yet are shown as such (they never change the store module).
  const [pending, setPending] = useState<ModuleId | null>(null);
  const [missing, setMissing] = useState(false);
  const active: ModuleId = pending ?? storeModule;

  useEffect(() => {
    setMissing(false);
    useEditor.setState({ loadState: 'loading' });
    openProject(projectId)
      .then((r) => setMissing(r === 'missing'))
      .catch((e) => useEditor.setState({ loadState: 'error', loadError: e instanceof Error ? e.message : String(e) }));
  }, [projectId]);

  // Leaving the Studio with unsaved changes asks for confirmation.
  useEffect(() => {
    setNavigationGuard(() => !useEditor.getState().dirty || confirm('Des modifications ne sont pas enregistrées. Quitter le Studio quand même ?'));
    return () => setNavigationGuard(null);
  }, []);

  const ready = loadState === 'ready' && !missing && !readOnly;
  useKeyboardShortcuts(ready && !pending && storeModule !== 'media');
  useAutosave();
  useUnsavedGuard();
  useRemoteSaveNotice();

  const change = (m: ModuleId) => {
    if ((IMPLEMENTED as string[]).includes(m)) {
      setPending(null);
      useEditor.getState().setModule(m as StudioModule);
    } else setPending(m);
  };

  if (missing)
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
        <p className="text-ink">Projet introuvable.</p>
        <p className="max-w-md text-sm text-ink-muted">Ce projet n’existe pas ou vous n’y avez pas accès.</p>
        <Button variant="primary" onClick={() => navigate('/tours')}>
          Voir mes visites
        </Button>
      </div>
    );
  if (loadState === 'loading' || readOnly)
    return (
      <div className="flex h-screen items-center justify-center gap-3 text-ink-muted" role="status">
        <Loader2 className="animate-spin text-cyan" /> Chargement du projet…
      </div>
    );
  if (loadState === 'error')
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
        <p className="text-ink">Impossible d’ouvrir le projet.</p>
        <p className="max-w-md text-sm text-ink-muted">{loadError}</p>
        <Button variant="primary" onClick={() => void openProject(projectId)}>
          Réessayer
        </Button>
      </div>
    );

  let content: ReactNode;
  if (pending) content = <ModuleUnavailable id={pending} onBack={() => change('objects')} />;
  else if (storeModule === 'media') content = <MediaModule />;
  else if (storeModule === 'plan') content = <PlanModule />;
  else if (storeModule === 'settings') content = <SettingsModule />;
  else if (storeModule === 'appearance') content = <AppearanceModule />;
  else if (storeModule === 'annotations') content = <ViewportWorkspace left={<AnnotationsPanel />} right={<AnnotationInspector />} leftLabel="Annotations" rightLabel="Annotation" />;
  else if (storeModule === 'tour') content = <ViewportWorkspace left={<GuidedToursPanel />} right={<GuidedTourInspector />} leftLabel="Parcours guidés" rightLabel="Étape" />;
  else if (storeModule === 'scenes') content = <ViewportWorkspace left={<ScenesPanel />} right={<SceneInspector />} leftLabel="Scènes" rightLabel="Propriétés de la scène" />;
  else if (storeModule === 'navigation')
    content = <ViewportWorkspace left={<NavigationPanel />} right={<NavigationInspector />} bottom={<NavigationBottom />} leftLabel="Réseau de navigation" rightLabel="Propriétés de la navigation" />;
  else if (storeModule === 'hotspots') content = <ViewportWorkspace left={<HotspotsPanel />} right={<HotspotInspector />} bottom={<HotspotsBottom />} leftLabel="Hotspots" rightLabel="Propriétés du hotspot" />;
  else content = <ObjectsWorkspace />;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-navy-950 text-ink">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <StudioNav active={active} onChange={change} />
        <main className="min-w-0 flex-1 p-2 pb-0 md:p-3 md:pb-0 md:pl-0">{content}</main>
      </div>
      <MobileModuleBar active={active} onChange={change} />
      {active === 'objects' ? <ObjectStatusBar /> : <TourSummaryBar />}
      <Toasts />
      <ConfirmDialog />
      <ConflictDialog />
    </div>
  );
}

/**
 * Left panel · viewport (+ optional bottom strip) · right panel. On narrow screens the side
 * panels become drawers over the viewport.
 */
function ViewportWorkspace({
  left,
  right,
  bottom,
  leftLabel,
  rightLabel,
  leftIcon = <PanelLeft size={16} />,
  rightIcon = <PanelRight size={16} />,
}: {
  left: ReactNode;
  right: ReactNode;
  bottom?: ReactNode;
  leftLabel: string;
  rightLabel: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}) {
  const panels = useEditor((s) => s.panels);
  const togglePanel = useEditor((s) => s.togglePanel);
  const visitor = useEditor((s) => s.viewMode === 'visitor');
  const wide = useMediaQuery('(min-width: 1180px)');

  useEffect(() => {
    togglePanel('library', wide);
    togglePanel('inspector', wide);
  }, [wide, togglePanel]);

  const showLeft = panels.library && !visitor;
  const showRight = panels.inspector && !visitor;

  return (
    <div className="relative flex h-full min-h-0 gap-3">
      {wide && showLeft && <aside className="flex w-[300px] shrink-0 flex-col pb-3 2xl:w-[330px]">{left}</aside>}
      <section className="flex min-w-0 flex-1 flex-col gap-2 pb-2 md:gap-3 md:pb-3">
        <div className="relative min-h-0 flex-1">
          <Scene3DViewport />
          {!visitor && (!showLeft || !showRight || !wide) && (
            <div className="absolute left-3 top-16 z-30 flex flex-col gap-1 rounded-xl border border-white/10 bg-navy-950/75 p-1 backdrop-blur-md">
              {(!showLeft || !wide) && (
                <IconButton label={leftLabel} tooltipSide="right" active={showLeft} onClick={() => togglePanel('library')}>
                  {leftIcon}
                </IconButton>
              )}
              {(!showRight || !wide) && (
                <IconButton label={rightLabel} tooltipSide="right" active={showRight} onClick={() => togglePanel('inspector')}>
                  {rightIcon}
                </IconButton>
              )}
            </div>
          )}
        </div>
        {!visitor && bottom}
      </section>
      {wide && showRight && <aside className="flex w-[340px] shrink-0 flex-col pb-3 2xl:w-[380px]">{right}</aside>}
      {!wide && (showLeft || showRight) && (
        <div className="absolute inset-0 z-40 flex" onMouseDown={(e) => e.target === e.currentTarget && (togglePanel('library', false), togglePanel('inspector', false))}>
          <div className={cx('flex h-full w-full max-w-[360px] flex-col pb-2 drop-shadow-2xl', showRight && !showLeft && 'ml-auto')}>{showLeft ? left : right}</div>
        </div>
      )}
    </div>
  );
}

function ObjectsWorkspace() {
  const hasSelection = useEditor((s) => s.selection.length > 0);
  const [hierCollapsed, setHierCollapsed] = useState(false);
  return (
    <ViewportWorkspace
      left={<ObjectLibraryPanel onClose={() => useEditor.getState().togglePanel('library', false)} />}
      right={
        <div className="flex h-full min-h-0 flex-col gap-2 md:gap-3">
          <ObjectHierarchyPanel collapsed={hierCollapsed} onToggle={() => setHierCollapsed((v) => !v)} />
          <ObjectPropertiesInspector onClose={() => useEditor.getState().togglePanel('inspector', false)} />
        </div>
      }
      leftLabel="Bibliothèque d’objets"
      rightLabel="Hiérarchie et propriétés"
      leftIcon={<Library size={16} />}
      rightIcon={hasSelection ? <SlidersHorizontal size={16} /> : <FolderTree size={16} />}
    />
  );
}

function MobileModuleBar({ active, onChange }: { active: ModuleId; onChange: (m: ModuleId) => void }) {
  return (
    <nav aria-label="Modules du Studio" className="flex shrink-0 gap-1 overflow-x-auto border-t border-navy-500/50 bg-navy-900 px-2 py-1 md:hidden">
      {MODULES.map((m) => (
        <button
          key={m.id}
          type="button"
          aria-current={active === m.id ? 'page' : undefined}
          onClick={() => onChange(m.id)}
          className={cx('flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-2.5 py-1 text-[10px]', active === m.id ? 'bg-cyan/15 text-cyan' : 'text-ink-muted')}
        >
          {m.icon}
          {m.label}
        </button>
      ))}
    </nav>
  );
}
