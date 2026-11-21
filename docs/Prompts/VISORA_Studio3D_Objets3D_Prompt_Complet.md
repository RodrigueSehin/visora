# VISORA Studio 3D --- Module Objets 3D

## Prompt complet de conception et de développement

> **Mission :** Concevoir et développer le module **Objets 3D** de
> VISORA Studio 3D, une plateforme SaaS de création, d'édition et de
> publication de visites immersives et d'environnements spatiaux
> interactifs.\
> Le module doit être un véritable éditeur 3D fonctionnel, intégré au
> Studio, avec une UX professionnelle, premium, moderne et cohérente
> avec l'identité VISORA.

------------------------------------------------------------------------

## 1. Contexte produit

VISORA permet de créer des visites immersives de lieux à partir de
médias et de reconstruction spatiale assistée par IA. Les projets
peuvent concerner notamment :

-   Immobilier et bâtiments
-   Entrepôts et logistique
-   Industrie et usines
-   Bureaux et espaces professionnels
-   Hôtels, tourisme et showroom
-   Établissements scolaires et lieux de formation
-   Laboratoires et espaces techniques

Le module **Objets 3D** permet d'ajouter, positionner, transformer,
organiser et configurer des objets 3D dans les scènes du projet. Il
complète les modules Scènes, Navigation, Hotspots, Médias, Plan 2D,
Annotations, Parcours guidé, Apparence et Paramètres.

### Principes essentiels

1.  Développer une fonctionnalité réelle, pas une simple image ou
    interface statique.
2.  Respecter l'architecture et les conventions existantes du projet.
3.  Ne pas casser les modules existants.
4.  Réutiliser les composants, design tokens, services et modèles de
    données existants.
5.  Rendre les interactions cohérentes entre le viewport 3D, la
    bibliothèque, la hiérarchie et l'inspecteur.
6.  Sauvegarder les modifications de manière persistante.
7.  Prévoir une expérience responsive, tout en privilégiant le desktop
    pour l'édition 3D.
8.  Optimiser le chargement et le rendu des assets pour le Web.
9.  Ne pas afficher de données fictives comme si elles étaient
    réellement sauvegardées.
10. Toute action visible dans l'interface doit fonctionner ou être
    clairement indiquée comme indisponible.

------------------------------------------------------------------------

## 2. Identité visuelle et UX

Créer une interface de logiciel professionnel 3D avec un style **Premium
Spatial Editor**.

### Palette de référence

-   Midnight Navy : `#101827`
-   Deep Navy : `#18263B`
-   Surface Navy : `#1D2B43`
-   Spatial Cyan : `#36C8F4`
-   AI Violet : `#7868F5`
-   Success : vert
-   Warning : orange
-   Danger : rouge

### Style

-   Interface sombre, élégante et technologique
-   Panneaux avec contrastes subtils
-   Bordures discrètes
-   États actifs avec accent cyan/bleu
-   Violet réservé aux fonctions IA ou actions avancées
-   Typographie moderne et lisible
-   Icônes cohérentes
-   Tooltips sur les actions
-   Transitions discrètes et rapides
-   Densité adaptée à un outil professionnel
-   Pas de décoration excessive
-   Éviter les interfaces génériques d'administration

### Layout desktop

Organiser l'écran avec :

1.  **Barre supérieure**
2.  **Navigation principale verticale**
3.  **Bibliothèque d'objets à gauche**
4.  **Viewport 3D central**
5.  **Inspecteur de propriétés à droite**
6.  **Barre d'outils contextuelle / transformations**
7.  **Filmstrip ou sélecteur de scènes si utile**
8.  **Barre de statut en bas**

Prévoir la possibilité de réduire ou masquer les panneaux afin de
libérer l'espace du viewport.

------------------------------------------------------------------------

## 3. Barre supérieure du Studio

Afficher :

-   Logo VISORA
-   Libellé Studio 3D
-   Nom du projet
-   Statut du projet : Brouillon, Modifié, Enregistré, Publié
-   Undo
-   Redo
-   Aperçu de la visite
-   Enregistrer
-   Publier / Mettre à jour
-   Menu complémentaire

### Comportements

-   Afficher un état « Modifications non enregistrées » après
    modification.
-   Désactiver Undo/Redo lorsque l'historique est vide.
-   Afficher un feedback de sauvegarde.
-   Prévenir l'utilisateur avant de quitter avec des modifications non
    sauvegardées.
-   La publication ne doit pas être confondue avec la sauvegarde.

------------------------------------------------------------------------

