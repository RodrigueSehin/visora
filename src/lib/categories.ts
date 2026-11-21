import type { AssetCategory } from '../types';

export const CATEGORIES: { id: AssetCategory; label: string; short: string }[] = [
  { id: 'industrial', label: 'Équipements industriels', short: 'Industriel' },
  { id: 'furniture', label: 'Mobilier', short: 'Mobilier' },
  { id: 'decor', label: 'Éléments décoratifs', short: 'Décor' },
  { id: 'imported', label: 'Modèles importés', short: 'Importés' },
  { id: 'signage', label: 'Signalétique', short: 'Signalétique' },
  { id: 'lighting', label: 'Éclairage', short: 'Éclairage' },
  { id: 'vehicles', label: 'Véhicules', short: 'Véhicules' },
  { id: 'security', label: 'Sécurité', short: 'Sécurité' },
  { id: 'architecture', label: 'Architecture', short: 'Architecture' },
  { id: 'other', label: 'Autres', short: 'Autres' },
];

export const categoryLabel = (c?: AssetCategory) => CATEGORIES.find((x) => x.id === c)?.label ?? 'Autres';
