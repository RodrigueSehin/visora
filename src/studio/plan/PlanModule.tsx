import {
  Eye,
  EyeOff,
  Layers,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  Ruler,
  Scaling,
  Share2,
  Square,
  Target,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PlanCanvas } from '../../components/plan/PlanCanvas';
import { Badge, Button, CommitInput, Field, IconButton, NumberField, Panel, Select, cx, inputCls } from '../../components/common/ui';
import { HotspotIcon, useMediaUrl } from '../../components/viewport/TourLayers';
import { formatNumber } from '../../lib/format';
import { sceneIcon } from '../../lib/sceneIcons';
import { useEditor } from '../../store/editor';
import {
  addHotspotPin,
  addPlan,
  addPlanText,
  addZone,
  calibratePlan,
  measureMeters,
  placeSceneOnPlan,
  reassignMarker,
  removeHotspotPin,
  removePlan,
  removePlanText,
  removeSceneFromPlan,
  removeZone,
  updateHotspotPin,
  updateMarker,
  updatePlan,
  updatePlanText,
  updateZone,
} from '../../store/planActions';
import { addConnection, hotspotMeta, setBidirectional, updateNavLink, updateScene } from '../../store/tourActions';
import type { FloorPlan, PlanPoint, SceneTransition } from '../../types';
import { MediaField } from '../media/MediaPicker';
import { useMedia } from '../media/mediaStore';
import { SceneThumb, useSortedScenes } from '../tour/ScenesModule';

type Tool = 'select' | 'scene' | 'connect' | 'hotspot' | 'zone' | 'text' | 'measure' | 'plan' | 'calibrate';
type Sel = { kind: 'scene' | 'text' | 'pin' | 'zone'; id: string } | null;

const TOOLS: { id: Tool; label: string; icon: ReactNode; hint: string }[] = [
  { id: 'select', label: 'Sélectionner', icon: <MousePointer2 size={20} />, hint: 'Cliquez un élément ; glissez pour le déplacer. Glissez une scène depuis la liste pour la placer.' },
  { id: 'scene', label: 'Point de navigation', icon: <MapPin size={20} />, hint: 'Cliquez sur le plan, puis choisissez la scène à placer à cet endroit.' },
  { id: 'connect', label: 'Connexion', icon: <Share2 size={20} />, hint: 'Cliquez une scène de départ puis une scène d’arrivée : la connexion est créée dans les deux sens.' },
  { id: 'hotspot', label: 'Hotspot', icon: <Target size={20} />, hint: 'Cliquez sur le plan, puis choisissez le hotspot à épingler.' },
  { id: 'zone', label: 'Zone', icon: <Square size={20} />, hint: 'Cliquez deux coins opposés de la zone.' },
  { id: 'text', label: 'Texte', icon: <Type size={20} />, hint: 'Cliquez sur le plan pour ajouter un libellé.' },
  { id: 'measure', label: 'Mesure', icon: <Ruler size={20} />, hint: 'Cliquez deux points pour mesurer (plan calibré requis).' },
  { id: 'plan', label: 'Plan', icon: <Layers size={20} />, hint: 'Propriétés du plan : nom, image, échelle.' },
];

const MARKER_COLORS = ['#7C3AED', '#2563EB', '#0EA5B7', '#16A34A', '#F59E0B', '#DC2626', '#DB2777', '#475569'];

function PlanThumb({ plan, className }: { plan: FloorPlan; className?: string }) {
  const { url } = useMediaUrl(plan.imageFileId);
  return url ? <img src={url} alt="" className={cx('object-cover', className)} /> : <span className={cx('flex items-center justify-center bg-navy-700', className)}><MapIcon size={16} className="text-ink-faint" /></span>;
}

