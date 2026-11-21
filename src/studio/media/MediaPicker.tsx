import { Loader2, Upload as UploadIcon, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatBytes } from '../../lib/format';
import { useEditor } from '../../store/editor';
import { Modal } from '../../components/common/Overlays';
import { Button, cx } from '../../components/common/ui';
import { MediaThumb } from './MediaModule';
import { ACCEPT_MEDIA, KIND_LABEL, useMedia, type Media, type MediaKind } from './mediaStore';

/** Field showing the chosen media with "Choisir…" / "Retirer" actions. */
export function MediaField({ value, kinds, onChange, label }: { value?: string; kinds: MediaKind[]; onChange: (id: string | undefined) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const items = useMedia((s) => s.items);
  useEffect(() => {
    void useMedia.getState().load();
  }, []);
  const current = items.find((m) => m.id === value);
  return (
    <div>
      <div className="flex items-center gap-2 rounded-lg border border-navy-500 bg-navy-900/60 p-1.5">
        {current ? <MediaThumb media={current} className="h-11 w-16 shrink-0 rounded-md" /> : <div className="flex h-11 w-16 shrink-0 items-center justify-center rounded-md bg-navy-700 text-[10px] text-ink-faint">Aucun</div>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-ink">{current?.name ?? (value ? 'Média introuvable (supprimé ?)' : `Aucun ${label.toLowerCase()}`)}</p>
          {current && <p className="text-[10px] text-ink-faint">{formatBytes(current.size)}</p>}
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Choisir…
        </Button>
        {value && (
          <button type="button" aria-label="Retirer le média" onClick={() => onChange(undefined)} className="rounded p-1 text-ink-faint hover:text-red-400">
            <X size={14} />
          </button>
        )}
      </div>
      {open && <MediaPicker kinds={kinds} title={`Choisir : ${label}`} onClose={() => setOpen(false)} onPick={(m) => (onChange(m.id), setOpen(false))} />}
    </div>
  );
}

export function MediaPicker({ kinds, title, onPick, onClose }: { kinds: MediaKind[]; title: string; onPick: (m: Media) => void; onClose: () => void }) {
  const { items, status, uploads } = useMedia();
  const input = useRef<HTMLInputElement>(null);
  const list = items.filter((m) => kinds.includes(m.kind));
  const busy = uploads.some((u) => u.status === 'uploading');
  return (
    <Modal
      title={title}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          <span className="mr-auto self-center text-xs text-ink-faint">Types acceptés : {kinds.map((k) => KIND_LABEL[k]).join(', ')}</span>
          <Button onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <UploadIcon size={14} />} Importer un fichier
          </Button>
        </>
      }
    >
      <input
        ref={input}
        type="file"
        accept={ACCEPT_MEDIA}
        className="hidden"
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          const done = await useMedia.getState().upload(files);
          const ok = done.find((m) => kinds.includes(m.kind));
          if (ok) onPick(ok);
          // Uploaded but of another kind: it stays in the library, the user is told why it was not selected.
          else if (done.length) useEditor.getState().toast({ kind: 'warning', text: `Fichier importé dans la bibliothèque, mais ce n’est pas : ${kinds.map((k) => KIND_LABEL[k]).join(' / ')}.` });
        }}
      />
      {status !== 'ready' ? (
        <p className="flex items-center gap-2 text-sm text-ink-muted" role="status">
          <Loader2 size={15} className="animate-spin" /> Chargement…
        </p>
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">Aucun média de ce type dans la bibliothèque. Importez-en un.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {list.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m)} className={cx('block w-full overflow-hidden rounded-xl border border-navy-500/60 text-left hover:border-cyan focus-ring')}>
                <MediaThumb media={m} className="aspect-[4/3] w-full" />
                <span className="block truncate px-2 py-1.5 text-xs text-ink">{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
