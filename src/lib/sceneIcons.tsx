import { Boxes, DoorOpen, Home, LogOut, MapPin, Monitor, Package, Server, ShieldCheck, Bath, Truck, Users, Warehouse, type LucideIcon } from 'lucide-react';
import type { SceneIcon } from '../types';

export const SCENE_ICONS: { id: SceneIcon; label: string; Icon: LucideIcon }[] = [
  { id: 'home', label: 'Maison', Icon: Home },
  { id: 'door', label: 'Entrée', Icon: DoorOpen },
  { id: 'warehouse', label: 'Entrepôt', Icon: Warehouse },
  { id: 'boxes', label: 'Stockage', Icon: Boxes },
  { id: 'package', label: 'Colis', Icon: Package },
  { id: 'truck', label: 'Expédition', Icon: Truck },
  { id: 'office', label: 'Bureau', Icon: Monitor },
  { id: 'meeting', label: 'Réunion', Icon: Users },
  { id: 'server', label: 'Technique', Icon: Server },
  { id: 'shield', label: 'Sécurité', Icon: ShieldCheck },
  { id: 'restroom', label: 'Sanitaires', Icon: Bath },
  { id: 'exit', label: 'Sortie', Icon: LogOut },
  { id: 'pin', label: 'Repère', Icon: MapPin },
];

export function sceneIcon(id?: SceneIcon): LucideIcon {
  return SCENE_ICONS.find((i) => i.id === id)?.Icon ?? MapPin;
}
