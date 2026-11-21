import { Building2, Factory, FlaskConical, Home, Loader2, Shapes, Warehouse, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PROJECT_TYPES } from '../lib/defaultProject';
import { navigate } from '../router';
import { useWorkspace } from '../store/workspace';
import type { ProjectType } from '../types';
import { cx } from '../components/common/ui';

export const TYPE_ICON: Record<ProjectType, typeof Home> = {
  'real-estate': Home,
  logistics: Warehouse,
  laboratory: FlaskConical,
  industry: Factory,
  other: Shapes,
};

export function LightModal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('keydown', esc);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="lm-title" className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="lm-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button type="button" aria-label="Fermer" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

const lightInput = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1E8BE0] focus:outline-none focus:ring-2 focus:ring-[#36C8F4]/40';

export function CreateTourDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('logistics');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const p = await useWorkspace.getState().createProject({ name, type, description: description.trim() || undefined });
      onClose();
      navigate(`/studio/${p.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <LightModal
      title="Créer une visite"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void create()}
            disabled={!name.trim() || busy}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E8BE0] to-[#36C8F4] px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
          >
            {busy && <Loader2 size={15} className="animate-spin" />} Créer et ouvrir le Studio
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Nom de la visite <span className="text-[#1E8BE0]">*</span>
          </span>
          <input className={lightInput} value={name} maxLength={80} placeholder="ex. Entrepôt Logistique – Abidjan" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void create()} />
        </label>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Type de lieu</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {PROJECT_TYPES.map((t) => {
              const Icon = TYPE_ICON[t.id];
              const on = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setType(t.id)}
                  className={cx('flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-colors', on ? 'border-[#1E8BE0] bg-[#1E8BE0]/5 text-slate-900 ring-1 ring-[#1E8BE0]' : 'border-slate-200 text-slate-600 hover:border-slate-300')}
                >
                  <Icon size={20} style={{ color: t.color }} />
                  {t.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <Building2 size={13} /> Des scènes de départ adaptées au type sont créées ; vous pourrez les renommer ou en ajouter.
          </p>
        </fieldset>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
          <textarea className={cx(lightInput, 'min-h-[72px]')} value={description} maxLength={400} onChange={(e) => setDescription(e.target.value)} placeholder="Optionnelle — affichée dans l’espace visiteur" />
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Création impossible : {error}
          </p>
        )}
      </div>
    </LightModal>
  );
}
