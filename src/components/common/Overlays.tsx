import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useEditor } from '../../store/editor';
import { Button, cx } from './ui';

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 'max-w-lg',
  labelledBy = 'modal-title',
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-950/70 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={cx('flex max-h-[90vh] w-full flex-col rounded-2xl border border-navy-500 bg-navy-800 shadow-panel', width)}>
        <div className="flex items-center justify-between border-b border-navy-500/60 px-5 py-3.5">
          <h2 id={labelledBy} className="text-base font-semibold text-ink">
            {title}
          </h2>
          <button data-close type="button" aria-label="Fermer" onClick={onClose} className="rounded-md p-1 text-ink-muted hover:bg-navy-600 hover:text-ink focus-ring">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-navy-500/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog() {
  const req = useEditor((s) => s.confirmRequest);
  if (!req) return null;
  return (
    <Modal
      title={req.title}
      onClose={() => req.resolve(false)}
      width="max-w-md"
      labelledBy="confirm-title"
      footer={
        <>
          <Button variant="ghost" onClick={() => req.resolve(false)}>
            Annuler
          </Button>
          <Button variant={req.danger ? 'danger' : 'primary'} onClick={() => req.resolve(true)}>
            {req.confirmLabel ?? 'Confirmer'}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-muted">{req.message}</p>
    </Modal>
  );
}

export function ConflictDialog() {
  const conflict = useEditor((s) => s.conflict);
  const status = useEditor((s) => s.saveStatus);
  const resolve = useEditor((s) => s.resolveConflict);
  if (!conflict || status !== 'conflict') return null;
  return (
    <Modal
      title="Conflit de sauvegarde"
      onClose={() => useEditor.setState({ saveStatus: 'error' })}
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={() => resolve('reload')}>
            Recharger la version enregistrée
          </Button>
          <Button variant="danger" onClick={() => resolve('overwrite')}>
            Écraser avec mes modifications
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-amber-400" size={20} />
        <p className="text-sm leading-relaxed text-ink-muted">
          Ce projet a été enregistré depuis un autre onglet ou une autre session (révision {conflict.revision}, {new Date(conflict.updatedAt).toLocaleString('fr-FR')}).
          Recharger fera perdre vos modifications non enregistrées ; écraser remplacera la version enregistrée par la vôtre.
        </p>
      </div>
    </Modal>
  );
}

export function Toasts() {
  const toasts = useEditor((s) => s.toasts);
  const dismiss = useEditor((s) => s.dismissToast);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-20 right-4 z-[70] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : t.kind === 'warning' ? AlertTriangle : Info;
        const color = t.kind === 'success' ? 'text-emerald-400' : t.kind === 'error' ? 'text-red-400' : t.kind === 'warning' ? 'text-amber-400' : 'text-cyan';
        return (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-navy-500 bg-navy-800/95 p-3 shadow-panel backdrop-blur">
            <Icon size={18} className={cx('mt-0.5 shrink-0', color)} />
            <div className="min-w-0 flex-1 text-sm text-ink">
              {t.text}
              {t.actionLabel && (
                <button
                  type="button"
                  className="mt-1 block text-xs font-semibold text-cyan hover:underline"
                  onClick={() => {
                    t.onAction?.();
                    dismiss(t.id);
                  }}
                >
                  {t.actionLabel}
                </button>
              )}
            </div>
            <button type="button" aria-label="Fermer la notification" onClick={() => dismiss(t.id)} className="text-ink-faint hover:text-ink">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Small popover menu anchored to its trigger; closes on outside click / Escape. */
export function Menu({ open, onClose, children, align = 'right', className }: { open: boolean; onClose: () => void; children: ReactNode; align?: 'left' | 'right'; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    setTimeout(() => document.addEventListener('mousedown', onDown));
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      role="menu"
      className={cx(
        'absolute top-full z-50 mt-1 min-w-[200px] rounded-xl border border-navy-500 bg-navy-800 p-1 shadow-panel',
        align === 'right' ? 'right-0' : 'left-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  danger,
  disabled,
  icon,
  hint,
}: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={disabled ? hint : undefined}
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        danger ? 'text-red-300 hover:bg-red-500/10' : 'text-ink hover:bg-navy-600',
      )}
    >
      {icon && <span className="text-ink-muted">{icon}</span>}
      <span className="flex-1">{children}</span>
      {hint && !disabled && <span className="text-[11px] text-ink-faint">{hint}</span>}
    </button>
  );
}

export const MenuSeparator = () => <div className="my-1 h-px bg-navy-500/60" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => (
  <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{children}</div>
);