## 4. Navigation principale Studio 3D

La navigation latérale doit conserver la structure globale VISORA Studio
:

-   Scènes
-   Navigation
-   Hotspots
-   Médias
-   Plan 2D
-   **Objets 3D** (élément actif)
-   Annotations
-   Parcours guidé
-   Apparence
-   Paramètres

Le module Objets 3D doit s'intégrer sans remplacer ni dégrader les
autres modules.

------------------------------------------------------------------------

## 5. Bibliothèque d'objets 3D

Créer une bibliothèque d'assets accessible depuis le panneau gauche.

### 5.1 Catégories

-   Tous
-   Équipements industriels
-   Mobilier
-   Éléments décoratifs
-   Modèles importés
-   Signalétique
-   Éclairage
-   Véhicules
-   Sécurité
-   Architecture
-   Autres

### 5.2 Exemples d'assets

**Industrie / Logistique** - Chariot élévateur - Rack industriel -
Palette - Transpalette - Convoyeur - Machine industrielle - Conteneur -
Caisse / carton - Quai de chargement - Équipement de manutention

**Mobilier** - Bureau - Chaise - Table de réunion - Armoire - Canapé -
Étagère - Comptoir

**Sécurité** - Cône - Barrière - Extincteur - Panneau de sécurité -
Caméra de surveillance - Poste de contrôle

**Décor** - Plante - Luminaire - Objet décoratif - Panneau - Accessoire

### 5.3 Affichage des assets

Chaque asset doit être présenté sous forme de carte comprenant :

-   Thumbnail ou preview 3D
-   Nom
-   Catégorie
-   Format
-   Taille du fichier si connue
-   Badge « Importé » si asset utilisateur
-   Badge « Favori » si marqué
-   Menu contextuel

Prévoir les modes :

-   Grille
-   Liste, si pertinent

### 5.4 Recherche et filtres

-   Recherche par nom
-   Filtre catégorie
-   Filtre format
-   Filtre assets importés
-   Filtre favoris
-   Tri par nom
-   Tri par date
-   Tri par taille
-   Tri par catégorie

### 5.5 Actions bibliothèque

-   Prévisualiser
-   Ajouter à la scène
-   Ajouter par drag-and-drop
-   Marquer en favori
-   Importer
-   Remplacer l'asset
-   Renommer l'asset
-   Supprimer de la bibliothèque (avec confirmation)
-   Dupliquer une ressource si autorisé

------------------------------------------------------------------------

## 6. Import de modèles 3D

Créer un workflow d'import clair.

### Formats cibles

Priorité Web :

-   GLB
-   GLTF

Formats additionnels selon les capacités du pipeline :

-   OBJ
-   FBX
-   STL
-   USD / USDZ, si supporté par la stack choisie

### Workflow

1.  Sélectionner ou glisser-déposer un fichier.
2.  Valider le format.
3.  Afficher la taille et les informations disponibles.
4.  Charger le modèle.
5.  Afficher un aperçu.
6.  Vérifier les dimensions et le nombre de meshes si possible.
7.  Proposer une optimisation si l'asset est trop lourd.
8.  Permettre de définir le nom, la catégorie et les tags.
9.  Ajouter à la bibliothèque.
10. Ajouter à la scène ou conserver dans la bibliothèque.

### Gestion des erreurs

Afficher des messages explicites pour :

-   Format non pris en charge
-   Fichier corrompu
-   Import échoué
-   Asset trop volumineux
-   Textures manquantes
-   Erreur de parsing
-   Temps de chargement dépassé

Ne jamais faire disparaître silencieusement un fichier en échec.

------------------------------------------------------------------------

## 7. Viewport 3D

Le viewport est la zone centrale principale.

### 7.1 Modes d'affichage

-   Vue 3D
-   Vue immersive / caméra
-   Vue 360° si applicable
-   Plan 2D
-   Mode visiteur / preview

### 7.2 Contrôle caméra

Prendre en charge les contrôles habituels de viewport :

-   Rotation de caméra
-   Pan
-   Zoom
-   Focus sur sélection
-   Vue précédente / suivante si possible
-   Réinitialisation caméra
-   Vue de dessus
-   Vue frontale
-   Vue latérale
-   Vues preset

Afficher des tooltips pour les commandes et les raccourcis.

### 7.3 Sélection d'objets

