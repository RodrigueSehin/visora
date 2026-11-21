import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  shortcut?: string;
  active?: boolean;
  tone?: 'default' | 'danger' | 'primary' | 'ai';
  size?: 'sm' | 'md';
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
};

/** Icon-only button with an accessible label and a tooltip (label + shortcut). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, shortcut, active, tone = 'default', size = 'md', tooltipSide = 'bottom', className, children, ...rest },
  ref,
) {
  return (
    <span className="group relative inline-flex">
      <button
        ref={ref}
        type="button"
        aria-label={shortcut ? `${label} (${shortcut})` : label}
        aria-pressed={active}
        className={cx(
          'inline-flex items-center justify-center rounded-lg border transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-40',
          size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
          active
            ? 'border-cyan/60 bg-cyan/15 text-cyan'
            : tone === 'danger'
              ? 'border-transparent text-ink-muted hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400'
              : tone === 'primary'
                ? 'border-cyan/50 bg-cyan text-navy-900 hover:bg-cyan-400'
                : tone === 'ai'
                  ? 'border-violet/50 bg-violet/15 text-violet-400 hover:bg-violet/25'
                  : 'border-transparent text-ink-muted hover:border-navy-500 hover:bg-navy-600/60 hover:text-ink',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
      <Tip side={tooltipSide}>
        {label}
        {shortcut && <kbd className="ml-1.5 rounded bg-navy-600 px-1 text-[10px] text-ink-muted">{shortcut}</kbd>}
      </Tip>
    </span>
  );
});

export function Tip({ children, side = 'bottom' }: { children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  const pos = {
    bottom: 'top-full mt-1.5 left-1/2 -translate-x-1/2',
    top: 'bottom-full mb-1.5 left-1/2 -translate-x-1/2',
    left: 'right-full mr-1.5 top-1/2 -translate-y-1/2',
    right: 'left-full ml-1.5 top-1/2 -translate-y-1/2',
  }[side];
  return (
    <span
      role="tooltip"
      className={cx(
        'pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-navy-500 bg-navy-950 px-2 py-1 text-xs text-ink opacity-0 shadow-panel transition-opacity delay-300 group-hover:opacity-100',
        pos,
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'ai'; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'border-cyan/60 bg-gradient-to-r from-cyan-600 to-cyan text-navy-950 hover:brightness-110',
        variant === 'secondary' && 'border-navy-500 bg-navy-700 text-ink hover:bg-navy-600',
        variant === 'danger' && 'border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20',
        variant === 'ghost' && 'border-transparent text-ink-muted hover:bg-navy-600/60 hover:text-ink',
        variant === 'ai' && 'border-violet/60 bg-violet/20 text-violet-400 hover:bg-violet/30',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, hint, required, group }: { label: string; children: ReactNode; hint?: string; required?: boolean; group?: boolean }) {
  // A <label> must wrap a single control: composite fields (several buttons) use a labelled group.
  if (group)
    return (
      <div role="group" aria-label={label} className="block">
        <span className="mb-1 block text-xs font-medium text-ink-muted">
          {label}
          {required && <span className="text-cyan"> *</span>}
        </span>
        {children}
        {hint && <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span>}
      </div>
    );
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">
        {label}
        {required && <span className="text-cyan"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-lg border border-navy-500 bg-navy-900/70 px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan disabled:opacity-50';

/** Text input that commits on blur / Enter (one undo step per edit, not per keystroke). */
export function CommitInput({
  value,
  onCommit,
  multiline,
  className,
  ...rest
}: {
  value: string;
  onCommit: (v: string) => void;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
  maxLength?: number;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => v !== value && onCommit(v);
  if (multiline)
    return (
      <textarea
        className={cx(inputCls, 'min-h-[64px] resize-y', className)}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        {...rest}
      />
    );
  return (
    <input
      className={cx(inputCls, className)}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setV(value);
          const el = e.target as HTMLInputElement;
          requestAnimationFrame(() => el.blur());
        }
      }}
      {...rest}
    />
  );
}

/** Numeric field with axis badge; commits on blur/Enter, arrow keys step (Shift = ×10). */
export function NumberField({
  value,
  onCommit,
  axis,
  step = 0.1,
  disabled,
  label,
  min,
  suffix,
}: {
  value: number;
  onCommit: (v: number) => void;
  axis?: 'X' | 'Y' | 'Z';
  step?: number;
  disabled?: boolean;
  label: string;
  min?: number;
  suffix?: string;
}) {
  const fmt = (n: number) => String(Math.round(n * 1000) / 1000);
  const [v, setV] = useState(fmt(value));
  useEffect(() => setV(fmt(value)), [value]);
  const commit = (raw: string) => {
    const n = parseFloat(raw.replace(',', '.'));
    if (!Number.isFinite(n)) return setV(fmt(value));
    const clamped = min != null ? Math.max(min, n) : n;
    if (clamped !== value) onCommit(clamped);
    else setV(fmt(value));
  };
  const color = axis === 'X' ? 'text-red-400' : axis === 'Y' ? 'text-green-400' : axis === 'Z' ? 'text-sky-400' : '';
  return (
    <div className={cx('flex items-center rounded-lg border border-navy-500 bg-navy-900/70 focus-within:border-cyan', disabled && 'opacity-50')}>
      {axis && <span className={cx('pl-2 text-[11px] font-semibold', color)}>{axis}</span>}
      <input
        aria-label={label}
        disabled={disabled}
        inputMode="decimal"
        className="w-full min-w-0 bg-transparent px-2 py-1.5 text-sm tabular-nums text-ink focus:outline-none"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit((e.target as HTMLInputElement).value);
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const d = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            commit(fmt((parseFloat(v.replace(',', '.')) || 0) + d));
          }
        }}
      />
      {suffix && <span className="pr-2 text-[11px] text-ink-faint">{suffix}</span>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className={cx('flex items-center justify-between gap-3 py-1', disabled && 'opacity-50')}>
      <span className="text-sm text-ink">
        {label}
        {hint && <span className="block text-[11px] text-ink-faint">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors focus-ring disabled:cursor-not-allowed', checked ? 'bg-cyan' : 'bg-navy-500')}
      >
        <span className={cx('absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (t: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 rounded-xl border border-navy-500/60 bg-navy-900/60 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          disabled={t.disabled}
          onClick={() => onChange(t.id)}
          className={cx(
            'flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium transition-colors focus-ring disabled:opacity-40',
            value === t.id ? 'bg-cyan text-navy-950' : 'text-ink-muted hover:bg-navy-600/60 hover:text-ink',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'cyan' | 'violet' | 'green' | 'amber' | 'red' }) {
  const cls = {
    default: 'bg-navy-600 text-ink-muted',
    cyan: 'bg-cyan/15 text-cyan',
    violet: 'bg-violet/20 text-violet-400',
    green: 'bg-emerald-500/15 text-emerald-400',
    amber: 'bg-amber-500/15 text-amber-300',
    red: 'bg-red-500/15 text-red-300',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium', cls)}>{children}</span>;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex min-h-0 flex-col rounded-2xl border border-navy-500/50 bg-navy-800/90 shadow-panel', className)}>{children}</div>;
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; disabled?: boolean }[];
  label: string;
  disabled?: boolean;
}) {
  return (
    <select aria-label={label} disabled={disabled} className={inputCls} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
