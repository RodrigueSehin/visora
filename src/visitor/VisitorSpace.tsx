// Visitor space: gallery of published tours and the immersive read-only viewer.
// The viewer loads the *published snapshot* (never the working draft) and records
// anonymous sessions (duration, scenes viewed) used by the creator analytics.
import { Canvas } from '@react-three/fiber';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Compass, Eye, Layers, Loader2, Lock, Map as MapIcon, Maximize2, Minimize2, PlayCircle, Share2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { InteractionDialog } from '../components/viewport/Scene3DViewport';
import { AnnotationMarkers, HotspotMarkers, NavMarkers, SceneBackdrop, useHotspotRunner, useMediaUrl, useSceneTransition } from '../components/viewport/TourLayers';
import { controlOn, DEFAULT_ACCENT } from '../studio/settings/AppearanceModule';
import { Toasts } from '../components/common/Overlays';
import { GuidedTourPlayer, usePlayback } from '../components/viewport/GuidedTourPlayer';
import { PlanCanvas } from '../components/plan/PlanCanvas';
import { SceneObjects } from '../components/viewport/SceneObjects';
import { CameraRig } from '../components/viewport/ViewportScene';
import { SceneThumb } from '../components/viewport/SceneThumb';
import { sceneIcon } from '../lib/sceneIcons';
import { cx } from '../components/common/ui';
import { isSafeUrl } from '../lib/actions';
import { projectTypeLabel } from '../lib/defaultProject';
import { uid } from '../lib/ids';
import { api } from '../services/api';
import { loadPublished, setPublicTourContext, tourAccessHeaders, TourExpiredError, TourLockedError, unlockTour } from '../services/persistence';
import { navigate } from '../router';
import { useEditor } from '../store/editor';
import { webglAvailable } from '../three/thumbnails';
import { viewport } from '../three/registry';
import type { ProjectDoc, SceneObject3D } from '../types';
import { VisoraMark } from '../creator/CreatorLayout';
import { TourCover } from '../creator/DashboardPage';
import { tourUrl } from '../creator/CreatorPages';

type PublicTour = { id: string; name: string; type: ProjectDoc['type']; description?: string; sceneCount: number; publishedAt: string };

function visitorId(): string {
  try {
    let id = localStorage.getItem('visora:visitor-id');
    if (!id) {
      id = uid('vis');
      localStorage.setItem('visora:visitor-id', id);
    }
    return id;
  } catch {
    return uid('vis');
  }
}

function VisitorHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-3 border-b border-white/10 bg-navy-950/80 px-4 py-3 backdrop-blur sm:px-6">
      <button type="button" onClick={() => navigate('/explorer')} className="flex items-center gap-2 focus-ring">
        <VisoraMark className="h-8 w-8" />
        <span className="text-left leading-tight">
          <span className="block text-lg font-bold tracking-wide text-ink">VISORA</span>
          <span className="block text-[10px] text-ink-muted">Explorez les lieux, où que vous soyez.</span>
        </span>
      </button>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </header>
  );
}

