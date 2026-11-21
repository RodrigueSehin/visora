// Tour content shared by the Studio viewport and the visitor viewer: 360° panoramas,
// hotspot markers, navigation points, hotspot content dialog and scene transitions.
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { AlertTriangle, Box, ChevronsUp, ClipboardList, ExternalLink, FileText, Image as ImageIcon, Info, Link2, Loader2, MapPin, Phone, PlayCircle, Mail, Send, Star, Wrench } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { isSafeUrl } from '../../lib/actions';
import { mediaUrl } from '../../services/persistence';
import { useEditor } from '../../store/editor';
import { hotspotMeta } from '../../store/tourActions';
import type { Hotspot, HotspotFormField, HotspotIconId, HotspotType, NavLink, Scene } from '../../types';
import { Modal } from '../common/Overlays';
import { cx } from '../common/ui';
import { SceneEnvironment } from './SceneEnvironment';

/** Resolves a media-library file to a URL usable by <img>/<video>/<iframe>. */
export function useMediaUrl(fileId?: string) {
  const [state, setState] = useState<{ url?: string; error?: string }>({});
  useEffect(() => {
    if (!fileId) return setState({});
    let alive = true;
    setState({});
    mediaUrl(fileId)
      .then((url) => alive && setState({ url }))
      .catch((e) => alive && setState({ error: e instanceof Error ? e.message : String(e) }));
    return () => {
      alive = false;
    };
  }, [fileId]);
  return state;
}

