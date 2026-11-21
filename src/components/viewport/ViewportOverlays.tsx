// Studio viewport overlays from the scene editor mockup: joystick, location, scene player,
// site plan and the scene filmstrip. Every control acts on the real project.
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsDown, Map as MapIcon, MapPin, Play, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../../store/editor';
import { homeSceneId } from '../../store/tourActions';
import { viewport } from '../../three/registry';
import type { Scene } from '../../types';
import { PlanCanvas } from '../plan/PlanCanvas';
import { cx } from '../common/ui';
import { usePlayback } from './GuidedTourPlayer';
import { SceneThumb } from './SceneThumb';
import { useViewportUi } from './ViewportScene';

type Go = (sceneId: string, transition?: 'fade' | 'none', durationMs?: number) => void;

const glass = 'border border-white/10 bg-navy-950/75 shadow-panel backdrop-blur-md';

function useSorted(): Scene[] {
  const scenes = useEditor((s) => s.project?.scenes);
  return useMemo(() => [...(scenes ?? [])].sort((a, b) => a.order - b.order), [scenes]);
}

/** Direction pad: walk (first-person 3D) or turn the view (360°, orbit). The centre resets the view. */
function Joystick() {
  const look = (az: number, polar: number) => viewport()?.rotate(az, polar);
  const fwd = (d: number) => {
    const v = viewport();
    if (!v) return;
    if (v.canWalk()) v.walk(d);
    else v.rotate(0, d > 0 ? -12 : 12);
  };
  const btn = 'absolute flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-white/10 hover:text-ink focus-ring';
  return (
    <div role="group" aria-label="Déplacement de la caméra" className={cx('relative h-[84px] w-[84px] shrink-0 rounded-full', glass)}>
      <button type="button" className={cx(btn, 'left-1/2 top-1 -translate-x-1/2')} aria-label="Avancer ou regarder vers le haut" title="Avancer" onClick={() => fwd(1.5)}>
        <ChevronUp size={18} />
      </button>
      <button type="button" className={cx(btn, 'bottom-1 left-1/2 -translate-x-1/2')} aria-label="Reculer ou regarder vers le bas" title="Reculer" onClick={() => fwd(-1.5)}>
        <ChevronDown size={18} />
      </button>
      <button type="button" className={cx(btn, 'left-1 top-1/2 -translate-y-1/2')} aria-label="Tourner à gauche" title="Tourner à gauche" onClick={() => look(20, 0)}>
        <ChevronLeft size={18} />
      </button>
      <button type="button" className={cx(btn, 'right-1 top-1/2 -translate-y-1/2')} aria-label="Tourner à droite" title="Tourner à droite" onClick={() => look(-20, 0)}>
        <ChevronRight size={18} />
      </button>
      <button
        type="button"
        aria-label="Revenir à la vue de départ"
        title="Vue de départ"
        onClick={() => viewport()?.reset()}
        className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40 hover:bg-white/30 focus-ring"
      />
    </div>
  );
}

