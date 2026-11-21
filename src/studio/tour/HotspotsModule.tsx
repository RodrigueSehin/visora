import { Copy, Crosshair, Eye, MoreVertical, Plus, Search, Target, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Menu, MenuItem, MenuSeparator } from '../../components/common/Overlays';
import { Button, CommitInput, Field, IconButton, NumberField, Panel, Select, cx, inputCls } from '../../components/common/ui';
import { SceneThumb } from '../../components/viewport/SceneThumb';
import { FORM_FIELDS, HOTSPOT_ICONS, HotspotContent, HotspotDialog, HotspotIcon, isEmail, useMediaUrl } from '../../components/viewport/TourLayers';
import { isSafeUrl } from '../../lib/actions';
import { useEditor } from '../../store/editor';
import { addHotspot, duplicateHotspot, HOTSPOT_TYPES, hotspotMeta, removeHotspot, updateHotspot } from '../../store/tourActions';
import type { Hotspot, HotspotFormField, HotspotIconId, HotspotType } from '../../types';
import { MediaField } from '../media/MediaPicker';
import type { MediaKind } from '../media/mediaStore';
import { useSortedScenes } from './ScenesModule';

const MEDIA_KINDS: Partial<Record<HotspotType, MediaKind[]>> = { video: ['video'], document: ['document'], image: ['image', 'panorama', 'texture'] };

/** What is still missing for the hotspot to work in the published tour. */
export function hotspotProblem(h: Hotspot): string | null {
  if (MEDIA_KINDS[h.type] && !h.mediaId) return 'Aucun média associé.';
  if (h.type === 'link' && !isSafeUrl(h.url)) return 'Adresse web manquante ou invalide (https://…).';
  if (h.type === 'scene' && !h.targetSceneId) return 'Aucune scène de destination.';
  if (h.type === 'contact' && !h.contact?.email && !h.contact?.phone) return 'Aucune coordonnée.';
  if (h.type === 'form' && !isEmail(h.form?.recipient)) return 'Aucune adresse e-mail de réception.';
  if (h.type === 'form' && !h.form?.fields.length) return 'Aucun champ dans le formulaire.';
  if (h.moreUrl && !isSafeUrl(h.moreUrl)) return 'Lien « En savoir plus » invalide (https://…).';
  return null;
}

const select = (h: Hotspot) => {
  const st = useEditor.getState();
  if (st.activeSceneId !== h.sceneId) st.setActiveScene(h.sceneId);
  st.setFocus({ kind: 'hotspot', id: h.id });
};
const place = (h: Hotspot) => {
  select(h);
  useEditor.getState().setPlacement({ kind: 'hotspot', id: h.id });
};
/** New hotspot of a type, then the next click in the view places it. */
export const createHotspot = (t: HotspotType) => {
  const id = addHotspot(t);
  if (id) useEditor.getState().setPlacement({ kind: 'hotspot', id });
};

/** Round colored badge with the hotspot icon. */
function Badge({ h, size = 36 }: { h: Pick<Hotspot, 'type' | 'icon' | 'color'>; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full text-white shadow" style={{ background: h.color || hotspotMeta(h.type).color, width: size, height: size }}>
      <HotspotIcon type={h.type} icon={h.icon} size={Math.round(size * 0.5)} />
    </span>
  );
}

/** Picture of the hotspot: its image/video, else the cover of its scene. */
function HotspotThumb({ h, className }: { h: Hotspot; className?: string }) {
  const scene = useEditor((s) => s.project?.scenes.find((x) => x.id === h.sceneId));
  const visual = (h.type === 'image' || h.type === 'video') && h.mediaId;
  const { url } = useMediaUrl(visual ? h.mediaId : undefined);
  if (url && h.type === 'video') return <video src={`${url}#t=0.5`} preload="metadata" muted className={cx('object-cover', className)} />;
  if (url) return <img src={url} alt="" className={cx('object-cover', className)} />;
  return scene ? <SceneThumb scene={scene} badge={false} className={className} /> : <span className={cx('bg-navy-700', className)} />;
}