export function PlanModule() {
  const project = useEditor((s) => s.project);
  const activeSceneId = useEditor((s) => s.activeSceneId);
  const scenes = useSortedScenes();
  const plans = [...(project?.floorPlans ?? [])].sort((a, b) => a.order - b.order);
  const [planId, setPlanId] = useState<string | null>(() => plans.find((p) => p.markers.some((m) => m.sceneId === activeSceneId))?.id ?? plans[0]?.id ?? null);
  const plan = plans.find((p) => p.id === planId) ?? plans[0];
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [tool, setTool] = useState<Tool>('select');
  const [zoom, setZoom] = useState(1);
  const [sel, setSel] = useState<Sel>(null);
  const [points, setPoints] = useState<PlanPoint[]>([]);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ kind: 'scene' | 'hotspot'; at: PlanPoint } | null>(null);
  const [aspect, setAspect] = useState(0.6);
  const [meters, setMeters] = useState('');
  const [tourId, setTourId] = useState<string>('');
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void useMedia.getState().load();
  }, []);
  useEffect(() => {
    setPoints([]);
    setConnectFrom(null);
    setPicker(null);
    if (tool !== 'select' && tool !== 'plan') setSel(null);
    if (tool === 'plan') setSel(null);
  }, [planId, tool]);

  if (!project) return null;
  const codes = new Map(scenes.map((s, i) => [s.id, `S${String(i + 1).padStart(2, '0')}`]));
  const placedHere = plan ? plan.markers.map((m) => m.sceneId) : [];
  const placedAnywhere = new Set(plans.flatMap((p) => p.markers.map((m) => m.sceneId)));
  const unplaced = scenes.filter((s) => !placedAnywhere.has(s.id));
  const measured = plan && tool === 'measure' && points.length === 2 ? measureMeters(plan, points[0], points[1], aspect) : undefined;
  const tours = (project.guidedTours ?? []).filter((t) => t.steps.length);
  const tour = tours.find((t) => t.id === tourId) ?? tours[0];
  const editing = mode === 'edit';
  const hotspots = project.hotspots ?? [];

  const onPlanClick = (p: PlanPoint) => {
    if (!plan || !editing) return;
    if (tool === 'text') {
      const id = addPlanText(plan.id, p);
      setSel({ kind: 'text', id });
      setTool('select');
    } else if (tool === 'measure' || tool === 'calibrate') setPoints((cur) => (cur.length >= 2 ? [p] : [...cur, p]));
    else if (tool === 'zone') {
      if (points.length === 1) {
        const id = addZone(plan.id, points[0], p, `Zone ${(plan.zones?.length ?? 0) + 1}`);
        setPoints([]);
        if (id) {
          setSel({ kind: 'zone', id });
          setTool('select');
        }
      } else setPoints([p]);
    } else if (tool === 'scene' || tool === 'hotspot') setPicker({ kind: tool, at: p });
    else setSel(null);
  };
  const onSceneClick = (id: string) => {
    if (!editing) return useEditor.getState().setActiveScene(id);
    if (tool === 'connect') {
      if (!connectFrom) return setConnectFrom(id);
      if (connectFrom === id) return setConnectFrom(null);
      const exists = (project.navigation ?? []).some((n) => (n.sceneId === connectFrom && n.targetSceneId === id) || (n.sceneId === id && n.targetSceneId === connectFrom));
      if (exists) useEditor.getState().toast({ kind: 'info', text: 'Ces deux scènes sont déjà reliées.' });
      else addConnection(connectFrom, id, true);
      setConnectFrom(null);
      return;
    }
    if (tool === 'select' || tool === 'plan') {
      setTool('select');
      setSel({ kind: 'scene', id });
    }
  };
  const toggleFullscreen = () => (document.fullscreenElement ? void document.exitFullscreen() : void stage.current?.requestFullscreen?.());

  // Guided tour route drawn on the plan (steps whose scene is placed here), numbered in order.
  const tourOverlay = (asp: number) => {
    if (!plan || !tour) return null;
    const byScene = new Map(plan.markers.map((m) => [m.sceneId, m]));
    const pts = tour.steps.map((s) => byScene.get(s.sceneId)).filter((m): m is NonNullable<typeof m> => !!m);
    const W = 1000;
    const H = 1000 * asp;
    return (
      <g pointerEvents="none">
        {pts.length > 1 && <polyline points={pts.map((m) => `${m.x * W},${m.y * H}`).join(' ')} fill="none" stroke="#22C55E" strokeWidth={7} strokeLinejoin="round" strokeDasharray="2 14" strokeLinecap="round" />}
        {pts.map((m, i) => (
          <g key={i} transform={`translate(${m.x * W + 24},${m.y * H + 24})`}>
            <circle r={15} fill="#22C55E" stroke="#fff" strokeWidth={3} />
            <text y={6} textAnchor="middle" className="fill-white text-[17px] font-bold">
              {i + 1}
            </text>
          </g>
        ))}
      </g>
    );
  };
  const pointsOverlay = () =>
    points.map((p, i) => {
      const color = tool === 'calibrate' ? '#F59E0B' : tool === 'zone' ? '#7868F5' : '#22C55E';
      return (
        <g key={i} pointerEvents="none">
          <circle cx={p.x * 1000} cy={p.y * 1000 * aspect} r={9} fill={color} stroke="#fff" strokeWidth={3} />
          {i === 1 && <line x1={points[0].x * 1000} y1={points[0].y * 1000 * aspect} x2={p.x * 1000} y2={p.y * 1000 * aspect} stroke={color} strokeWidth={4} strokeDasharray="12 8" />}
        </g>
      );
    });

  return (
    <div className="flex h-full min-h-0 gap-3 pb-3">
      {/* Left: floors and scenes */}
      <Panel className="hidden w-[290px] shrink-0 lg:flex">
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <h2 className="text-lg font-semibold">Plan 2D du site</h2>
          <button
            type="button"
            onClick={() => setPlanId(addPlan() ?? null)}
            aria-label="Ajouter un plan (étage)"
            title="Ajouter un plan (étage)"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-glow hover:brightness-110 focus-ring"
          >
            <Plus size={20} />
          </button>
        </div>
        <ul className="space-y-1 px-2.5" aria-label="Plans">
          {plans.length === 0 && <li className="px-2 py-4 text-xs text-ink-faint">Aucun plan. Ajoutez un étage puis choisissez son image.</li>}
          {plans.map((p) => {
            const current = p.id === plan?.id;
            const hasActive = p.markers.some((m) => m.sceneId === activeSceneId);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setPlanId(p.id)}
                  aria-current={current}
                  className={cx('flex w-full items-center gap-2.5 rounded-xl border p-1.5 text-left', current ? 'border-blue-400/80 bg-gradient-to-r from-blue-600/90 to-violet/70 shadow-glow' : 'border-transparent hover:bg-navy-700/60')}
                >
                  <PlanThumb plan={p} className="h-11 w-16 shrink-0 rounded-md" />
                  <span className="min-w-0">
                    <span className={cx('block truncate text-sm font-medium', current ? 'text-white' : 'text-ink')}>{p.name}</span>
                    <span className={cx('block text-[11.5px]', current ? 'text-white/80' : 'text-ink-muted')}>
                      {p.markers.length} scène{p.markers.length > 1 ? 's' : ''}
                      {hasActive ? ' · Actif' : ''}
                      {p.calibration ? ' · calibré' : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {plan && (
          <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-navy-500/50">
            <h3 className="px-4 pb-1.5 pt-3 text-[15px] font-semibold">Scènes sur ce plan ({placedHere.length})</h3>
            <ul className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2" aria-label="Scènes sur ce plan">
              {scenes
                .filter((s) => placedHere.includes(s.id))
                .map((s) => {
                  const m = plan.markers.find((x) => x.sceneId === s.id)!;
                  const Icon = sceneIcon(s.icon);
                  const selected = sel?.kind === 'scene' && sel.id === s.id;
                  return (
                    <li key={s.id} className={cx('flex items-center gap-2 rounded-lg px-2 py-1', selected ? 'bg-blue-600/25' : 'hover:bg-navy-700/60')}>
                      <button type="button" onClick={() => (setTool('select'), setSel({ kind: 'scene', id: s.id }))} className={cx('flex min-w-0 flex-1 items-center gap-2 text-left text-[13px]', m.hidden && 'opacity-50')}>
                        <Icon size={15} className="shrink-0 text-ink-muted" />
                        <span className="w-8 shrink-0 font-semibold tabular-nums text-ink-muted">{codes.get(s.id)}</span>
                        <span className="truncate text-ink">{s.name}</span>
                      </button>
                      <IconButton size="sm" label={m.hidden ? `Afficher ${s.name} aux visiteurs` : `Masquer ${s.name} aux visiteurs`} onClick={() => updateMarker(plan.id, s.id, { hidden: !m.hidden }, m.hidden ? 'Afficher le point' : 'Masquer le point')}>
                        {m.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                      </IconButton>
                    </li>
                  );
                })}
              {placedHere.length === 0 && <li className="px-2 py-2 text-xs text-ink-faint">Aucune scène placée. Glissez une scène ci-dessous sur le plan.</li>}
            </ul>
            {unplaced.length > 0 && (
              <div className="max-h-[34%] overflow-y-auto border-t border-navy-500/50 px-2.5 pb-3">
                <h3 className="px-1.5 pb-1 pt-2.5 text-[13px] font-semibold text-ink-muted">À placer ({unplaced.length}) · glisser sur le plan</h3>
                <ul aria-label="Scènes à placer">
                  {unplaced.map((s) => (
                    <li
                      key={s.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/x-visora-scene', s.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      className="flex cursor-grab items-center gap-2 rounded-lg px-2 py-1 text-[13px] hover:bg-navy-700/60"
                    >
                      <SceneThumb scene={s} badge={false} className="h-6 w-9 shrink-0 rounded" />
                      <span className="w-8 shrink-0 font-semibold tabular-nums text-ink-muted">{codes.get(s.id)}</span>
                      <span className="truncate">{s.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* Centre: plan */}
      <div ref={stage} className="flex min-w-0 flex-1 flex-col gap-3 bg-navy-950">
        <Panel className="min-h-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
            <div className="flex rounded-full border border-navy-500/60 bg-navy-900/60 p-1" role="tablist" aria-label="Mode du plan">
              {(
                [
                  ['edit', 'Édition du plan'],
                  ['preview', 'Aperçu du parcours'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={mode === id}
                  onClick={() => setMode(id)}
                  className={cx('rounded-full px-4 py-1.5 text-sm font-medium', mode === id ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-glow' : 'text-ink hover:bg-white/5')}
                >
                  {label}
                </button>
              ))}
            </div>
            {!editing && tours.length > 0 && (
              <span className="w-52">
                <Select label="Parcours affiché" value={tour?.id ?? ''} onChange={setTourId} options={tours.map((t) => ({ value: t.id, label: t.name }))} />
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {plans.length > 0 && (
                <span className="w-44">
                  <Select label="Étage" value={plan?.id ?? ''} onChange={setPlanId} options={plans.map((p) => ({ value: p.id, label: p.name }))} />
                </span>
              )}
              <div className="flex items-center gap-1 rounded-xl border border-navy-500/60 p-0.5">
                <IconButton size="sm" label="Zoom arrière" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>
                  <Minus size={15} />
                </IconButton>
                <span className="w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)} %</span>
                <IconButton size="sm" label="Zoom avant" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}>
                  <Plus size={15} />
                </IconButton>
              </div>
              <IconButton label="Plein écran" onClick={toggleFullscreen}>
                <Maximize2 size={17} />
              </IconButton>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 overflow-auto bg-navy-950/60 p-4">
            {plan ? (
              <PlanCanvas
                plan={plan}
                scenes={scenes}
                navigation={project.navigation ?? []}
                hotspots={hotspots}
                codes={codes}
                activeSceneId={editing ? (tool === 'connect' ? connectFrom ?? undefined : activeSceneId) : activeSceneId}
                selectedSceneId={sel?.kind === 'scene' ? sel.id : undefined}
                selectedTextId={sel?.kind === 'text' ? sel.id : undefined}
                selectedPinId={sel?.kind === 'pin' ? sel.id : undefined}
                selectedZoneId={sel?.kind === 'zone' ? sel.id : undefined}
                zoom={zoom}
                interactive={editing && tool === 'select'}
                cursor={editing && tool !== 'select' && tool !== 'plan' ? 'cursor-crosshair' : 'cursor-default'}
                onAspect={setAspect}
                onPlanClick={onPlanClick}
                onSceneClick={onSceneClick}
                onTextClick={(id) => editing && setSel({ kind: 'text', id })}
                onPinClick={(id, hotspotId) => {
                  if (editing) return setSel({ kind: 'pin', id });
                  const h = hotspots.find((x) => x.id === hotspotId);
                  if (h) useEditor.getState().setActiveScene(h.sceneId);
                }}
                onZoneClick={editing && (tool === 'select' || tool === 'plan') ? (id) => (setTool('select'), setSel({ kind: 'zone', id })) : undefined}
                onSceneMove={(id, p) => placeSceneOnPlan(plan.id, id, p)}
                onTextMove={(id, p) => updatePlanText(plan.id, id, p, 'Déplacer le texte')}
                onPinMove={(id, p) => updateHotspotPin(plan.id, id, p)}
                onDropScene={
                  editing
                    ? (id, p) => {
                        placeSceneOnPlan(plan.id, id, p);
                        setTool('select');
                        setSel({ kind: 'scene', id });
                      }
                    : undefined
                }
                overlay={editing ? pointsOverlay : tourOverlay}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <MapIcon size={32} className="text-ink-faint" />
                <p className="text-sm text-ink">Aucun plan pour cette visite</p>
                <Button variant="primary" onClick={() => setPlanId(addPlan() ?? null)}>
                  <Plus size={15} /> Créer le plan du rez-de-chaussée
                </Button>
              </div>
            )}
            {picker && plan && (
              <div role="dialog" aria-label={picker.kind === 'scene' ? 'Choisir la scène à placer' : 'Choisir le hotspot à épingler'} className="absolute left-1/2 top-4 z-20 w-80 -translate-x-1/2 rounded-xl border border-navy-500 bg-navy-950/95 p-2 shadow-panel">
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-sm font-semibold">{picker.kind === 'scene' ? 'Placer quelle scène ici ?' : 'Épingler quel hotspot ?'}</span>
                  <IconButton size="sm" label="Annuler" onClick={() => setPicker(null)}>
                    <X size={14} />
                  </IconButton>
                </div>
                <ul className="max-h-64 overflow-y-auto">
                  {picker.kind === 'scene' &&
                    scenes.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            placeSceneOnPlan(plan.id, s.id, picker.at);
                            setPicker(null);
                            setTool('select');
                            setSel({ kind: 'scene', id: s.id });
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-navy-700"
                        >
                          <span className="w-8 font-semibold tabular-nums text-ink-muted">{codes.get(s.id)}</span>
                          <span className="flex-1 truncate">{s.name}</span>
                          {placedAnywhere.has(s.id) && <span className="text-[11px] text-ink-faint">déplacer</span>}
                        </button>
                      </li>
                    ))}
                  {picker.kind === 'hotspot' &&
                    (hotspots.length ? (
                      hotspots.map((h) => (
                        <li key={h.id}>
                          <button
                            type="button"
                            onClick={() => {
                              const id = addHotspotPin(plan.id, h.id, picker.at);
                              setPicker(null);
                              setTool('select');
                              setSel({ kind: 'pin', id });
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-navy-700"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white" style={{ background: h.color || hotspotMeta(h.type).color }}>
                              <HotspotIcon type={h.type} icon={h.icon} size={13} />
                            </span>
                            <span className="flex-1 truncate">{h.title}</span>
                            <span className="truncate text-[11px] text-ink-faint">{scenes.find((s) => s.id === h.sceneId)?.name}</span>
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="px-2 py-3 text-xs text-ink-muted">Aucun hotspot dans la visite. Créez-en dans le module Hotspots.</li>
                    ))}
                </ul>
              </div>
            )}
          </div>
          {editing && plan && (tool === 'measure' || tool === 'calibrate' || tool === 'zone' || tool === 'connect') && (
            <div className="flex flex-wrap items-center gap-3 border-t border-navy-500/50 px-3 py-2 text-sm" role="status">
              {tool === 'connect' ? (
                <span className="text-ink-muted">{connectFrom ? `Départ : ${scenes.find((s) => s.id === connectFrom)?.name}. Cliquez la scène d’arrivée.` : 'Cliquez la scène de départ sur le plan.'}</span>
              ) : tool === 'zone' ? (
                <span className="text-ink-muted">{points.length ? 'Cliquez le coin opposé de la zone.' : 'Cliquez un premier coin de la zone.'}</span>
              ) : points.length < 2 ? (
                <span className="text-ink-muted">Point {points.length + 1} sur 2 : cliquez sur le plan.</span>
              ) : tool === 'measure' ? (
                measured != null ? (
                  <span>
                    Distance : <b className="text-emerald-300">{formatNumber(measured)} m</b> <span className="text-xs text-ink-faint">(d’après la calibration de {formatNumber(plan.calibration!.meters)} m)</span>
                  </span>
                ) : (
                  <span className="text-amber-300">Plan non calibré : la distance réelle ne peut pas être calculée. Calibrez-le depuis l’outil « Plan ».</span>
                )
              ) : (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const m = parseFloat(meters.replace(',', '.'));
                    if (!(m > 0)) return;
                    calibratePlan(plan.id, points[0], points[1], m);
                    setPoints([]);
                    setMeters('');
                    setTool('measure');
                  }}
                >
                  <label htmlFor="cal-m">Distance réelle entre les deux points :</label>
                  <input id="cal-m" autoFocus inputMode="decimal" value={meters} onChange={(e) => setMeters(e.target.value)} className="w-24 rounded-lg border border-navy-500 bg-navy-900 px-2 py-1 text-sm" placeholder="ex. 12,5" />
                  <span>m</span>
                  <Button size="sm" variant="primary" type="submit" disabled={!(parseFloat(meters.replace(',', '.')) > 0)}>
                    Calibrer
                  </Button>
                </form>
              )}
            </div>
          )}
        </Panel>
        {editing && (
          <div className="flex shrink-0 items-stretch justify-center gap-1 overflow-x-auto rounded-2xl border border-navy-500/50 bg-navy-800/90 p-1.5" role="toolbar" aria-label="Outils du plan">
            {TOOLS.map((t) => {
              const needsImage = t.id !== 'plan' && t.id !== 'select';
              const on = tool === t.id || (t.id === 'plan' && tool === 'calibrate');
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  title={t.hint}
                  disabled={needsImage && !plan?.imageFileId}
                  onClick={() => setTool(t.id)}
                  className={cx(
                    'flex min-w-[80px] flex-1 flex-col items-center gap-1 rounded-xl px-1.5 py-2 text-[12px] font-medium disabled:opacity-40',
                    on ? 'bg-gradient-to-b from-blue-600 to-blue-500 text-white shadow-glow' : 'text-ink hover:bg-navy-600',
                  )}
                >
                  {t.icon}
                  <span className="whitespace-nowrap">{t.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: properties */}
      <Panel className="hidden w-[340px] shrink-0 xl:flex">
        {plan && sel?.kind === 'scene' ? (
          <PointInspector planId={plan.id} sceneId={sel.id} code={codes.get(sel.id) ?? ''} onClose={() => setSel(null)} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-4 pb-3 pt-4">
              <h2 className="text-lg font-semibold">{sel?.kind === 'text' ? 'Texte' : sel?.kind === 'pin' ? 'Hotspot épinglé' : sel?.kind === 'zone' ? 'Zone' : 'Propriétés du plan'}</h2>
              {sel && (
                <IconButton label="Désélectionner" onClick={() => setSel(null)}>
                  <X size={18} />
                </IconButton>
              )}
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
              {plan && sel?.kind === 'text' && (() => {
                const t = plan.texts.find((x) => x.id === sel.id);
                return (
                  t && (
                    <>
                      <Field label="Libellé">
                        <CommitInput value={t.text} maxLength={60} aria-label="Texte du libellé" onCommit={(v) => v.trim() && updatePlanText(plan.id, t.id, { text: v.trim() })} />
                      </Field>
                      <Button variant="danger" className="w-full" onClick={() => (removePlanText(plan.id, t.id), setSel(null))}>
                        <Trash2 size={14} /> Supprimer le texte
                      </Button>
                    </>
                  )
                );
              })()}
              {plan && sel?.kind === 'pin' && (() => {
                const pin = plan.hotspotPins?.find((x) => x.id === sel.id);
                const h = hotspots.find((x) => x.id === pin?.hotspotId);
                return (
                  pin && (
                    <>
                      <Field label="Hotspot">
                        <Select label="Hotspot épinglé" value={pin.hotspotId} onChange={(hotspotId) => updateHotspotPin(plan.id, pin.id, { hotspotId }, 'Changer le hotspot épinglé')} options={hotspots.map((x) => ({ value: x.id, label: `${x.title} (${scenes.find((s) => s.id === x.sceneId)?.name ?? '?'})` }))} />
                      </Field>
                      {h && <p className="text-xs text-ink-muted">Au clic, le visiteur rejoint la scène « {scenes.find((s) => s.id === h.sceneId)?.name} » et le hotspot s’ouvre.</p>}
                      {h && (
                        <Button className="w-full" onClick={() => {
                          const st = useEditor.getState();
                          st.setActiveScene(h.sceneId);
                          st.setModule('hotspots');
                          st.setFocus({ kind: 'hotspot', id: h.id });
                        }}>
                          <Target size={14} /> Modifier le hotspot
                        </Button>
                      )}
                      <Button variant="danger" className="w-full" onClick={() => (removeHotspotPin(plan.id, pin.id), setSel(null))}>
                        <Trash2 size={14} /> Retirer l’épingle
                      </Button>
                    </>
                  )
                );
              })()}
              {plan && sel?.kind === 'zone' && (() => {
                const z = plan.zones?.find((x) => x.id === sel.id);
                return (
                  z && (
                    <>
                      <Field label="Nom de la zone">
                        <CommitInput value={z.label} maxLength={40} aria-label="Nom de la zone" onCommit={(v) => updateZone(plan.id, z.id, { label: v.trim() || 'Zone' }, 'Renommer la zone')} />
                      </Field>
                      <Field group label="Couleur">
                        <Swatches value={z.color} onChange={(color) => updateZone(plan.id, z.id, { color }, 'Couleur de la zone')} />
                      </Field>
                      <Button variant="danger" className="w-full" onClick={() => (removeZone(plan.id, z.id), setSel(null))}>
                        <Trash2 size={14} /> Supprimer la zone
                      </Button>
                    </>
                  )
                );
              })()}
              {plan && !sel && (
                <>
                  <Field label="Nom">
                    <CommitInput value={plan.name} maxLength={80} aria-label="Nom du plan" onCommit={(v) => v.trim() && updatePlan(plan.id, { name: v.trim() }, 'Renommer le plan')} />
                  </Field>
                  <Field group label="Image du plan" hint="Plan d’architecte, export DAO ou scan (PNG, JPEG, WebP).">
                    <MediaField label="Image" kinds={['image', 'texture']} value={plan.imageFileId} onChange={(imageFileId) => updatePlan(plan.id, { imageFileId }, 'Changer l’image du plan')} />
                  </Field>
                  <section className="space-y-2">
                    <h3 className="text-[15px] font-semibold">Échelle</h3>
                    {plan.calibration ? (
                      <>
                        <p className="text-sm text-ink">
                          <Badge tone="green">Calibré</Badge> {formatNumber(plan.calibration.meters)} m entre deux points.
                        </p>
                        <Field label="Corriger la distance de référence (m)">
                          <NumberField label="Distance de référence" value={plan.calibration.meters} min={0.01} step={0.5} onCommit={(m) => calibratePlan(plan.id, plan.calibration!.a, plan.calibration!.b, m)} />
                        </Field>
                        <Button className="w-full" onClick={() => updatePlan(plan.id, { calibration: undefined }, 'Retirer la calibration')}>
                          Retirer la calibration
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs text-ink-muted">Sans calibration, aucune distance n’est présentée comme réelle.</p>
                    )}
                    <Button className="w-full" disabled={!plan.imageFileId} onClick={() => setTool('calibrate')}>
                      <Scaling size={14} /> {plan.calibration ? 'Recalibrer' : 'Calibrer l’échelle'} (2 points + distance)
                    </Button>
                  </section>
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={async () => {
                      const ok = await useEditor.getState().confirm({ title: `Supprimer le plan « ${plan.name} » ?`, message: 'Les positions des scènes, zones, épingles et libellés de ce plan seront perdus. Action annulable avec Ctrl+Z.', confirmLabel: 'Supprimer', danger: true });
                      if (ok) {
                        removePlan(plan.id);
                        setPlanId(null);
                      }
                    }}
                  >
                    <Trash2 size={14} /> Supprimer le plan
                  </Button>
                </>
              )}
              <p className="text-[11px] text-ink-faint">{(TOOLS.find((t) => t.id === tool) ?? { hint: 'Cliquez deux points dont vous connaissez la distance réelle.' }).hint}</p>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Swatches({ value, onChange }: { value?: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {MARKER_COLORS.map((c) => (
        <button key={c} type="button" aria-label={`Couleur ${c}`} aria-pressed={value === c} onClick={() => onChange(c)} className={cx('h-7 w-7 rounded-full ring-offset-2 ring-offset-navy-800', value === c && 'ring-2 ring-white')} style={{ background: c }} />
      ))}
      <input type="color" aria-label="Couleur personnalisée" value={value ?? '#7C3AED'} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-navy-500 bg-transparent" />
    </div>
  );
}

/** Properties of a scene marker ("point") on the plan. */
function PointInspector({ planId, sceneId, code, onClose }: { planId: string; sceneId: string; code: string; onClose: () => void }) {
  const project = useEditor((s) => s.project)!;
  const scenes = useSortedScenes();
  const [tab, setTab] = useState<'general' | 'link' | 'style' | 'advanced'>('general');
  const plan = project.floorPlans?.find((p) => p.id === planId);
  const marker = plan?.markers.find((m) => m.sceneId === sceneId);
  const scene = scenes.find((s) => s.id === sceneId);
  if (!plan || !marker || !scene) return null;
  const out = (project.navigation ?? []).filter((n) => n.sceneId === sceneId);
  const name = (id: string) => scenes.find((s) => s.id === id)?.name ?? '?';
  const goScene = () => {
    const st = useEditor.getState();
    st.setActiveScene(scene.id);
    st.setModule('scenes');
  };
  const tabs = [
    { id: 'general' as const, label: 'Général' },
    { id: 'link' as const, label: 'Lien' },
    { id: 'style' as const, label: 'Style' },
    { id: 'advanced' as const, label: 'Avancé' },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-lg font-semibold">Propriétés du point</h2>
        <IconButton label="Fermer" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </div>
      <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl border border-navy-500/50 bg-navy-900/40 p-2.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white" style={{ background: marker.color || '#7C3AED' }}>
          <MapPin size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{code}</span>
          <span className="block text-xs text-ink-muted">Point de scène</span>
        </span>
        <span className="text-xs text-ink-muted">{marker.hidden ? 'Masqué' : 'Actif'}</span>
        <button
          type="button"
          role="switch"
          aria-checked={!marker.hidden}
          aria-label="Point visible par les visiteurs"
          onClick={() => updateMarker(plan.id, sceneId, { hidden: !marker.hidden }, marker.hidden ? 'Afficher le point' : 'Masquer le point')}
          className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors focus-ring', !marker.hidden ? 'bg-emerald-500' : 'bg-navy-500')}
        >
          <span className={cx('absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', !marker.hidden ? 'translate-x-[22px]' : 'translate-x-0.5')} />
        </button>
      </div>
      <div role="tablist" aria-label="Propriétés du point" className="mx-3 mb-3 flex gap-0.5 rounded-xl border border-navy-500/60 bg-navy-900/60 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx('flex-1 rounded-lg py-1.5 text-[13px] font-medium', tab === t.id ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-glow' : 'text-ink-muted hover:text-ink')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 pb-4" role="tabpanel">
        {tab === 'general' && (
          <>
            <h3 className="text-[15px] font-semibold">Informations</h3>
            <Field label="Nom" required>
              <CommitInput value={scene.name} maxLength={120} aria-label="Nom de la scène" onCommit={(v) => v.trim() && updateScene(scene.id, { name: v.trim() }, 'Renommer la scène')} />
            </Field>
            <Field label="Type">
              <span className={cx(inputCls, 'flex items-center gap-2')}>{scene.kind === 'panorama' ? 'Scène 360°' : 'Scène 3D'} · déplacement vers la scène</span>
            </Field>
            <Field label="Scène associée (arrivée)">
              <span className="flex items-center gap-2">
                <SceneThumb scene={scene} badge={false} className="h-9 w-14 shrink-0 rounded-md" />
                <select aria-label="Scène associée" className={inputCls} value={sceneId} onChange={(e) => reassignMarker(plan.id, sceneId, e.target.value)}>
                  {scenes.map((s, i) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (S{String(i + 1).padStart(2, '0')})
                    </option>
                  ))}
                </select>
              </span>
            </Field>
            <h3 className="pt-1 text-[15px] font-semibold">Navigation</h3>
            <button type="button" onClick={() => setTab('link')} className={cx(inputCls, 'flex items-center gap-2 text-left hover:border-blue-400')}>
              <Share2 size={15} /> <span className="flex-1">Connexion(s)</span>
              <span className="text-ink-muted">{out.length} connexion{out.length > 1 ? 's' : ''} ›</span>
            </button>
            <Button className="w-full" onClick={goScene}>
              <Eye size={14} /> Ouvrir la scène
            </Button>
          </>
        )}
        {tab === 'link' && (
          <>
            {!out.length && <p className="text-sm text-ink-muted">Aucune connexion au départ de cette scène. Utilisez l’outil « Connexion » : cliquez cette scène puis une autre.</p>}
            {out.map((n) => {
              const back = n.pairId ? project.navigation?.find((x) => x.pairId === n.pairId && x.id !== n.id) : undefined;
              return (
                <section key={n.id} className="space-y-1 rounded-xl border border-navy-500/50 p-2.5">
                  <p className="truncate text-sm font-semibold">→ {name(n.targetSceneId)}</p>
                  <Row label="Navigation bidirectionnelle">
                    <MiniSwitch label={`Retour depuis ${name(n.targetSceneId)}`} checked={!!back} onChange={(v) => setBidirectional(n.id, v)} />
                  </Row>
                  <Row label="Afficher la flèche au sol">
                    <MiniSwitch label={`Flèche vers ${name(n.targetSceneId)}`} checked={n.showArrow} disabled={n.showArrow && n.showTarget === false} onChange={(v) => updateNavLink(n.id, { showArrow: v }, 'Flèche au sol')} />
                  </Row>
                  <Row label="Animation de transition">
                    <span className="w-32">
                      <Select<SceneTransition> label={`Transition vers ${name(n.targetSceneId)}`} value={n.transition} onChange={(t) => updateNavLink(n.id, { transition: t }, 'Transition')} options={[{ value: 'fade', label: 'Fondu doux' }, { value: 'none', label: 'Immédiate' }]} />
                    </span>
                  </Row>
                  <Row label="Durée">
                    <span className="w-24">
                      <NumberField label={`Durée vers ${name(n.targetSceneId)} (s)`} value={n.transition === 'fade' ? n.durationMs / 1000 : 0} step={0.1} min={0.2} suffix="s" disabled={n.transition !== 'fade'} onCommit={(v) => updateNavLink(n.id, { durationMs: Math.round(Math.max(0.2, Math.min(5, v)) * 1000) }, 'Durée de transition')} />
                    </span>
                  </Row>
                </section>
              );
            })}
          </>
        )}
        {tab === 'style' && (
          <>
            <Field group label="Couleur du point">
              <Swatches value={marker.color ?? '#7C3AED'} onChange={(color) => updateMarker(plan.id, sceneId, { color }, 'Couleur du point')} />
            </Field>
            <p className="text-xs text-ink-muted">Le point de la scène affichée dans le viewer est entouré en vert pour le visiteur.</p>
          </>
        )}
        {tab === 'advanced' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Position X (%)">
                <NumberField label="Position X" value={Math.round(marker.x * 1000) / 10} step={0.5} min={0} suffix="%" onCommit={(v) => placeSceneOnPlan(plan.id, sceneId, { x: Math.min(100, v) / 100, y: marker.y })} />
              </Field>
              <Field label="Position Y (%)">
                <NumberField label="Position Y" value={Math.round(marker.y * 1000) / 10} step={0.5} min={0} suffix="%" onCommit={(v) => placeSceneOnPlan(plan.id, sceneId, { x: marker.x, y: Math.min(100, v) / 100 })} />
              </Field>
            </div>
            <p className="text-xs text-ink-muted">Positions relatives à l’image du plan. Une scène n’apparaît que sur un seul plan.</p>
          </>
        )}
      </div>
      <div className="p-3">
        <button
          type="button"
          onClick={() => (removeSceneFromPlan(plan.id, sceneId), onClose())}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/70 bg-red-500/10 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/20 focus-ring"
        >
          <Trash2 size={17} /> Supprimer le point
        </button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="text-[13px] text-ink">{label}</span>
      {children}
    </div>
  );
}

function MiniSwitch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      title={disabled ? 'Un repère au moins doit rester visible' : undefined}
      onClick={() => onChange(!checked)}
      className={cx('relative h-6 w-11 shrink-0 rounded-full transition-colors focus-ring disabled:opacity-50', checked ? 'bg-emerald-500' : 'bg-navy-500')}
    >
      <span className={cx('absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}
