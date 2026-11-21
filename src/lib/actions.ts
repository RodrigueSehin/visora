// Shared action vocabulary. Hotspots and 3D objects trigger the same VISORA actions,
// so the Hotspots module can reuse ACTION_TYPES / runAction without a parallel system.
import type { ActionType } from '../types';

export const ACTION_TYPES: { id: ActionType; label: string; needsUrl?: boolean; needsScene?: boolean }[] = [
  { id: 'none', label: 'Aucune' },
  { id: 'info', label: "Afficher un hotspot d'information" },
  { id: 'sheet', label: 'Ouvrir une fiche détaillée' },
  { id: 'document', label: 'Ouvrir un document', needsUrl: true },
  { id: 'video', label: 'Lire une vidéo', needsUrl: true },
  { id: 'scene', label: 'Naviguer vers une scène', needsScene: true },
  { id: 'link', label: 'Ouvrir un lien', needsUrl: true },
];

/** Only http(s) URLs are allowed to be opened from a tour. */
export function isSafeUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
