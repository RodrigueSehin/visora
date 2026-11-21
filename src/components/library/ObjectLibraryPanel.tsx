import {
  Box,
  ChevronDown,
  Copy,
  Eye,
  FileUp,
  Filter,
  LayoutGrid,
  List,
  MoreVertical,
  PackageOpen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, categoryLabel } from '../../lib/categories';
import { isBuiltinId } from '../../lib/catalog';
import { formatBytes } from '../../lib/format';
import { allAssets, useEditor } from '../../store/editor';
import { buildBuiltin } from '../../three/procedural';
import { dragState } from '../../three/registry';
import { renderThumbnail } from '../../three/thumbnails';
import type { Asset3D, AssetCategory } from '../../types';
import { Menu, MenuItem, MenuSeparator, Modal } from '../common/Overlays';
import { Badge, Button, CommitInput, IconButton, Panel, Select, cx, inputCls } from '../common/ui';
import { ObjectAssetPreview } from './ObjectAssetPreview';
import { ObjectImportDialog } from './ObjectImportDialog';

type Sort = 'name' | 'date' | 'size' | 'category';

export function AssetThumb({ asset, className }: { asset: Asset3D; className?: string }) {
  const [url, setUrl] = useState(asset.thumbnailUrl);
  useEffect(() => {
    if (asset.thumbnailUrl) return setUrl(asset.thumbnailUrl);
    if (asset.source.kind !== 'builtin') return setUrl(undefined);
    let alive = true;
    const key = asset.source.key;
    renderThumbnail(`builtin:${key}`, buildBuiltin(key)).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [asset]);
  return (
    <div className={cx('flex items-center justify-center overflow-hidden bg-gradient-to-b from-navy-600/60 to-navy-900', className)}>
      {url ? <img src={url} alt="" draggable={false} className="h-full w-full object-contain" /> : <Box className="text-ink-faint" size={24} aria-hidden />}
    </div>
  );
}

export function ObjectLibraryPanel({ onClose }: { onClose?: () => void }) {
  const project = useEditor((s) => s.project);
  const favorites = useEditor((s) => s.project?.favorites ?? []);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<AssetCategory | 'all'>('all');
  const [format, setFormat] = useState('all');
  const [onlyImported, setOnlyImported] = useState(false);
  const [onlyFav, setOnlyFav] = useState(false);
  const [sort, setSort] = useState<Sort>('name');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [importOpen, setImportOpen] = useState<{ replace?: Asset3D } | null>(null);
  const [preview, setPreview] = useState<Asset3D | null>(null);
  const [renaming, setRenaming] = useState<Asset3D | null>(null);

  const assets = useMemo(() => allAssets(project), [project]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of assets) m.set(a.category, (m.get(a.category) ?? 0) + 1);
    return m;
  }, [assets]);
  const formats = useMemo(() => [...new Set(assets.map((a) => a.format))].sort(), [assets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = assets.filter(
      (a) =>
        (category === 'all' || a.category === category) &&
        (format === 'all' || a.format === format) &&
        (!onlyImported || a.imported) &&
        (!onlyFav || favorites.includes(a.id)) &&
        (!q || a.name.toLowerCase().includes(q) || a.tags?.some((t) => t.toLowerCase().includes(q))),
    );
    const cmp: Record<Sort, (a: Asset3D, b: Asset3D) => number> = {
      name: (a, b) => a.name.localeCompare(b.name, 'fr'),
      date: (a, b) => b.createdAt.localeCompare(a.createdAt),
      size: (a, b) => (b.fileSize ?? 0) - (a.fileSize ?? 0),
      category: (a, b) => categoryLabel(a.category).localeCompare(categoryLabel(b.category), 'fr') || a.name.localeCompare(b.name, 'fr'),
    };
    return list.sort(cmp[sort]);
  }, [assets, query, category, format, onlyImported, onlyFav, favorites, sort]);

  const activeFilters = (format !== 'all' ? 1 : 0) + (onlyImported ? 1 : 0) + (onlyFav ? 1 : 0);
  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    setFormat('all');
    setOnlyImported(false);
    setOnlyFav(false);
  };

  const remove = async (a: Asset3D) => {
    const st = useEditor.getState();
    const n = st.project?.objects.filter((o) => o.assetId === a.id).length ?? 0;
    const ok = await st.confirm({
      title: `Supprimer « ${a.name} » de la bibliothèque ?`,
      message: n
        ? `Cet asset est utilisé par ${n} objet(s) dans le projet : ils seront également supprimés des scènes. Action annulable avec Ctrl+Z.`
        : 'L’asset sera retiré de la bibliothèque du projet. Action annulable avec Ctrl+Z.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (ok) st.deleteAsset(a.id);
  };

  return (
    <Panel className="h-full">
      <div className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-3">
        <h2 className="text-[15px] font-semibold text-ink">Bibliothèque d’objets 3D</h2>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="primary" onClick={() => setImportOpen({})}>
            <FileUp size={14} /> Importer
          </Button>
          {onClose && (
            <IconButton size="sm" label="Masquer la bibliothèque" onClick={onClose}>
              <X size={15} />
            </IconButton>
          )}
        </div>
      </div>

      <div className="space-y-2 px-3.5">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            className={cx(inputCls, 'pl-8 pr-8')}
            placeholder="Rechercher un objet…"
            aria-label="Rechercher un objet"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" aria-label="Effacer la recherche" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <select
              aria-label="Catégorie"
              className={cx(inputCls, 'appearance-none pr-7')}
              value={category}
              onChange={(e) => setCategory(e.target.value as AssetCategory | 'all')}
            >
              <option value="all">Toutes les catégories ({assets.length})</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({counts.get(c.id) ?? 0})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint" />
          </div>
          <IconButton label="Filtres et tri" active={showFilters || activeFilters > 0} onClick={() => setShowFilters((v) => !v)}>
            <Filter size={15} />
          </IconButton>
          <IconButton label={view === 'grid' ? 'Affichage liste' : 'Affichage grille'} onClick={() => setView(view === 'grid' ? 'list' : 'grid')}>
            {view === 'grid' ? <List size={15} /> : <LayoutGrid size={15} />}
          </IconButton>
        </div>

        <div className="-mx-0.5 flex gap-1 overflow-x-auto pb-0.5" role="group" aria-label="Catégories rapides">
          {(['all', 'industrial', 'furniture', 'security', 'decor', 'imported'] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cx(
                'shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-ring',
                category === c ? 'bg-cyan text-navy-950' : 'bg-navy-700 text-ink-muted hover:text-ink',
              )}
            >
              {c === 'all' ? 'Tous' : CATEGORIES.find((x) => x.id === c)!.short}
            </button>
          ))}
        </div>

        {showFilters && (
          <div className="space-y-2 rounded-xl border border-navy-500/60 bg-navy-900/50 p-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Select
                label="Format"
                value={format}
                onChange={setFormat}
                options={[{ value: 'all', label: 'Tous formats' }, ...formats.map((f) => ({ value: f, label: f }))]}
              />
              <Select
                label="Trier par"
                value={sort}
                onChange={setSort}
                options={[
                  { value: 'name', label: 'Tri : nom' },
                  { value: 'date', label: 'Tri : date' },
                  { value: 'size', label: 'Tri : taille' },
                  { value: 'category', label: 'Tri : catégorie' },
                ]}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={onlyImported} onClick={() => setOnlyImported((v) => !v)} className={cx('rounded-md px-2 py-1 text-xs', onlyImported ? 'bg-cyan/20 text-cyan' : 'bg-navy-700 text-ink-muted')}>
                Importés uniquement
              </button>
              <button type="button" aria-pressed={onlyFav} onClick={() => setOnlyFav((v) => !v)} className={cx('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs', onlyFav ? 'bg-amber-400/20 text-amber-300' : 'bg-navy-700 text-ink-muted')}>
                <Star size={11} /> Favoris
              </button>
              {(activeFilters > 0 || query || category !== 'all') && (
                <button type="button" onClick={resetFilters} className="px-1 text-xs text-cyan hover:underline">
                  Réinitialiser
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-3.5 pb-3">
        {filtered.length === 0 ? (
          <EmptyLibrary
            noAssets={assets.length === 0}
            onReset={resetFilters}
            onImport={() => setImportOpen({})}
            category={category}
          />
        ) : (
          <ul className={cx(view === 'grid' ? 'grid grid-cols-2 gap-2 2xl:grid-cols-3' : 'space-y-1')}>
            {filtered.map((a) => (
              <ObjectAssetCard
                key={a.id}
                asset={a}
                view={view}
                favorite={favorites.includes(a.id)}
                onPreview={() => setPreview(a)}
                onRename={() => setRenaming(a)}
                onReplace={() => setImportOpen({ replace: a })}
                onDelete={() => void remove(a)}
              />
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-navy-500/50 px-3.5 py-2 text-[11px] text-ink-faint">
        {filtered.length} / {assets.length} objets · glisser-déposer dans le viewport pour placer
      </div>

      {importOpen && <ObjectImportDialog replace={importOpen.replace} onClose={() => setImportOpen(null)} />}
      {preview && <ObjectAssetPreview asset={preview} onClose={() => setPreview(null)} />}
      {renaming && <RenameAssetDialog asset={renaming} onClose={() => setRenaming(null)} />}
    </Panel>
  );
}

function EmptyLibrary({ noAssets, onReset, onImport, category }: { noAssets: boolean; onReset: () => void; onImport: () => void; category: string }) {
  if (noAssets || category === 'imported')
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <PackageOpen className="text-ink-faint" size={30} />
        <p className="text-sm text-ink">{category === 'imported' ? 'Aucun modèle importé' : 'Bibliothèque vide'}</p>
        <p className="text-xs text-ink-muted">Importez vos modèles GLB, GLTF, OBJ, FBX ou STL.</p>
        <Button size="sm" variant="primary" onClick={onImport}>
          <FileUp size={14} /> Importer un modèle
        </Button>
      </div>
    );
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <Search className="text-ink-faint" size={26} />
      <p className="text-sm text-ink">Aucun résultat</p>
      <p className="text-xs text-ink-muted">Aucun objet ne correspond à la recherche ou aux filtres.</p>
      <Button size="sm" variant="ghost" onClick={onReset}>
        Réinitialiser les filtres
      </Button>
    </div>
  );
}

function ObjectAssetCard({
  asset,
  view,
  favorite,
  onPreview,
  onRename,
  onReplace,
  onDelete,
}: {
  asset: Asset3D;
  view: 'grid' | 'list';
  favorite: boolean;
  onPreview: () => void;
  onRename: () => void;
  onReplace: () => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const add = () => useEditor.getState().addObject(asset.id);
  const builtin = isBuiltinId(asset.id);
  const dragProps = {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData('application/x-visora-asset', asset.id);
      e.dataTransfer.effectAllowed = 'copy';
      dragState.assetId = asset.id;
    },
    onDragEnd: () => (dragState.assetId = null),
  };
  const menuEl = (
    <div className="relative">
      <IconButton size="sm" label="Plus d’actions" onClick={(e) => (e.stopPropagation(), setMenu((v) => !v))} className="bg-navy-900/70">
        <MoreVertical size={14} />
      </IconButton>
      <Menu open={menu} onClose={() => setMenu(false)}>
        <MenuItem icon={<Plus size={14} />} onClick={() => (add(), setMenu(false))}>
          Ajouter à la scène
        </MenuItem>
        <MenuItem icon={<Eye size={14} />} onClick={() => (onPreview(), setMenu(false))}>
          Prévisualiser
        </MenuItem>
        <MenuItem icon={<Star size={14} />} onClick={() => (useEditor.getState().toggleFavorite(asset.id), setMenu(false))}>
          {favorite ? 'Retirer des favoris' : 'Marquer en favori'}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Pencil size={14} />} disabled={builtin} hint={builtin ? 'Asset VISORA : dupliquez-le pour le personnaliser' : undefined} onClick={() => (onRename(), setMenu(false))}>
          Renommer / modifier
        </MenuItem>
        <MenuItem icon={<RefreshCw size={14} />} disabled={!asset.imported} hint={!asset.imported ? 'Réservé aux modèles importés' : undefined} onClick={() => (onReplace(), setMenu(false))}>
          Remplacer le fichier
        </MenuItem>
        <MenuItem icon={<Copy size={14} />} onClick={() => (useEditor.getState().duplicateAsset(asset.id), setMenu(false))}>
          Dupliquer la ressource
        </MenuItem>
        <MenuItem icon={<Trash2 size={14} />} danger disabled={builtin} hint={builtin ? 'Les assets VISORA ne peuvent pas être supprimés' : undefined} onClick={() => (onDelete(), setMenu(false))}>
          Supprimer de la bibliothèque
        </MenuItem>
      </Menu>
    </div>
  );

  if (view === 'list')
    return (
      <li {...dragProps} className="group flex cursor-grab items-center gap-2.5 rounded-xl border border-transparent p-1.5 hover:border-navy-500 hover:bg-navy-700/60 active:cursor-grabbing">
        <AssetThumb asset={asset} className="h-11 w-14 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 truncate text-sm text-ink">
            {asset.name}
            {favorite && <Star size={11} className="shrink-0 fill-amber-400 text-amber-400" aria-label="Favori" />}
          </div>
          <div className="truncate text-[11px] text-ink-faint">
            {categoryLabel(asset.category)} · {asset.format}
            {asset.fileSize ? ` · ${formatBytes(asset.fileSize)}` : ''}
          </div>
        </div>
        <IconButton size="sm" label="Ajouter à la scène" onClick={add}>
          <Plus size={15} />
        </IconButton>
        {menuEl}
      </li>
    );

  return (
    <li {...dragProps} className="group relative cursor-grab rounded-xl border border-navy-500/50 bg-navy-700/50 transition-colors hover:border-cyan/60 active:cursor-grabbing">
      <button type="button" className="block w-full text-left focus-ring" onDoubleClick={add} onClick={onPreview} aria-label={`Prévisualiser ${asset.name}`}>
        <AssetThumb asset={asset} className="aspect-[4/3] w-full rounded-t-xl" />
      </button>
      <div className="absolute left-1.5 top-1.5 flex gap-1">
        {asset.imported && <Badge tone="violet">Importé</Badge>}
        {favorite && (
          <Badge tone="amber">
            <Star size={9} className="fill-current" /> Favori
          </Badge>
        )}
      </div>
      <div className="absolute right-1 top-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">{menuEl}</div>
      <div className="px-2 pb-2 pt-1.5">
        <div className="truncate text-xs font-medium text-ink" title={asset.name}>
          {asset.name}
        </div>
        <div className="truncate text-[10px] text-ink-faint">
          {categoryLabel(asset.category)} · {asset.format}
          {asset.fileSize ? ` · ${formatBytes(asset.fileSize)}` : ''}
        </div>
        <button
          type="button"
          onClick={add}
          className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md bg-navy-600 py-1 text-[11px] font-medium text-ink hover:bg-cyan hover:text-navy-950 focus-ring"
        >
          <Plus size={12} /> Ajouter
        </button>
      </div>
    </li>
  );
}

function RenameAssetDialog({ asset, onClose }: { asset: Asset3D; onClose: () => void }) {
  const update = useEditor((s) => s.updateAsset);
  const [name, setName] = useState(asset.name);
  const [category, setCategory] = useState<AssetCategory>(asset.category);
  const [tags, setTags] = useState(asset.tags?.join(', ') ?? '');
  const save = () => {
    if (!name.trim()) return;
    update(asset.id, { name: name.trim().slice(0, 80), category, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) }, 'Modifier l’asset');
    onClose();
  };
  return (
    <Modal
      title="Modifier l’asset"
      onClose={onClose}
      width="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={save} disabled={!name.trim()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-muted">Nom</span>
          <input className={inputCls} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-muted">Catégorie</span>
          <Select label="Catégorie" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-muted">Tags (séparés par des virgules)</span>
          <CommitInput value={tags} onCommit={setTags} />
        </label>
      </div>
    </Modal>
  );
}