export function HotspotsPanel() {
  const sceneId = useEditor((s) => s.activeSceneId);
  const all = useEditor((s) => s.project?.hotspots);
  const scenes = useSortedScenes();
  const focus = useEditor((s) => s.focus);
  const [q, setQ] = useState('');
  const [type, setType] = useState<HotspotType | 'all'>('all');
  const [scope, setScope] = useState<'scene' | 'all'>('scene');
  const [menu, setMenu] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const needle = q.trim().toLowerCase();
  const sceneName = (id: string) => scenes.find((s) => s.id === id)?.name ?? '';
  const list = (all ?? [])
    .filter((h) => (scope === 'all' || h.sceneId === sceneId) && (type === 'all' || h.type === type) && (!needle || `${h.title} ${h.description ?? ''}`.toLowerCase().includes(needle)))
    .sort((a, b) => (scope === 'all' ? scenes.findIndex((s) => s.id === a.sceneId) - scenes.findIndex((s) => s.id === b.sceneId) : 0));
  const inScene = (all ?? []).filter((h) => h.sceneId === sceneId).length;

  const remove = async (h: Hotspot) => {
    const ok = await useEditor.getState().confirm({ title: `Supprimer le hotspot « ${h.title} » ?`, message: 'Action annulable avec Ctrl+Z.', confirmLabel: 'Supprimer', danger: true });
    if (ok) removeHotspot(h.id);
  };

  return (
    <Panel className="h-full">
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <h2 className="text-lg font-semibold">Hotspots ({scope === 'all' ? (all ?? []).length : inScene})</h2>
        <div className="relative">
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={adding}
            aria-label="Ajouter un hotspot"
            title="Ajouter un hotspot"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-glow hover:brightness-110 focus-ring"
          >
            <Plus size={20} />
          </button>
          <Menu open={adding} onClose={() => setAdding(false)} className="w-56">
            {HOTSPOT_TYPES.map((t) => (
              <MenuItem key={t.id} icon={<Badge h={{ type: t.id }} size={20} />} onClick={() => (createHotspot(t.id), setAdding(false))}>
                {t.label}
              </MenuItem>
            ))}
          </Menu>
        </div>
      </div>
      <div className="space-y-2.5 px-4 pb-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input className={cx(inputCls, 'pl-9')} placeholder="Rechercher un hotspot…" aria-label="Rechercher un hotspot" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Select label="Filtrer par type" value={type} onChange={setType} options={[{ value: 'all', label: 'Tous les types' }, ...HOTSPOT_TYPES.map((t) => ({ value: t.id, label: t.label }))]} />
          <Select
            label="Portée de la liste"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'scene', label: 'Cette scène' },
              { value: 'all', label: 'Toutes les scènes' },
            ]}
          />
        </div>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2.5 pb-3" aria-label="Hotspots">
        {list.length === 0 && (
          <li className="px-2 py-8 text-center text-xs text-ink-faint">
            <Target className="mx-auto mb-2" size={22} />
            {(all ?? []).length ? 'Aucun hotspot ne correspond.' : 'Aucun hotspot. Choisissez un type (bouton « + » ou palette sous la vue), puis cliquez dans la vue pour le placer.'}
          </li>
        )}
        {list.map((h) => {
          const selected = focus?.kind === 'hotspot' && focus.id === h.id;
          const problem = hotspotProblem(h);
          return (
            <li key={h.id} className="relative">
              <div className={cx('flex items-center gap-1 rounded-xl border p-1.5', selected ? 'border-blue-400/80 bg-gradient-to-r from-blue-600/90 to-violet/70 shadow-glow' : 'border-transparent hover:bg-navy-700/60')}>
                <button type="button" onClick={() => select(h)} aria-current={selected} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus-ring">
                  <Badge h={h} />
                  <HotspotThumb h={h} className="h-10 w-14 shrink-0 rounded-md" />
                  <span className="min-w-0">
                    <span className={cx('block truncate text-[13.5px] font-medium', selected ? 'text-white' : 'text-ink')}>{h.title}</span>
                    <span className={cx('block truncate text-[11.5px]', selected ? 'text-white/80' : 'text-ink-muted')}>
                      {hotspotMeta(h.type).label}
                      {scope === 'all' && ` · ${sceneName(h.sceneId)}`}
                    </span>
                    {problem && <span className="block truncate text-[11px] text-amber-300">À compléter</span>}
                  </span>
                </button>
                <IconButton size="sm" label={`Actions du hotspot ${h.title}`} active={menu === h.id} onClick={() => setMenu(menu === h.id ? null : h.id)} className={selected ? 'text-white' : undefined}>
                  <MoreVertical size={15} />
                </IconButton>
              </div>
              <Menu open={menu === h.id} onClose={() => setMenu(null)} className="w-52">
                <MenuItem icon={<Crosshair size={14} />} onClick={() => (place(h), setMenu(null))}>
                  Placer dans la vue
                </MenuItem>
                <MenuItem icon={<Copy size={14} />} onClick={() => (duplicateHotspot(h.id), setMenu(null))}>
                  Dupliquer
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={<Trash2 size={14} />} danger onClick={() => (setMenu(null), void remove(h))}>
                  Supprimer
                </MenuItem>
              </Menu>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

type Tab = 'general' | 'content' | 'style' | 'actions';

function Switch({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-ink">
        {label}
        {hint && <span className="block text-[11px] text-ink-faint">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors focus-ring', checked ? 'bg-blue-500' : 'bg-navy-500')}
      >
        <span className={cx('absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

export function HotspotInspector() {
  const focus = useEditor((s) => s.focus);
  const h = useEditor((s) => (s.focus?.kind === 'hotspot' ? s.project?.hotspots?.find((x) => x.id === s.focus!.id) : undefined));
  const [tab, setTab] = useState<Tab>('general');
  const header = (
    <div className="flex items-center justify-between px-4 pb-3 pt-4">
      <h2 className="text-lg font-semibold">Propriétés du hotspot</h2>
      <IconButton label="Fermer le panneau" onClick={() => useEditor.getState().togglePanel('inspector', false)}>
        <X size={18} />
      </IconButton>
    </div>
  );
  if (!h || focus?.kind !== 'hotspot')
    return (
      <Panel className="h-full">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <Target className="text-ink-faint" size={26} />
          <p className="text-sm text-ink">Aucun hotspot sélectionné</p>
          <p className="text-xs text-ink-muted">Sélectionnez un hotspot dans la liste ou dans la vue.</p>
        </div>
      </Panel>
    );
  const set = (patch: Partial<Hotspot>, label?: string, key?: string) => updateHotspot(h.id, patch, label, key);
  const problem = hotspotProblem(h);
  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: 'Général' },
    { id: 'content', label: 'Contenu' },
    { id: 'style', label: 'Style' },
    { id: 'actions', label: 'Actions' },
  ];
  const remove = async () => {
    const ok = await useEditor.getState().confirm({ title: `Supprimer le hotspot « ${h.title} » ?`, message: 'Action annulable avec Ctrl+Z.', confirmLabel: 'Supprimer', danger: true });
    if (ok) removeHotspot(h.id);
  };

  return (
    <Panel className="h-full">
      {header}
      <div role="tablist" aria-label="Propriétés du hotspot" className="mx-3 mb-3 flex gap-0.5 rounded-xl border border-navy-500/60 bg-navy-900/60 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              'flex-1 whitespace-nowrap rounded-lg px-1.5 py-1.5 text-[13px] font-medium transition-colors focus-ring',
              tab === t.id ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-glow' : 'text-ink-muted hover:bg-white/5 hover:text-ink',
            )}
          >
            {t.label}
            {t.id === 'content' && problem && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" aria-label="à compléter" />}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4" role="tabpanel">
        {tab === 'general' && <GeneralTab h={h} set={set} />}
        {tab === 'content' && <ContentTab h={h} set={set} problem={problem} />}
        {tab === 'style' && <StyleTab h={h} set={set} />}
        {tab === 'actions' && <ActionsTab h={h} set={set} />}
      </div>
      <div className="space-y-2 p-3">
        <button
          type="button"
          onClick={() => void remove()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/70 bg-red-500/10 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/20 focus-ring"
        >
          <Trash2 size={17} /> Supprimer le hotspot
        </button>
        <Button className="w-full" onClick={() => duplicateHotspot(h.id)}>
          <Copy size={15} /> Dupliquer
        </Button>
      </div>
    </Panel>
  );
}

type TabProps = { h: Hotspot; set: (patch: Partial<Hotspot>, label?: string, key?: string) => void };

function GeneralTab({ h, set }: TabProps) {
  const meta = hotspotMeta(h.type);
  const color = h.color ?? meta.color;
  return (
    <Group title="Informations générales">
      <Field label="Type de hotspot" required>
        <span className="relative block">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
            <Badge h={h} size={22} />
          </span>
          <select aria-label="Type de hotspot" className={cx(inputCls, 'pl-10')} value={h.type} onChange={(e) => set({ type: e.target.value as HotspotType, icon: undefined }, 'Changer le type')}>
            {HOTSPOT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </span>
      </Field>
      <Field label="Titre" required>
        <CommitInput value={h.title} maxLength={120} aria-label="Titre" onCommit={(v) => v.trim() && set({ title: v.trim() }, 'Renommer le hotspot')} />
      </Field>
      <Field label="Description" hint="La première ligne s’affiche sous le titre dans la vue.">
        <CommitInput multiline value={h.description ?? ''} aria-label="Description" onCommit={(v) => set({ description: v }, 'Description du hotspot')} />
      </Field>
      <div className="grid grid-cols-[80px_1fr_96px] gap-2">
        <Field label="Icône">
          <span className="relative block">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">
              <Badge h={h} size={22} />
            </span>
            <select aria-label="Icône du hotspot" className={cx(inputCls, 'pl-9 text-transparent')} value={h.icon ?? ''} onChange={(e) => set({ icon: (e.target.value || undefined) as HotspotIconId | undefined }, 'Icône du hotspot')}>
              <option value="" className="text-ink">
                Icône du type
              </option>
              {HOTSPOT_ICONS.map((i) => (
                <option key={i.id} value={i.id} className="text-ink">
                  {i.label}
                </option>
              ))}
            </select>
          </span>
        </Field>
        <Field label="Couleur">
          <span className="flex items-center gap-2 rounded-lg border border-navy-500 bg-navy-900/70 px-2 py-1">
            <input type="color" aria-label="Couleur du hotspot" value={color} onChange={(e) => set({ color: e.target.value }, 'Couleur du hotspot', `hs-color:${h.id}`)} className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent" />
            <span className="truncate text-xs uppercase tabular-nums text-ink">{color}</span>
          </span>
        </Field>
        <Field label="Taille">
          <NumberField label="Taille (%)" value={Math.round((h.size ?? 1) * 100)} step={5} min={60} suffix="%" onCommit={(v) => set({ size: Math.max(0.6, Math.min(1.8, v / 100)) }, 'Taille du hotspot')} />
        </Field>
      </div>
      <div>
        <div className="mb-1 text-[15px] font-semibold text-ink">Position dans la scène</div>
        <div className="grid grid-cols-3 gap-1.5">
          {(['x', 'y', 'z'] as const).map((k) => (
            <NumberField key={k} axis={k.toUpperCase() as 'X' | 'Y' | 'Z'} label={`Position ${k}`} value={h.position[k]} step={0.1} onCommit={(v) => set({ position: { ...h.position, [k]: v } }, 'Déplacer le hotspot')} />
          ))}
        </div>
        <Button size="sm" className="mt-2 w-full" onClick={() => place(h)}>
          <Crosshair size={14} /> Placer d’un clic dans la vue
        </Button>
      </div>
      <div>
        <Switch label="Toujours visible" hint={h.alwaysVisible === false ? 'Masqué quand un objet le cache' : undefined} checked={h.alwaysVisible !== false} onChange={(v) => set({ alwaysVisible: v }, 'Visibilité du hotspot')} />
        <Switch label="Afficher une étiquette" checked={h.showLabel} onChange={(showLabel) => set({ showLabel }, 'Étiquette du hotspot')} />
        <Switch label="Effet au survol" checked={h.hoverEffect !== false} onChange={(v) => set({ hoverEffect: v }, 'Effet au survol')} />
      </div>
    </Group>
  );
}

function ContentTab({ h, set, problem }: TabProps & { problem: string | null }) {
  const scenes = useSortedScenes();
  const meta = hotspotMeta(h.type);
  const specs = h.specs ?? [];
  const fields = h.form?.fields ?? [];
  return (
    <Group title={`Contenu : ${meta.label}`}>
      {MEDIA_KINDS[h.type] && (
        <Field label={meta.label} group>
          <MediaField label={meta.label} kinds={MEDIA_KINDS[h.type]!} value={h.mediaId} onChange={(mediaId) => set({ mediaId }, 'Changer le média')} />
        </Field>
      )}
      {h.type === 'link' && (
        <Field label="Adresse web (https://…)">
          <CommitInput value={h.url ?? ''} placeholder="https://" aria-label="Adresse web" onCommit={(v) => set({ url: v.trim() }, 'Lien du hotspot')} />
        </Field>
      )}
      {h.type === 'scene' && (
        <Field label="Scène de destination">
          <Select
            label="Scène de destination"
            value={h.targetSceneId ?? ''}
            onChange={(v) => set({ targetSceneId: v || undefined }, 'Destination')}
            options={[{ value: '', label: 'Choisir une scène…' }, ...scenes.filter((s) => s.id !== h.sceneId).map((s) => ({ value: s.id, label: s.name }))]}
          />
        </Field>
      )}
      {h.type === 'contact' && (
        <>
          <Field label="E-mail">
            <CommitInput value={h.contact?.email ?? ''} aria-label="E-mail" placeholder="contact@exemple.com" onCommit={(v) => set({ contact: { ...h.contact, email: v.trim() || undefined } }, 'Contact')} />
          </Field>
          <Field label="Téléphone">
            <CommitInput value={h.contact?.phone ?? ''} aria-label="Téléphone" placeholder="+225 …" onCommit={(v) => set({ contact: { ...h.contact, phone: v.trim() || undefined } }, 'Contact')} />
          </Field>
        </>
      )}
      {(h.type === 'equipment' || h.type === 'info') && (
        <Field group label="Caractéristiques" hint="Lignes « libellé : valeur » affichées dans la fiche.">
          <div className="space-y-1.5">
            {specs.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
                <CommitInput value={s.label} placeholder="Capacité" aria-label={`Libellé ${i + 1}`} maxLength={40} onCommit={(v) => set({ specs: specs.map((x, j) => (j === i ? { ...x, label: v } : x)) }, 'Caractéristique')} />
                <CommitInput value={s.value} placeholder="1 200 palettes" aria-label={`Valeur ${i + 1}`} maxLength={80} onCommit={(v) => set({ specs: specs.map((x, j) => (j === i ? { ...x, value: v } : x)) }, 'Caractéristique')} />
                <IconButton size="sm" tone="danger" label={`Retirer la ligne ${i + 1}`} onClick={() => set({ specs: specs.filter((_, j) => j !== i) }, 'Retirer une caractéristique')}>
                  <Trash2 size={13} />
                </IconButton>
              </div>
            ))}
            <Button size="sm" disabled={specs.length >= 12} onClick={() => set({ specs: [...specs, { label: '', value: '' }] }, 'Ajouter une caractéristique')}>
              <Plus size={14} /> Ajouter une ligne
            </Button>
          </div>
        </Field>
      )}
      {h.type === 'form' && (
        <>
          <Field label="Adresse de réception" hint="Le visiteur envoie sa demande depuis sa messagerie, à cette adresse.">
            <CommitInput value={h.form?.recipient ?? ''} placeholder="devis@entreprise.com" aria-label="Adresse de réception" onCommit={(v) => set({ form: { fields, ...h.form, recipient: v.trim() || undefined } }, 'Formulaire')} />
          </Field>
          <Field label="Objet du message">
            <CommitInput value={h.form?.subject ?? ''} placeholder={h.title} aria-label="Objet du message" onCommit={(v) => set({ form: { fields, ...h.form, subject: v.trim() || undefined } }, 'Formulaire')} />
          </Field>
          <Field group label="Champs">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(FORM_FIELDS) as HotspotFormField[]).map((f) => {
                const on = fields.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ form: { ...h.form, fields: on ? fields.filter((x) => x !== f) : (Object.keys(FORM_FIELDS) as HotspotFormField[]).filter((x) => x === f || fields.includes(x)) } }, 'Champs du formulaire')}
                    className={cx('rounded-lg border px-2.5 py-1 text-xs', on ? 'border-blue-400 bg-blue-600/25 text-white' : 'border-navy-500 text-ink-muted hover:text-ink')}
                  >
                    {FORM_FIELDS[f].label}
                  </button>
                );
              })}
            </div>
          </Field>
        </>
      )}
      {h.type === 'info' && <p className="text-[11px] text-ink-faint">Le titre, la description et les caractéristiques s’affichent au clic du visiteur.</p>}
      {problem ? <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">À compléter : {problem}</p> : <p className="text-xs text-emerald-300">Prêt pour la visite.</p>}
    </Group>
  );
}

function StyleTab({ h, set }: TabProps) {
  return (
    <Group title="Apparence du repère">
      <div className="flex items-center justify-center rounded-xl border border-navy-500/50 bg-[radial-gradient(circle_at_center,#1D2B43,#0B1220)] py-6">
        <span className="flex items-center" style={{ transform: `scale(${h.size ?? 1})` }}>
          <span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full text-white ring-[3px] ring-white/80" style={{ background: h.color || hotspotMeta(h.type).color }}>
            {h.pulse && <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: h.color || hotspotMeta(h.type).color }} aria-hidden />}
            <HotspotIcon type={h.type} icon={h.icon} size={20} />
          </span>
          {h.showLabel && (
            <span className="-ml-3 rounded-r-xl border border-white/15 bg-navy-950/85 py-1.5 pl-5 pr-3 text-left">
              <span className="block text-sm font-semibold text-white">{h.title}</span>
              {h.labelStyle !== 'compact' && <span className="block text-[11px] text-slate-300">{h.description?.split('\n')[0] || 'Sous-titre'}</span>}
            </span>
          )}
        </span>
      </div>
      <Field label="Style de l’étiquette">
        <Select<'card' | 'compact'>
          label="Style de l’étiquette"
          value={h.labelStyle ?? 'card'}
          onChange={(labelStyle) => set({ labelStyle }, 'Style de l’étiquette')}
          options={[
            { value: 'card', label: 'Titre et sous-titre' },
            { value: 'compact', label: 'Titre seul' },
          ]}
        />
      </Field>
      <Switch label="Afficher une étiquette" checked={h.showLabel} onChange={(showLabel) => set({ showLabel }, 'Étiquette du hotspot')} />
      <Switch label="Animation d’appel (pulsation)" checked={!!h.pulse} onChange={(pulse) => set({ pulse }, 'Pulsation du hotspot')} />
      <Field label="Taille">
        <input type="range" aria-label="Taille du repère" min={0.6} max={1.8} step={0.05} value={h.size ?? 1} onChange={(e) => set({ size: parseFloat(e.target.value) }, 'Taille du hotspot', `hs-size:${h.id}`)} className="w-full accent-blue-500" />
      </Field>
    </Group>
  );
}

