import { useMemo, useRef, useState } from 'react';
import { PROJECT_TYPES } from '../lib/defaultProject';
import type { DayPoint } from '../services/analytics';
import type { ProjectType } from '../types';

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

function niceMax(v: number) {
  if (v <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** Daily views: single series (title names it), area + 2px line, crosshair tooltip on hover. */
export function ViewsLineChart({ data, height = 210 }: { data: DayPoint[]; height?: number }) {
  const W = 520;
  const H = height;
  const pad = { l: 34, r: 14, t: 26, b: 26 };
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const max = niceMax(Math.max(1, ...data.map((d) => d.views)) * 1.05);
  const ticks = Array.from({ length: 6 }, (_, i) => (max / 5) * i);
  const x = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);

  const path = useMemo(() => {
    // Monotone-ish smoothing with cubic midpoints keeps the curve inside the data range.
    return data
      .map((d, i) => {
        if (i === 0) return `M${x(0)},${y(d.views)}`;
        const px = x(i - 1);
        const py = y(data[i - 1].views);
        const cx = (px + x(i)) / 2;
        return `C${cx},${py} ${cx},${y(d.views)} ${x(i)},${y(d.views)}`;
      })
      .join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, max, H]);

  const labelEvery = Math.ceil(data.length / 8);
  const last = data.length - 1;
  const onMove = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((sx - pad.l) / (W - pad.l - pad.r)) * last);
    setHover(Math.max(0, Math.min(last, i)));
  };
  const h = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`Vues par jour sur ${data.length} jours, total ${data.reduce((a, d) => a + d.views, 0)}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="viewsArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6D5DF5" stopOpacity="0.28" />
            <stop offset="1" stopColor="#6D5DF5" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#E8EDF5" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          (i % labelEvery === 0 && last - i >= labelEvery * 0.6) || i === last ? (
            <text key={d.date} x={x(i)} y={H - 6} textAnchor="middle" className="fill-slate-500 text-[11px]">
              {shortDate(d.date)}
            </text>
          ) : null,
        )}
        <path d={`${path} L${x(last)},${y(0)} L${x(0)},${y(0)} Z`} fill="url(#viewsArea)" />
        <path d={path} fill="none" stroke="#6D5DF5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {/* Selective markers: weekly points plus the last value. */}
        {data.map((d, i) =>
          (last - i) % 7 === 0 ? <circle key={d.date} cx={x(i)} cy={y(d.views)} r={4} fill="#6D5DF5" stroke="#fff" strokeWidth={2} /> : null,
        )}
        <g transform={`translate(${x(last)},${y(data[last]?.views ?? 0) - 14})`}>
          <rect x={-18} y={-18} width={36} height={20} rx={6} fill="#2563EB" />
          <text y={-4} textAnchor="middle" className="fill-white text-[11px] font-semibold">
            {data[last]?.views ?? 0}
          </text>
        </g>
        {h && (
          <g pointerEvents="none">
            <line x1={x(hover!)} x2={x(hover!)} y1={pad.t} y2={H - pad.b} stroke="#94A3B8" strokeDasharray="3 3" />
            <circle cx={x(hover!)} cy={y(h.views)} r={5} fill="#6D5DF5" stroke="#fff" strokeWidth={2} />
          </g>
        )}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${(x(hover!) / W) * 100}%` }}
        >
          <div className="text-slate-500">{shortDate(h.date)}</div>
          <div className="font-semibold text-slate-900">
            {h.views} vue{h.views > 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}

/** Part-to-whole by tour type: ring with 2px gaps, total in the centre, legend with %. */
export function TypeDonut({ data }: { data: { type: ProjectType; count: number }[] }) {
  const [hover, setHover] = useState<ProjectType | null>(null);
  const total = data.reduce((a, d) => a + d.count, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  const gap = total > 1 ? 2 : 0;
  let acc = 0;
  const segs = PROJECT_TYPES.map((t) => ({ ...t, count: data.find((d) => d.type === t.id)?.count ?? 0 })).filter((s) => s.count > 0);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90" role="img" aria-label={`Répartition de ${total} visites par type`}>
        <circle cx={70} cy={70} r={R} fill="none" stroke="#EEF2F7" strokeWidth={22} />
        {segs.map((s) => {
          const len = (s.count / total) * C;
          const el = (
            <circle
              key={s.id}
              cx={70}
              cy={70}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={hover === s.id ? 26 : 22}
              strokeDasharray={`${Math.max(0, len - gap)} ${C}`}
              strokeDashoffset={-acc}
              onPointerEnter={() => setHover(s.id)}
              onPointerLeave={() => setHover(null)}
              className="cursor-default transition-[stroke-width]"
            >
              <title>{`${s.label} : ${s.count} visite(s), ${Math.round((s.count / total) * 100)} %`}</title>
            </circle>
          );
          acc += len;
          return el;
        })}
        <g className="rotate-90" style={{ transformOrigin: '70px 70px' }}>
          <text x={70} y={70} textAnchor="middle" className="fill-slate-900 text-[26px] font-bold">
            {total}
          </text>
          <text x={70} y={88} textAnchor="middle" className="fill-slate-500 text-[11px]">
            visite{total > 1 ? 's' : ''}
          </text>
        </g>
      </svg>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {PROJECT_TYPES.map((t) => {
          const c = data.find((d) => d.type === t.id)?.count ?? 0;
          return (
            <li
              key={t.id}
              onPointerEnter={() => setHover(t.id)}
              onPointerLeave={() => setHover(null)}
              className={`flex items-center gap-2.5 rounded-md px-1.5 py-0.5 text-sm ${hover === t.id ? 'bg-slate-100' : ''}`}
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.color }} aria-hidden />
              <span className="flex-1 text-slate-700">{t.label}</span>
              <span className="tabular-nums font-medium text-slate-900">{total ? Math.round((c / total) * 100) : 0} %</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
