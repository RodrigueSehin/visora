import { Layers, Map as MapIcon, Maximize2, PlayCircle, Share2 } from 'lucide-react';
import { CommitInput, Field, Panel, Section, Toggle } from '../../components/common/ui';
import { useMediaUrl } from '../../components/viewport/TourLayers';
import { useEditor } from '../../store/editor';
import { updateAppearance } from '../../store/tourActions';
import type { Appearance } from '../../types';
import { MediaField } from '../media/MediaPicker';

export const DEFAULT_ACCENT = '#36C8F4';
const CONTROLS: { k: keyof NonNullable<Appearance['controls']>; label: string; icon: typeof MapIcon }[] = [
  { k: 'scenes', label: 'Liste des scènes', icon: Layers },
  { k: 'plan', label: 'Plan du site', icon: MapIcon },
  { k: 'tours', label: 'Parcours guidés', icon: PlayCircle },
  { k: 'share', label: 'Bouton Partager', icon: Share2 },
  { k: 'fullscreen', label: 'Plein écran', icon: Maximize2 },
];
export const controlOn = (a: Appearance | undefined, k: keyof NonNullable<Appearance['controls']>) => a?.controls?.[k] !== false;

export function AppearanceModule() {
  const p = useEditor((s) => s.project);
  const a = p?.settings.appearance ?? {};
  const { url: logo } = useMediaUrl(a.logoFileId);
  if (!p) return null;
  const accent = a.accent ?? DEFAULT_ACCENT;
  const welcome = a.welcome ?? { enabled: false };
  return (
    <div className="h-full overflow-y-auto pb-6">
      <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel className="space-y-5 p-4">
          <Section title="Identité">
            <Field label="Couleur d’accent">
              <div className="flex items-center gap-3">
                <input type="color" aria-label="Couleur d’accent" value={accent} onChange={(e) => updateAppearance({ accent: e.target.value }, 'Couleur d’accent', 'accent')} className="h-9 w-12 cursor-pointer rounded border border-navy-500 bg-transparent" />
                <span className="font-mono text-xs text-ink-muted">{accent}</span>
                {a.accent && (
                  <button type="button" className="text-xs text-cyan hover:underline" onClick={() => updateAppearance({ accent: undefined }, 'Couleur par défaut')}>
                    Couleur VISORA
                  </button>
                )}
              </div>
            </Field>
            <Field group label="Logo (affiché en haut à gauche de la visite)">
              <MediaField label="Logo" kinds={['image', 'texture']} value={a.logoFileId} onChange={(logoFileId) => updateAppearance({ logoFileId }, 'Changer le logo')} />
            </Field>
          </Section>
          <Section title="Écran d’accueil">
            <Toggle label="Afficher un écran d’accueil" hint="Présenté avant d’entrer dans la visite" checked={welcome.enabled} onChange={(enabled) => updateAppearance({ welcome: { ...welcome, enabled } }, 'Écran d’accueil')} />
            {welcome.enabled && (
              <>
                <Field label="Titre">
                  <CommitInput value={welcome.title ?? ''} placeholder={p.name} maxLength={120} aria-label="Titre d’accueil" onCommit={(v) => updateAppearance({ welcome: { ...welcome, title: v.trim() || undefined } }, 'Titre d’accueil')} />
                </Field>
                <Field label="Texte">
                  <CommitInput multiline value={welcome.text ?? ''} placeholder={p.description ?? 'Bienvenue…'} aria-label="Texte d’accueil" onCommit={(v) => updateAppearance({ welcome: { ...welcome, text: v.trim() || undefined } }, 'Texte d’accueil')} />
                </Field>
              </>
            )}
          </Section>
          <Section title="Commandes du visiteur">
            {CONTROLS.map((c) => (
              <Toggle key={c.k} label={c.label} checked={controlOn(a, c.k)} onChange={(v) => updateAppearance({ controls: { ...a.controls, [c.k]: v } }, 'Commandes du visiteur')} />
            ))}
          </Section>
          <p className="text-[11px] text-ink-faint">L’apparence fait partie de la visite : elle est enregistrée avec le projet et visible des visiteurs après publication.</p>
        </Panel>

        <Panel className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Aperçu</h2>
          <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-b from-slate-500 to-slate-700" aria-label="Aperçu de l’apparence">
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-xl bg-navy-950/80 px-2.5 py-1.5">
              {logo && <img src={logo} alt="" className="h-6 max-w-[90px] object-contain" />}
              <span className="text-xs font-semibold text-white">{p.name}</span>
            </div>
            {welcome.enabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-navy-950/70">
                <div className="max-w-[80%] rounded-xl bg-navy-900/95 p-4 text-center">
                  <p className="text-sm font-semibold text-white">{welcome.title || p.name}</p>
                  {(welcome.text || p.description) && <p className="mt-1 line-clamp-3 text-[11px] text-slate-300">{welcome.text || p.description}</p>}
                  <span className="mt-3 inline-block rounded-lg px-3 py-1.5 text-xs font-semibold text-navy-950" style={{ background: accent }}>
                    Commencer la visite
                  </span>
                </div>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {CONTROLS.filter((c) => c.k !== 'fullscreen' && c.k !== 'share' && controlOn(a, c.k)).map((c) => (
                <span key={c.k} className="flex items-center gap-1 rounded-lg bg-navy-950/80 px-2 py-1 text-[10px] text-white">
                  <c.icon size={11} style={{ color: accent }} /> {c.label}
                </span>
              ))}
            </div>
            <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-navy-950 shadow-lg" style={{ background: accent, opacity: welcome.enabled ? 0 : 1 }}>
              ⌃
            </span>
          </div>
        </Panel>
      </div>
    </div>
  );
}
