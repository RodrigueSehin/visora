import { CameraControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import CameraControlsImpl from 'camera-controls';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Modal } from '../../components/common/Overlays';
import { PanoramaSphere } from '../../components/viewport/TourLayers';

function LookAround() {
  const ref = useRef<CameraControlsImpl>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const A = CameraControlsImpl.ACTION;
    // Camera at the sphere centre: dragging turns the view, the wheel zooms.
    c.setLookAt(0, 0, 0.01, 0, 0, 0, false);
    c.minDistance = c.maxDistance = 0.01;
    c.azimuthRotateSpeed = c.polarRotateSpeed = -0.35;
    c.minZoom = 0.6;
    c.maxZoom = 3;
    c.mouseButtons.wheel = A.ZOOM;
    c.mouseButtons.right = A.NONE;
    c.touches.two = A.TOUCH_ZOOM;
  }, []);
  return <CameraControls ref={ref} makeDefault smoothTime={0.15} />;
}

/** Look-around viewer for a 360° image of the media library. */
export function PanoramaViewer({ fileId, name, onClose }: { fileId: string; name: string; onClose: () => void }) {
  return (
    <Modal title={`Aperçu 360° · ${name}`} onClose={onClose} width="max-w-5xl">
      <div className="h-[65vh] overflow-hidden rounded-xl bg-navy-950">
        <Canvas frameloop="demand" dpr={[1, 1.75]} onCreated={({ gl }) => (gl.toneMapping = THREE.NoToneMapping)} aria-label={`Panorama 360° ${name}`}>
          <PerspectiveCamera makeDefault fov={75} near={0.01} far={200} position={[0, 0, 0.01]} />
          <LookAround />
          <PanoramaSphere fileId={fileId} />
        </Canvas>
      </div>
      <p className="mt-2 text-xs text-ink-muted">Glissez pour regarder autour, molette ou pincement pour zoomer.</p>
    </Modal>
  );
}
