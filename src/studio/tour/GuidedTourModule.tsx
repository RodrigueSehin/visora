import { AlertTriangle, ArrowDown, ArrowUp, Camera, Play, PlayCircle, Plus, Trash2 } from 'lucide-react';
import { create } from 'zustand';
import { usePlayback } from '../../components/viewport/GuidedTourPlayer';
import { Badge, Button, CommitInput, Field, IconButton, NumberField, Panel, Section, Select, cx } from '../../components/common/ui';
import { useEditor } from '../../store/editor';
import { addGuidedTour, addStep, brokenSteps, moveStep, removeGuidedTour, removeStep, renameGuidedTour, updateStep } from '../../store/planActions';
import { viewport } from '../../three/registry';
import { useSortedScenes } from './ScenesModule';

/** Selected tour / step, shared by the list and the inspector. */
const useSel = create<{ tour: string | null; step: string | null; setTour: (id: string | null) => void; setStep: (id: string | null) => void }>((set) => ({
  tour: null,
  step: null,
  setTour: (tour) => set({ tour, step: null }),
  setStep: (step) => set({ step }),
}));

/** Starts the preview in visitor mode (first-person camera, interactions enabled). */
function preview(tourId: string, index = 0) {
  useEditor.getState().setViewMode('visitor');
  usePlayback.getState().start(tourId, index);
}

export function GuidedToursPanel() {
  const tours = useEditor((s) => s.project?.guidedTours ?? []);
  const scenes = useSortedScenes();
  const sel = useSel();
  const tour = tours.find((t) => t.id === sel.tour) ?? tours[0];
  const name = (id: string) => scenes.find((s) => s.id === id)?.name ?? 'Scène supprimée';
  const broken = new Set(tour ? brokenSteps(tour, scenes) : []);
  return (
    <Panel className="h-full">
      <div className="flex items-center justify-between px-3.5 pb-2 pt-3">
        <h2 className="text-[15px] font-semibold">Parcours guidés</h2>
        <Button size="sm" variant="primary" onClick={() => sel.setTour(addGuidedTour() ?? null)}>
          <Plus size={14} /> Nouveau
        </Button>
      </div>
      <ul className="space-y-1 px-2.5">
        {tours.length === 0 && <li className="px-2 py-4 text-xs text-ink-faint">Aucun parcours. Un parcours enchaîne des scènes avec un commentaire et un cadrage à chaque étape.</li>}
        {tours.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => sel.setTour(t.id)} aria-current={t.id === tour?.id} className={cx('flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-sm', t.id === tour?.id ? 'border-violet bg-violet/10' : 'border-transparent hover:bg-navy-700/60')}>
              <PlayCircle size={17} className="text-violet-400" />
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              <span className="text-xs text-ink-faint">{t.steps.length} ét.</span>
            </button>
          </li>
        ))}
      </ul>
      {tour && (
        <>
          <div className="flex items-center justify-between px-3.5 pb-1 pt-4">
            <h3 className="text-sm font-semibold">Étapes</h3>
            <Button size="sm" disabled={!tour.steps.length} onClick={() => preview(tour.id)}>
              <Play size={13} /> Aperçu
            </Button>
          </div>
          <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2.5 pb-2">
            {tour.steps.map((s, i) => (
              <li key={s.id}>
                <div className={cx('group flex items-center gap-2 rounded-xl border p-2', sel.step === s.id ? 'border-cyan bg-cyan/10' : 'border-transparent hover:bg-navy-700/60')}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet/25 text-xs font-semibold text-violet-400">{i + 1}</span>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      sel.setStep(s.id);
                      useEditor.getState().setActiveScene(s.sceneId);
                    }}
                  >
                    <span className="block truncate text-sm">{s.title}</span>
                    <span className="block truncate text-[11px] text-ink-faint">
                      {name(s.sceneId)} · {s.durationS} s
                    </span>
                    {broken.has(s.id) && (
                      <Badge tone="amber">
                        <AlertTriangle size={10} /> scène absente ou masquée
                      </Badge>
                    )}
                  </button>
                  <div className="flex flex-col opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                    <IconButton size="sm" label="Monter" disabled={i === 0} onClick={() => moveStep(tour.id, s.id, -1)}>
                      <ArrowUp size={12} />
                    </IconButton>
                    <IconButton size="sm" label="Descendre" disabled={i === tour.steps.length - 1} onClick={() => moveStep(tour.id, s.id, 1)}>
                      <ArrowDown size={12} />
                    </IconButton>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="border-t border-navy-500/50 p-3">
            <Button variant="primary" className="w-full" onClick={() => sel.setStep(addStep(tour.id, viewport()?.getView()) ?? null)}>
              <Camera size={14} /> Ajouter l’étape (scène et vue actuelles)
            </Button>
            <p className="mt-1.5 text-[11px] text-ink-faint">Astuce : passez en vue « Immersive » pour cadrer la vue avant de l’ajouter.</p>
          </div>
        </>
      )}
    </Panel>
  );
}