const CLICK: Record<HotspotType, string> = {
  info: 'Ouvre une fiche avec le titre, la description et les caractéristiques.',
  video: 'Ouvre la vidéo dans un lecteur.',
  document: 'Ouvre le document, avec un lien de téléchargement.',
  image: 'Ouvre l’image en grand.',
  link: 'Ouvre le site dans un nouvel onglet.',
  contact: 'Affiche l’e-mail et le téléphone (cliquables).',
  scene: 'Emmène le visiteur dans la scène de destination.',
  equipment: 'Ouvre la fiche de l’équipement.',
  form: 'Ouvre le formulaire ; l’envoi passe par la messagerie du visiteur.',
};

function ActionsTab({ h, set }: TabProps) {
  const [preview, setPreview] = useState(false);
  const opensDialog = h.type !== 'link' && h.type !== 'scene';
  return (
    <Group title="Au clic du visiteur">
      <p className="rounded-lg border border-navy-500/50 bg-navy-900/40 px-3 py-2 text-sm text-ink-muted">{CLICK[h.type]}</p>
      {opensDialog && (
        <Field label="Bouton « En savoir plus » (https://…)" hint="Optionnel : ajouté en bas de la fiche.">
          <CommitInput value={h.moreUrl ?? ''} placeholder="https://" aria-label="Lien En savoir plus" onCommit={(v) => set({ moreUrl: v.trim() || undefined }, 'Lien En savoir plus')} />
        </Field>
      )}
      <Button className="w-full" disabled={!opensDialog} title={opensDialog ? undefined : 'Testez-le avec « Aperçu visite »'} onClick={() => setPreview(true)}>
        <Eye size={14} /> Tester comme un visiteur
      </Button>
      {preview && <HotspotDialog hotspot={h} onClose={() => setPreview(false)} />}
    </Group>
  );
}

