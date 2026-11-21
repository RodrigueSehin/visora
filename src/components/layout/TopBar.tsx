import { CheckCircle2, CircleDashed, Eye, Loader2, MoreVertical, Redo2, Save, Send, TriangleAlert, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { formatTime } from '../../lib/format';
import { navigate } from '../../router';
import { useEditor } from '../../store/editor';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '../common/Overlays';
import { Button, IconButton, cx } from '../common/ui';

export function VisoraLogo() {
  return (
    <svg viewBox="0 0 32 32" className="h-9 w-9 shrink-0" aria-hidden>
      <defs>
        <linearGradient id="vg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#36C8F4" />
          <stop offset="1" stopColor="#7868F5" />
        </linearGradient>
      </defs>
      <path d="M5 4 L27 16 L5 28 L11 16 Z" fill="url(#vg)" />
      <path d="M11 16 L27 16 L5 28 Z" fill="#101827" opacity="0.25" />
    </svg>
  );
}

export function ProjectStatusBadge() {
  const dirty = useEditor((s) => s.dirty);
  const saveStatus = useEditor((s) => s.saveStatus);
  const p = useEditor((s) => s.project);
  if (!p) return null;
  let tone = 'bg-navy-600 text-ink-muted';
  let icon = <CircleDashed size={13} />;
  let text = 'Brouillon';
  if (saveStatus === 'saving') {
    tone = 'bg-cyan/15 text-cyan';
    icon = <Loader2 size={13} className="animate-spin" />;
    text = 'Enregistrement…';
  } else if (saveStatus === 'error' || saveStatus === 'conflict') {
    tone = 'bg-red-500/15 text-red-300';
    icon = <TriangleAlert size={13} />;
    text = saveStatus === 'conflict' ? 'Conflit de sauvegarde' : 'Échec de l’enregistrement';
  } else if (dirty) {
    tone = 'bg-amber-500/15 text-amber-300';
    icon = <span className="h-2 w-2 rounded-full bg-amber-400" />;
    text = 'Modifications non enregistrées';
  } else if (p.status === 'published' && p.publishedRevision === p.revision) {
    tone = 'border border-emerald-500/60 bg-emerald-500/15 text-emerald-300';
    icon = <CheckCircle2 size={14} className="fill-emerald-500 text-navy-950" />;
    text = 'Publié';
  } else if (p.status === 'published') {
    tone = 'bg-cyan/15 text-cyan';
    icon = <CheckCircle2 size={13} />;
    text = 'Enregistré · non publié';
  } else if (p.revision > 1) {
    tone = 'bg-cyan/15 text-cyan';
    icon = <CheckCircle2 size={13} />;
    text = 'Enregistré · brouillon';
  }
  return (
    <span role="status" className={cx('inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium', tone)}>
      {icon}
      <span className="hidden md:inline">{text}</span>
    </span>
  );
}

export function TopBar() {
  const p = useEditor((s) => s.project);
  const past = useEditor((s) => s.past);
  const future = useEditor((s) => s.future);
  const dirty = useEditor((s) => s.dirty);
  const saveStatus = useEditor((s) => s.saveStatus);
  const lastSavedAt = useEditor((s) => s.lastSavedAt);
  const viewMode = useEditor((s) => s.viewMode);
  const [menu, setMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const st = useEditor.getState;
  if (!p) return null;
  const upToDate = p.status === 'published' && p.publishedRevision === p.revision && !dirty;

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-navy-500/50 bg-navy-950 px-3 md:gap-3 md:px-4">
      <button type="button" onClick={() => navigate("/")} title="Retour au tableau de bord" className="flex items-center gap-2 rounded-lg text-left focus-ring">
        <VisoraLogo />
        <div className="hidden leading-tight sm:block">
          <div className="text-xl font-bold tracking-wide text-ink">VISORA</div>
          <div className="-mt-0.5 text-[11px] text-ink-muted">Studio 3D</div>
        </div>
      </button>
      <div className="mx-2 hidden h-8 w-px bg-navy-500/60 sm:block" />
      <div className="flex min-w-0 items-center gap-2">
        {editingName ? (
          <input
            autoFocus
            aria-label="Nom du projet"
            defaultValue={p.name}
            maxLength={80}
            className="w-56 rounded-md border border-cyan bg-navy-800 px-2 py-1 text-[15px] font-semibold text-ink focus:outline-none"
            onBlur={(e) => (st().renameProject(e.target.value), setEditingName(false))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditingName(false);
            }}
          />
        ) : (
          <button type="button" onClick={() => setEditingName(true)} title="Renommer le projet" className="truncate rounded-md px-1 text-[15px] font-semibold text-ink hover:bg-navy-700 focus-ring md:text-xl">
            {p.name}
          </button>
        )}
        <ProjectStatusBadge />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-navy-500/70 p-0.5">
        <IconButton label={past.length ? `Annuler : ${past[past.length - 1].label}` : 'Rien à annuler'} shortcut="Ctrl+Z" disabled={!past.length} onClick={() => st().undo()}>
          <Undo2 size={17} />
        </IconButton>
        <IconButton label={future.length ? `Rétablir : ${future[0].label}` : 'Rien à rétablir'} shortcut="Ctrl+Y" disabled={!future.length} onClick={() => st().redo()}>
          <Redo2 size={17} />
        </IconButton>
        </div>
        <Button variant="secondary" className="hidden lg:inline-flex" onClick={() => st().setViewMode(viewMode === 'visitor' ? '3d' : 'visitor')} aria-pressed={viewMode === 'visitor'}>
          <Eye size={15} /> {viewMode === 'visitor' ? 'Quitter l’aperçu' : 'Aperçu visite'}
        </Button>
        <span className="group relative">
          <Button variant="secondary" onClick={() => void st().save()} disabled={saveStatus === 'saving'} aria-label="Enregistrer (Ctrl+S)">
            {saveStatus === 'saving' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span className="hidden sm:inline">Enregistrer</span>
          </Button>
          <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-50 mt-1.5 whitespace-nowrap rounded-md border border-navy-500 bg-navy-950 px-2 py-1 text-xs text-ink opacity-0 shadow-panel transition-opacity group-hover:opacity-100">
            Ctrl+S · Enregistré sur le serveur VISORA{lastSavedAt ? ` · dernier enregistrement ${formatTime(lastSavedAt)}` : ''}
          </span>
        </span>
        <Button variant="primary" className="bg-gradient-to-r from-cyan to-blue-500 !text-white shadow-glow" onClick={() => void st().publish()} disabled={saveStatus === 'saving' || upToDate} title={upToDate ? 'La version publiée est à jour' : 'Enregistre puis met à jour la version publiée'}>
          <Send size={15} />
          <span className="hidden sm:inline">{p.status === 'published' ? 'Publier / Mettre à jour' : 'Publier'}</span>
        </Button>
        <div className="relative">
          <IconButton label="Plus d’options" active={menu} onClick={() => setMenu((v) => !v)}>
            <MoreVertical size={17} />
          </IconButton>
          <Menu open={menu} onClose={() => setMenu(false)} className="w-64">
            <MenuLabel>Sauvegarde automatique</MenuLabel>
            {[
              [0, 'Désactivée'],
              [30, 'Toutes les 30 s'],
              [120, 'Toutes les 2 min'],
            ].map(([sec, label]) => (
              <MenuItem key={sec} onClick={() => (st().setAutosave(sec as number), setMenu(false))} hint={p.settings.autosaveSeconds === sec ? '✓' : undefined}>
                {label}
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuLabel>Panneaux</MenuLabel>
            <MenuItem onClick={() => (st().togglePanel('library'), setMenu(false))}>Bibliothèque</MenuItem>
            <MenuItem onClick={() => (st().togglePanel('inspector'), setMenu(false))}>Inspecteur et hiérarchie</MenuItem>
            <MenuSeparator />
            <div className="px-2.5 py-1.5 text-[11px] leading-relaxed text-ink-faint">
              Le projet est enregistré sur le serveur VISORA ; les modèles importés sont stockés dans l’espace de fichiers de votre organisation.
            </div>
          </Menu>
        </div>
      </div>
    </header>
  );
}
