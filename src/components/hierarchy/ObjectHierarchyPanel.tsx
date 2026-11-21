import { Box, ChevronDown, ChevronRight, Eye, EyeOff, FolderTree, Group as GroupIcon, Lock, LockOpen, Pencil, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../../store/editor';
import { deleteSelection, groupSelection, toggleLock, toggleVisibility } from '../../store/objectActions';
import type { SceneObject3D } from '../../types';
import { Menu, MenuItem, MenuSeparator } from '../common/Overlays';
import { IconButton, Panel, cx, inputCls } from '../common/ui';
import { ObjectMenuItems } from '../viewport/Scene3DViewport';

type DropHint = { id: string | null; where: 'before' | 'inside' } | null;

export function ObjectHierarchyPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const objects = useEditor((s) => s.project?.objects);
  const sceneId = useEditor((s) => s.activeSceneId);
  const selection = useEditor((s) => s.selection);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hint, setHint] = useState<DropHint>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const sceneObjects = useMemo(() => objects?.filter((o) => o.sceneId === sceneId) ?? [], [objects, sceneId]);
  const childrenOf = useMemo(() => {
    const m = new Map<string | undefined, SceneObject3D[]>();
    for (const o of sceneObjects) {
      if (!m.has(o.parentId)) m.set(o.parentId, []);
      m.get(o.parentId)!.push(o);
    }
    for (const l of m.values()) l.sort((a, b) => a.order - b.order);
    return m;
  }, [sceneObjects]);

  // Auto-expand ancestors of the selection so it is always visible in the tree.
  useEffect(() => {
    const byId = new Map(sceneObjects.map((o) => [o.id, o]));
    const add = new Set<string>();
    for (const id of selection) {
      let p = byId.get(id)?.parentId;
      while (p) {
        add.add(p);
        p = byId.get(p)?.parentId;
      }
    }
    if ([...add].some((a) => !expanded.has(a))) setExpanded((e) => new Set([...e, ...add]));
    const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${selection[selection.length - 1]}"]`);
    el?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, sceneObjects]);

  const q = query.trim().toLowerCase();
  const rows: { obj: SceneObject3D; depth: number }[] = [];
  if (q) {
    for (const o of sceneObjects) if (o.name.toLowerCase().includes(q)) rows.push({ obj: o, depth: 0 });
  } else {
    const walk = (pid: string | undefined, depth: number) => {
      for (const o of childrenOf.get(pid) ?? []) {
        rows.push({ obj: o, depth });
        if (o.kind === 'group' && expanded.has(o.id)) walk(o.id, depth + 1);
      }
    };
    walk(undefined, 0);
  }

  const onRowClick = (e: React.MouseEvent, id: string) => {
    const st = useEditor.getState();
    if (e.shiftKey && st.selection.length) {
      const ids = rows.map((r) => r.obj.id);
      const a = ids.indexOf(st.selection[st.selection.length - 1]);
      const b = ids.indexOf(id);
      if (a >= 0 && b >= 0) return st.select(ids.slice(Math.min(a, b), Math.max(a, b) + 1), 'add');
    }
    st.select([id], e.ctrlKey || e.metaKey ? 'toggle' : 'replace');
  };

  const onDrop = () => {
    const st = useEditor.getState();
    if (!dragId || !hint) return;
    if (hint.where === 'inside' && hint.id) st.reparent(dragId, hint.id);
    else {
      const target = hint.id ? sceneObjects.find((o) => o.id === hint.id) : undefined;
      const moving = sceneObjects.find((o) => o.id === dragId);
      if (moving && moving.parentId !== target?.parentId) st.reparent(dragId, target?.parentId);
      st.reorder(dragId, hint.id);
    }
    setDragId(null);
    setHint(null);
  };

  return (
    <Panel className={cx('shrink-0', collapsed ? '' : 'max-h-[42%] min-h-[160px]')}>
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <button type="button" onClick={onToggle} className="flex items-center gap-1.5 text-[14px] font-semibold text-ink focus-ring" aria-expanded={!collapsed}>
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
          <FolderTree size={15} className="text-cyan" /> Hiérarchie
          <span className="text-xs font-normal text-ink-faint">({sceneObjects.length})</span>
        </button>
        {!collapsed && (
          <IconButton size="sm" label="Grouper la sélection" shortcut="Ctrl+G" disabled={selection.length < 2} onClick={groupSelection}>
            <GroupIcon size={14} />
          </IconButton>
        )}
      </div>
      {!collapsed && (
        <>
          <div className="relative px-3.5 pb-2">
            <Search size={13} className="pointer-events-none absolute left-6 top-[9px] text-ink-faint" />
            <input className={cx(inputCls, 'py-1 pl-7 text-xs')} placeholder="Filtrer les objets…" aria-label="Filtrer les objets de la scène" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && (
              <button type="button" aria-label="Effacer" className="absolute right-6 top-[7px] text-ink-faint" onClick={() => setQuery('')}>
                <X size={13} />
              </button>
            )}
          </div>
          <ul
            ref={listRef}
            role="tree"
            aria-label="Objets de la scène"
            aria-multiselectable
            className="min-h-0 flex-1 overflow-y-auto px-2 pb-2"
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              if (e.target === e.currentTarget) setHint({ id: null, where: 'before' });
            }}
            onDrop={onDrop}
          >
            {rows.length === 0 && (
              <li className="px-2 py-4 text-center text-xs text-ink-faint">{q ? 'Aucun objet ne correspond.' : 'Aucun objet dans cette scène.'}</li>
            )}
            {rows.map(({ obj, depth }) => {
              const selected = selection.includes(obj.id);
              const isGroup = obj.kind === 'group';
              const open = expanded.has(obj.id);
              return (
                <li
                  key={obj.id}
                  data-id={obj.id}
                  role="treeitem"
                  aria-selected={selected}
                  aria-expanded={isGroup ? open : undefined}
                  tabIndex={0}
                  draggable={!q && renaming !== obj.id}
                  onDragStart={(e) => {
                    setDragId(obj.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', obj.id);
                  }}
                  onDragEnd={() => (setDragId(null), setHint(null))}
                  onDragOver={(e) => {
                    if (!dragId || dragId === obj.id) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const r = e.currentTarget.getBoundingClientRect();
                    const y = (e.clientY - r.top) / r.height;
                    setHint({ id: obj.id, where: isGroup && y > 0.3 ? 'inside' : 'before' });
                  }}
                  onClick={(e) => onRowClick(e, obj.id)}
                  onDoubleClick={() => setRenaming(obj.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!selection.includes(obj.id)) useEditor.getState().select([obj.id]);
                    setCtx({ x: e.clientX, y: e.clientY });
                  }}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') (e.preventDefault(), onRowClick(e as unknown as React.MouseEvent, obj.id));
                    if (e.key === 'F2') setRenaming(obj.id);
                    if (e.key === 'ArrowRight' && isGroup) setExpanded((s) => new Set(s).add(obj.id));
                    if (e.key === 'ArrowLeft' && isGroup) setExpanded((s) => (s.delete(obj.id), new Set(s)));
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      const sib = e.key === 'ArrowDown' ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling;
                      (sib as HTMLElement | null)?.focus();
                    }
                  }}
                  className={cx(
                    'group relative flex cursor-pointer items-center gap-1 rounded-lg py-1 pr-1 text-sm outline-none focus-visible:ring-1 focus-visible:ring-cyan',
                    selected ? 'bg-cyan/15 text-ink' : 'text-ink-muted hover:bg-navy-700/70 hover:text-ink',
                    !obj.visible && 'opacity-50',
                    hint?.id === obj.id && hint.where === 'inside' && 'ring-1 ring-violet',
                  )}
                  style={{ paddingLeft: 6 + depth * 14 }}
                >
                  {hint?.id === obj.id && hint.where === 'before' && <span className="absolute inset-x-1 -top-px h-0.5 rounded bg-cyan" />}
                  {isGroup ? (
                    <button
                      type="button"
                      aria-label={open ? 'Replier' : 'Déplier'}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpanded((s) => {
                          const n = new Set(s);
                          open ? n.delete(obj.id) : n.add(obj.id);
                          return n;
                        });
                      }}
                      className="rounded p-0.5 hover:bg-navy-600"
                    >
                      {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  ) : (
                    <span className="w-[17px]" />
                  )}
                  {isGroup ? <GroupIcon size={14} className="shrink-0 text-violet-400" /> : <Box size={14} className="shrink-0 text-cyan/80" />}
                  {renaming === obj.id ? (
                    <RenameField
                      value={obj.name}
                      onDone={(v) => {
                        setRenaming(null);
                        if (v && v !== obj.name) useEditor.getState().patchObjects([obj.id], () => ({ name: v }), 'Renommer');
                      }}
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate">{obj.name}</span>
                  )}
                  {obj.studioOnly && <span className="rounded bg-navy-600 px-1 text-[9px] text-ink-faint" title="Visible dans Studio uniquement">Studio</span>}
                  <button
                    type="button"
                    aria-label={obj.visible ? `Masquer ${obj.name}` : `Afficher ${obj.name}`}
                    title={obj.visible ? 'Masquer' : 'Afficher'}
                    onClick={(e) => (e.stopPropagation(), toggleVisibility([obj.id]))}
                    className={cx('rounded p-1 hover:bg-navy-600 hover:text-ink', obj.visible && 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100')}
                  >
                    {obj.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button
                    type="button"
                    aria-label={obj.locked ? `Déverrouiller ${obj.name}` : `Verrouiller ${obj.name}`}
                    title={obj.locked ? 'Déverrouiller' : 'Verrouiller'}
                    onClick={(e) => (e.stopPropagation(), toggleLock([obj.id]))}
                    className={cx('rounded p-1 hover:bg-navy-600 hover:text-ink', obj.locked ? 'text-amber-400' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100')}
                  >
                    {obj.locked ? <Lock size={13} /> : <LockOpen size={13} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {ctx && (
        <div className="fixed z-50" style={{ left: ctx.x, top: ctx.y }}>
          <Menu open onClose={() => setCtx(null)} align="left" className="!top-0 !mt-0">
            <MenuItem
              icon={<Pencil size={14} />}
              hint="F2"
              disabled={selection.length !== 1}
              onClick={() => {
                setRenaming(selection[0]);
                setCtx(null);
              }}
            >
              Renommer
            </MenuItem>
            <ObjectMenuItems
              close={() => setCtx(null)}
              multi={selection.length > 1}
              isGroup={selection.length === 1 && sceneObjects.find((o) => o.id === selection[0])?.kind === 'group'}
            />
            <MenuSeparator />
            <MenuItem icon={<Trash2 size={14} />} danger hint="Suppr" onClick={() => (setCtx(null), void deleteSelection())}>
              Supprimer
            </MenuItem>
          </Menu>
        </div>
      )}
    </Panel>
  );
}

function RenameField({ value, onDone }: { value: string; onDone: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <input
      autoFocus
      aria-label="Nouveau nom"
      className="min-w-0 flex-1 rounded border border-cyan bg-navy-900 px-1 py-0 text-sm text-ink focus:outline-none"
      value={v}
      maxLength={80}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onDone(v.trim())}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') onDone(v.trim());
        if (e.key === 'Escape') onDone(value);
      }}
    />
  );
}