export function GuidedTourInspector() {
  const tours = useEditor((s) => s.project?.guidedTours ?? []);
  const scenes = useSortedScenes();
  const sel = useSel();
  const tour = tours.find((t) => t.id === sel.tour) ?? tours[0];
  const step = tour?.steps.find((s) => s.id === sel.step);
  if (!tour)
    return (
      <Panel className="h-full">
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-ink-muted">Créez un parcours pour le configurer.</div>
      </Panel>
    );
  return (
    <Panel className="h-full">
      <div className="px-3.5 pb-2 pt-3">
        <h2 className="text-[15px] font-semibold">{step ? 'Étape' : 'Parcours'}</h2>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3.5 pb-4">
        {step ? (
          <>
            <Section title="Contenu">
              <Field label="Titre" required>
                <CommitInput value={step.title} maxLength={120} aria-label="Titre de l’étape" onCommit={(v) => v.trim() && updateStep(tour.id, step.id, { title: v.trim() })} />
              </Field>
              <Field label="Commentaire (affiché au visiteur)">
                <CommitInput multiline value={step.text ?? ''} aria-label="Commentaire" onCommit={(v) => updateStep(tour.id, step.id, { text: v })} />
              </Field>
              <Field label="Durée (secondes)">
                <NumberField label="Durée" value={step.durationS} min={2} step={1} onCommit={(v) => updateStep(tour.id, step.id, { durationS: Math.min(120, Math.round(v)) })} />
              </Field>
            </Section>
            <Section title="Scène et cadrage">
              <Select label="Scène" value={step.sceneId} onChange={(sceneId) => updateStep(tour.id, step.id, { sceneId, view: scenes.find((s) => s.id === sceneId)?.initialView }, 'Changer la scène de l’étape')} options={scenes.map((s) => ({ value: s.id, label: s.name }))} />
              <p className="text-xs text-ink-muted">
                {step.view ? `Cap ${step.view.yaw}° · inclinaison ${step.view.pitch}° · champ ${step.view.fov}°` : 'Vue initiale de la scène'}
              </p>
              <Button
                className="w-full"
                onClick={() => {
                  const v = viewport()?.getView();
                  if (v) updateStep(tour.id, step.id, { view: v }, 'Cadrer l’étape');
                  else useEditor.getState().toast({ kind: 'info', text: 'Passez en vue « Immersive » (ou ouvrez une scène 360°) pour capturer un cadrage.' });
                }}
              >
                <Camera size={14} /> Capturer la vue actuelle
              </Button>
            </Section>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => preview(tour.id, tour.steps.indexOf(step))}>
                <Play size={14} /> Lire d’ici
              </Button>
              <Button variant="danger" onClick={() => (removeStep(tour.id, step.id), sel.setStep(null))}>
                <Trash2 size={14} /> Supprimer
              </Button>
            </div>
          </>
        ) : (
          <>
            <Section title="Parcours">
              <Field label="Nom">
                <CommitInput value={tour.name} maxLength={80} aria-label="Nom du parcours" onCommit={(v) => renameGuidedTour(tour.id, v)} />
              </Field>
              <p className="text-xs text-ink-muted">
                {tour.steps.length} étape(s) · environ {tour.steps.reduce((a, s) => a + s.durationS + 1, 0)} s. Les visiteurs le lancent depuis le bouton « Parcours guidé ».
              </p>
            </Section>
            <Button
              variant="danger"
              className="w-full"
              onClick={async () => {
                const ok = await useEditor.getState().confirm({ title: `Supprimer « ${tour.name} » ?`, message: 'Action annulable avec Ctrl+Z.', confirmLabel: 'Supprimer', danger: true });
                if (ok) {
                  removeGuidedTour(tour.id);
                  sel.setTour(null);
                }
              }}
            >
              <Trash2 size={14} /> Supprimer le parcours
            </Button>
          </>
        )}
      </div>
    </Panel>
  );
}