-   Cliquer sur un objet pour le sélectionner.
-   Afficher un contour ou highlight.
-   Afficher le gizmo de transformation.
-   Synchroniser la sélection avec l'inspecteur.
-   Synchroniser la sélection avec la hiérarchie.
-   Permettre la sélection multiple avec les commandes usuelles.
-   Permettre de désélectionner.
-   Éviter que les hotspots et points de navigation soient confondus
    avec les objets 3D.

### 7.4 Affichage des overlays

Pouvoir afficher ou masquer :

-   Grille
-   Axes
-   Gizmos
-   Hotspots
-   Points de navigation
-   Annotations
-   Zones
-   Objets
-   Labels
-   Mesures

------------------------------------------------------------------------

## 8. Ajouter un objet dans la scène

Prendre en charge plusieurs méthodes :

### Méthode A --- Drag & drop

L'utilisateur fait glisser un asset de la bibliothèque vers le viewport.

-   Créer un preview temporaire
-   Positionner l'objet au point ciblé
-   Snap au sol par défaut si applicable
-   Confirmer le placement au relâchement
-   Annuler avec Escape

### Méthode B --- Ajouter

Depuis une carte de la bibliothèque :

-   Cliquer sur « Ajouter »
-   Insérer l'objet à une position par défaut pertinente
-   Sélectionner automatiquement l'objet
-   Ouvrir ou synchroniser l'inspecteur

### Méthode C --- Import puis placement

Après import, permettre d'ajouter l'asset dans la scène actuelle.

------------------------------------------------------------------------

## 9. Transformations 3D

L'objet sélectionné doit pouvoir être transformé.

### 9.1 Déplacer

-   Axe X
-   Axe Y
-   Axe Z
-   Gizmo de déplacement
-   Champs numériques
-   Déplacement libre
-   Snap à la grille
-   Snap au sol
-   Snap aux surfaces si techniquement disponible

### 9.2 Rotation

-   Rotation X
-   Rotation Y
-   Rotation Z
-   Gizmo de rotation
-   Champs numériques
-   Snap angulaire configurable, par exemple 15° ou 45°

### 9.3 Échelle

-   Échelle X, Y, Z
-   Échelle uniforme
-   Échelle non uniforme
-   Option « Conserver les proportions »
-   Réinitialisation de l'échelle

### 9.4 Outils contextuels

Afficher une barre d'outils au-dessus ou à proximité de l'objet
sélectionné :

-   Déplacer
-   Tourner
-   Redimensionner
-   Dupliquer
-   Supprimer
-   Plus d'actions

Le tool doit indiquer clairement le mode de transformation actif.

------------------------------------------------------------------------

## 10. Inspecteur de propriétés

Le panneau droit affiche les propriétés de l'objet sélectionné.

### Onglets recommandés

-   Général
-   Transformations
-   Style
-   Interactions
-   Avancé

### 10.1 Général

-   Nom
-   Description
-   Catégorie
-   Asset source
-   Tags
-   Visibilité
-   Objet verrouillé / déverrouillé
-   Favori, si pertinent

### 10.2 Transformations

-   Position X / Y / Z
-   Rotation X / Y / Z
-   Échelle X / Y / Z
-   Échelle uniforme
-   Dimensions calculées, si disponibles
-   Origine / pivot
-   Réinitialiser les transformations

### 10.3 Style / matériaux

Selon les capacités du moteur :

-   Matériau
-   Couleur
-   Opacité
-   Roughness
-   Metallic
-   Texture
-   Emissive
-   Réinitialiser le style

Ne proposer que les contrôles réellement supportés par le modèle et le
moteur.

### 10.4 Interactions

Permettre de configurer des comportements :

-   Aucun
-   Afficher un hotspot d'information
-   Ouvrir une fiche détaillée
-   Ouvrir un document
-   Lire une vidéo
-   Naviguer vers une scène
-   Ouvrir un lien
-   Déclencher une action compatible

Les interactions doivent être reliées au système Hotspots et aux actions
VISORA existantes, plutôt que d'inventer un système parallèle.

### 10.5 Avancé

-   Identifiant
-   Source / asset
-   Visible dans la visite
-   Visible dans Studio uniquement
-   Cast shadows, si supporté
-   Receive shadows, si supporté
-   LOD, si supporté
-   Optimisation
-   Options techniques disponibles

------------------------------------------------------------------------

## 11. Hiérarchie et organisation des objets

Prévoir un système d'organisation permettant :

-   Liste des objets présents dans la scène
-   Nom et icône
-   Type / catégorie
-   Visibilité
-   Verrouillage
-   Sélection
-   Recherche
-   Renommage
-   Groupement
-   Dégroupement
-   Parent / enfant si supporté
-   Réorganisation
-   Duplication
-   Suppression

