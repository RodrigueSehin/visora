import { Copy, Info, Link2, Lock, LockOpen, MousePointer2, Plus, RotateCcw, Star, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ACTION_TYPES, isSafeUrl } from '../../lib/actions';
import { CATEGORIES, categoryLabel } from '../../lib/categories';
import { formatBytes, formatNumber } from '../../lib/format';
import { findAsset, useEditor } from '../../store/editor';
import { deleteSelection, duplicateSelection, groupSelection, toggleLock, toggleVisibility } from '../../store/objectActions';
import { objectRegistry } from '../../three/registry';
import { supportsPbr } from '../../three/assetCache';
import type { ActionType, ObjectInteraction, ObjectStyle, SceneObject3D, Vec3 } from '../../types';
import { AssetThumb } from '../library/ObjectLibraryPanel';
import { Badge, Button, CommitInput, Field, IconButton, NumberField, Panel, Section, Select, Tabs, Toggle, cx, inputCls } from '../common/ui';

type Tab = 'general' | 'transform' | 'style' | 'interactions' | 'advanced';

export function ObjectPropertiesInspector({ onClose }: { onClose?: () => void }) {
  const selection = useEditor((s) => s.selection);
  const objects = useEditor((s) => s.project?.objects);
  const [tab, setTab] = useState<Tab>('general');
  const selected = useMemo(() => objects?.filter((o) => selection.includes(o.id)) ?? [], [objects, selection]);
  const primary = selected.length === 1 ? selected[0] : undefined;

  return (
    <Panel className="min-h-0 flex-1">
      <div className="flex items-center justify-between px-3.5 pb-2 pt-3">
        <h2 className="text-[15px] font-semibold text-ink">Propriétés de l’objet</h2>
        {onClose && (
          <IconButton size="sm" label="Masquer l’inspecteur" onClick={onClose}>
            <X size={15} />
          </IconButton>
        )}
      </div>
      {selected.length === 0 && <NoSelection />}
      {selected.length > 1 && <MultiSelection objects={selected} />}
      {primary && (
        <>
          <ObjectHeader obj={primary} />
          <div className="px-3.5 pb-2">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'general', label: 'Général' },
                { id: 'transform', label: 'Transform' },
                { id: 'style', label: 'Style', disabled: primary.kind === 'group' },
                { id: 'interactions', label: 'Actions' },
                { id: 'advanced', label: 'Avancé' },
              ]}
            />
          </div>
          {primary.locked && (
            <div className="mx-3.5 mb-2 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
              <Lock size={13} /> Objet verrouillé : les propriétés sont en lecture seule.
              <button type="button" className="ml-auto font-semibold hover:underline" onClick={() => toggleLock([primary.id])}>
                Déverrouiller
              </button>
            </div>
          )}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3.5 pb-4">
            {tab === 'general' && <ObjectGeneralProperties obj={primary} />}
            {tab === 'transform' && <ObjectTransformProperties obj={primary} />}
            {tab === 'style' && primary.kind !== 'group' && <ObjectStyleProperties obj={primary} />}
            {tab === 'interactions' && <ObjectInteractionProperties obj={primary} />}
            {tab === 'advanced' && <ObjectAdvancedProperties obj={primary} />}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-navy-500/50 p-3">
            <Button variant="danger" disabled={primary.locked} onClick={() => void deleteSelection([primary.id])} title={primary.locked ? 'Objet verrouillé' : undefined}>
              <Trash2 size={14} /> Supprimer
            </Button>
            <Button variant="secondary" onClick={duplicateSelection} className="border-cyan/40 text-cyan">
              <Copy size={14} /> Dupliquer
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}