/** Below the viewport: the type palette and a live preview of the selected hotspot. */
export function HotspotsBottom() {
  const h = useEditor((s) => (s.focus?.kind === 'hotspot' ? s.project?.hotspots?.find((x) => x.id === s.focus!.id) : undefined));
  return (
    <div className="grid h-[226px] shrink-0 grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-3">
      <section className="flex min-h-0 flex-col rounded-2xl border border-navy-500/50 bg-navy-800/90 p-3" aria-label="Types de hotspots">
        <h3 className="mb-2 text-[15px] font-semibold">Types de hotspots</h3>
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-1.5 overflow-y-auto xl:grid-cols-5">
          {HOTSPOT_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => createHotspot(t.id)}
              title={`Ajouter : ${t.label} (puis cliquez dans la vue)`}
              className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-0.5 py-2 text-[11px] font-medium leading-tight text-white transition hover:brightness-125 focus-ring"
              style={{ background: `${t.color}33`, borderColor: `${t.color}99` }}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: t.color }}>
                <HotspotIcon type={t.id} size={15} />
              </span>
              <span className="w-full truncate text-center">{t.label}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="flex min-h-0 flex-col rounded-2xl border border-navy-500/50 bg-navy-800/90 p-3" aria-label="Aperçu du hotspot">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold">Aperçu du hotspot{h ? ` (${hotspotMeta(h.type).label})` : ''}</h3>
          {h && (
            <IconButton size="sm" label="Désélectionner" onClick={() => useEditor.getState().setFocus(null)}>
              <X size={15} />
            </IconButton>
          )}
        </div>
        {h ? (
          <div className="flex min-h-0 flex-1 gap-3">
            <HotspotThumb h={h} className="h-full w-[38%] shrink-0 rounded-lg" />
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg border border-navy-500/50 bg-navy-900/50 p-2.5">
              <p className="text-sm font-semibold text-ink">{h.title}</p>
              <HotspotContent hotspot={h} compact />
              {!h.description && !(h.specs ?? []).length && !h.moreUrl && <p className="text-xs text-ink-faint">Ajoutez une description ou des caractéristiques.</p>}
            </div>
          </div>
        ) : (
          <p className="flex flex-1 items-center justify-center text-center text-sm text-ink-muted">Sélectionnez un hotspot pour voir ce que le visiteur verra.</p>
        )}
      </section>
    </div>
  );
}