export function VisitorExplorer() {
  const [tours, setTours] = useState<PublicTour[] | null>(null);
  const [error, setError] = useState<string>();
  const load = useCallback(() => {
    setError(undefined);
    setTours(null);
    // Only tours whose owner chose "galerie publique"; others are reachable by link only.
    api<PublicTour[]>('/api/public/tours', { auth: false })
      .then(setTours)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(load, [load]);
  return (
    <div className="min-h-screen bg-navy-900 text-ink">
      <VisitorHeader>
        <button type="button" onClick={() => navigate('/')} className="rounded-lg border border-navy-500 px-3 py-1.5 text-sm text-ink-muted hover:text-ink">
          Espace créateur
        </button>
      </VisitorHeader>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold sm:text-3xl">Visites publiées</h1>
        <p className="mt-1 text-sm text-ink-muted">Visites publiées dans la galerie publique VISORA. Glissez pour regarder, ZQSD ou flèches pour vous déplacer.</p>
        {error && (
          <p role="alert" className="mt-6 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Impossible de charger les visites : {error}{' '}
            <button type="button" onClick={load} className="font-semibold underline">
              Réessayer
            </button>
          </p>
        )}
        {!tours && !error && (
          <p className="mt-10 flex items-center gap-2 text-ink-muted" role="status">
            <Loader2 className="animate-spin" size={18} /> Chargement…
          </p>
        )}
        {tours?.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-navy-500 px-6 py-14 text-center">
            <Compass className="text-ink-faint" size={32} />
            <p className="font-medium">Aucune visite publiée</p>
            <p className="text-sm text-ink-muted">Aucune visite n’a encore été ajoutée à la galerie publique. Les visites partagées par lien restent accessibles directement.</p>
          </div>
        )}
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tours?.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => navigate(`/visite/${t.id}`)} className="group block w-full overflow-hidden rounded-2xl border border-navy-500/60 bg-navy-800 text-left transition-colors hover:border-cyan/60 focus-ring">
                <TourCover type={t.type ?? 'other'} className="h-40 w-full rounded-none" />
                <div className="p-4">
                  <p className="font-semibold">{t.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {projectTypeLabel(t.type)} · {t.sceneCount} scène{t.sceneCount > 1 ? 's' : ''}
                  </p>
                  {t.description && <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{t.description}</p>}
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-cyan">
                    <Eye size={15} /> Visiter
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

/** Press-and-hold walking for touch screens (keyboard users have ZQSD / arrows). */
function WalkButton({ direction }: { direction: 1 | -1 }) {
  const timer = useRef<ReturnType<typeof setInterval>>();
  const stop = () => clearInterval(timer.current);
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      aria-label={direction > 0 ? 'Avancer' : 'Reculer'}
      title={direction > 0 ? 'Avancer (maintenir)' : 'Reculer (maintenir)'}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        viewport()?.walk(0.25 * direction);
        timer.current = setInterval(() => viewport()?.walk(0.12 * direction), 40);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && viewport()?.walk(0.6 * direction)}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-navy-950/75 text-ink backdrop-blur hover:bg-navy-800 focus-ring"
    >
      {direction > 0 ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
    </button>
  );
}

/** Password form of a protected tour (the server checks it and returns a time-limited access token). */
function PasswordGate({ name, projectId, onUnlocked }: { name?: string; projectId: string; onUnlocked: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  return (
    <form
      className="w-full max-w-sm space-y-3 rounded-2xl border border-navy-500 bg-navy-800 p-6 text-left"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(undefined);
        try {
          await unlockTour(projectId, password);
          onUnlocked();
        } catch (ex) {
          setErr(ex instanceof Error ? ex.message : String(ex));
          setBusy(false);
        }
      }}
    >
      <div className="flex items-center gap-2 text-ink">
        <Lock size={18} className="text-cyan" />
        <p className="font-semibold">{name ?? 'Visite protégée'}</p>
      </div>
      <p className="text-sm text-ink-muted">Cette visite est protégée. Saisissez le mot de passe communiqué par son auteur.</p>
      <label className="block text-sm">
        <span className="mb-1 block text-ink-muted">Mot de passe</span>
        <input type="password" autoFocus autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-navy-500 bg-navy-900 px-3 py-2 text-ink focus:border-cyan focus:outline-none" />
      </label>
      {err && (
        <p role="alert" className="text-sm text-red-300">
          {err}
        </p>
      )}
      <button type="submit" disabled={!password || busy} className="w-full rounded-lg bg-cyan py-2 text-sm font-semibold text-navy-950 disabled:opacity-50">
        {busy ? 'Vérification…' : 'Accéder à la visite'}
      </button>
    </form>
  );
}

export function VisitorTour({ projectId }: { projectId: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error' | 'locked' | 'expired'>('loading');
  const [error, setError] = useState<string>();
  const [lockedName, setLockedName] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const project = useEditor((s) => s.project);
  const sceneId = useEditor((s) => s.activeSceneId);
  const [action, setAction] = useState<SceneObject3D | null>(null);
  const [scenesOpen, setScenesOpen] = useState(false);
  const [panel, setPanel] = useState<'plan' | 'tours' | null>(null);
  const playing = usePlayback((p) => p.tourId);
  // Embedded on a third-party site: no way back to the gallery.
  const embed = /[?&]embed=1/.test(location.hash);
  const [welcomeDone, setWelcomeDone] = useState(false);
  const appearance = useEditor((s) => (s.readOnly ? s.project?.settings.appearance : undefined));
  const { url: logoUrl } = useMediaUrl(appearance?.logoFileId);
  useEffect(() => () => usePlayback.getState().stop(), []);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const session = useRef<{ id: string; start: number; scenes: Set<string> } | null>(null);

  useEffect(() => {
    let alive = true;
    setState('loading');
    // Model files are fetched through this tour's public endpoint while the viewer is open.
    setPublicTourContext(projectId);
    loadPublished(projectId)
      .then(async (doc) => {
        if (!alive) return;
        if (!doc) return setState('missing');
        await useEditor.getState().init(doc, { readOnly: true, viewMode: 'visitor' });
        setState('ready');
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof TourLockedError) {
          setLockedName(e.tourName);
          return setState('locked');
        }
        if (e instanceof TourExpiredError) return setState('expired');
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      });
    return () => {
      alive = false;
      setPublicTourContext(null);
    };
  }, [projectId, attempt]);

  // Session recording: start when the tour is ready, persist duration on hide/leave.
  useEffect(() => {
    if (state !== 'ready') return;
    const s = { id: crypto.randomUUID(), start: Date.now(), scenes: new Set<string>() };
    session.current = s;
    const vid = visitorId();
    // Idempotent upsert (same id, growing duration). keepalive lets the last call finish on page close.
    const flush = () =>
      void fetch(`/api/public/tours/${encodeURIComponent(projectId)}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...tourAccessHeaders(projectId) },
        body: JSON.stringify({ id: s.id, visitorId: vid, durationMs: Date.now() - s.start, scenesViewed: s.scenes.size }),
        keepalive: true,
      }).catch(() => {});
    flush();
    const t = setInterval(flush, 15_000);
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
      session.current = null;
    };
  }, [state, projectId]);

  useEffect(() => {
    if (sceneId) session.current?.scenes.add(sceneId);
  }, [sceneId]);

  useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === wrap.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  const { go, overlay } = useSceneTransition();
  const { run: runHotspot, dialog: hotspotDialog } = useHotspotRunner(go);

  const onVisitorAction = useCallback((o: SceneObject3D) => {
    const it = o.interaction;
    if (!it) return;
    if (it.type === 'scene' && it.targetId) return go(it.targetId);
    if (it.type === 'link') {
      if (isSafeUrl(it.config?.url)) window.open(it.config!.url, '_blank', 'noopener,noreferrer');
      return;
    }
    setAction(o);
  }, [go]);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: project?.name, url: tourUrl(projectId) });
      else {
        await navigator.clipboard.writeText(tourUrl(projectId));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  if (state !== 'ready' || !project)
    return (
      <div className="flex min-h-screen flex-col bg-navy-900 text-ink">
        <VisitorHeader />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center" role={state === 'loading' ? 'status' : 'alert'}>
          {state === 'loading' && (
            <>
              <Loader2 className="animate-spin text-cyan" size={28} /> Chargement de la visite…
            </>
          )}
          {state === 'missing' && (
            <>
              <p className="text-lg font-semibold">Visite introuvable</p>
              <p className="max-w-md text-sm text-ink-muted">Cette visite n’existe pas ou n’a pas été publiée.</p>
            </>
          )}
          {state === 'error' && <p className="text-sm text-red-300">Erreur de chargement : {error}</p>}
          {state === 'expired' && (
            <>
              <p className="text-lg font-semibold">Lien expiré</p>
              <p className="max-w-md text-sm text-ink-muted">Ce lien de visite n’est plus valide. Demandez un nouveau lien à la personne qui vous l’a partagé.</p>
            </>
          )}
          {state === 'locked' && <PasswordGate name={lockedName} projectId={projectId} onUnlocked={() => setAttempt((n) => n + 1)} />}
          {state !== 'loading' && state !== 'locked' && (
            <button type="button" onClick={() => navigate('/explorer')} className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-navy-950">
              Voir les visites publiées
            </button>
          )}
        </div>
      </div>
    );

  // Hidden scenes are not reachable by visitors.
  const scenes = [...project.scenes].filter((s) => !s.hidden || s.id === sceneId).sort((a, b) => a.order - b.order);
  const scene = scenes.find((s) => s.id === sceneId) ?? scenes[0];
  const idx = scenes.indexOf(scene);
  const plans = [...(project.floorPlans ?? [])].filter((p) => p.imageFileId).sort((a, b) => a.order - b.order);
  // The plan of the floor the visitor is on (fallback: first plan).
  const visitorPlanAll = plans.find((p) => p.markers.some((m) => m.sceneId === sceneId)) ?? plans[0];
  const visitorPlan = controlOn(appearance, 'plan') ? visitorPlanAll : undefined;
  const accent = appearance?.accent ?? DEFAULT_ACCENT;
  const showWelcome = !!appearance?.welcome?.enabled && !welcomeDone;
  const playableTours = !controlOn(appearance, 'tours') ? [] : (project.guidedTours ?? []).filter((t) => t.steps.some((st) => project.scenes.some((x) => x.id === st.sceneId && !x.hidden)));
  const pill = 'flex items-center gap-2 rounded-xl border border-white/10 bg-navy-950/75 px-3 py-2 text-sm text-ink backdrop-blur hover:bg-navy-800 focus-ring';

  return (
    <div ref={wrap} className="relative h-[100dvh] w-full overflow-hidden bg-navy-950 text-ink">
      {webglAvailable() ? (
        <Canvas shadows frameloop="demand" dpr={[1, 1.75]} gl={{ antialias: true }} onCreated={({ gl }) => (gl.toneMapping = THREE.ACESFilmicToneMapping)}>
          <CameraRig scene={scene} />
          <SceneBackdrop scene={scene} showGrid={false} showAxes={false} />
          <SceneObjects onVisitorAction={onVisitorAction} />
          <HotspotMarkers visitor onActivate={runHotspot} />
          <AnnotationMarkers visitor />
          <NavMarkers visitor onNavigate={(n) => go(n.targetSceneId, n.transition, n.durationMs)} />
        </Canvas>
      ) : (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-ink-muted">WebGL n’est pas disponible sur cet appareil : la visite 3D ne peut pas s’afficher.</div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          {!embed && (
            <button type="button" aria-label="Retour aux visites" onClick={() => navigate('/explorer')} className={pill}>
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-navy-950/75 px-3 py-1.5 backdrop-blur">
            {logoUrl && <img src={logoUrl} alt="" className="h-7 max-w-[110px] object-contain" />}
            <div>
            <p className="text-sm font-semibold leading-tight">{project.name}</p>
            <p className="text-[11px] text-ink-muted">
              {scene.name} · {idx + 1}/{scenes.length}
            </p>
            </div>
          </div>
        </div>
        <div className="pointer-events-auto flex gap-2">
          {controlOn(appearance, 'share') && (
            <button type="button" onClick={() => void share()} className={pill} aria-label="Partager la visite">
              {copied ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} />}
              <span className="hidden sm:inline">{copied ? 'Lien copié' : 'Partager'}</span>
            </button>
          )}
          {controlOn(appearance, 'fullscreen') && <button
            type="button"
            aria-label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void wrap.current?.requestFullscreen?.())}
            className={pill}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 sm:p-4">
        {scenesOpen && (
          <ul className="flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-navy-950/80 p-2 backdrop-blur" aria-label="Scènes de la visite">
            {scenes.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={s.id === scene.id}
                  onClick={() => (useEditor.getState().setActiveScene(s.id), setScenesOpen(false))}
                  className={cx('relative block h-[72px] w-[120px] overflow-hidden rounded-xl border-2 text-left', s.id === scene.id ? 'border-cyan' : 'border-white/10 hover:border-white/40')}
                >
                  <SceneThumb scene={s} className="absolute inset-0 h-full w-full" badge={false} />
                  <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 truncate bg-navy-950/80 px-1.5 py-1 text-[11px] font-medium text-white">
                    {s.icon && (() => {
                      const I = sceneIcon(s.icon);
                      return <I size={12} className="shrink-0" aria-hidden />;
                    })()}
                    <span className="truncate">{s.name}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          {visitorPlan && (
            <button type="button" onClick={() => setPanel(panel === 'plan' ? null : 'plan')} className={pill} aria-expanded={panel === 'plan'}>
              <MapIcon size={16} /> Plan
            </button>
          )}
          {playableTours.length > 0 && !playing && (
            <button type="button" onClick={() => setPanel(panel === 'tours' ? null : 'tours')} className={pill} aria-expanded={panel === 'tours'}>
              <PlayCircle size={16} /> Parcours guidé
            </button>
          )}
          {scenes.length > 1 && controlOn(appearance, 'scenes') && (
            <button type="button" onClick={() => setScenesOpen((v) => !v)} className={pill} aria-expanded={scenesOpen}>
              {scenesOpen ? <X size={16} /> : <Layers size={16} />} Scènes
            </button>
          )}
          {scene.kind !== 'panorama' && !scene.lockCamera && (
            <>
              <WalkButton direction={1} />
              <WalkButton direction={-1} />
            </>
          )}
          <p className="hidden rounded-xl bg-navy-950/60 px-3 py-2 text-xs text-ink-muted md:block">Glisser pour regarder · ZQSD / flèches pour avancer · cliquer un objet interactif</p>
        </div>
      </div>
      {overlay}
      <GuidedTourPlayer go={go} />
      {showWelcome && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-navy-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Accueil de la visite">
          <div className="max-w-md rounded-2xl border border-white/10 bg-navy-900/95 p-6 text-center shadow-panel">
            {logoUrl && <img src={logoUrl} alt="" className="mx-auto mb-3 h-12 max-w-[180px] object-contain" />}
            <h1 className="text-xl font-bold text-ink">{appearance?.welcome?.title || project.name}</h1>
            {(appearance?.welcome?.text || project.description) && <p className="mt-2 whitespace-pre-line text-sm text-ink-muted">{appearance?.welcome?.text || project.description}</p>}
            <button type="button" autoFocus onClick={() => setWelcomeDone(true)} className="mt-5 rounded-xl px-5 py-2.5 text-sm font-semibold text-navy-950" style={{ background: accent }}>
              Commencer la visite
            </button>
          </div>
        </div>
      )}
      {panel === 'plan' && visitorPlan && (
        <div className="absolute bottom-24 left-3 z-30 w-[min(92vw,440px)] rounded-2xl border border-white/10 bg-navy-950/90 p-2 backdrop-blur" role="dialog" aria-label={`Plan : ${visitorPlan.name}`}>
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-sm font-semibold text-ink">{visitorPlan.name}</span>
            <button type="button" aria-label="Fermer le plan" onClick={() => setPanel(null)} className="rounded p-1 text-ink-muted hover:text-ink">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-[50vh] overflow-auto">
            <PlanCanvas
              plan={{
                ...visitorPlan,
                markers: visitorPlan.markers.filter((m) => !m.hidden && !project.scenes.find((x) => x.id === m.sceneId)?.hidden),
                hotspotPins: (visitorPlan.hotspotPins ?? []).filter((p) => {
                  const h = project.hotspots?.find((x) => x.id === p.hotspotId);
                  return h && !project.scenes.find((x) => x.id === h.sceneId)?.hidden;
                }),
              }}
              scenes={project.scenes}
              navigation={project.navigation ?? []}
              hotspots={project.hotspots}
              activeSceneId={sceneId}
              onSceneClick={(id) => {
                if (id !== sceneId) go(id);
                setPanel(null);
              }}
              onPinClick={(_, hotspotId) => {
                const h = project.hotspots?.find((x) => x.id === hotspotId);
                if (!h) return;
                if (h.sceneId !== sceneId) go(h.sceneId);
                setPanel(null);
                runHotspot(h);
              }}
            />
          </div>
        </div>
      )}
      {panel === 'tours' && (
        <div className="absolute bottom-24 left-1/2 z-30 w-[min(92vw,360px)] -translate-x-1/2 rounded-2xl border border-white/10 bg-navy-950/90 p-2 backdrop-blur" role="dialog" aria-label="Parcours guidés">
          {playableTours.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                usePlayback.getState().start(t.id);
                setPanel(null);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-ink hover:bg-navy-700"
            >
              <PlayCircle size={18} className="text-violet-400" />
              <span className="flex-1">{t.name}</span>
              <span className="text-xs text-ink-muted">{t.steps.length} étapes</span>
            </button>
          ))}
        </div>
      )}
      {action && <InteractionDialog obj={action} onClose={() => setAction(null)} />}
      {hotspotDialog}
      <Toasts />
    </div>
  );
}