### Sélection synchronisée

La sélection dans la hiérarchie doit sélectionner le même objet dans le
viewport.

La sélection dans le viewport doit mettre à jour la hiérarchie et
l'inspecteur.

### Actions en lot

Pour une sélection multiple :

-   Déplacer
-   Dupliquer
-   Supprimer
-   Grouper
-   Masquer
-   Verrouiller

Ne permettre que les actions compatibles avec la sélection.

------------------------------------------------------------------------

## 12. Snapping et placement intelligent

Prévoir des options de placement :

-   Snap à la grille
-   Snap au sol
-   Snap aux objets
-   Snap aux surfaces
-   Alignement
-   Distribution
-   Rotation incrémentale
-   Placement centré
-   Placement à l'origine

Les options doivent être activables/désactivables depuis les outils ou
les paramètres du viewport.

------------------------------------------------------------------------

## 13. Objets et scènes

Les objets sont associés à une scène.

Le système doit :

-   Identifier la scène active
-   Afficher uniquement les objets de la scène, sauf vue globale
-   Permettre le changement de scène
-   Préserver les objets propres à chaque scène
-   Permettre la duplication d'un objet dans une autre scène si demandé
-   Gérer les assets réutilisés sans dupliquer inutilement le fichier
    source

Si l'architecture le permet, séparer :

-   Asset de bibliothèque
-   Instance d'objet dans une scène
-   Transformations de l'instance
-   Propriétés propres à l'instance

------------------------------------------------------------------------

## 14. Undo / Redo

Ajouter un historique fiable pour les opérations :

-   Ajouter un objet
-   Importer
-   Déplacer
-   Tourner
-   Échelle
-   Renommer
-   Modifier les propriétés
-   Modifier le style
-   Dupliquer
-   Supprimer
-   Grouper / dégrouper
-   Masquer / afficher
-   Verrouiller / déverrouiller

Undo et Redo doivent restaurer l'état des objets et synchroniser le
viewport, la hiérarchie et l'inspecteur.

------------------------------------------------------------------------

## 15. Sauvegarde et persistance

Les changements doivent être persistants.

### À sauvegarder

-   Assets référencés
-   Instances
-   Transformations
-   Nom
-   Description
-   Catégorie
-   Visibilité
-   Verrouillage
-   Groupes / hiérarchie
-   Interactions
-   Paramètres de style
-   Scene ID
-   Ordre / organisation

### UX de sauvegarde

-   Autosave configurable
-   Bouton sauvegarder
-   Indicateur de sauvegarde
-   État « Modifié »
-   Gestion des erreurs
-   Retry
-   Prévention de perte de données
-   Confirmation en cas de conflit

Ne simuler la sauvegarde que si le backend est réellement indisponible,
et indiquer clairement le mode local/démo.

------------------------------------------------------------------------

## 16. Performance 3D et optimisation Web

Prévoir :

-   Chargement asynchrone
-   Progression de chargement
-   Cache d'assets
-   Compression
-   Optimisation des textures
-   Limitation du nombre de draw calls si possible
-   Gestion des meshes
-   LOD si disponible
-   Frustum culling
-   Occlusion culling si supporté
-   Instancing pour les objets répétés
-   Gestion de la mémoire
-   Nettoyage des ressources lors de la suppression ou du changement de
    scène
-   Limitation des assets très lourds
-   Fallback lorsque WebGL/WebGPU n'est pas disponible

Ne pas charger toutes les ressources simultanément.

------------------------------------------------------------------------

## 17. Responsive et accessibilité

### Desktop

Optimiser le layout pour une résolution professionnelle, notamment 1440
px et plus.

### Tablette

-   Panneaux repliables
-   Viewport prioritaire
-   Inspecteur en panneau overlay
-   Contrôles adaptés

### Mobile

Le mobile est principalement destiné à la visualisation et aux
ajustements simples.

-   Navigation simplifiée
-   Viewport plein écran
-   Inspecteur en drawer
-   Contrôles tactiles
-   Actions principales accessibles
-   Éviter les outils de transformation trop complexes sur petit écran

### Accessibilité

-   Contraste suffisant
-   Focus clavier
-   Labels explicites
-   Tooltips
-   Navigation clavier lorsque possible
-   Ne pas dépendre uniquement de la couleur

------------------------------------------------------------------------

## 18. Architecture technique --- recommandations

Adapter ces recommandations au stack réellement présent dans le projet.

