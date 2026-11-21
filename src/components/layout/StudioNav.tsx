import { Box, Compass, Image, Map as MapIcon, Palette, PenLine, PlayCircle, Settings, Share2, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '../common/ui';

export type ModuleId = 'scenes' | 'navigation' | 'hotspots' | 'media' | 'plan' | 'objects' | 'annotations' | 'tour' | 'appearance' | 'settings';

export const MODULES: { id: ModuleId; label: string; icon: ReactNode }[] = [
  { id: 'scenes', label: 'Scènes', icon: <Compass size={19} /> },
  { id: 'navigation', label: 'Navigation', icon: <Share2 size={19} /> },
  { id: 'hotspots', label: 'Hotspots', icon: <Target size={19} /> },
  { id: 'media', label: 'Médias', icon: <Image size={19} /> },
  { id: 'plan', label: 'Plan 2D', icon: <MapIcon size={19} /> },
  { id: 'objects', label: 'Objets 3D', icon: <Box size={19} /> },
  { id: 'annotations', label: 'Annotations', icon: <PenLine size={19} /> },
  { id: 'tour', label: 'Parcours guidé', icon: <PlayCircle size={19} /> },
  { id: 'appearance', label: 'Apparence', icon: <Palette size={19} /> },
  { id: 'settings', label: 'Paramètres', icon: <Settings size={19} /> },
];

export function StudioNav({ active, onChange }: { active: ModuleId; onChange: (m: ModuleId) => void }) {
  return (
    <nav aria-label="Modules du Studio" className="hidden w-[68px] shrink-0 flex-col gap-1.5 bg-navy-950 p-2 pt-3 md:flex xl:w-[180px]">
      {MODULES.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          aria-current={active === m.id ? 'page' : undefined}
          title={m.label}
          className={cx(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-ring',
            active === m.id ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-glow' : 'text-ink hover:bg-navy-700',
          )}
        >
          <span className="shrink-0">{m.icon}</span>
          <span className="hidden truncate xl:inline">{m.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function ModuleUnavailable({ id, onBack }: { id: ModuleId; onBack: () => void }) {
  const m = MODULES.find((x) => x.id === id)!;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-navy-500/50 bg-navy-800/60 p-8 text-center">
      <div className="rounded-2xl bg-navy-700 p-4 text-cyan">{m.icon}</div>
      <h2 className="text-lg font-semibold text-ink">Module « {m.label} »</h2>
      <p className="max-w-md text-sm text-ink-muted">
        Ce module n’est pas inclus dans cette version du Studio. Le module Objets 3D partage déjà ses modèles de données (scènes, actions des hotspots) pour s’y intégrer.
      </p>
      <button type="button" onClick={onBack} className="mt-2 rounded-lg bg-cyan px-3.5 py-2 text-sm font-medium text-navy-950 focus-ring">
        Retour à Objets 3D
      </button>
    </div>
  );
}
