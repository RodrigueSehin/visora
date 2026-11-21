// Guided tour playback (Studio preview and visitor viewer).
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { useEditor } from '../../store/editor';
import { viewport } from '../../three/registry';
import { cx } from '../common/ui';

type Playback = {
  tourId: string | null;
  index: number;
  playing: boolean;
  start: (tourId: string, index?: number) => void;
  stop: () => void;
  goto: (index: number) => void;
  setPlaying: (v: boolean) => void;
};

export const usePlayback = create<Playback>((set) => ({
  tourId: null,
  index: 0,
  playing: false,
  start: (tourId, index = 0) => set({ tourId, index, playing: true }),
  stop: () => set({ tourId: null, index: 0, playing: false }),
  goto: (index) => set({ index }),
  setPlaying: (playing) => set({ playing }),
}));

const TRANSITION_MS = 800;

export function GuidedTourPlayer({ go }: { go: (sceneId: string, transition?: 'fade' | 'none', durationMs?: number) => void }) {
  const { tourId, index, playing } = usePlayback();
  const tour = useEditor((s) => s.project?.guidedTours?.find((t) => t.id === tourId));
  const scenes = useEditor((s) => s.project?.scenes);
  const steps = (tour?.steps ?? []).filter((st) => scenes?.some((s) => s.id === st.sceneId));
  const step = steps[index];
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Show the step: change scene if needed, then turn the camera to the step view.
  useEffect(() => {
    if (!step) return;
    const clear = () => timers.current.forEach(clearTimeout);
    clear();
    const needsScene = useEditor.getState().activeSceneId !== step.sceneId;
    if (needsScene) go(step.sceneId, 'fade', TRANSITION_MS);
    const view = step.view ?? scenes?.find((s) => s.id === step.sceneId)?.initialView;
    if (view) timers.current.push(setTimeout(() => viewport()?.setView(view), needsScene ? TRANSITION_MS + 150 : 0));
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id, tourId]);

  // Auto-advance while playing.
  useEffect(() => {
    if (!step || !playing) return;
    const t = setTimeout(() => {
      if (index < steps.length - 1) usePlayback.getState().goto(index + 1);
      else usePlayback.getState().setPlaying(false);
    }, step.durationS * 1000 + TRANSITION_MS);
    return () => clearTimeout(t);
  }, [step, playing, index, steps.length]);

  useEffect(() => {
    if (!tourId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') usePlayback.getState().stop();
      if (e.key === 'ArrowRight' && e.altKey) usePlayback.getState().goto(Math.min(steps.length - 1, index + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tourId, index, steps.length]);

  if (!tourId || !tour) return null;
  if (!step)
    return (
      <div className="absolute inset-x-0 bottom-24 z-40 flex justify-center">
        <div className="flex items-center gap-3 rounded-xl border border-navy-500 bg-navy-900/95 px-4 py-3 text-sm text-ink" role="status">
          Ce parcours n’a aucune étape jouable.
          <button type="button" onClick={() => usePlayback.getState().stop()} className="text-cyan hover:underline">
            Fermer
          </button>
        </div>
      </div>
    );

  const pb = usePlayback.getState();
  return (
    <div className="absolute inset-x-0 bottom-20 z-40 flex justify-center px-3" role="region" aria-label={`Parcours guidé : ${tour.name}`}>
      <div className="w-full max-w-xl rounded-2xl border border-violet/50 bg-navy-900/95 p-4 shadow-panel backdrop-blur">
        <div className="mb-2 flex gap-1" aria-hidden>
          {steps.map((s, i) => (
            <span key={s.id} className={cx('h-1 flex-1 rounded-full', i < index ? 'bg-violet' : i === index ? 'bg-cyan' : 'bg-navy-600')} />
          ))}
        </div>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1" aria-live="polite">
            <p className="text-[11px] font-medium uppercase tracking-wide text-violet-400">
              {tour.name} · étape {index + 1}/{steps.length}
            </p>
            <p className="mt-0.5 text-base font-semibold text-ink">{step.title}</p>
            {step.text && <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">{step.text}</p>}
          </div>
          <button type="button" aria-label="Quitter le parcours (Échap)" onClick={() => pb.stop()} className="rounded-lg p-1 text-ink-muted hover:bg-navy-700 hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          <button type="button" aria-label="Étape précédente" disabled={index === 0} onClick={() => pb.goto(index - 1)} className="rounded-xl border border-navy-500 p-2 text-ink disabled:opacity-30 hover:bg-navy-700">
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label={playing ? 'Pause' : 'Lecture'} onClick={() => pb.setPlaying(!playing)} className="rounded-xl bg-cyan p-2 text-navy-950 hover:brightness-110">
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button type="button" aria-label="Étape suivante" disabled={index >= steps.length - 1} onClick={() => pb.goto(index + 1)} className="rounded-xl border border-navy-500 p-2 text-ink disabled:opacity-30 hover:bg-navy-700">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