### Frontend

-   React
-   TypeScript
-   Next.js si déjà utilisé
-   Tailwind CSS
-   Composants UI existants (Fluent UI, shadcn ou design system du
    projet)

### 3D Web

Évaluer la stack actuelle avant d'ajouter des dépendances.

Options possibles :

-   Three.js
-   React Three Fiber
-   Drei

### Services

-   Service bibliothèque assets
-   Service import
-   Service scene objects
-   Service transforms
-   Service persistence
-   Service history / undo-redo
-   Service optimization
-   Service interactions

Ne pas créer de nouvelle architecture incompatible avec le projet
existant.

------------------------------------------------------------------------

## 19. Modèle de données --- exemple de structure

Adapter aux modèles existants.

### Asset de bibliothèque

``` ts
type Asset3D = {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  category: string;
  sourceFileId: string;
  format: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  tags?: string[];
  fileSize?: number;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
};
```

### Instance d'objet de scène

``` ts
type SceneObject3D = {
  id: string;
  sceneId: string;
  assetId: string;
  name: string;
  description?: string;
  category?: string;

  position: {
    x: number;
    y: number;
    z: number;
  };

  rotation: {
    x: number;
    y: number;
    z: number;
  };

  scale: {
    x: number;
    y: number;
    z: number;
  };

  visible: boolean;
  locked: boolean;
  uniformScale?: boolean;

  interaction?: {
    type: string;
    targetId?: string;
    config?: Record<string, unknown>;
  };

  style?: Record<string, unknown>;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
};
```

Ces structures sont des exemples. Ne pas les appliquer aveuglément si le
projet possède déjà un modèle équivalent.

------------------------------------------------------------------------

## 20. Composants UI attendus

Construire des composants réutilisables selon l'architecture existante :

-   `ObjectLibraryPanel`
-   `ObjectLibrarySearch`
-   `ObjectCategoryFilter`
-   `ObjectAssetCard`
-   `ObjectAssetPreview`
-   `ObjectImportDialog`
-   `Scene3DViewport`
-   `ObjectSelectionGizmo`
-   `ObjectTransformToolbar`
-   `ObjectHierarchyPanel`
-   `ObjectPropertiesInspector`
-   `ObjectGeneralProperties`
-   `ObjectTransformProperties`
-   `ObjectStyleProperties`
-   `ObjectInteractionProperties`
-   `ObjectAdvancedProperties`
-   `ObjectContextMenu`
-   `ObjectMultiSelectionToolbar`
-   `AssetLoadingIndicator`
-   `ObjectStatusBar`

Renommer ou regrouper selon les conventions du code existant.

------------------------------------------------------------------------

## 21. États UX à traiter

Créer les états suivants :

-   Bibliothèque chargée
-   Bibliothèque vide
-   Recherche sans résultat
-   Import en cours
-   Import réussi
-   Import échoué
-   Viewport en chargement
-   Objet sélectionné
-   Aucun objet sélectionné
-   Plusieurs objets sélectionnés
-   Objet verrouillé
-   Asset indisponible
-   Texture manquante
-   Erreur WebGL
-   Modifications non sauvegardées
-   Sauvegarde en cours
-   Sauvegarde réussie
-   Sauvegarde échouée
-   Suppression avec confirmation

------------------------------------------------------------------------

## 22. Sécurité et fiabilité

-   Valider les fichiers importés côté client et serveur.
-   Vérifier les extensions et MIME types.
-   Limiter les tailles selon les règles du produit.
-   Ne pas exécuter de contenu importé.
-   Contrôler les accès projet.
-   Vérifier les droits avant suppression ou modification.
-   Protéger les assets privés.
-   Ne pas exposer les chemins internes de stockage.
-   Prévoir la suppression logique si nécessaire.
-   Confirmer les actions destructives.
-   Gérer les imports interrompus.

------------------------------------------------------------------------

## 23. Critères d'acceptation

Le module est considéré comme fonctionnel lorsque :

