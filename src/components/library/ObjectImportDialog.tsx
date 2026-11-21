import { Bounds, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Sparkles, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CATEGORIES } from '../../lib/categories';
import { formatBytes, formatNumber } from '../../lib/format';
import { nowIso, uid } from '../../lib/ids';
import { analyzeFiles, computeStats, downscaleTextures, exportGlb, type ImportAnalysis } from '../../services/importer';
import { MAX_FILE_BYTES, sanitizeName, SUPPORTED_FORMATS } from '../../services/importValidation';
import { uploadFile } from '../../services/persistence';
import { useEditor } from '../../store/editor';
import { disposeObject, evictFile } from '../../three/assetCache';
import { renderThumbnail, webglAvailable } from '../../three/thumbnails';
import type { Asset3D, AssetCategory } from '../../types';
import { Modal } from '../common/Overlays';
import { Badge, Button, Field, Select, Toggle, cx, inputCls } from '../common/ui';

type Phase = 'select' | 'analyzing' | 'review' | 'saving' | 'done' | 'failed';

const ACCEPT = [...SUPPORTED_FORMATS, 'bin', 'png', 'jpg', 'jpeg', 'webp', 'mtl'].map((e) => `.${e}`).join(',');

export function ObjectImportDialog({ onClose, replace }: { onClose: () => void; replace?: Asset3D }) {
  const [phase, setPhase] = useState<Phase>('select');
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [name, setName] = useState(replace?.name ?? '');
  const [category, setCategory] = useState<AssetCategory>(replace?.category ?? 'imported');
  const [tags, setTags] = useState(replace?.tags?.join(', ') ?? '');
  const [unit, setUnit] = useState('1');
  const [optimize, setOptimize] = useState(false);
  const [error, setError] = useState<string>();
  const [savedAsset, setSavedAsset] = useState<Asset3D | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const objectRef = useRef<THREE.Object3D>();

  useEffect(() => () => objectRef.current && disposeObject(objectRef.current, true), []);

  const start = async (files: File[]) => {
    if (!files.length) return;
    setPhase('analyzing');
    setError(undefined);
    try {
      const a = await analyzeFiles(files);
      setAnalysis(a);
      if (!a.ok) return setPhase('failed');
      objectRef.current = a.object;
      if (!replace) setName(sanitizeName(a.fileName));
      setUnit(String(a.suggestedUnitScale));
      setOptimize(a.issues.some((i) => i.code === 'heavy'));
      setPhase('review');
    } catch (e) {
      setAnalysis({ ok: false, fileName: files[0].name, bytes: files[0].size, issues: [{ level: 'error', code: 'parse-error', message: `Import échoué : ${e instanceof Error ? e.message : e}` }], suggestedUnitScale: 1 });
      setPhase('failed');
    }
  };

  const save = async (placeInScene: boolean) => {
    const a = analysis;
    const obj = objectRef.current;
    if (!a?.ok || !obj || !a.format) return;
    setPhase('saving');
    try {
      if (optimize) downscaleTextures(obj, 1024);
      const glb = await exportGlb(obj);
      if (glb.byteLength > MAX_FILE_BYTES) throw new Error(`Le modèle converti dépasse ${MAX_FILE_BYTES / 1024 / 1024} Mo.`);
      const projectId = useEditor.getState().project!.id;
      const fileId = await uploadFile(projectId, new Blob([glb], { type: 'model/gltf-binary' }), `${sanitizeName(a.fileName).replace(/\s+/g, '-')}.glb`);
      const unitScale = parseFloat(unit) || 1;
      const thumbSrc = skeletonClone(obj);
      thumbSrc.scale.multiplyScalar(unitScale);
      const thumbnailUrl = await renderThumbnail(null, thumbSrc);
      const stats = computeStats(obj);
      const size = { x: +(stats.size.x * unitScale).toFixed(3), y: +(stats.size.y * unitScale).toFixed(3), z: +(stats.size.z * unitScale).toFixed(3) };
      const st = useEditor.getState();
      const common = {
        source: { kind: 'file' as const, fileId, originalFormat: a.format },
        format: a.format.toUpperCase(),
        fileSize: glb.byteLength,
        size,
        unitScale,
        meshCount: stats.meshes,
        triangleCount: stats.triangles,
        thumbnailUrl,
      };
      let asset: Asset3D;
      if (replace) {
        st.updateAsset(replace.id, { ...common, name: name.trim() || replace.name, category, tags: splitTags(tags) }, 'Remplacer l’asset');
        if (replace.source.kind === 'file') evictFile(replace.source.fileId);
        asset = { ...replace, ...common };
      } else {
        const t = nowIso();
        asset = {
          id: uid('ast'),
          projectId: st.project!.id,
          name: name.trim() || sanitizeName(a.fileName),
          category,
          tags: splitTags(tags),
          imported: true,
          createdAt: t,
          updatedAt: t,
          ...common,
        };
        st.addAsset(asset);
      }
      setSavedAsset(asset);
      if (placeInScene && !replace) {
        st.addObject(asset.id);
        st.toast({ kind: 'success', text: `« ${asset.name} » importé et ajouté à la scène.` });
        onClose();
        return;
      }
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('review');
    }
  };

  const issues = analysis?.issues ?? [];
  const title = replace ? `Remplacer le fichier de « ${replace.name} »` : 'Importer un modèle 3D';

  return (
    <Modal
      title={title}
      onClose={phase === 'saving' ? () => {} : onClose}
      width="max-w-3xl"
      footer={
        phase === 'review' ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button variant="secondary" onClick={() => void save(false)} disabled={!name.trim()}>
              {replace ? 'Remplacer' : 'Ajouter à la bibliothèque'}
            </Button>
            {!replace && (
              <Button variant="primary" onClick={() => void save(true)} disabled={!name.trim()}>
                Ajouter et placer dans la scène
              </Button>
            )}
          </>
        ) : phase === 'done' ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Fermer
            </Button>
            {savedAsset && !replace && (
              <Button
                variant="primary"
                onClick={() => {
                  useEditor.getState().addObject(savedAsset.id);
                  onClose();
                }}
              >
                Ajouter à la scène
              </Button>
            )}
          </>
        ) : phase === 'failed' ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Fermer
            </Button>
            <Button variant="primary" onClick={() => setPhase('select')}>
              Choisir un autre fichier
            </Button>
          </>
        ) : undefined
      }
    >
      {phase === 'select' && (
        <div
          onDragOver={(e) => (e.preventDefault(), setDragOver(true))}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void start([...e.dataTransfer.files]);
          }}
          className={cx(
            'flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
            dragOver ? 'border-cyan bg-cyan/5' : 'border-navy-500',
          )}
        >
          <FileUp className="text-cyan" size={34} />
          <div>
            <p className="text-sm font-medium text-ink">Glissez-déposez votre modèle ici</p>
            <p className="mt-1 text-xs text-ink-muted">
              GLB et GLTF recommandés · OBJ, FBX, STL acceptés · {MAX_FILE_BYTES / 1024 / 1024} Mo max.
              <br />
              Pour un GLTF ou un OBJ, sélectionnez aussi ses fichiers associés (.bin, textures, .mtl).
            </p>
          </div>
          <Button variant="primary" onClick={() => input.current?.click()}>
            Parcourir…
          </Button>
          <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => void start([...(e.target.files ?? [])])} />
          {!webglAvailable() && <p className="text-xs text-amber-300">WebGL indisponible : l’aperçu et la miniature ne pourront pas être générés.</p>}
        </div>
      )}

      {phase === 'analyzing' && (
        <div className="flex flex-col items-center gap-3 py-14" role="status">
          <Loader2 className="animate-spin text-cyan" size={30} />
          <p className="text-sm text-ink">Analyse et chargement du modèle…</p>
          <p className="text-xs text-ink-muted">Validation du format, lecture de la géométrie et des textures.</p>
        </div>
      )}

      {phase === 'failed' && (
        <div className="space-y-3 py-4">
          <div className="flex items-center gap-2 text-red-300">
            <XCircle size={20} />
            <span className="text-sm font-medium">Import échoué — {analysis?.fileName}</span>
          </div>
          <IssueList issues={issues} />
        </div>
      )}

      {(phase === 'review' || phase === 'saving') && analysis?.object && (
        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <div className="aspect-[4/3] overflow-hidden rounded-xl border border-navy-500/60 bg-navy-950">
              {webglAvailable() ? <ImportPreviewCanvas object={analysis.object} /> : <div className="p-6 text-xs text-ink-muted">Aperçu indisponible (WebGL).</div>}
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <Stat k="Fichier" v={analysis.fileName} />
              <Stat k="Format" v={analysis.format?.toUpperCase() ?? '—'} />
              <Stat k="Taille" v={formatBytes(analysis.bytes)} />
              <Stat k="Meshes" v={formatNumber(analysis.stats!.meshes, 0)} />
              <Stat k="Triangles" v={formatNumber(analysis.stats!.triangles, 0)} />
              <Stat k="Textures" v={`${analysis.stats!.textures}${analysis.stats!.maxTexture ? ` (max ${analysis.stats!.maxTexture} px)` : ''}`} />
              <Stat
                k="Dimensions"
                v={(['x', 'y', 'z'] as const).map((a) => formatNumber(analysis.stats!.size[a] * (parseFloat(unit) || 1))).join(' × ') + ' m'}
              />
            </dl>
          </div>
          <div className="space-y-3">
            {issues.length > 0 ? (
              <IssueList issues={issues} />
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                <CheckCircle2 size={15} /> Modèle valide et prêt pour le Web.
              </div>
            )}
            <Field label="Nom" required>
              <input className={inputCls} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Catégorie">
              <Select label="Catégorie" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
            </Field>
            <Field label="Tags" hint="Séparés par des virgules">
              <input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ex. quai, logistique" />
            </Field>
            <Field label="Unités du fichier" hint={analysis.unitReason}>
              <Select
                label="Unités"
                value={unit}
                onChange={setUnit}
                options={[
                  { value: '1', label: 'Mètres' },
                  { value: '0.01', label: 'Centimètres' },
                  { value: '0.001', label: 'Millimètres' },
                  { value: '0.0254', label: 'Pouces' },
                ]}
              />
            </Field>
            <div className="rounded-xl border border-violet/30 bg-violet/5 px-3 py-1.5">
              <Toggle
                label="Optimiser pour le Web"
                hint="Réduit les textures à 1024 px max. et convertit en GLB compact"
                checked={optimize}
                onChange={setOptimize}
              />
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}
            {phase === 'saving' && (
              <p className="flex items-center gap-2 text-xs text-ink-muted" role="status">
                <Loader2 size={14} className="animate-spin text-cyan" /> Conversion et enregistrement…
              </p>
            )}
          </div>
        </div>
      )}

      {phase === 'done' && savedAsset && (
        <div className="flex items-center gap-3 py-6">
          <CheckCircle2 className="text-emerald-400" size={26} />
          <div>
            <p className="text-sm font-medium text-ink">« {savedAsset.name} » {replace ? 'a été remplacé' : 'a été ajouté à la bibliothèque'}.</p>
            <p className="text-xs text-ink-muted">
              GLB · {formatBytes(savedAsset.fileSize)} · {formatNumber(savedAsset.triangleCount ?? 0, 0)} triangles
              {replace ? ' · toutes les instances utilisent désormais le nouveau fichier' : ''}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}

const splitTags = (t: string) => t.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20);

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-ink-faint">{k}</dt>
      <dd className="truncate text-ink" title={v}>
        {v}
      </dd>
    </>
  );
}

function IssueList({ issues }: { issues: ImportAnalysis['issues'] }) {
  return (
    <ul className="space-y-1.5">
      {issues.map((i, k) => (
        <li key={k} className={cx('flex gap-2 rounded-lg px-3 py-2 text-xs', i.level === 'error' ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/10 text-amber-200')}>
          {i.level === 'error' ? <XCircle size={15} className="shrink-0" /> : <AlertTriangle size={15} className="shrink-0" />}
          <span>
            {i.message}
            {i.code === 'heavy' && (
              <Badge tone="violet">
                <Sparkles size={9} /> Optimisation proposée
              </Badge>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ImportPreviewCanvas({ object }: { object: THREE.Object3D }) {
  return (
    <Canvas camera={{ position: [3, 2, 4], fov: 40 }} dpr={[1, 1.5]}>
      <color attach="background" args={['#0B1220']} />
      <hemisphereLight args={['#ffffff', '#334155', 1.2]} />
      <directionalLight position={[4, 6, 5]} intensity={1.4} />
      <Bounds fit clip observe margin={1.3}>
        <primitive object={object} />
      </Bounds>
      <OrbitControls makeDefault />
    </Canvas>
  );
}