/** Equirectangular image mapped inside a sphere centred on the camera. */
export function PanoramaSphere({ fileId }: { fileId?: string }) {
  const { url, error } = useMediaUrl(fileId);
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const invalidate = useThree((s) => s.invalidate);
  const geometry = useRef(new THREE.SphereGeometry(50, 64, 40).scale(-1, 1, 1));

  useEffect(() => {
    if (!url) return;
    let alive = true;
    let loaded: THREE.Texture | undefined;
    setLoadError(undefined);
    new THREE.TextureLoader()
      .loadAsync(url)
      .then((t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        loaded = t;
        if (alive) {
          setTex(t);
          invalidate();
        } else t.dispose();
      })
      .catch(() => alive && setLoadError('Image 360° illisible ou indisponible.'));
    return () => {
      alive = false;
      loaded?.dispose();
      setTex(null);
    };
  }, [url, invalidate]);

  const message = !fileId ? 'Aucune image 360° : choisissez un panorama dans les propriétés de la scène.' : error || loadError;
  return (
    <group>
      <mesh name="panorama" geometry={geometry.current}>
        {/* Distinct keys: a material compiled without a map would ignore one added later (needs a shader recompile). */}
        {tex ? <meshBasicMaterial key={tex.uuid} map={tex} toneMapped={false} /> : <meshBasicMaterial key="loading" color="#18263B" />}
      </mesh>
      {(message || !tex) && (
        <Html center position={[0, 0, -6]} zIndexRange={[10, 0]}>
          <div className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-navy-500 bg-navy-900/90 px-3 py-2 text-xs text-ink-muted">
            {message ? message : (
              <>
                <Loader2 size={14} className="animate-spin text-cyan" /> Chargement du panorama…
              </>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Room environment for 3D scenes, 360° sphere (plus soft lights for 3D objects) for panoramas. */
export function SceneBackdrop({ scene, showGrid, showAxes }: { scene: Scene; showGrid: boolean; showAxes: boolean }) {
  if (scene.kind !== 'panorama') return <SceneEnvironment scene={scene} showGrid={showGrid} showAxes={showAxes} />;
  return (
    <>
      <color attach="background" args={['#0B1220']} />
      <hemisphereLight args={['#ffffff', '#3a3f47', 1]} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} />
      <PanoramaSphere fileId={scene.panoramaFileId} />
    </>
  );
}

const ICONS: Record<HotspotType, typeof Info> = { info: Info, video: PlayCircle, document: FileText, image: ImageIcon, link: Link2, contact: Phone, scene: MapPin, equipment: Box, form: ClipboardList };

export const HOTSPOT_ICONS: { id: HotspotIconId; label: string; Icon: typeof Info }[] = [
  { id: 'info', label: 'Information', Icon: Info },
  { id: 'play', label: 'Lecture', Icon: PlayCircle },
  { id: 'file', label: 'Document', Icon: FileText },
  { id: 'pin', label: 'Repère', Icon: MapPin },
  { id: 'box', label: 'Équipement', Icon: Box },
  { id: 'link', label: 'Lien', Icon: Link2 },
  { id: 'form', label: 'Formulaire', Icon: ClipboardList },
  { id: 'phone', label: 'Téléphone', Icon: Phone },
  { id: 'image', label: 'Image', Icon: ImageIcon },
  { id: 'star', label: 'Étoile', Icon: Star },
  { id: 'alert', label: 'Attention', Icon: AlertTriangle },
  { id: 'wrench', label: 'Maintenance', Icon: Wrench },
];

export function HotspotIcon({ type, icon, size = 16 }: { type: HotspotType; icon?: HotspotIconId; size?: number }) {
  const Icon = (icon && HOTSPOT_ICONS.find((i) => i.id === icon)?.Icon) || ICONS[type] || Info;
  return <Icon size={size} />;
}

const HINTS: Record<HotspotType, string> = {
  info: 'Voir les détails',
  video: 'Voir la vidéo',
  document: 'Télécharger (PDF)',
  image: 'Voir l’image',
  link: 'Ouvrir le site',
  contact: 'Nous contacter',
  scene: 'Aller à la scène',
  equipment: 'Caractéristiques',
  form: 'Remplir le formulaire',
};
/** Second line of a hotspot label: the first line of its description, else what a click does. */
export const hotspotSubtitle = (h: Hotspot) => h.description?.split('\n')[0]?.trim() || HINTS[h.type];

/** Hotspots of the active scene. Studio: click selects. Visitor: click runs the hotspot. */
export function HotspotMarkers({ visitor, onActivate }: { visitor: boolean; onActivate?: (h: Hotspot) => void }) {
  const hotspots = useEditor((s) => s.project?.hotspots);
  const sceneId = useEditor((s) => s.activeSceneId);
  const focus = useEditor((s) => s.focus);
  const show = useEditor((s) => s.overlays.hotspots);
  if (!visitor && !show) return null;
  return (
    <>
      {(hotspots ?? [])
        .filter((h) => h.sceneId === sceneId)
        .map((h) => {
          const meta = hotspotMeta(h.type);
          const color = h.color || meta.color;
          const selected = !visitor && focus?.kind === 'hotspot' && focus.id === h.id;
          const s = h.size ?? 1;
          return (
            <Html key={h.id} position={[h.position.x, h.position.y, h.position.z]} center zIndexRange={[25, 0]} occlude={h.alwaysVisible === false}>
              <button
                type="button"
                aria-label={`${meta.label} : ${h.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (visitor) onActivate?.(h);
                  else {
                    const st = useEditor.getState();
                    if (st.module !== 'hotspots') st.setModule('hotspots');
                    st.setFocus({ kind: 'hotspot', id: h.id });
                  }
                }}
                className="group flex items-center focus:outline-none"
                style={{ transform: `scale(${s})` }}
              >
                <span
                  className={cx(
                    'relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-lg ring-[3px] transition-transform',
                    h.hoverEffect !== false && 'group-hover:scale-110',
                    selected ? 'ring-white' : 'ring-white/80',
                  )}
                  style={{ background: color, boxShadow: `0 0 0 6px ${color}40, 0 0 18px ${color}aa` }}
                >
                  {h.pulse && <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: color }} aria-hidden />}
                  <HotspotIcon type={h.type} icon={h.icon} size={20} />
                </span>
                {h.showLabel && (
                  <span className={cx('-ml-3 max-w-[240px] rounded-r-xl border border-white/15 bg-navy-950/85 py-1.5 pl-5 pr-3 text-left backdrop-blur', h.hoverEffect !== false && 'group-hover:bg-navy-900/95')}>
                    <span className="block truncate text-sm font-semibold text-white">{h.title}</span>
                    {h.labelStyle !== 'compact' && <span className="block max-w-[210px] truncate text-[11px] text-slate-300">{hotspotSubtitle(h)}</span>}
                  </span>
                )}
              </button>
            </Html>
          );
        })}
    </>
  );
}

/** Navigation points of the active scene (arrow + destination name). */
export function NavMarkers({ visitor, onNavigate }: { visitor: boolean; onNavigate?: (n: NavLink) => void }) {
  const links = useEditor((s) => s.project?.navigation);
  const scenes = useEditor((s) => s.project?.scenes);
  const sceneId = useEditor((s) => s.activeSceneId);
  const focus = useEditor((s) => s.focus);
  const show = useEditor((s) => s.overlays.navigation);
  if (!visitor && !show) return null;
  return (
    <>
      {(links ?? [])
        .filter((n) => n.sceneId === sceneId)
        .map((n) => {
          const target = scenes?.find((s) => s.id === n.targetSceneId);
          if (!target || (visitor && target.hidden)) return null;
          const selected = !visitor && focus?.kind === 'nav' && focus.id === n.id;
          return (
            <Html key={n.id} position={[n.position.x, n.position.y, n.position.z]} center zIndexRange={[24, 0]}>
              <button
                type="button"
                aria-label={`Aller à ${target.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (visitor) onNavigate?.(n);
                  else {
                    const st = useEditor.getState();
                    if (st.module !== 'navigation') st.setModule('navigation');
                    st.setFocus({ kind: 'nav', id: n.id });
                  }
                }}
                className={cx('group flex flex-col items-center gap-1 focus:outline-none', n.showTarget === false && !n.showArrow && (visitor ? 'opacity-0' : 'opacity-40'))}
              >
                {n.showTarget !== false && (
                  <>
                    <span className={cx('flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet to-blue-600 text-white shadow-lg ring-2 transition-transform group-hover:scale-110', selected ? 'ring-white' : 'ring-white/30')}>
                      <MapPin size={20} />
                    </span>
                    <span className="whitespace-nowrap rounded-lg bg-navy-950/85 px-2 py-0.5 text-xs font-medium text-white">{n.label || target.name}</span>
                  </>
                )}
                {n.showArrow && (
                  <span className={cx('flex flex-col items-center leading-none text-white drop-shadow-[0_0_6px_rgba(120,104,245,0.9)]', selected && n.showTarget === false && 'rounded-lg ring-2 ring-white')} aria-hidden>
                    {[0, 1, 2].map((i) => (
                      <ChevronsUp key={i} size={30 - i * 3} strokeWidth={2.5} className="-my-2 animate-pulse" style={{ animationDelay: `${(2 - i) * 180}ms` }} />
                    ))}
                  </span>
                )}
              </button>
            </Html>
          );
        })}
    </>
  );
}

/** Fade transition between scenes (also used for instant jumps). */
export function useSceneTransition() {
  const [opacity, setOpacity] = useState(0);
  const [ms, setMs] = useState(0);
  const busy = useRef(false);
  const go = useCallback((targetSceneId: string, transition: 'fade' | 'none' = 'fade', durationMs = 800) => {
    const st = useEditor.getState();
    if (!st.project?.scenes.some((s) => s.id === targetSceneId)) {
      st.toast({ kind: 'warning', text: 'La scène de destination n’existe plus.' });
      return;
    }
    if (transition === 'none' || durationMs < 50) return st.setActiveScene(targetSceneId);
    if (busy.current) return;
    busy.current = true;
    const half = Math.max(100, durationMs / 2);
    setMs(half);
    setOpacity(1);
    setTimeout(() => {
      useEditor.getState().setActiveScene(targetSceneId);
      setOpacity(0);
      setTimeout(() => (busy.current = false), half);
    }, half);
  }, []);
  const overlay = <div aria-hidden className="pointer-events-none absolute inset-0 z-30 bg-navy-950" style={{ opacity, transition: `opacity ${ms}ms ease` }} />;
  return { go, overlay };
}

function MediaBody({ hotspot }: { hotspot: Hotspot }) {
  const { url, error } = useMediaUrl(hotspot.mediaId);
  if (!hotspot.mediaId) return <p className="mt-3 text-sm text-amber-300">Aucun média n’est associé à ce hotspot.</p>;
  if (error) return <p className="mt-3 text-sm text-red-300">Média indisponible : {error}</p>;
  if (!url)
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted" role="status">
        <Loader2 size={14} className="animate-spin" /> Chargement…
      </p>
    );
  if (hotspot.type === 'video') return <video className="mt-3 w-full rounded-lg bg-black" src={url} controls autoPlay playsInline />;
  if (hotspot.type === 'image') return <img className="mt-3 max-h-[60vh] w-full rounded-lg object-contain" src={url} alt={hotspot.title} />;
  return (
    <div className="mt-3 space-y-2">
      <iframe title={hotspot.title} src={url} className="h-[60vh] w-full rounded-lg bg-white" />
      <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-cyan px-3 py-2 text-sm font-medium text-navy-950">
        <FileText size={15} /> Ouvrir le document
      </a>
    </div>
  );
}

/** Content shown to the visitor (and in the Studio preview) when a hotspot is activated. */
export function HotspotDialog({ hotspot, onClose }: { hotspot: Hotspot; onClose: () => void }) {
  const wide = hotspot.type === 'video' || hotspot.type === 'document' || hotspot.type === 'image';
  let body: ReactNode = null;
  if (wide) body = <MediaBody hotspot={hotspot} />;
  if (hotspot.type === 'contact')
    body = (
      <div className="mt-3 flex flex-wrap gap-2">
        {hotspot.contact?.email && (
          <a href={`mailto:${hotspot.contact.email}`} className="inline-flex items-center gap-2 rounded-lg bg-cyan px-3 py-2 text-sm font-medium text-navy-950">
            <Mail size={15} /> {hotspot.contact.email}
          </a>
        )}
        {hotspot.contact?.phone && (
          <a href={`tel:${hotspot.contact.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-2 rounded-lg border border-navy-500 px-3 py-2 text-sm text-ink">
            <Phone size={15} /> {hotspot.contact.phone}
          </a>
        )}
        {!hotspot.contact?.email && !hotspot.contact?.phone && <p className="text-sm text-amber-300">Aucune coordonnée renseignée.</p>}
      </div>
    );
  if (hotspot.type === 'form') body = <HotspotForm hotspot={hotspot} onDone={onClose} />;
  return (
    <Modal title={hotspot.title} onClose={onClose} width={wide ? 'max-w-3xl' : 'max-w-md'}>
      <HotspotContent hotspot={hotspot} />
      {body}
    </Modal>
  );
}

/** Description, equipment specs and "En savoir plus": shared by the visitor dialog and the Studio preview card. */
export function HotspotContent({ hotspot, compact }: { hotspot: Hotspot; compact?: boolean }) {
  const specs = (hotspot.specs ?? []).filter((s) => s.label.trim() || s.value.trim());
  return (
    <>
      {hotspot.description && <p className={cx('whitespace-pre-line leading-relaxed text-ink-muted', compact ? 'line-clamp-3 text-xs' : 'text-sm')}>{hotspot.description}</p>}
      {specs.length > 0 && (
        <dl className={cx('mt-2 space-y-1', compact ? 'text-xs' : 'text-sm')}>
          {specs.map((s, i) => (
            <div key={i} className="flex gap-1.5">
              <dt className="text-ink-muted">
                {s.label}
                {s.label && ' :'}
              </dt>
              <dd className="text-ink">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {isSafeUrl(hotspot.moreUrl) && (
        <a
          href={hotspot.moreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cx('mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 font-medium text-white hover:bg-blue-500', compact ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm')}
        >
          <ExternalLink size={compact ? 13 : 15} /> En savoir plus
        </a>
      )}
    </>
  );
}

export const FORM_FIELDS: Record<HotspotFormField, { label: string; type: string; required?: boolean }> = {
  name: { label: 'Nom', type: 'text', required: true },
  email: { label: 'E-mail', type: 'email', required: true },
  phone: { label: 'Téléphone', type: 'tel' },
  company: { label: 'Entreprise', type: 'text' },
  message: { label: 'Message', type: 'textarea', required: true },
};

export const isEmail = (v?: string) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** Builds the e-mail sent from the visitor's mail app (no data goes through VISORA). */
export function formMailto(h: Hotspot, values: Partial<Record<HotspotFormField, string>>): string | null {
  const to = h.form?.recipient?.trim();
  if (!isEmail(to)) return null;
  const body = (h.form?.fields ?? []).map((f) => `${FORM_FIELDS[f].label} : ${values[f]?.trim() ?? ''}`).join('\n');
  return `mailto:${encodeURIComponent(to!)}?subject=${encodeURIComponent(h.form?.subject?.trim() || h.title)}&body=${encodeURIComponent(body)}`;
}

function HotspotForm({ hotspot, onDone }: { hotspot: Hotspot; onDone: () => void }) {
  const [values, setValues] = useState<Partial<Record<HotspotFormField, string>>>({});
  const fields = hotspot.form?.fields ?? [];
  const href = formMailto(hotspot, values);
  if (!href) return <p className="mt-3 text-sm text-amber-300">Ce formulaire n’a pas d’adresse de réception.</p>;
  const cls = 'w-full rounded-lg border border-navy-500 bg-navy-900/70 px-2.5 py-1.5 text-sm text-ink focus:border-cyan focus:outline-none';
  return (
    <form
      className="mt-3 space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        window.location.href = href;
        onDone();
      }}
    >
      {fields.map((f) => {
        const def = FORM_FIELDS[f];
        return (
          <label key={f} className="block">
            <span className="mb-1 block text-xs text-ink-muted">
              {def.label}
              {def.required && ' *'}
            </span>
            {def.type === 'textarea' ? (
              <textarea required={def.required} rows={4} maxLength={2000} className={cls} value={values[f] ?? ''} onChange={(e) => setValues({ ...values, [f]: e.target.value })} />
            ) : (
              <input type={def.type} required={def.required} maxLength={200} className={cls} value={values[f] ?? ''} onChange={(e) => setValues({ ...values, [f]: e.target.value })} />
            )}
          </label>
        );
      })}
      <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-500">
        <Send size={15} /> Envoyer
      </button>
      <p className="text-[11px] text-ink-faint">Votre messagerie s’ouvre avec le message prêt à envoyer.</p>
    </form>
  );
}

/** Runs a hotspot: opens its content, follows its link, or navigates to its scene. */
export function useHotspotRunner(go: (sceneId: string) => void) {
  const [open, setOpen] = useState<Hotspot | null>(null);
  const run = useCallback(
    (h: Hotspot) => {
      if (h.type === 'scene') {
        if (h.targetSceneId) go(h.targetSceneId);
        else useEditor.getState().toast({ kind: 'warning', text: 'Aucune scène de destination n’est définie.' });
        return;
      }
      if (h.type === 'link') {
        if (isSafeUrl(h.url)) window.open(h.url, '_blank', 'noopener,noreferrer');
        else useEditor.getState().toast({ kind: 'warning', text: 'Lien invalide ou non sécurisé.' });
        return;
      }
      setOpen(h);
    },
    [go],
  );
  const dialog = open ? <HotspotDialog hotspot={open} onClose={() => setOpen(null)} /> : null;
  return { run, dialog };
}

/** Annotations of the active scene. Visitors only see public ones. */
export function AnnotationMarkers({ visitor }: { visitor: boolean }) {
  const notes = useEditor((s) => s.project?.annotations);
  const sceneId = useEditor((s) => s.activeSceneId);
  const focus = useEditor((s) => s.focus);
  const show = useEditor((s) => s.overlays.annotations);
  if (!visitor && !show) return null;
  return (
    <>
      {(notes ?? [])
        .filter((n) => n.sceneId === sceneId && (!visitor || n.visibility === 'public'))
        .map((n) => (
          <Html key={n.id} position={[n.position.x, n.position.y, n.position.z]} center zIndexRange={[23, 0]}>
            <button
              type="button"
              disabled={visitor}
              onClick={(e) => {
                e.stopPropagation();
                const st = useEditor.getState();
                if (st.module !== 'annotations') st.setModule('annotations');
                st.setFocus({ kind: 'annotation', id: n.id });
              }}
              className={cx('max-w-[240px] rounded-lg border-l-4 bg-white/95 px-2.5 py-1.5 text-left text-xs font-medium text-navy-950 shadow-lg', !visitor && focus?.id === n.id && 'ring-2 ring-cyan')}
              style={{ borderColor: n.color ?? '#F59E0B' }}
            >
              {!visitor && n.visibility === 'studio' && <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-slate-500">Note d’équipe</span>}
              <span className="whitespace-pre-line">{n.text}</span>
            </button>
          </Html>
        ))}
    </>
  );
}