/** Joystick · current scene · previous / play guided tour / next · site plan. */
export function ViewportNavCluster({ go }: { go: Go }) {
  const sorted = useSorted();
  const activeId = useEditor((s) => s.activeSceneId);
  const tours = useEditor((s) => s.project?.guidedTours);
  const plans = useEditor((s) => s.project?.floorPlans);
  const navigation = useEditor((s) => s.project?.navigation);
  const [planOpen, setPlanOpen] = useState(false);
  const i = sorted.findIndex((s) => s.id === activeId);
  const scene = sorted[i];
  const tour = (tours ?? []).find((t) => t.steps.some((st) => sorted.some((s) => s.id === st.sceneId && !s.hidden)));
  const plan = (plans ?? []).find((p) => p.markers.some((m) => m.sceneId === activeId)) ?? (plans ?? []).find((p) => p.imageFileId);
  if (!scene) return null;

  const play = () => {
    if (!tour) return;
    useEditor.getState().setViewMode('visitor');
    // The player stops when leaving the visitor preview; start it once the mode has switched.
    setTimeout(() => usePlayback.getState().start(tour.id), 0);
  };
  const pill = cx('flex items-center rounded-full', glass);
  const round = 'flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-white/10 focus-ring disabled:cursor-not-allowed disabled:opacity-35';

  return (
    <div className="relative flex items-end justify-between gap-2">
      <div className="pointer-events-auto flex items-center gap-2">
        <Joystick />
        <div className={cx(pill, 'hidden gap-2 px-3.5 py-2 sm:flex')} aria-live="polite">
          <MapPin size={17} className="shrink-0 text-ink-muted" />
          <span className="leading-tight">
            <span className="block max-w-[150px] truncate text-[13px] font-medium text-ink">{scene.name}</span>
            <span className="block text-[11px] text-ink-muted">
              {i + 1} / {sorted.length}
            </span>
          </span>
        </div>
      </div>

      <div className={cx(pill, 'pointer-events-auto gap-1 p-1')} role="group" aria-label="Lecture des scènes">
        <button type="button" className={round} disabled={i <= 0} aria-label="Scène précédente" title="Scène précédente" onClick={() => go(sorted[i - 1].id)}>
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className={cx(round, 'h-10 w-10')}
          disabled={!tour}
          aria-label={tour ? `Lire le parcours « ${tour.name} »` : 'Aucun parcours guidé'}
          title={tour ? `Aperçu du parcours « ${tour.name} »` : 'Aucun parcours guidé : créez-en un dans le module Parcours guidé'}
          onClick={play}
        >
          <Play size={19} fill="currentColor" />
        </button>
        <button type="button" className={round} disabled={i >= sorted.length - 1} aria-label="Scène suivante" title="Scène suivante" onClick={() => go(sorted[i + 1].id)}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          disabled={!plan}
          aria-expanded={planOpen}
          title={plan ? undefined : 'Aucun plan : ajoutez-en un dans le module Plan 2D'}
          onClick={() => setPlanOpen((v) => !v)}
          className={cx(pill, 'gap-2 px-3.5 py-2.5 text-[13px] font-medium text-ink hover:bg-navy-800 focus-ring disabled:cursor-not-allowed disabled:opacity-40')}
        >
          <MapIcon size={17} /> <span className="hidden md:inline">Plan du site</span>
        </button>
      </div>

      {planOpen && plan && (
        <div className={cx('pointer-events-auto absolute bottom-full right-0 mb-2 w-[min(90%,420px)] rounded-2xl p-2', glass)} role="dialog" aria-label={`Plan : ${plan.name}`}>
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-sm font-semibold text-ink">{plan.name}</span>
            <button type="button" aria-label="Fermer le plan" onClick={() => setPlanOpen(false)} className="rounded p-1 text-ink-muted hover:text-ink">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-[45vh] overflow-auto">
            <PlanCanvas
              plan={plan}
              scenes={sorted}
              navigation={navigation ?? []}
              activeSceneId={activeId}
              onSceneClick={(id) => {
                if (id !== activeId) go(id);
                setPlanOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Scene thumbnails at the bottom of the viewport, with scroll arrows. */
export function ViewportFilmstrip({ go }: { go: Go }) {
  const sorted = useSorted();
  const activeId = useEditor((s) => s.activeSceneId);
  const home = useEditor((s) => (s.project ? homeSceneId(s.project) : undefined));
  const strip = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = () => {
    const el = strip.current;
    if (el) setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    const el = strip.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sorted.length]);
  // Keep the active scene in view.
  useEffect(() => {
    strip.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  const scroll = (dir: 1 | -1) => strip.current?.scrollBy({ left: dir * strip.current.clientWidth * 0.8, behavior: 'smooth' });
  const arrow = 'flex h-9 w-7 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-white/10 focus-ring disabled:opacity-25';

  return (
    <div className="pointer-events-auto flex items-center gap-1">
      <button type="button" className={arrow} disabled={!edges.left} onClick={() => scroll(-1)} aria-label="Scènes précédentes">
        <ChevronLeft size={22} />
      </button>
      <div ref={strip} onScroll={measure} role="tablist" aria-label="Scènes de la visite" className="flex min-w-0 flex-1 gap-2 overflow-x-auto scroll-smooth py-0.5 [scrollbar-width:none]">
        {sorted.map((s) => {
          const active = s.id === activeId;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => s.id !== activeId && go(s.id)}
              title={s.hidden ? `${s.name} (masquée aux visiteurs)` : s.name}
              className={cx(
                'group relative h-[68px] w-[112px] shrink-0 overflow-hidden rounded-xl border-2 text-left transition-all focus-ring',
                active ? 'border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.35)]' : 'border-white/15 hover:border-white/40',
                s.hidden && 'opacity-60',
              )}
            >
              <SceneThumb scene={s} className="absolute inset-0 h-full w-full" badge={false} />
              <span className={cx('absolute inset-x-0 bottom-0 truncate px-1.5 py-1 text-center text-[11px] font-medium text-white', active ? 'bg-blue-600/90' : 'bg-navy-950/75')}>
                {s.id === home ? '⌂ ' : ''}
                {s.name}
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" className={arrow} disabled={!edges.right} onClick={() => scroll(1)} aria-label="Scènes suivantes">
        <ChevronRight size={22} />
      </button>
      <button type="button" className={cx(arrow, 'w-6 text-ink-muted')} onClick={() => useViewportUi.getState().set({ filmstrip: false })} aria-label="Masquer les vignettes" title="Masquer les vignettes">
        <ChevronsDown size={16} />
      </button>
    </div>
  );
}
