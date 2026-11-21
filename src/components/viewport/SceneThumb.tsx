import { Box, Orbit } from 'lucide-react';
import type { Scene } from '../../types';
import { cx } from '../common/ui';
import { useMediaUrl } from './TourLayers';

/** Scene cover: its thumbnail, else its 360° image, else a placeholder by scene kind. Works in the Studio and the visitor viewer. */
export function SceneThumb({ scene, className, badge = true }: { scene: Pick<Scene, 'kind' | 'thumbnailFileId' | 'panoramaFileId'>; className?: string; badge?: boolean }) {
  const fileId = scene.thumbnailFileId ?? (scene.kind === 'panorama' ? scene.panoramaFileId : undefined);
  const { url } = useMediaUrl(fileId);
  return (
    <div className={cx('relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-navy-600 to-navy-900', className)}>
      {url ? (
        <img src={url} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
      ) : scene.kind === 'panorama' ? (
        <Orbit size={20} className="text-ink-faint" />
      ) : (
        <Box size={20} className="text-cyan/70" />
      )}
      {badge && scene.kind === 'panorama' && <span className="absolute right-1 top-1 rounded bg-navy-950/80 px-1 text-[9px] font-semibold text-white">360°</span>}
    </div>
  );
}