-   [ ] La bibliothèque affiche les assets disponibles.
-   [ ] Les catégories et filtres fonctionnent.
-   [ ] La recherche fonctionne.
-   [ ] Un asset peut être prévisualisé.
-   [ ] Un asset peut être ajouté dans la scène.
-   [ ] Le drag-and-drop fonctionne, si retenu.
-   [ ] L'objet peut être sélectionné dans le viewport.
-   [ ] La sélection synchronise l'inspecteur.
-   [ ] L'objet peut être déplacé.
-   [ ] L'objet peut être tourné.
-   [ ] L'objet peut être redimensionné.
-   [ ] Les transformations numériques sont éditables.
-   [ ] L'échelle uniforme est disponible.
-   [ ] L'objet peut être dupliqué.
-   [ ] L'objet peut être supprimé avec confirmation.
-   [ ] L'objet peut être renommé.
-   [ ] La visibilité peut être contrôlée.
-   [ ] Le verrouillage fonctionne.
-   [ ] Undo/Redo fonctionne sur les opérations majeures.
-   [ ] Les objets sont associés à la scène active.
-   [ ] Les changements sont persistés.
-   [ ] Les erreurs sont présentées à l'utilisateur.
-   [ ] Le viewport reste performant avec plusieurs objets.
-   [ ] L'interface respecte le design VISORA.
-   [ ] Le module ne casse pas les autres sections du Studio.

------------------------------------------------------------------------

## 24. Plan de réalisation recommandé

### Phase 1 --- Audit

-   Inspecter l'architecture existante
-   Identifier le moteur 3D
-   Identifier les modèles Scene, Asset, Project
-   Identifier le stockage
-   Identifier les composants UI réutilisables
-   Identifier les fonctions déjà disponibles

### Phase 2 --- Interface

-   Layout
-   Bibliothèque
-   Viewport
-   Inspecteur
-   Toolbar
-   Hierarchie
-   Responsive

### Phase 3 --- Fonctionnalités de base

-   Sélection
-   Ajout
-   Déplacement
-   Rotation
-   Échelle
-   Duplication
-   Suppression
-   Renommage
-   Visibilité
-   Verrouillage

### Phase 4 --- Import

-   GLB / GLTF
-   Preview
-   Validation
-   Gestion des erreurs
-   Assets utilisateur
-   Optimisation de base

### Phase 5 --- Persistance et historique

-   Sauvegarde
-   Autosave
-   Undo/Redo
-   Gestion des conflits
-   Synchronisation

### Phase 6 --- Interactions avancées

-   Snapping
-   Groupes
-   Hiérarchie
-   Style / matériaux
-   Interactions liées aux hotspots
-   Optimisation avancée

### Phase 7 --- Tests

-   Tests UI
-   Tests transformations
-   Tests persistance
-   Tests import
-   Tests performance
-   Tests responsive
-   Tests régression Studio

------------------------------------------------------------------------

## 25. Livrables demandés à l'agent

1.  Audit rapide de l'existant et des composants réutilisables.
2.  Proposition d'architecture courte, uniquement si nécessaire.
3.  Développement complet du module Objets 3D.
4.  Intégration au Studio 3D existant.
5.  Composants réutilisables.
6.  Fonctionnalités réelles avec états UX.
7.  Persistance réelle selon backend existant.
8.  Gestion des erreurs.
9.  Tests des fonctionnalités majeures.
10. Documentation courte sur les fichiers créés ou modifiés.

### Règles de travail

-   Commencer par inspecter le projet.
-   Ne pas réécrire toute l'application.
-   Ne pas supprimer les fonctionnalités existantes.
-   Ne pas remplacer le backend sans justification.
-   Ne pas laisser les boutons principaux inactifs.
-   Ne pas utiliser des données statiques pour simuler une
    fonctionnalité persistante.
-   Utiliser des données de démonstration uniquement si l'application
    possède explicitement un mode démo.
-   Respecter les conventions et le style du code existant.
-   Utiliser des composants réutilisables.
-   Garder un code TypeScript propre et maintenable.
-   Traiter les erreurs et les états de chargement.
-   Tester les interactions avant de déclarer le module terminé.

------------------------------------------------------------------------

## 26. Résultat attendu

Livrer un module **VISORA Studio 3D → Objets 3D** premium, cohérent avec
le reste de VISORA Studio, permettant à un créateur de :

1.  Parcourir une bibliothèque d'objets 3D.
2.  Importer ses propres assets.
3.  Prévisualiser les objets.
4.  Ajouter des objets dans une scène.
5.  Les sélectionner dans le viewport.
6.  Les déplacer, tourner et redimensionner.
7.  Configurer leurs propriétés.
8.  Les organiser et les dupliquer.
9.  Leur associer des interactions.
10. Sauvegarder et retrouver les modifications.
11. Prévisualiser le résultat dans la visite immersive.

**Priorité absolue :** expérience utilisateur fluide, manipulations 3D
fiables, cohérence visuelle, persistance des données, performance Web et
intégration propre avec VISORA Studio 3D.
