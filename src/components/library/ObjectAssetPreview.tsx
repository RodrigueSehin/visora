import { Bounds, ContactShadows, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Loader2, Plus, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { categoryLabel } from '../../lib/categories';
import { formatBytes, formatNumber } from '../../lib/format';
import { useEditor } from '../../store/editor';
import { acquireInstance, releaseInstance } from '../../three/assetCache';
import { webglAvailable } from '../../three/thumbnails';
import type { Asset3D } from '../../types';
import { Modal } from '../common/Overlays';
import { Badge, Button } from '../common/ui';
import { AssetThumb } from './ObjectLibraryPanel';

export function ObjectAssetPreview({ asset, onClose }: { asset: Asset3D; onClose: () => void }) {
  const [node, setNode] = useState<THREE.Object3D | null>(null);
  const [error, setError] = useState<string>();
  const fav = useEditor((s) => s.project?.favorites.includes(asset.id) ?? false);
  const webgl = webglAvailable();

  useEffect(() => {
    if (!webgl) return;
    let alive = true;
    let n: THREE.Object3D | undefined;
    acquireInstance(asset)
      .then((x) => {
        n = x;
        if (alive) setNode(x);
        else releaseInstance(asset, x);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
      if (n) releaseInstance(asset, n);
    };
  }, [asset, webgl]);

  const s = asset.size;
  return (
    <Modal
      title={asset.name}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => useEditor.getState().toggleFavorite(asset.id)}>
            <Star size={14} className={fav ? 'fill-amber-400 text-amber-400' : ''} /> {fav ? 'Favori' : 'Marquer en favori'}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              useEditor.getState().addObject(asset.id);
              onClose();
            }}
          >
            <Plus size={14} /> Ajouter à la scène
          </Button>
        </>
      }
    >
      <div className="aspect-[16/10] overflow-hidden rounded-xl border border-navy-500/60 bg-navy-950">
        {!webgl ? (
          <AssetThumb asset={asset} className="h-full w-full" />
        ) : error ? (
          <div role="alert" className="flex h-full items-center justify-center p-6 text-sm text-red-300">
            Asset indisponible : {error}
          </div>
        ) : !node ? (
          <div className="flex h-full items-center justify-center" role="status">
            <Loader2 className="animate-spin text-cyan" />
          </div>
        ) : (
          <Canvas camera={{ position: [3, 2, 4], fov: 40 }} dpr={[1, 1.5]} shadows>
            <color attach="background" args={['#0B1220']} />
            <hemisphereLight args={['#ffffff', '#334155', 1.1]} />
            <directionalLight position={[4, 6, 5]} intensity={1.5} />
            <Bounds fit clip observe margin={1.25}>
              <primitive object={node} />
            </Bounds>
            <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={Math.max(4, (s?.x ?? 1) * 3)} blur={2} far={4} />
            <OrbitControls makeDefault autoRotate autoRotateSpeed={0.8} />
          </Canvas>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge tone="cyan">{categoryLabel(asset.category)}</Badge>
        <Badge>{asset.format}</Badge>
        {asset.imported && <Badge tone="violet">Importé</Badge>}
        {asset.tags?.map((t) => <Badge key={t}>{t}</Badge>)}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <dt className="text-ink-faint">Dimensions</dt>
        <dd className="text-ink sm:col-span-3">{s ? `${formatNumber(s.x)} × ${formatNumber(s.y)} × ${formatNumber(s.z)} m (L × H × P)` : '—'}</dd>
        <dt className="text-ink-faint">Taille du fichier</dt>
        <dd className="text-ink">{asset.fileSize ? formatBytes(asset.fileSize) : 'Généré (aucun fichier)'}</dd>
        <dt className="text-ink-faint">Triangles</dt>
        <dd className="text-ink">{asset.triangleCount != null ? formatNumber(asset.triangleCount, 0) : '—'}</dd>
      </dl>
      <p className="mt-2 text-[11px] text-ink-faint">Faites glisser pour tourner, molette pour zoomer.</p>
    </Modal>
  );
}
