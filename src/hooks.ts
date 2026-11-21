import { useEffect, useState } from 'react';
import { loadProject, onRemoteSave } from './services/persistence';
import { useEditor } from './store/editor';
import {
  deleteSelection,
  duplicateSelection,
  focusSelection,
  groupSelection,
  toggleLock,
  toggleVisibility,
  ungroupSelection,
} from './store/objectActions';

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el?.closest?.('input, textarea, select, [contenteditable="true"]');
};

export function useKeyboardShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const st = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      // Save works everywhere, including in fields.
      if (mod && k === 's') {
        e.preventDefault();
        void st.save();
        return;
      }
      if (isTyping(e.target) || st.confirmRequest) return;
      if (mod && k === 'z' && !e.shiftKey) return e.preventDefault(), st.undo();
      if ((mod && k === 'y') || (mod && e.shiftKey && k === 'z')) return e.preventDefault(), st.redo();
      if (st.viewMode === 'visitor') {
        if (k === 'escape') st.setViewMode('3d');
        return;
      }
      if (mod && k === 'd') return e.preventDefault(), duplicateSelection();
      if (mod && k === 'g' && e.shiftKey) return e.preventDefault(), ungroupSelection();
      if (mod && k === 'g') return e.preventDefault(), groupSelection();
      if (mod && k === 'a') {
        e.preventDefault();
        const ids = st.project?.objects.filter((o) => o.sceneId === st.activeSceneId && !o.parentId).map((o) => o.id) ?? [];
        return st.select(ids);
      }
      if (mod) return;
      // First-person modes use ZQSD/WASD for walking.
      const walking = st.viewMode === 'immersive';
      switch (k) {
        case 'delete':
        case 'backspace':
          e.preventDefault();
          void deleteSelection();
          break;
        case 'escape':
          if (st.placement) st.setPlacement(null);
          else if (st.focus) st.setFocus(null);
          else st.clearSelection();
          break;
        case 'w':
          if (!walking) st.setTool('translate');
          break;
        case 'e':
          if (!walking) st.setTool('rotate');
          break;
        case 'r':
          if (!walking) st.setTool('scale');
          break;
        case 'f':
          focusSelection();
          break;
        case 'h':
          toggleVisibility();
          break;
        case 'l':
          toggleLock();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

export function useAutosave() {
  const seconds = useEditor((s) => s.project?.settings.autosaveSeconds ?? 0);
  const dirty = useEditor((s) => s.dirty);
  useEffect(() => {
    if (!seconds || !dirty) return;
    const t = setTimeout(() => {
      const st = useEditor.getState();
      if (st.dirty && st.saveStatus !== 'saving' && st.saveStatus !== 'conflict') void st.save({ silent: true });
    }, seconds * 1000);
    return () => clearTimeout(t);
  }, [seconds, dirty]);
}

export function useUnsavedGuard() {
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (!useEditor.getState().dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, []);
}

/** Warns when another tab saved the same project (the next save will report a conflict). */
export function useRemoteSaveNotice() {
  useEffect(
    () =>
      onRemoteSave((projectId, revision) => {
        const st = useEditor.getState();
        if (st.project?.id !== projectId || revision <= st.baseRevision) return;
        st.toast({
          kind: 'warning',
          text: 'Ce projet vient d’être enregistré depuis un autre onglet.',
          actionLabel: st.dirty ? undefined : 'Recharger',
          onAction: () => void loadProject(projectId).then((p) => p && st.init(p)),
        });
      }),
    [],
  );
}

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}
