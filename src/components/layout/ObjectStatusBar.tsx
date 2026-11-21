import { Box, Database, HardDrive, Layers, Magnet, MousePointer2, Triangle } from 'lucide-react';
import { useMemo } from 'react';
import { formatBytes, formatNumber, formatTime } from '../../lib/format';
import { findAsset, useEditor } from '../../store/editor';
import { cx } from '../common/ui';

function Stat({ icon, value, label, className }: { icon: React.ReactNode; value: React.ReactNode; label: string; className?: string }) {
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <span className="text-ink-faint">{icon}</span>
      <span className="text-sm font-semibold tabular-nums text-ink">{value}</span>
      <span className="text-xs text-ink-muted">{label}</span>
    </div>
  );
}

export function ObjectStatusBar() {
  const p = useEditor((s) => s.project);
  const sceneId = useEditor((s) => s.activeSceneId);
  const selection = useEditor((s) => s.selection.length);
  const snap = useEditor((s) => s.snap);
  const dirty = useEditor((s) => s.dirty);
  const lastSavedAt = useEditor((s) => s.lastSavedAt);
  const autosave = p?.settings.autosaveSeconds ?? 0;

  const stats = useMemo(() => {
    const inScene = p?.objects.filter((o) => o.sceneId === sceneId && o.kind === 'object') ?? [];
    const tris = inScene.reduce((a, o) => a + (findAsset(p, o.assetId)?.triangleCount ?? 0), 0);
    return {
      scene: inScene.length,
      total: p?.objects.filter((o) => o.kind === 'object').length ?? 0,
      tris,
      imported: p?.assets.filter((a) => !a.deletedAt).length ?? 0,
      // Size of the imported model files referenced by this project (stored in S3).
      bytes: p?.assets.filter((a) => !a.deletedAt).reduce((s, a) => s + (a.fileSize ?? 0), 0) ?? 0,
    };
  }, [p, sceneId]);

  if (!p) return null;
  return (
    <footer className="flex h-11 shrink-0 items-center gap-5 overflow-x-auto border-t border-navy-500/50 bg-navy-900 px-4 text-xs" aria-label="Barre de statut">
      <Stat icon={<Layers size={15} />} value={p.scenes.length} label="Scènes" />
      <Stat icon={<Box size={15} />} value={`${stats.scene}`} label={`Objets dans la scène · ${stats.total} au total`} />
      <Stat icon={<Database size={15} />} value={stats.imported} label="Modèles importés" className="hidden md:flex" />
      {stats.tris > 0 && <Stat icon={<Triangle size={14} />} value={formatNumber(stats.tris, 0)} label="triangles importés" className="hidden lg:flex" />}
      <Stat icon={<MousePointer2 size={14} />} value={selection} label="sélectionné(s)" className="hidden sm:flex" />
      <div className="hidden items-center gap-1.5 text-ink-muted lg:flex" title="Magnétisme actif">
        <Magnet size={14} className={snap.grid || snap.ground ? 'text-cyan' : 'text-ink-faint'} />
        {[snap.grid && `grille ${String(snap.gridSize).replace('.', ',')} m`, snap.ground && 'sol', snap.surfaces && 'surfaces', snap.rotation && `${snap.rotationStep}°`].filter(Boolean).join(' · ') || 'aucun'}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-4">
        <span className="text-ink-muted">
          {dirty ? 'Non enregistré' : lastSavedAt ? `Enregistré à ${formatTime(lastSavedAt)}` : ''}
          {autosave ? ` · auto ${autosave < 60 ? `${autosave} s` : `${autosave / 60} min`}` : ''}
        </span>
        <div className="hidden items-center gap-2 md:flex" title="Fichiers 3D importés dans ce projet (stockage S3 de l’organisation)">
          <HardDrive size={14} className="text-ink-faint" />
          <span className="text-ink-muted">Fichiers du projet</span>
          <span className="tabular-nums text-ink">{formatBytes(stats.bytes)}</span>
        </div>
      </div>
    </footer>
  );
}
