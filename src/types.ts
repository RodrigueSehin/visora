// Core data model for the VISORA Studio 3D "Objets 3D" module.
// Library assets (Asset3D) are separated from their placed instances (SceneObject3D):
// an asset's source file is stored once and reused by any number of instances.

export type Vec3 = { x: number; y: number; z: number };

export type AssetCategory =
  | 'industrial'
  | 'furniture'
  | 'decor'
  | 'imported'
  | 'signage'
  | 'lighting'
  | 'vehicles'
  | 'security'
  | 'architecture'
  | 'other';

export type AssetSource =
  | { kind: 'builtin'; key: string }
  | { kind: 'file'; fileId: string; originalFormat: string };

export type Asset3D = {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  category: AssetCategory;
  source: AssetSource;
  /** Display format, e.g. GLB, OBJ, VISORA (procedural). */
  format: string;
  thumbnailUrl?: string;
  tags?: string[];
  fileSize?: number;
  /** Bounding box size at scale 1, in metres. */
  size?: Vec3;
  meshCount?: number;
  triangleCount?: number;
  /** Multiplier applied so the model's native units become metres. */
  unitScale?: number;
  imported: boolean;
  /** Soft delete: kept in data so undo can restore it. */
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Interaction attached to an object. Shares its shape with VISORA hotspot actions
 * (see lib/actions.ts) so the Hotspots module and objects trigger the same behaviours.
 */
export type ActionType = 'none' | 'info' | 'sheet' | 'document' | 'video' | 'scene' | 'link';

export type ObjectInteraction = {
  type: ActionType;
  targetId?: string;
  config?: { title?: string; text?: string; url?: string; details?: { label: string; value: string }[] };
};

export type ObjectStyle = {
  color?: string;
  opacity?: number;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
};

export type SceneObject3D = {
  id: string;
  sceneId: string;
  /** null for group nodes. */
  assetId: string | null;
  kind: 'object' | 'group';
  name: string;
  description?: string;
  category?: AssetCategory;
  tags?: string[];
  position: Vec3;
  /** Degrees, Euler XYZ. */
  rotation: Vec3;
  scale: Vec3;
  visible: boolean;
  locked: boolean;
  /** Only shown in Studio, hidden in the published tour. */
  studioOnly: boolean;
  uniformScale: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  interaction?: ObjectInteraction;
  style?: ObjectStyle;
  parentId?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type EnvironmentPreset = 'warehouse' | 'office' | 'showroom' | 'empty';

/** environment = modelled 3D room; panorama = equirectangular 360° image from the media library. */
export type SceneKind = 'environment' | 'panorama';

/** Camera orientation in degrees (yaw around Y, pitch up/down) and vertical field of view. */
export type SceneView = { yaw: number; pitch: number; fov: number };

export type Scene = {
  id: string;
  name: string;
  environment: EnvironmentPreset;
  size: { width: number; depth: number; height: number };
  order: number;
  kind?: SceneKind;
  panoramaFileId?: string;
  description?: string;
  initialView?: SceneView;
  /** Hidden scenes stay editable but are not reachable in the published tour. */
  hidden?: boolean;
  /** Cover image (media library image) shown in lists, the filmstrip and the visitor scene menu. */
  thumbnailFileId?: string;
  icon?: SceneIcon;
  /** Free labels, used by the scene search. */
  tags?: string[];
  /** Visitors can look around but cannot walk away from the start point (3D scenes). */
  lockCamera?: boolean;
};

export type SceneIcon = 'home' | 'door' | 'warehouse' | 'boxes' | 'package' | 'truck' | 'office' | 'meeting' | 'server' | 'shield' | 'restroom' | 'exit' | 'pin';

export type HotspotType = 'info' | 'video' | 'document' | 'image' | 'link' | 'contact' | 'scene' | 'equipment' | 'form';

export type HotspotIconId = 'info' | 'play' | 'file' | 'pin' | 'box' | 'link' | 'form' | 'phone' | 'image' | 'star' | 'alert' | 'wrench';
export type HotspotFormField = 'name' | 'email' | 'phone' | 'company' | 'message';

export type Hotspot = {
  id: string;
  sceneId: string;
  type: HotspotType;
  title: string;
  description?: string;
  /** World position (on a surface, or on the 360° sphere for panorama scenes). */
  position: Vec3;
  color?: string;
  size?: number;
  showLabel: boolean;
  /** Media library file (video, document, image). */
  mediaId?: string;
  url?: string;
  targetSceneId?: string;
  contact?: { email?: string; phone?: string };
  /** Icon override (defaults to the type icon). */
  icon?: HotspotIconId;
  /** Off: hidden when an object stands between the camera and the hotspot. Absent = always visible. */
  alwaysVisible?: boolean;
  /** Enlarges the marker on hover. Absent = on. */
  hoverEffect?: boolean;
  /** Label look: title + subtitle card, or title only. */
  labelStyle?: 'card' | 'compact';
  /** Pulsing ring that draws attention. */
  pulse?: boolean;
  /** Equipment sheet: label / value lines. */
  specs?: { label: string; value: string }[];
  /** "En savoir plus" button (https URL). */
  moreUrl?: string;
  /** Form: fields shown to the visitor; the answer is sent by e-mail from the visitor's mail app. */
  form?: { recipient?: string; subject?: string; fields: HotspotFormField[] };
};

/** Position on a plan, normalized to the plan image (0..1 on each axis). */
export type PlanPoint = { x: number; y: number };
export type PlanMarker = PlanPoint & {
  sceneId: string;
  /** Hidden from visitors (still shown, faded, in the Studio). */
  hidden?: boolean;
  color?: string;
};
/** Plan pin that opens an existing hotspot (goes to its scene first). */
export type PlanHotspotPin = PlanPoint & { id: string; hotspotId: string };
/** Named rectangular area (normalized x, y, width, height). */
export type PlanZone = PlanPoint & { id: string; w: number; h: number; label: string; color: string };
export type PlanText = PlanPoint & { id: string; text: string };

export type FloorPlan = {
  id: string;
  name: string;
  /** Image from the media library (plan drawing, export, scan…). */
  imageFileId?: string;
  order: number;
  markers: PlanMarker[];
  texts: PlanText[];
  hotspotPins?: PlanHotspotPin[];
  zones?: PlanZone[];
  /**
   * Real-world scale, set by the user from two points and a known distance.
   * Without it, no distance is ever presented as a measurement.
   */
  calibration?: { a: PlanPoint; b: PlanPoint; meters: number };
};

export type TourStep = {
  id: string;
  sceneId: string;
  title: string;
  text?: string;
  /** Camera orientation shown at this step (defaults to the scene's initial view). */
  view?: SceneView;
  durationS: number;
};

export type GuidedTour = { id: string; name: string; steps: TourStep[] };

/** Visitor-facing look of the tour (published with it). */
export type Appearance = {
  accent?: string;
  logoFileId?: string;
  welcome?: { enabled: boolean; title?: string; text?: string };
  /** Viewer controls shown to visitors (all shown by default). */
  controls?: { plan?: boolean; scenes?: boolean; share?: boolean; fullscreen?: boolean; tours?: boolean };
};

/** Note placed in a scene. Studio-only notes are for the team and never shown to visitors. */
export type Annotation = {
  id: string;
  sceneId: string;
  text: string;
  position: Vec3;
  color?: string;
  visibility: 'studio' | 'public';
};

export type SceneTransition = 'fade' | 'none';

/** Navigation point placed in `sceneId` that leads to `targetSceneId`. A two-way connection is two points sharing `pairId`. */
export type NavLink = {
  id: string;
  sceneId: string;
  targetSceneId: string;
  position: Vec3;
  label?: string;
  pairId?: string;
  transition: SceneTransition;
  durationMs: number;
  /** Animated arrow on the floor below the point. */
  showArrow: boolean;
  /** Target marker (pin + label). Absent = shown. At least one of arrow / target stays visible. */
  showTarget?: boolean;
};

export type ProjectStatus = 'draft' | 'published';

export type ProjectType = 'real-estate' | 'logistics' | 'laboratory' | 'industry' | 'other';

export type ProjectDoc = {
  id: string;
  name: string;
  /** Kind of place, used for dashboard breakdowns (optional for older projects). */
  type?: ProjectType;
  description?: string;
  /** Monotonic revision used for conflict detection between tabs/sessions. */
  revision: number;
  status: ProjectStatus;
  publishedRevision?: number;
  publishedAt?: string;
  /** unlisted = link only; public = also listed in the visitor gallery (server-owned). */
  visibility?: 'unlisted' | 'public';
  /** Owning organization (server-owned). */
  organizationId?: string;
  scenes: Scene[];
  assets: Asset3D[];
  objects: SceneObject3D[];
  /** Favorite asset ids (built-in and imported). */
  favorites: string[];
  settings: { autosaveSeconds: number; homeSceneId?: string; appearance?: Appearance };
  annotations?: Annotation[];
  /** Share settings of the publication (server-owned, read-only in the document). */
  share?: { protected: boolean; expiresAt?: string };
  hotspots?: Hotspot[];
  floorPlans?: FloorPlan[];
  guidedTours?: GuidedTour[];
  navigation?: NavLink[];
  createdAt: string;
  updatedAt: string;
};
