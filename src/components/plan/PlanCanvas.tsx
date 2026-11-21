// 2D plan: image from the media library + scenes, navigation links, zones, hotspot pins and labels
// (normalized coords). Shared by the Studio (editing) and the visitor viewer (read-only).
import { Loader2, Map as MapIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { hotspotMeta } from '../../store/tourActions';
import type { FloorPlan, Hotspot, NavLink, PlanPoint, Scene } from '../../types';
import { HotspotIcon, useMediaUrl } from '../viewport/TourLayers';
import { cx } from '../common/ui';

export type PlanCanvasProps = {
  plan: FloorPlan;
  scenes: Scene[];
  navigation: NavLink[];
  /** Hotspots of the project, for the pins (pins of missing hotspots are not drawn). */
  hotspots?: Hotspot[];
  activeSceneId?: string;
  selectedSceneId?: string;
  selectedTextId?: string;
  selectedPinId?: string;
  selectedZoneId?: string;
  /** Short codes shown under scene names (Studio: S01, S02…). */
  codes?: Map<string, string>;
  zoom?: number;
  interactive?: boolean;
  cursor?: string;
  /** Click on the plan surface (normalized point). */
  onPlanClick?: (p: PlanPoint) => void;
  onSceneClick?: (sceneId: string) => void;
  onTextClick?: (id: string) => void;
  onPinClick?: (pinId: string, hotspotId: string) => void;
  onZoneClick?: (id: string) => void;
  /** Dragging a marker / text / pin ends at a new normalized point. */
  onSceneMove?: (sceneId: string, p: PlanPoint) => void;
  onTextMove?: (id: string, p: PlanPoint) => void;
  onPinMove?: (id: string, p: PlanPoint) => void;
  onDropScene?: (sceneId: string, p: PlanPoint) => void;
  overlay?: (aspect: number) => ReactNode;
  onAspect?: (aspect: number) => void;
};

type DragKind = 'scene' | 'text' | 'pin';

/** Image height / width once loaded (plan units: x in [0,1], y in [0,1] of the image). */
export function PlanCanvas(props: PlanCanvasProps) {
  const { plan, scenes, navigation, activeSceneId, selectedSceneId, selectedTextId, selectedPinId, selectedZoneId, codes, zoom = 1, interactive, onAspect } = props;
  const { url, error } = useMediaUrl(plan.imageFileId);
  const [aspect, setAspect] = useState(0.6);
  const [loaded, setLoaded] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: DragKind; id: string } | null>(null);
  const moved = useRef(false);
  const [dragPos, setDragPos] = useState<{ id: string; p: PlanPoint } | null>(null);

  useEffect(() => setLoaded(false), [url]);

  const toPoint = (e: { clientX: number; clientY: number }): PlanPoint => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const startDrag = (e: React.PointerEvent, kind: DragKind, id: string) => {
    if (!interactive) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { kind, id };
  };

  const W = 1000;
  const H = 1000 * aspect;
  const placed = new Map(plan.markers.map((m) => [m.sceneId, dragPos?.id === m.sceneId ? { ...m, ...dragPos.p } : m]));
  const links = navigation.filter((n) => placed.has(n.sceneId) && placed.has(n.targetSceneId) && (!n.pairId || n.sceneId < n.targetSceneId));
  const pins = (plan.hotspotPins ?? []).map((p) => ({ pin: dragPos?.id === p.id ? { ...p, ...dragPos.p } : p, h: props.hotspots?.find((h) => h.id === p.hotspotId) })).filter((x): x is { pin: typeof x.pin; h: Hotspot } => !!x.h);

  if (!plan.imageFileId)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-ink-muted">
        <MapIcon size={28} className="text-ink-faint" />
        Ce plan n’a pas encore d’image. Choisissez une image (plan, export, scan) dans ses propriétés.
      </div>
    );
  if (error) return <p className="p-6 text-sm text-red-300">Image du plan indisponible : {error}</p>;

  return (
    <div
      ref={wrap}
      className={cx('relative mx-auto select-none', props.cursor)}
      style={{ width: `${zoom * 100}%`, aspectRatio: `${1 / aspect}` }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        moved.current = true;
        setDragPos({ id: drag.current.id, p: toPoint(e) });
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        // A plain click selects; only an actual drag moves (and creates an undo step).
        if (!d || !moved.current) return;
        moved.current = false;
        const p = toPoint(e);
        setDragPos(null);
        if (d.kind === 'scene') props.onSceneMove?.(d.id, p);
        else if (d.kind === 'pin') props.onPinMove?.(d.id, p);
        else props.onTextMove?.(d.id, p);
      }}
      onClick={(e) => {
        if ((e.target as Element).closest('[data-plan-item]')) return;
        props.onPlanClick?.(toPoint(e));
      }}
      onDragOver={(e) => props.onDropScene && e.dataTransfer.types.includes('application/x-visora-scene') && e.preventDefault()}
      onDrop={(e) => {
        const id = e.dataTransfer.getData('application/x-visora-scene');
        if (id) {
          e.preventDefault();
          props.onDropScene?.(id, toPoint(e));
        }
      }}
    >
      {url && (
        <img
          src={url}
          alt={`Plan ${plan.name}`}
          draggable={false}
          className="absolute inset-0 h-full w-full rounded-lg object-fill"
          onLoad={(e) => {
            const a = e.currentTarget.naturalHeight / e.currentTarget.naturalWidth;
            if (a > 0) {
              setAspect(a);
              onAspect?.(a);
            }
            setLoaded(true);
          }}
        />
      )}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center" role="status">
          <Loader2 className="animate-spin text-cyan" />
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-label={`Scènes placées sur ${plan.name}`}>
        <defs>
          <marker id="plan-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,1 L9,5 L0,9 z" fill="#7868F5" />
          </marker>
          <filter id="plan-glow" filterUnits="userSpaceOnUse" x={-50} y={-50} width={W + 100} height={H + 100}>
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {(plan.zones ?? []).map((z) => (
          <g
            key={z.id}
            data-plan-item={props.onZoneClick ? true : undefined}
            className={props.onZoneClick ? 'cursor-pointer' : undefined}
            pointerEvents={props.onZoneClick ? undefined : 'none'}
            onClick={(e) => {
              if (!props.onZoneClick) return;
              e.stopPropagation();
              props.onZoneClick(z.id);
            }}
          >
            <rect x={z.x * W} y={z.y * H} width={z.w * W} height={z.h * H} rx={8} fill={z.color} fillOpacity={0.18} stroke={z.color} strokeWidth={selectedZoneId === z.id ? 5 : 3} strokeDasharray={selectedZoneId === z.id ? undefined : '10 6'} />
            <text x={(z.x + z.w / 2) * W} y={z.y * H + 26} textAnchor="middle" className="text-[20px] font-bold" fill={z.color} stroke="#ffffff" strokeWidth={5} paintOrder="stroke">
              {z.label}
            </text>
          </g>
        ))}
        {links.map((n) => {
          const a = placed.get(n.sceneId)!;
          const b = placed.get(n.targetSceneId)!;
          const mx = ((a.x + b.x) / 2) * W;
          const my = ((a.y + b.y) / 2) * H;
          return (
            <g key={n.id} pointerEvents="none">
              <line x1={a.x * W} y1={a.y * H} x2={b.x * W} y2={b.y * H} stroke="#7C3AED" strokeWidth={6} strokeLinecap="round" filter="url(#plan-glow)" />
              {!n.pairId && <path d={`M${mx},${my} l0.01,0`} markerEnd="url(#plan-arrow)" stroke="#7868F5" strokeWidth={8} transform={`rotate(${(Math.atan2((b.y - a.y) * H, (b.x - a.x) * W) * 180) / Math.PI} ${mx} ${my})`} />}
            </g>
          );
        })}
        {props.overlay?.(aspect)}
        {plan.texts.map((t) => {
          const p = dragPos?.id === t.id ? dragPos.p : t;
          return (
            <text
              key={t.id}
              data-plan-item
              x={p.x * W}
              y={p.y * H}
              textAnchor="middle"
              className={cx('fill-navy-950 text-[22px] font-bold', interactive && 'cursor-move')}
              stroke={selectedTextId === t.id ? '#36C8F4' : '#ffffff'}
              strokeWidth={selectedTextId === t.id ? 6 : 5}
              paintOrder="stroke"
              onPointerDown={(e) => {
                startDrag(e, 'text', t.id);
                props.onTextClick?.(t.id);
              }}
            >
              {t.text}
            </text>
          );
        })}
        {pins.map(({ pin, h }) => {
          const color = h.color || hotspotMeta(h.type).color;
          const selected = selectedPinId === pin.id;
          return (
            <g
              key={pin.id}
              data-plan-item
              transform={`translate(${pin.x * W},${pin.y * H})`}
              className="cursor-pointer"
              role="button"
              aria-label={`Hotspot ${h.title}`}
              onPointerDown={(e) => startDrag(e, 'pin', pin.id)}
              onClick={(e) => {
                e.stopPropagation();
                props.onPinClick?.(pin.id, h.id);
              }}
            >
              <circle r={22} fill={color} stroke={selected ? '#ffffff' : '#ffffffcc'} strokeWidth={selected ? 6 : 4} filter="url(#plan-glow)" />
              <g transform="translate(-12,-12)" color="#ffffff">
                <HotspotIcon type={h.type} icon={h.icon} size={24} />
              </g>
              <title>{h.title}</title>
            </g>
          );
        })}
        {[...placed.entries()].map(([sceneId, m]) => {
          const scene = scenes.find((s) => s.id === sceneId);
          if (!scene) return null;
          const active = sceneId === activeSceneId;
          const selected = sceneId === selectedSceneId;
          const color = m.color || '#7C3AED';
          const code = codes?.get(sceneId);
          return (
            <g
              key={sceneId}
              data-plan-item
              transform={`translate(${m.x * W},${m.y * H})`}
              className="cursor-pointer"
              opacity={m.hidden ? 0.4 : 1}
              role="button"
              aria-label={`Scène ${scene.name}${m.hidden ? ' (masquée aux visiteurs)' : ''}`}
              onPointerDown={(e) => startDrag(e, 'scene', sceneId)}
              onClick={(e) => {
                e.stopPropagation();
                props.onSceneClick?.(sceneId);
              }}
            >
              {active && <circle r={30} fill="#22C55E" opacity={0.35} className="animate-pulse" />}
              <circle r={15} fill="#ffffff" stroke={active ? '#22C55E' : color} strokeWidth={selected ? 9 : 7} filter={selected || active ? 'url(#plan-glow)' : undefined} />
              {selected && <circle r={24} fill="none" stroke="#3B82F6" strokeWidth={3} />}
              <text y={code ? -40 : -26} textAnchor="middle" className="fill-navy-950 text-[19px] font-semibold" stroke="#ffffff" strokeWidth={5} paintOrder="stroke">
                {scene.name.length > 22 ? `${scene.name.slice(0, 21)}…` : scene.name}
              </text>
              {code && (
                <text y={-20} textAnchor="middle" className="fill-navy-950 text-[17px] font-bold" stroke="#ffffff" strokeWidth={5} paintOrder="stroke">
                  {code}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
