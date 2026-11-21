import { Crosshair, Eye, EyeOff, Plus, StickyNote, Trash2 } from 'lucide-react';
import { Button, CommitInput, Field, Panel, Section, Select, cx } from '../../components/common/ui';
import { useEditor } from '../../store/editor';
import { addAnnotation, removeAnnotation, updateAnnotation } from '../../store/tourActions';
import type { Annotation } from '../../types';

export function AnnotationsPanel() {
  const sceneId = useEditor((s) => s.activeSceneId);
  const scene = useEditor((s) => s.project?.scenes.find((x) => x.id === s.activeSceneId));
  const notes = useEditor((s) => (s.project?.annotations ?? []).filter((a) => a.sceneId === s.activeSceneId));
  const focus = useEditor((s) => s.focus);
  return (
    <Panel className="h-full">
      <div className="flex items-center justify-between px-3.5 pb-2 pt-3">
        <div>
          <h2 className="text-[15px] font-semibold">Annotations ({notes.length})</h2>
          <p className="truncate text-xs text-ink-muted">Scène : {scene?.name}</p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            const id = addAnnotation(sceneId);
            if (id) useEditor.getState().setPlacement({ kind: 'annotation', id });
          }}
        >
          <Plus size={14} /> Ajouter
        </Button>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2.5 pb-3">
        {notes.length === 0 && (
          <li className="px-2 py-8 text-center text-xs text-ink-faint">
            <StickyNote className="mx-auto mb-2" size={22} />
            Notes pour l’équipe (consignes, points à vérifier) ou libellés publics. Cliquez sur « Ajouter » puis dans la vue.
          </li>
        )}
        {notes.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => useEditor.getState().setFocus({ kind: 'annotation', id: n.id })}
              className={cx('flex w-full items-center gap-2.5 rounded-xl border p-2 text-left', focus?.id === n.id ? 'border-cyan bg-cyan/10' : 'border-transparent hover:bg-navy-700/60')}
            >
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: n.color ?? '#F59E0B' }} />
              <span className="min-w-0 flex-1 truncate text-sm">{n.text}</span>
              {n.visibility === 'public' ? <Eye size={13} className="text-emerald-400" aria-label="Visible des visiteurs" /> : <EyeOff size={13} className="text-ink-faint" aria-label="Studio uniquement" />}
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function AnnotationInspector() {
  const n = useEditor((s) => (s.focus?.kind === 'annotation' ? s.project?.annotations?.find((a) => a.id === s.focus!.id) : undefined));
  if (!n)
    return (
      <Panel className="h-full">
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-ink-muted">Sélectionnez une annotation dans la liste ou dans la vue.</div>
      </Panel>
    );
  const set = (patch: Partial<Annotation>, label?: string) => updateAnnotation(n.id, patch, label);
  return (
    <Panel className="h-full">
      <div className="px-3.5 pb-2 pt-3">
        <h2 className="text-[15px] font-semibold">Annotation</h2>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3.5 pb-4">
        <Section title="Contenu">
          <Field label="Texte">
            <CommitInput multiline value={n.text} maxLength={500} aria-label="Texte de l’annotation" onCommit={(v) => v.trim() && set({ text: v.trim() }, 'Texte de l’annotation')} />
          </Field>
          <Field label="Visibilité">
            <Select
              label="Visibilité"
              value={n.visibility}
              onChange={(visibility) => set({ visibility }, 'Visibilité de l’annotation')}
              options={[
                { value: 'studio', label: 'Studio uniquement (note d’équipe)' },
                { value: 'public', label: 'Visible des visiteurs (libellé)' },
              ]}
            />
          </Field>
          <Field label="Couleur">
            <input type="color" aria-label="Couleur" value={n.color ?? '#F59E0B'} onChange={(e) => set({ color: e.target.value }, 'Couleur de l’annotation')} className="h-8 w-10 cursor-pointer rounded border border-navy-500 bg-transparent" />
          </Field>
        </Section>
        <Button
          className="w-full"
          onClick={() => {
            const st = useEditor.getState();
            st.setActiveScene(n.sceneId);
            st.setFocus({ kind: 'annotation', id: n.id });
            st.setPlacement({ kind: 'annotation', id: n.id });
          }}
        >
          <Crosshair size={14} /> Placer dans la vue
        </Button>
      </div>
      <div className="border-t border-navy-500/50 p-3">
        <Button variant="danger" className="w-full" onClick={() => removeAnnotation(n.id)}>
          <Trash2 size={14} /> Supprimer
        </Button>
      </div>
    </Panel>
  );
}
