import {
  Box,
  CheckSquare,
  ChevronDown,
  Clapperboard,
  CloudUpload,
  File,
  FileText,
  Filter,
  Folder,
  FolderInput,
  FolderPlus,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  Layers,
  List,
  Loader2,
  MoreHorizontal,
  MoreVertical,
  Music,
  Orbit,
  Pencil,
  Play,
  RotateCcw,
  Search,
  Square,
  Star,
  Trash2,
  Upload as UploadIcon,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '../../components/common/Overlays';
import { Badge, Button, IconButton, Panel, Select, cx, inputCls } from '../../components/common/ui';
import { useMediaUrl } from '../../components/viewport/TourLayers';
import { formatBytes } from '../../lib/format';
import { ApiError } from '../../services/api';
import { useEditor } from '../../store/editor';
import { addScene } from '../../store/tourActions';
import { ACCEPT_MEDIA, KIND_LABEL, MAX_UPLOAD_MB, mediaUsage, useMedia, type Media, type MediaKind } from './mediaStore';
import { PanoramaViewer } from './PanoramaViewer';

type Category = 'all' | MediaKind | 'favorites' | 'trash';
const CATEGORIES: { id: Category; label: string; short: string; icon: ReactNode; kinds?: MediaKind[] }[] = [
  { id: 'all', label: 'Tous les médias', short: 'Tous', icon: <Layers size={16} /> },
  { id: 'image', label: 'Images', short: 'Images', icon: <ImageIcon size={16} />, kinds: ['image'] },
  { id: 'panorama', label: 'Panoramas 360°', short: '360°', icon: <Orbit size={16} />, kinds: ['panorama'] },
  { id: 'video', label: 'Vidéos', short: 'Vidéos', icon: <Clapperboard size={16} />, kinds: ['video'] },
  { id: 'document', label: 'Documents (PDF)', short: 'PDF', icon: <FileText size={16} />, kinds: ['document'] },
  { id: 'audio', label: 'Audio', short: 'Audio', icon: <Music size={16} />, kinds: ['audio'] },
  { id: 'model', label: 'Modèles 3D', short: '3D', icon: <Box size={16} />, kinds: ['model'] },
  { id: 'texture', label: 'Textures', short: 'Textures', icon: <Images size={16} />, kinds: ['texture'] },
  { id: 'favorites', label: 'Favoris', short: 'Favoris', icon: <Star size={16} /> },
  { id: 'trash', label: 'Corbeille', short: 'Corbeille', icon: <Trash2 size={16} /> },
];
const CHIPS: Category[] = ['all', 'image', 'panorama', 'video', 'document', 'model'];

const KIND_ICON: Record<MediaKind, typeof File> = { image: ImageIcon, panorama: Orbit, texture: Images, video: Clapperboard, document: FileText, audio: Music, model: Box };
const ext = (m: Media) => m.name.split('.').pop()?.toUpperCase() ?? m.mimeType;
const FORMATS: { label: string; icon: ReactNode; color: string }[] = [
  { label: 'JPG PNG WEBP', icon: <ImageIcon size={16} />, color: '#2563EB' },
  { label: 'MP4 MOV WEBM', icon: <Clapperboard size={16} />, color: '#7C3AED' },
  { label: 'PDF', icon: <FileText size={16} />, color: '#DC2626' },
  { label: 'GLB', icon: <Box size={16} />, color: '#475569' },
  { label: 'MP3 WAV', icon: <Music size={16} />, color: '#7C3AED' },
];

const fmtDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** Real duration of a video / audio file, read from its metadata by the browser. */
function useDuration(url: string | undefined, kind: MediaKind): number | null {
  const [d, setD] = useState<number | null>(null);
  useEffect(() => {
    setD(null);
    if (!url || (kind !== 'video' && kind !== 'audio')) return;
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    el.preload = 'metadata';
    const done = () => Number.isFinite(el.duration) && setD(el.duration);
    el.addEventListener('loadedmetadata', done);
    el.src = url;
    return () => {
      el.removeEventListener('loadedmetadata', done);
      el.removeAttribute('src');
      el.load();
    };
  }, [url, kind]);
  return d;
}

/** Thumbnail: real image for pictures, first frame for videos, icon otherwise; kind badge and duration. */
export function MediaThumb({ media, className, details }: { media: Media; className?: string; details?: boolean }) {
  const visual = media.kind === 'image' || media.kind === 'panorama' || media.kind === 'texture' || media.kind === 'video';
  const timed = details && (media.kind === 'video' || media.kind === 'audio');
  const { url } = useMediaUrl((visual || timed) && !media.deletedAt ? media.id : undefined);
  const duration = useDuration(timed ? url : undefined, media.kind);
  const Icon = KIND_ICON[media.kind] ?? File;
  return (
    <div
      className={cx(
        'relative flex items-center justify-center overflow-hidden',
        media.kind === 'audio' ? 'bg-gradient-to-br from-violet-700 to-indigo-900' : media.kind === 'document' ? 'bg-slate-200' : 'bg-gradient-to-br from-navy-600 to-navy-900',
        className,
      )}
    >
      {url && media.kind === 'video' ? (
        <video src={`${url}#t=0.5`} preload="metadata" muted className="h-full w-full object-cover" />
      ) : url && visual ? (
        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : media.kind === 'document' ? (
        <span className="flex flex-col items-center">
          <FileText size={34} className="text-red-500" />
          <span className="mt-0.5 rounded bg-red-600 px-1.5 text-[10px] font-bold text-white">PDF</span>
        </span>
      ) : media.kind === 'audio' ? (
        <span className="flex h-10 items-end gap-[3px]" aria-hidden>
          {[5, 9, 14, 8, 18, 11, 22, 13, 7, 16, 10, 19, 6, 12, 8].map((h, i) => (
            <span key={i} className="w-[3px] rounded-full bg-fuchsia-300/90" style={{ height: h * 1.6 }} />
          ))}
        </span>
      ) : (
        <Icon size={28} className="text-ink-faint" />
      )}
      {media.kind === 'panorama' && <span className="absolute right-1.5 top-1.5 rounded-md bg-navy-950/80 px-1.5 text-[10px] font-semibold text-white">360°</span>}
      {media.kind === 'model' && <span className="absolute right-1.5 top-1.5 rounded-md bg-navy-950/80 px-1.5 text-[10px] font-semibold text-white">3D</span>}
      {details && (media.kind === 'video' || media.kind === 'audio') && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-950/60 text-white ring-1 ring-white/50">
            <Play size={16} fill="currentColor" />
          </span>
        </span>
      )}
      {duration != null && <span className="absolute bottom-1.5 right-1.5 rounded-md bg-navy-950/80 px-1.5 text-[10px] font-semibold tabular-nums text-white">{fmtDuration(duration)}</span>}
    </div>
  );
}

export function MediaModule() {
  const { items, trash, status, error, uploads } = useMedia();
  const [cat, setCat] = useState<Category>('all');
  const [folder, setFolder] = useState<string | null>(null);
  const [extraFolders, setExtraFolders] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'date' | 'name' | 'size'>('date');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [cardSize, setCardSize] = useState(170);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selMenu, setSelMenu] = useState(false);
  const [cardMenu, setCardMenu] = useState<string | null>(null);
  const [moreMenu, setMoreMenu] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void useMedia.getState().load();
  }, []);

  const folders = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) if (i.folder) m.set(i.folder, (m.get(i.folder) ?? 0) + 1);
    for (const f of extraFolders) if (!m.has(f)) m.set(f, 0);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [items, extraFolders]);

  const count = (id: Category) => {
    const c = CATEGORIES.find((x) => x.id === id)!;
    return id === 'trash' ? trash.length : id === 'favorites' ? items.filter((i) => i.favorite).length : c.kinds ? items.filter((i) => c.kinds!.includes(i.kind)).length : items.length;
  };

  const list = useMemo(() => {
    const base = cat === 'trash' ? trash : items;
    const c = CATEGORIES.find((x) => x.id === cat)!;
    const needle = q.trim().toLowerCase();
    return base
      .filter((i) => (cat === 'favorites' ? i.favorite : c.kinds ? c.kinds.includes(i.kind) : true))
      .filter((i) => cat === 'trash' || !folder || i.folder === folder)
      .filter((i) => !needle || i.name.toLowerCase().includes(needle))
      .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, 'fr') : sort === 'size' ? b.size - a.size : b.createdAt.localeCompare(a.createdAt)));
  }, [items, trash, cat, folder, q, sort]);

  const current = [...items, ...trash].find((i) => i.id === selected) ?? null;
  const upload = (files: File[]) => files.length && void useMedia.getState().upload(files, folder ?? undefined);
  const toggleCheck = (id: string) =>
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allChecked = list.length > 0 && list.every((m) => checked.has(m.id));

  const bulkTrash = async (ids = [...checked]) => {
    const used = ids.filter((id) => mediaUsage(id).length);
    const ok = await useEditor.getState().confirm({
      title: `Mettre ${ids.length} média(s) à la corbeille ?`,
      message: used.length ? `${used.length} d’entre eux sont utilisés dans le projet : ils resteront référencés mais n’apparaîtront plus dans la bibliothèque tant qu’ils sont dans la corbeille.` : 'Vous pourrez les restaurer depuis la corbeille.',
      confirmLabel: 'Mettre à la corbeille',
      danger: true,
    });
    if (!ok) return;
    for (const id of ids) await useMedia.getState().remove(id).catch(() => {});
    setChecked(new Set());
    if (selected && ids.includes(selected)) setSelected(null);
  };
  const bulkMove = async (target: string, ids = [...checked]) => {
    for (const id of ids) await useMedia.getState().update(id, { folder: target || null } as Partial<Media>).catch(() => {});
    setChecked(new Set());
  };
  const pickCat = (c: Category) => (setCat(c), setChecked(new Set()));

  return (
    <div className="flex h-full min-h-0 gap-3 pb-3">
      {/* Left: categories and folders */}
      <Panel className="hidden w-[300px] shrink-0 lg:flex">
        <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-4">
          <h2 className="text-lg font-semibold">Bibliothèque de médias</h2>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-3 py-1.5 text-sm font-semibold text-white shadow-glow hover:brightness-110 focus-ring"
          >
            <UploadIcon size={15} /> Importer
          </button>
        </div>
        <div className="relative px-4 pb-3">
          <Search size={15} className="pointer-events-none absolute left-7 top-[18px] -translate-y-1/2 text-ink-muted" />
          <input className={cx(inputCls, 'pl-9')} placeholder="Rechercher un média…" aria-label="Rechercher un média" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <nav aria-label="Catégories de médias" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-current={cat === c.id}
              onClick={() => pickCat(c.id)}
              className={cx('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm', cat === c.id ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-glow' : 'text-ink hover:bg-navy-700')}
            >
              {c.icon}
              <span className="flex-1 text-left">{c.label}</span>
              <span className={cx('min-w-[28px] rounded-md px-1.5 text-center text-xs tabular-nums', cat === c.id ? 'bg-white/20' : 'bg-navy-700 text-ink-muted')}>{count(c.id)}</span>
            </button>
          ))}
          <div className="mt-3 flex items-center justify-between border-t border-navy-500/50 px-2 pb-1 pt-3">
            <span className="text-[15px] font-semibold text-ink">Dossiers du projet</span>
            <IconButton size="sm" label="Nouveau dossier" onClick={() => setNewFolder('')}>
              <FolderPlus size={16} />
            </IconButton>
          </div>
          {newFolder !== null && (
            <form
              className="px-2 pb-1"
              onSubmit={(e) => {
                e.preventDefault();
                const n = newFolder.trim().slice(0, 80);
                if (n) {
                  setExtraFolders((f) => [...new Set([...f, n])]);
                  setFolder(n);
                }
                setNewFolder(null);
              }}
            >
              <input autoFocus className={cx(inputCls, 'py-1 text-xs')} placeholder="Nom du dossier" aria-label="Nom du dossier" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} onBlur={() => setNewFolder(null)} />
            </form>
          )}
          <button type="button" onClick={() => setFolder(null)} aria-current={!folder} className={cx('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm', !folder ? 'bg-navy-600 text-ink' : 'text-ink-muted hover:bg-navy-700')}>
            <Folder size={15} /> Tous les dossiers
          </button>
          {folders.map(([f, n]) => (
            <button key={f} type="button" onClick={() => setFolder(f)} aria-current={folder === f} className={cx('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm', folder === f ? 'bg-navy-600 text-ink' : 'text-ink hover:bg-navy-700')}>
              <Folder size={15} className="text-ink-muted" />
              <span className="flex-1 truncate text-left">{f}</span>
              <span className="text-xs tabular-nums text-ink-muted">({n})</span>
            </button>
          ))}
          {folders.length === 0 && <p className="px-2.5 py-1 text-xs text-ink-faint">Aucun dossier. Créez-en un, puis importez ou déplacez des médias dedans.</p>}
        </nav>
      </Panel>

      {/* Centre: grid */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Panel className="min-h-0 flex-1">
          <div className="flex gap-1.5 overflow-x-auto border-b border-navy-500/50 px-3 pb-2.5 pt-3" role="tablist" aria-label="Filtrer par type">
            {CHIPS.map((id) => {
              const c = CATEGORIES.find((x) => x.id === id)!;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={cat === id}
                  onClick={() => pickCat(id)}
                  className={cx(
                    'flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px] font-medium',
                    cat === id ? 'border-blue-400 bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-glow' : 'border-navy-500/70 text-ink hover:bg-navy-700',
                  )}
                >
                  {id === 'all' ? <Filter size={14} /> : c.icon}
                  {c.short} ({count(id)})
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
            {cat !== 'trash' && (
              <button
                type="button"
                aria-label={allChecked ? 'Tout désélectionner' : 'Tout sélectionner'}
                onClick={() => setChecked(allChecked ? new Set() : new Set(list.map((m) => m.id)))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-navy-500/70 text-ink hover:bg-navy-700"
              >
                {allChecked ? <CheckSquare size={17} className="text-blue-400" /> : <Square size={17} />}
              </button>
            )}
            {cat !== 'trash' && (
              <div className="relative">
                <button type="button" aria-haspopup="menu" aria-expanded={selMenu} onClick={() => setSelMenu((v) => !v)} className="flex h-9 items-center gap-2 rounded-lg border border-navy-500/70 px-3 text-sm text-ink hover:bg-navy-700">
                  {checked.size ? `${checked.size} sélectionné(s)` : 'Sélectionner'} <ChevronDown size={14} />
                </button>
                <Menu open={selMenu} onClose={() => setSelMenu(false)} align="left" className="w-60">
                  <MenuItem onClick={() => (setChecked(new Set(list.map((m) => m.id))), setSelMenu(false))}>Tout sélectionner ({list.length})</MenuItem>
                  <MenuItem disabled={!checked.size} onClick={() => (setChecked(new Set()), setSelMenu(false))}>
                    Tout désélectionner
                  </MenuItem>
                  <MenuSeparator />
                  <MenuLabel>Déplacer la sélection vers</MenuLabel>
                  <MenuItem icon={<FolderInput size={14} />} disabled={!checked.size} onClick={() => (void bulkMove(''), setSelMenu(false))}>
                    Sans dossier
                  </MenuItem>
                  {folders.map(([f]) => (
                    <MenuItem key={f} icon={<Folder size={14} />} disabled={!checked.size} onClick={() => (void bulkMove(f), setSelMenu(false))}>
                      {f}
                    </MenuItem>
                  ))}
                  <MenuSeparator />
                  <MenuItem icon={<Trash2 size={14} />} danger disabled={!checked.size} onClick={() => (setSelMenu(false), void bulkTrash())}>
                    Mettre à la corbeille
                  </MenuItem>
                </Menu>
              </div>
            )}
            <span className="w-52">
              <Select label="Trier" value={sort} onChange={setSort} options={[{ value: 'date', label: 'Trier : Date d’ajout' }, { value: 'name', label: 'Trier : Nom' }, { value: 'size', label: 'Trier : Taille' }]} />
            </span>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex rounded-lg border border-navy-500/70 p-0.5" role="group" aria-label="Affichage">
                <IconButton size="sm" label="Grille" active={view === 'grid'} onClick={() => setView('grid')}>
                  <LayoutGrid size={16} />
                </IconButton>
                <IconButton size="sm" label="Liste" active={view === 'list'} onClick={() => setView('list')}>
                  <List size={16} />
                </IconButton>
              </div>
              {view === 'grid' && (
                <input type="range" min={130} max={260} step={10} value={cardSize} onChange={(e) => setCardSize(+e.target.value)} aria-label="Taille des vignettes" className="hidden w-24 accent-blue-500 md:block" />
              )}
              <div className="relative">
                <IconButton label="Plus d’options" active={moreMenu} onClick={() => setMoreMenu((v) => !v)}>
                  <MoreVertical size={17} />
                </IconButton>
                <Menu open={moreMenu} onClose={() => setMoreMenu(false)} className="w-56">
                  <MenuItem icon={<RotateCcw size={14} />} onClick={() => (void useMedia.getState().load(true), setMoreMenu(false))}>
                    Actualiser la bibliothèque
                  </MenuItem>
                  <MenuItem icon={<FolderPlus size={14} />} onClick={() => (setNewFolder(''), setMoreMenu(false))}>
                    Nouveau dossier
                  </MenuItem>
                  <MenuItem icon={<Trash2 size={14} />} onClick={() => (pickCat('trash'), setMoreMenu(false))}>
                    Ouvrir la corbeille ({trash.length})
                  </MenuItem>
                </Menu>
              </div>
            </div>
          </div>

          <div
            className={cx('relative min-h-0 flex-1 overflow-y-auto px-3 pb-3', dragOver && 'bg-blue-500/5 ring-2 ring-inset ring-blue-400')}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes('Files') || cat === 'trash') return;
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              upload([...e.dataTransfer.files]);
            }}
          >
            {status === 'loading' && (
              <p className="flex items-center gap-2 py-10 text-sm text-ink-muted" role="status">
                <Loader2 size={16} className="animate-spin text-cyan" /> Chargement des médias…
              </p>
            )}
            {status === 'error' && (
              <div role="alert" className="rounded-lg bg-red-500/10 p-4 text-sm text-red-300">
                Impossible de charger la bibliothèque : {error}{' '}
                <button type="button" className="font-semibold underline" onClick={() => void useMedia.getState().load(true)}>
                  Réessayer
                </button>
              </div>
            )}
            {status === 'ready' && list.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                {cat === 'trash' ? <Trash2 className="text-ink-faint" size={30} /> : <UploadIcon className="text-ink-faint" size={30} />}
                <p className="text-sm text-ink">{cat === 'trash' ? 'La corbeille est vide' : q ? 'Aucun média ne correspond' : 'Aucun média ici'}</p>
                {cat !== 'trash' && <p className="text-xs text-ink-muted">Glissez-déposez vos fichiers dans cette zone ou cliquez sur « Importer ».</p>}
              </div>
            )}
            <ul
              aria-label="Médias"
              className={view === 'grid' ? 'grid gap-3' : 'divide-y divide-navy-500/40'}
              style={view === 'grid' ? { gridTemplateColumns: `repeat(auto-fill, minmax(${cardSize}px, 1fr))` } : undefined}
            >
              {list.map((m) => {
                const isSel = selected === m.id;
                const isChecked = checked.has(m.id);
                const menu = (
                  <>
                    <IconButton size="sm" label={`Actions pour ${m.name}`} active={cardMenu === m.id} onClick={() => setCardMenu(cardMenu === m.id ? null : m.id)}>
                      <MoreVertical size={15} />
                    </IconButton>
                    <Menu open={cardMenu === m.id} onClose={() => setCardMenu(null)} className="w-56">
                      <MenuItem onClick={() => (setSelected(m.id), setCardMenu(null))}>Voir les détails</MenuItem>
                      {!m.deletedAt && (
                        <>
                          <MenuItem icon={<Star size={14} />} onClick={() => (void useMedia.getState().update(m.id, { favorite: !m.favorite }), setCardMenu(null))}>
                            {m.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                          </MenuItem>
                          <MenuSeparator />
                          <MenuLabel>Déplacer vers</MenuLabel>
                          <MenuItem icon={<FolderInput size={14} />} onClick={() => (void bulkMove('', [m.id]), setCardMenu(null))}>
                            Sans dossier
                          </MenuItem>
                          {folders.map(([f]) => (
                            <MenuItem key={f} icon={<Folder size={14} />} onClick={() => (void bulkMove(f, [m.id]), setCardMenu(null))}>
                              {f}
                            </MenuItem>
                          ))}
                          <MenuSeparator />
                          <MenuItem icon={<Trash2 size={14} />} danger onClick={() => (setCardMenu(null), void bulkTrash([m.id]))}>
                            Mettre à la corbeille
                          </MenuItem>
                        </>
                      )}
                      {m.deletedAt && (
                        <MenuItem icon={<RotateCcw size={14} />} onClick={() => (void useMedia.getState().restore(m.id), setCardMenu(null))}>
                          Restaurer
                        </MenuItem>
                      )}
                    </Menu>
                  </>
                );
                const checkbox = cat !== 'trash' && (
                  <button
                    type="button"
                    aria-label={isChecked ? `Désélectionner ${m.name}` : `Sélectionner ${m.name}`}
                    aria-pressed={isChecked}
                    onClick={() => toggleCheck(m.id)}
                    className={cx('rounded-md bg-navy-950/70 p-0.5 text-white', view === 'grid' && 'absolute left-2 top-2', view === 'grid' && !isChecked && !isSel && 'opacity-0 group-hover:opacity-100 focus:opacity-100')}
                  >
                    {isChecked ? <CheckSquare size={17} className="text-blue-400" /> : <Square size={17} />}
                  </button>
                );
                if (view === 'list')
                  return (
                    <li key={m.id} className={cx('relative flex items-center gap-3 px-1 py-1.5', isSel && 'rounded-lg bg-blue-600/15')}>
                      {checkbox}
                      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left focus-ring" onClick={() => setSelected(m.id)} aria-label={`Détails de ${m.name}`}>
                        <MediaThumb media={m} className="h-10 w-16 shrink-0 rounded-md" />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">
                          {m.favorite && <Star size={11} className="mr-1 inline fill-amber-400 text-amber-400" />}
                          {m.name}
                        </span>
                        <span className="hidden w-28 text-xs text-ink-muted sm:block">{KIND_LABEL[m.kind]}</span>
                        <span className="w-16 text-right text-xs tabular-nums text-ink-muted">{formatBytes(m.size)}</span>
                        <span className="hidden w-24 text-right text-xs text-ink-muted md:block">{new Date(m.createdAt).toLocaleDateString('fr-FR')}</span>
                      </button>
                      {menu}
                    </li>
                  );
                return (
                  <li key={m.id} className="relative">
                    <div
                      className={cx(
                        'group relative overflow-hidden rounded-xl border-2 bg-navy-700/50 transition-colors',
                        isSel ? 'border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.3)]' : isChecked ? 'border-blue-400/70' : 'border-navy-500/40 hover:border-navy-500',
                      )}
                    >
                      <button type="button" className="block w-full text-left focus-ring" onClick={() => setSelected(m.id)} aria-label={`Détails de ${m.name}`}>
                        <MediaThumb media={m} details className="aspect-[16/10] w-full" />
                      </button>
                      {checkbox}
                      <div className="flex items-center gap-1 py-1.5 pl-2.5 pr-1">
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelected(m.id)} tabIndex={-1}>
                          <p className="flex items-center gap-1 truncate text-[13px] font-medium text-ink" title={m.name}>
                            {m.favorite && <Star size={11} className="shrink-0 fill-amber-400 text-amber-400" />}
                            <span className="truncate">{m.name}</span>
                          </p>
                          <p className="text-[11px] text-ink-muted">
                            {ext(m)} • {formatBytes(m.size)}
                          </p>
                        </button>
                        {menu}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          {uploads.length > 0 && (
            <ul className="space-y-1 border-t border-navy-500/50 px-3 py-2" aria-label="Imports en cours">
              {uploads.map((u) => (
                <li key={u.key} className="flex items-center gap-2 text-xs">
                  <span className="w-48 truncate text-ink">{u.name}</span>
                  {u.status === 'error' ? (
                    <span className="text-red-300">{u.error}</span>
                  ) : (
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-600" role="progressbar" aria-valuenow={Math.round(u.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Import de ${u.name}`}>
                      <span className={cx('block h-full rounded-full', u.status === 'done' ? 'bg-emerald-400' : 'bg-blue-500')} style={{ width: `${Math.round(u.progress * 100)}%` }} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Quick import + supported formats */}
        {cat !== 'trash' && (
          <div className="flex shrink-0 flex-wrap items-center gap-4 rounded-2xl border border-navy-500/50 bg-navy-800/90 p-3">
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                upload([...e.dataTransfer.files]);
              }}
              className="flex min-w-[300px] flex-1 items-center gap-4 rounded-xl border-2 border-dashed border-navy-500 px-5 py-3 text-left hover:border-blue-400 focus-ring"
            >
              <CloudUpload size={34} className="shrink-0 text-ink" />
              <span>
                <span className="block text-[15px] font-semibold text-ink">Import rapide</span>
                <span className="block text-sm text-ink-muted">Glisser-déposer vos fichiers ici</span>
                <span className="block text-xs text-ink-faint">ou cliquer pour sélectionner · {folder ? `dossier « ${folder} »` : 'sans dossier'} · {MAX_UPLOAD_MB} Mo max.</span>
              </span>
            </button>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-ink">Formats supportés</p>
              <ul className="flex gap-2">
                {FORMATS.map((f) => (
                  <li key={f.label} className="flex w-[58px] flex-col items-center gap-1 text-center text-[10px] leading-tight text-ink-muted">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: f.color }}>
                      {f.icon}
                    </span>
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>
            <input ref={input} type="file" multiple accept={ACCEPT_MEDIA} className="hidden" onChange={(e) => (upload([...(e.target.files ?? [])]), (e.target.value = ''))} />
          </div>
        )}
      </div>

      {/* Right: details */}
      <Panel className="hidden w-[360px] shrink-0 xl:flex">
        {current ? (
          <MediaDetails media={current} folders={folders.map(([f]) => f)} onClose={() => setSelected(null)} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <ImageIcon className="text-ink-faint" size={28} />
            <p className="text-sm text-ink">Aucun média sélectionné</p>
            <p className="text-xs text-ink-muted">Cliquez sur un média pour voir ses détails, son utilisation et ses actions.</p>
          </div>
        )}
      </Panel>
    </div>
  );
}

function MediaPreview({ media, onOpen360 }: { media: Media; onOpen360: () => void }) {
  const { url, error } = useMediaUrl(media.deletedAt ? undefined : media.id);
  if (media.deletedAt) return <MediaThumb media={media} className="aspect-video w-full rounded-xl" />;
  if (error) return <p className="rounded-xl bg-red-500/10 p-4 text-xs text-red-300">Aperçu indisponible : {error}</p>;
  if (!url) return <div className="aspect-video w-full animate-pulse rounded-xl bg-navy-700" />;
  if (media.kind === 'video') return <video src={url} controls preload="metadata" className="aspect-video w-full rounded-xl bg-black" />;
  if (media.kind === 'audio')
    return (
      <div className="space-y-2">
        <MediaThumb media={media} details className="aspect-video w-full rounded-xl" />
        <audio src={url} controls className="w-full" />
      </div>
    );
  if (media.kind === 'panorama')
    return (
      <button type="button" onClick={onOpen360} className="group relative block w-full overflow-hidden rounded-xl focus-ring" aria-label="Ouvrir l’aperçu 360°">
        <img src={url} alt={media.name} className="aspect-video w-full object-cover" />
        <span className="absolute right-2 top-2 rounded-lg bg-navy-950/75 px-2 py-0.5 text-xs font-semibold text-white">360°</span>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-950/50 text-white ring-2 ring-white/70 transition group-hover:scale-110">
            <Play size={20} fill="currentColor" />
          </span>
        </span>
      </button>
    );
  if (media.kind === 'image' || media.kind === 'texture') return <img src={url} alt={media.name} className="aspect-video w-full rounded-xl object-cover" />;
  return (
    <div className="flex flex-col items-center gap-2">
      <MediaThumb media={media} className="aspect-video w-full rounded-xl" />
      {media.kind === 'document' && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-cyan hover:underline">
          Ouvrir le PDF dans un nouvel onglet
        </a>
      )}
    </div>
  );
}

const resolutionLabel = (w: number, h: number) => {
  const k = w >= 7680 ? ' (8K)' : w >= 3840 ? ' (4K)' : w >= 2048 ? ' (2K)' : w >= 1920 ? ' (Full HD)' : '';
  return `${w} × ${h}${k}`;
};

function MediaDetails({ media, folders, onClose }: { media: Media; folders: string[]; onClose: () => void }) {
  const [tab, setTab] = useState<'general' | 'usage' | 'meta'>('general');
  const [renaming, setRenaming] = useState(false);
  const [moving, setMoving] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [more, setMore] = useState(false);
  const [name, setName] = useState(media.name);
  useEffect(() => setName(media.name), [media.name]);
  useEffect(() => setViewer(false), [media.id]);
  const { url } = useMediaUrl((media.kind === 'video' || media.kind === 'audio') && !media.deletedAt ? media.id : undefined);
  const duration = useDuration(url, media.kind);
  const usage = mediaUsage(media.id);
  const st = useMedia.getState();
  const trashed = !!media.deletedAt;
  const imageKind = media.kind === 'image' || media.kind === 'panorama' || media.kind === 'texture';
  const KindIcon = KIND_ICON[media.kind];

  const destroy = async () => {
    const ok = await useEditor.getState().confirm({ title: `Supprimer définitivement « ${media.name} » ?`, message: 'Le fichier sera effacé du stockage. Cette action est irréversible.', confirmLabel: 'Supprimer définitivement', danger: true });
    if (!ok) return;
    try {
      await st.destroy(media.id);
      onClose();
    } catch (e) {
      useEditor.getState().toast({ kind: 'error', text: e instanceof ApiError && e.code === 'file_in_use' ? 'Impossible : ce média est encore utilisé par le projet ou par la version publiée.' : String(e instanceof Error ? e.message : e) });
    }
  };
  const toTrash = async () => {
    const ok = await useEditor.getState().confirm({
      title: `Mettre « ${media.name} » à la corbeille ?`,
      message: usage.length ? `Ce média est utilisé (${usage.join(', ')}). Il restera affiché dans la visite tant qu’il n’est pas supprimé définitivement.` : 'Vous pourrez le restaurer depuis la corbeille.',
      confirmLabel: 'Mettre à la corbeille',
      danger: true,
    });
    if (ok) await st.remove(media.id).then(onClose, (e) => useEditor.getState().toast({ kind: 'error', text: String(e instanceof Error ? e.message : e) }));
  };
  const tabs = [
    { id: 'general' as const, label: 'Général' },
    { id: 'usage' as const, label: `Utilisation (${usage.length})` },
    { id: 'meta' as const, label: 'Métadonnées' },
  ];
  const folderSelect = (
    <select aria-label="Dossier" className={cx(inputCls, 'py-1')} value={media.folder ?? ''} onChange={(e) => (void st.update(media.id, { folder: (e.target.value || null) as string }), setMoving(false))}>
      <option value="">Sans dossier</option>
      {[...new Set([...folders, ...(media.folder ? [media.folder] : [])])].map((f) => (
        <option key={f} value={f}>
          {f}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <h2 className="text-lg font-semibold">Détails du média</h2>
        <IconButton label="Fermer" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <MediaPreview media={media} onOpen360={() => setViewer(true)} />
        <div className="flex items-center gap-2">
          <KindIcon size={18} className="shrink-0 text-ink-muted" />
          {renaming ? (
            <form
              className="flex flex-1 gap-1"
              onSubmit={async (e) => {
                e.preventDefault();
                if (name.trim() && name !== media.name) await st.update(media.id, { name: name.trim() }).catch(() => {});
                setRenaming(false);
              }}
            >
              <input autoFocus aria-label="Nom du média" className={inputCls} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
              <Button size="sm" type="submit">
                OK
              </Button>
            </form>
          ) : (
            <p className="flex-1 truncate text-[15px] font-semibold" title={media.name}>
              {media.name}
            </p>
          )}
          {!trashed && (
            <IconButton label={media.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} onClick={() => void st.update(media.id, { favorite: !media.favorite })}>
              <Star size={18} className={media.favorite ? 'fill-amber-400 text-amber-400' : ''} />
            </IconButton>
          )}
          <div className="relative">
            <IconButton label="Plus d’actions" active={more} onClick={() => setMore((v) => !v)}>
              <MoreHorizontal size={18} />
            </IconButton>
            <Menu open={more} onClose={() => setMore(false)} className="w-64">
              {media.kind === 'panorama' && !trashed && (
                <MenuItem
                  icon={<Orbit size={14} />}
                  onClick={() => {
                    addScene('panorama', { panoramaFileId: media.id, name: media.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') });
                    useEditor.getState().setModule('scenes');
                  }}
                >
                  Créer une scène 360° avec ce panorama
                </MenuItem>
              )}
              {!trashed && (
                <MenuItem icon={<Pencil size={14} />} onClick={() => (setRenaming(true), setMore(false))}>
                  Renommer
                </MenuItem>
              )}
              {trashed && (
                <MenuItem icon={<RotateCcw size={14} />} onClick={() => (void st.restore(media.id), setMore(false))}>
                  Restaurer
                </MenuItem>
              )}
            </Menu>
          </div>
        </div>
        <div role="tablist" aria-label="Détails du média" className="flex gap-1 rounded-xl border border-navy-500/60 bg-navy-900/60 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cx('flex-1 whitespace-nowrap rounded-lg py-1.5 text-[12.5px] font-medium', tab === t.id ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-glow' : 'text-ink-muted hover:text-ink')}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'general' && (
          <dl className="divide-y divide-navy-500/40 text-sm">
            <Row k="Type">
              {imageKind && !trashed ? (
                <Select<MediaKind> label="Type" value={media.kind} onChange={(kind) => void st.update(media.id, { kind })} options={(['image', 'panorama', 'texture'] as MediaKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
              ) : (
                <span className="flex items-center gap-1.5">
                  <KindIcon size={15} /> {KIND_LABEL[media.kind]}
                </span>
              )}
            </Row>
            <Row k="Format">{ext(media)}</Row>
            <Row k="Taille">{formatBytes(media.size)}</Row>
            {media.width && media.height && <Row k="Résolution">{resolutionLabel(media.width, media.height)}</Row>}
            {duration != null && <Row k="Durée">{fmtDuration(duration)}</Row>}
            <Row k="Date d’ajout">{new Date(media.createdAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</Row>
            {!trashed && <Row k="Dossier">{folderSelect}</Row>}
            {media.kind === 'panorama' && !trashed && (
              <Row k="Aperçu 360°">
                <Button size="sm" className="w-full" onClick={() => setViewer(true)}>
                  <Play size={14} /> Ouvrir le panorama
                </Button>
              </Row>
            )}
          </dl>
        )}
        {tab === 'usage' &&
          (usage.length ? (
            <ul className="space-y-1 text-sm text-ink">
              {usage.map((u) => (
                <li key={u} className="rounded-lg bg-navy-700/60 px-2.5 py-1.5">
                  {u}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-muted">Ce média n’est utilisé nulle part dans le projet.</p>
          ))}
        {tab === 'meta' && (
          <dl className="divide-y divide-navy-500/40 text-sm">
            <Row k="Type MIME">{media.mimeType}</Row>
            <Row k="Octets">{media.size.toLocaleString('fr-FR')}</Row>
            {media.width && media.height && (
              <>
                <Row k="Rapport">{(media.width / media.height).toFixed(2)} : 1</Row>
                <Row k="Mégapixels">{((media.width * media.height) / 1e6).toFixed(1)} Mpx</Row>
              </>
            )}
            <Row k="Favori">{media.favorite ? 'Oui' : 'Non'}</Row>
            <Row k="Identifiant">
              <span className="select-all text-xs">{media.id}</span>
            </Row>
          </dl>
        )}
        {moving && !trashed && (
          <div className="rounded-xl border border-blue-400/60 p-2.5">
            <p className="mb-1.5 text-xs text-ink-muted">Déplacer vers le dossier :</p>
            {folderSelect}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 p-3">
        {trashed ? (
          <>
            <Button className="col-span-1" onClick={() => void st.restore(media.id)}>
              <RotateCcw size={14} /> Restaurer
            </Button>
            <button type="button" onClick={() => void destroy()} className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-2 text-sm font-medium text-white hover:bg-red-500">
              <Trash2 size={14} /> Supprimer définitivement
            </button>
          </>
        ) : (
          <>
            <Button onClick={() => setRenaming(true)}>
              <Pencil size={14} /> Renommer
            </Button>
            <Button onClick={() => setMoving((v) => !v)} aria-expanded={moving}>
              <FolderInput size={14} /> Déplacer
            </Button>
            <button type="button" onClick={() => void toTrash()} className="flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-2 text-sm font-medium text-white hover:bg-red-500 focus-ring">
              <Trash2 size={14} /> Supprimer
            </button>
          </>
        )}
      </div>
      {trashed && (
        <p className="px-4 pb-3 text-[11px] text-ink-faint">
          <Badge tone="amber">Corbeille</Badge> La suppression définitive est refusée tant que le média est utilisé par le brouillon ou la version publiée.
        </p>
      )}
      {viewer && media.kind === 'panorama' && <PanoramaViewer fileId={media.id} name={media.name} onClose={() => setViewer(false)} />}
    </>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-2 py-2">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="min-w-0 truncate text-ink">{children}</dd>
    </div>
  );
}