function NoSelection() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <MousePointer2 className="text-ink-faint" size={28} />
      <p className="text-sm font-medium text-ink">Aucun objet sélectionné</p>
      <p className="text-xs leading-relaxed text-ink-muted">
        Cliquez sur un objet dans le viewport ou la hiérarchie. Ctrl/Maj + clic pour une sélection multiple, Alt + clic pour sélectionner un objet dans un groupe.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-left text-[11px] text-ink-faint">
        {[
          ['W / E / R', 'Déplacer / Tourner / Échelle'],
          ['F', 'Cadrer'],
          ['Ctrl+D', 'Dupliquer'],
          ['Suppr', 'Supprimer'],
          ['H / L', 'Masquer / Verrouiller'],
          ['Ctrl+Z / Y', 'Annuler / Rétablir'],
        ].map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-mono text-ink-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MultiSelection({ objects }: { objects: SceneObject3D[] }) {
  const locked = objects.filter((o) => o.locked).length;
  const hidden = objects.filter((o) => !o.visible).length;
  const sameParent = objects.every((o) => o.parentId === objects[0].parentId);
  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-3.5 pb-4">
      <div className="rounded-xl border border-violet/40 bg-violet/10 p-3">
        <p className="text-sm font-semibold text-ink">{objects.length} objets sélectionnés</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {locked ? `${locked} verrouillé(s) · ` : ''}
          {hidden ? `${hidden} masqué(s) · ` : ''}Utilisez le gizmo pour déplacer l’ensemble.
        </p>
      </div>
      <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-ink-muted">
        {objects.map((o) => (
          <li key={o.id} className="flex items-center gap-1.5 truncate">
            {o.locked && <Lock size={11} className="text-amber-400" />}
            {o.name}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" onClick={groupSelection} disabled={!sameParent} title={sameParent ? undefined : 'Les objets doivent avoir le même parent'}>
          Grouper
        </Button>
        <Button size="sm" onClick={duplicateSelection}>
          Dupliquer
        </Button>
        <Button size="sm" onClick={() => toggleVisibility()}>
          {hidden === objects.length ? 'Afficher' : 'Masquer'}
        </Button>
        <Button size="sm" onClick={() => toggleLock()}>
          {locked === objects.length ? 'Déverrouiller' : 'Verrouiller'}
        </Button>
        <Button size="sm" variant="danger" className="col-span-2" disabled={locked === objects.length} onClick={() => void deleteSelection()}>
          <Trash2 size={14} /> Supprimer la sélection
        </Button>
      </div>
    </div>
  );
}

function ObjectHeader({ obj }: { obj: SceneObject3D }) {
  const asset = useEditor((s) => findAsset(s.project, obj.assetId));
  const fav = useEditor((s) => !!obj.assetId && !!s.project?.favorites.includes(obj.assetId));
  return (
    <div className="flex items-center gap-3 px-3.5 pb-3">
      {asset ? (
        <AssetThumb asset={asset} className="h-14 w-16 shrink-0 rounded-xl border border-navy-500/60" />
      ) : (
        <div className="flex h-14 w-16 items-center justify-center rounded-xl border border-violet/40 bg-violet/10 text-xs text-violet-400">Groupe</div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink" title={obj.name}>
          {obj.name}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge tone="cyan">{obj.kind === 'group' ? 'Groupe' : categoryLabel(obj.category)}</Badge>
          {!obj.visible && <Badge>Masqué</Badge>}
          {obj.studioOnly && <Badge>Studio uniquement</Badge>}
        </div>
      </div>
      {obj.assetId && (
        <IconButton label={fav ? 'Retirer l’asset des favoris' : 'Marquer l’asset en favori'} onClick={() => useEditor.getState().toggleFavorite(obj.assetId!)}>
          <Star size={16} className={fav ? 'fill-amber-400 text-amber-400' : ''} />
        </IconButton>
      )}
    </div>
  );
}

const patch = (obj: SceneObject3D, p: Partial<SceneObject3D>, label: string, key?: string) =>
  useEditor.getState().patchObjects([obj.id], () => p, label, key);

export function ObjectGeneralProperties({ obj }: { obj: SceneObject3D }) {
  const asset = useEditor((s) => findAsset(s.project, obj.assetId));
  const ro = obj.locked;
  return (
    <>
      <Section title="Informations générales">
        <Field label="Nom" required>
          <CommitInput value={obj.name} maxLength={80} disabled={ro} aria-label="Nom" onCommit={(v) => v.trim() && patch(obj, { name: v.trim() }, 'Renommer')} />
        </Field>
        <Field label="Description">
          <CommitInput multiline value={obj.description ?? ''} disabled={ro} aria-label="Description" onCommit={(v) => patch(obj, { description: v }, 'Modifier la description')} />
        </Field>
        <Field label="Catégorie">
          <Select label="Catégorie" disabled={ro} value={obj.category ?? 'other'} onChange={(v) => patch(obj, { category: v }, 'Modifier la catégorie')} options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
        </Field>
        <Field label="Tags" hint="Séparés par des virgules">
          <CommitInput
            value={obj.tags?.join(', ') ?? ''}
            disabled={ro}
            aria-label="Tags"
            onCommit={(v) => patch(obj, { tags: v.split(',').map((t) => t.trim()).filter(Boolean) }, 'Modifier les tags')}
          />
        </Field>
      </Section>
      {asset && (
        <Section title="Asset source">
          <div className="flex items-center justify-between rounded-lg border border-navy-500/60 bg-navy-900/50 px-2.5 py-2 text-xs">
            <span className="truncate text-ink">{asset.name}</span>
            <span className="text-ink-faint">
              {asset.format}
              {asset.fileSize ? ` · ${formatBytes(asset.fileSize)}` : ''}
            </span>
          </div>
        </Section>
      )}
      <Section title="État">
        <Toggle label="Visible" checked={obj.visible} onChange={() => toggleVisibility([obj.id])} />
        <Toggle label="Verrouillé" hint="Empêche les modifications et la suppression" checked={obj.locked} onChange={() => toggleLock([obj.id])} />
      </Section>
    </>
  );
}

function Vec3Row({ label, value, onCommit, disabled, step, min, suffix }: { label: string; value: Vec3; onCommit: (v: Vec3) => void; disabled?: boolean; step?: number; min?: number; suffix?: string }) {
  return (
    <div>
      <div className="mb-1 text-xs text-ink-muted">{label}</div>
      <div className="grid grid-cols-3 gap-1.5">
        {(['x', 'y', 'z'] as const).map((k) => (
          <NumberField
            key={k}
            axis={k.toUpperCase() as 'X' | 'Y' | 'Z'}
            label={`${label} ${k.toUpperCase()}`}
            value={value[k]}
            step={step}
            min={min}
            suffix={suffix}
            disabled={disabled}
            onCommit={(n) => onCommit({ ...value, [k]: n })}
          />
        ))}
      </div>
    </div>
  );
}

export function ObjectTransformProperties({ obj }: { obj: SceneObject3D }) {
  const asset = useEditor((s) => findAsset(s.project, obj.assetId));
  const setT = (p: Partial<Pick<SceneObject3D, 'position' | 'rotation' | 'scale'>>, label: string) =>
    useEditor.getState().setTransforms([{ id: obj.id, ...p }], label);
  const ro = obj.locked;
  const setScale = (v: Vec3) => {
    if (!obj.uniformScale) return setT({ scale: v }, 'Redimensionner');
    // Proportional: apply the ratio of the edited axis to all axes.
    const axis = (['x', 'y', 'z'] as const).find((k) => v[k] !== obj.scale[k]) ?? 'x';
    const k = obj.scale[axis] ? v[axis] / obj.scale[axis] : v[axis];
    setT({ scale: { x: r3(obj.scale.x * k), y: r3(obj.scale.y * k), z: r3(obj.scale.z * k) } }, 'Redimensionner');
  };
  const dims = asset?.size && obj.kind === 'object' ? { x: asset.size.x * Math.abs(obj.scale.x), y: asset.size.y * Math.abs(obj.scale.y), z: asset.size.z * Math.abs(obj.scale.z) } : null;
  const uniform = Math.abs(obj.scale.x);
  return (
    <>
      <Section title="Position (m)">
        <Vec3Row label="Position" value={obj.position} step={0.1} disabled={ro} onCommit={(v) => setT({ position: v }, 'Déplacer')} />
      </Section>
      <Section title="Rotation (°)">
        <Vec3Row label="Rotation" value={obj.rotation} step={15} disabled={ro} onCommit={(v) => setT({ rotation: v }, 'Tourner')} />
      </Section>
      <Section
        title="Échelle"
        actions={
          <button type="button" disabled={ro} className="text-[11px] text-cyan hover:underline disabled:opacity-40" onClick={() => setT({ scale: { x: 1, y: 1, z: 1 } }, 'Réinitialiser l’échelle')}>
            Réinitialiser
          </button>
        }
      >
        <Toggle label="Conserver les proportions" checked={obj.uniformScale} disabled={ro} onChange={(v) => patch(obj, { uniformScale: v }, 'Échelle uniforme')} />
        {obj.uniformScale && (
          <div className="flex items-center gap-2">
            <input
              type="range"
              aria-label="Échelle uniforme"
              min={0.1}
              max={5}
              step={0.05}
              disabled={ro}
              value={uniform}
              onChange={(e) => {
                const k = parseFloat(e.target.value) / (uniform || 1);
                useEditor.getState().patchObjects(
                  [obj.id],
                  (o) => ({ scale: { x: r3(o.scale.x * k), y: r3(o.scale.y * k), z: r3(o.scale.z * k) } }),
                  'Redimensionner',
                  `scale-slider:${obj.id}`,
                );
              }}
              className="flex-1 accent-cyan"
            />
            <span className="w-12 text-right text-xs tabular-nums text-ink">{formatNumber(uniform)}</span>
          </div>
        )}
        <Vec3Row label="Échelle" value={obj.scale} step={0.1} min={0.01} disabled={ro} onCommit={setScale} />
      </Section>
      {dims && (
        <Section title="Dimensions calculées">
          <p className="text-sm tabular-nums text-ink">
            {formatNumber(dims.x)} × {formatNumber(dims.y)} × {formatNumber(dims.z)} m
            <span className="ml-1 text-xs text-ink-faint">(L × H × P)</span>
          </p>
        </Section>
      )}
      <Section title="Origine / pivot">
        <p className="text-xs text-ink-muted">Pivot au centre de la base de l’objet ({obj.kind === 'group' ? 'centre du groupe' : 'origine du modèle'}).</p>
      </Section>
      <Button
        variant="secondary"
        className="w-full"
        disabled={ro}
        onClick={() => setT({ rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }, 'Réinitialiser les transformations')}
      >
        <RotateCcw size={14} /> Réinitialiser les transformations
      </Button>
    </>
  );
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function ObjectStyleProperties({ obj }: { obj: SceneObject3D }) {
  const style = obj.style ?? {};
  const ro = obj.locked;
  const [pbr, setPbr] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      const n = objectRegistry.get(obj.id);
      if (n) setPbr(supportsPbr(n));
    }, 50);
    return () => clearTimeout(t);
  }, [obj.id]);
  const set = (p: Partial<ObjectStyle>, key: string) =>
    useEditor.getState().patchObjects([obj.id], (o) => ({ style: { ...o.style, ...p } }), 'Modifier le style', `style:${key}:${obj.id}`);
  return (
    <>
      <Section title="Matériau">
        <p className="text-[11px] text-ink-faint">Les réglages s’appliquent à cette instance uniquement ; l’asset de bibliothèque n’est pas modifié.</p>
        <Field label="Teinte">
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Couleur"
              disabled={ro}
              value={style.color ?? '#ffffff'}
              onChange={(e) => set({ color: e.target.value }, 'color')}
              className="h-8 w-10 cursor-pointer rounded border border-navy-500 bg-transparent"
            />
            <span className="flex-1 font-mono text-xs text-ink-muted">{style.color ?? 'Couleurs d’origine'}</span>
            {style.color && (
              <button type="button" className="text-[11px] text-cyan hover:underline" onClick={() => set({ color: undefined }, 'color-reset')}>
                Retirer
              </button>
            )}
          </div>
        </Field>
        <Slider label="Opacité" value={style.opacity ?? 1} min={0.05} max={1} disabled={ro} onChange={(v) => set({ opacity: v }, 'opacity')} />
        {pbr ? (
          <>
            <Slider label="Rugosité (roughness)" value={style.roughness} placeholder="Origine" min={0} max={1} disabled={ro} onChange={(v) => set({ roughness: v }, 'roughness')} />
            <Slider label="Métallique (metallic)" value={style.metalness} placeholder="Origine" min={0} max={1} disabled={ro} onChange={(v) => set({ metalness: v }, 'metalness')} />
          </>
        ) : (
          <p className="text-[11px] text-ink-faint">Rugosité et métallique non disponibles : le modèle n’utilise pas de matériau PBR.</p>
        )}
      </Section>
      <Section title="Émission">
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Couleur d’émission"
            disabled={ro}
            value={style.emissive ?? '#000000'}
            onChange={(e) => set({ emissive: e.target.value, emissiveIntensity: style.emissiveIntensity ?? 1 }, 'emissive')}
            className="h-8 w-10 cursor-pointer rounded border border-navy-500 bg-transparent"
          />
          <span className="flex-1 font-mono text-xs text-ink-muted">{style.emissive ?? 'Aucune'}</span>
        </div>
        {style.emissive && <Slider label="Intensité" value={style.emissiveIntensity ?? 1} min={0} max={4} disabled={ro} onChange={(v) => set({ emissiveIntensity: v }, 'emissiveIntensity')} />}
      </Section>
      <Section title="Texture">
        <p className="text-[11px] text-ink-faint">Les textures proviennent du modèle source. Pour les modifier, remplacez le fichier de l’asset dans la bibliothèque.</p>
      </Section>
      <Button variant="secondary" className="w-full" disabled={ro || !obj.style} onClick={() => patch(obj, { style: undefined }, 'Réinitialiser le style')}>
        <RotateCcw size={14} /> Réinitialiser le style
      </Button>
    </>
  );
}

function Slider({ label, value, min, max, onChange, disabled, placeholder }: { label: string; value?: number; min: number; max: number; onChange: (v: number) => void; disabled?: boolean; placeholder?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-ink-muted">
        <span>{label}</span>
        <span className="tabular-nums text-ink">{value == null ? placeholder : formatNumber(value)}</span>
      </div>
      <input type="range" aria-label={label} min={min} max={max} step={0.01} disabled={disabled} value={value ?? (min + max) / 2} onChange={(e) => onChange(parseFloat(e.target.value))} className={cx('w-full accent-cyan', value == null && 'opacity-60')} />
    </div>
  );
}

export function ObjectInteractionProperties({ obj }: { obj: SceneObject3D }) {
  const scenes = useEditor((s) => s.project?.scenes ?? []);
  const activeSceneId = useEditor((s) => s.activeSceneId);
  const it: ObjectInteraction = obj.interaction ?? { type: 'none' };
  const ro = obj.locked;
  const def = ACTION_TYPES.find((a) => a.id === it.type)!;
  const set = (p: Partial<ObjectInteraction>, label = 'Modifier l’interaction') =>
    useEditor.getState().patchObjects([obj.id], (o) => ({ interaction: { ...(o.interaction ?? { type: 'none' }), ...p } }), label);
  const setCfg = (p: NonNullable<ObjectInteraction['config']>) => set({ config: { ...it.config, ...p } });
  const details = it.config?.details ?? [];
  const urlInvalid = def.needsUrl && !!it.config?.url && !isSafeUrl(it.config.url);
  return (
    <>
      <Section title="Comportement au clic (visite)">
        <p className="text-[11px] text-ink-faint">Les objets utilisent les mêmes actions que les hotspots VISORA. Testez-les en « Mode visiteur ».</p>
        <Select<ActionType> label="Type d’action" disabled={ro} value={it.type} onChange={(v) => set({ type: v, targetId: undefined }, 'Changer d’interaction')} options={ACTION_TYPES.map((a) => ({ value: a.id, label: a.label }))} />
      </Section>
      {it.type !== 'none' && it.type !== 'scene' && it.type !== 'link' && (
        <Section title="Contenu">
          <Field label="Titre">
            <CommitInput value={it.config?.title ?? ''} placeholder={obj.name} disabled={ro} aria-label="Titre" onCommit={(v) => setCfg({ title: v })} />
          </Field>
          <Field label="Texte">
            <CommitInput multiline value={it.config?.text ?? ''} placeholder={obj.description || 'Texte affiché au visiteur'} disabled={ro} aria-label="Texte" onCommit={(v) => setCfg({ text: v })} />
          </Field>
        </Section>
      )}
      {def.needsUrl && (
        <Section title={it.type === 'video' ? 'Vidéo' : it.type === 'document' ? 'Document' : 'Lien'}>
          <Field label="URL (https://…)" hint={urlInvalid ? undefined : 'Seules les adresses http(s) sont acceptées.'}>
            <div className="relative">
              <Link2 size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <CommitInput className="pl-7" value={it.config?.url ?? ''} disabled={ro} aria-label="URL" placeholder="https://" onCommit={(v) => setCfg({ url: v.trim() })} />
            </div>
          </Field>
          {urlInvalid && <p className="text-xs text-red-300">URL invalide : utilisez une adresse commençant par https://</p>}
        </Section>
      )}
      {def.needsScene && (
        <Section title="Scène cible">
          <Select
            label="Scène cible"
            disabled={ro}
            value={it.targetId ?? ''}
            onChange={(v) => set({ targetId: v || undefined })}
            options={[{ value: '', label: 'Choisir une scène…' }, ...scenes.map((s) => ({ value: s.id, label: s.name, disabled: s.id === activeSceneId }))]}
          />
          {!it.targetId && <p className="text-xs text-amber-300">Sélectionnez la scène vers laquelle naviguer.</p>}
        </Section>
      )}
      {it.type === 'sheet' && (
        <Section
          title="Caractéristiques"
          actions={
            <button type="button" disabled={ro} className="flex items-center gap-1 text-[11px] text-cyan hover:underline disabled:opacity-40" onClick={() => setCfg({ details: [...details, { label: 'Caractéristique', value: '' }] })}>
              <Plus size={11} /> Ajouter
            </button>
          }
        >
          {details.length === 0 && <p className="text-[11px] text-ink-faint">Ex. Capacité : 2,5 t · Hauteur : 4,5 m</p>}
          {details.map((d, i) => (
            <div key={i} className="flex gap-1.5">
              <CommitInput value={d.label} disabled={ro} aria-label="Libellé" onCommit={(v) => setCfg({ details: details.map((x, j) => (j === i ? { ...x, label: v } : x)) })} />
              <CommitInput value={d.value} disabled={ro} aria-label="Valeur" onCommit={(v) => setCfg({ details: details.map((x, j) => (j === i ? { ...x, value: v } : x)) })} />
              <IconButton size="sm" tone="danger" label="Retirer" disabled={ro} onClick={() => setCfg({ details: details.filter((_, j) => j !== i) })}>
                <X size={13} />
              </IconButton>
            </div>
          ))}
        </Section>
      )}
      {it.type !== 'none' && (
        <div className="flex gap-2 rounded-lg bg-cyan/10 px-3 py-2 text-xs text-cyan">
          <Info size={14} className="shrink-0" /> En mode visiteur, un clic sur l’objet déclenche cette action.
        </div>
      )}
    </>
  );
}

export function ObjectAdvancedProperties({ obj }: { obj: SceneObject3D }) {
  const asset = useEditor((s) => findAsset(s.project, obj.assetId));
  const ro = obj.locked;
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Section title="Identifiant">
        <div className="flex items-center gap-2">
          <input readOnly className={cx(inputCls, 'font-mono text-xs')} value={obj.id} aria-label="Identifiant" />
          <IconButton
            size="sm"
            label={copied ? 'Copié' : 'Copier l’identifiant'}
            onClick={() => {
              void navigator.clipboard?.writeText(obj.id);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            <Copy size={13} />
          </IconButton>
        </div>
      </Section>
      <Section title="Visibilité">
        <Toggle label="Visible dans la visite" hint="Désactivé : visible dans Studio uniquement" checked={!obj.studioOnly} disabled={ro} onChange={(v) => patch(obj, { studioOnly: !v }, 'Visibilité dans la visite')} />
      </Section>
      <Section title="Ombres">
        <Toggle label="Projeter des ombres" checked={obj.castShadow} disabled={ro || obj.kind === 'group'} onChange={(v) => patch(obj, { castShadow: v }, 'Ombres projetées')} />
        <Toggle label="Recevoir des ombres" checked={obj.receiveShadow} disabled={ro || obj.kind === 'group'} onChange={(v) => patch(obj, { receiveShadow: v }, 'Ombres reçues')} />
      </Section>
      {asset && (
        <Section title="Source et optimisation">
          <dl className="grid grid-cols-2 gap-y-1 text-xs">
            <dt className="text-ink-faint">Asset</dt>
            <dd className="truncate text-ink">{asset.name}</dd>
            <dt className="text-ink-faint">Format</dt>
            <dd className="text-ink">{asset.format}{asset.source.kind === 'file' && asset.source.originalFormat !== 'glb' ? ` (converti depuis ${asset.source.originalFormat.toUpperCase()})` : ''}</dd>
            <dt className="text-ink-faint">Fichier</dt>
            <dd className="text-ink">{asset.fileSize ? formatBytes(asset.fileSize) : 'Généré procéduralement'}</dd>
            {asset.triangleCount != null && (
              <>
                <dt className="text-ink-faint">Triangles</dt>
                <dd className="text-ink">{formatNumber(asset.triangleCount, 0)}</dd>
              </>
            )}
            <dt className="text-ink-faint">Partage</dt>
            <dd className="text-ink">Géométrie partagée entre instances</dd>
          </dl>
          <p className="text-[11px] text-ink-faint">LOD non disponible pour cet asset. Le frustum culling est actif sur tous les objets.</p>
        </Section>
      )}
      <Section title="Verrouillage">
        <Button variant="secondary" className="w-full" onClick={() => toggleLock([obj.id])}>
          {obj.locked ? <LockOpen size={14} /> : <Lock size={14} />} {obj.locked ? 'Déverrouiller' : 'Verrouiller'}
        </Button>
      </Section>
    </>
  );
}
