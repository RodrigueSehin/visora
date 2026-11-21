# VISORA — Prompt complet : AI Image-to-Scene / Spatial Reconstruction

## 1. Contexte et vision

VISORA est une plateforme SaaS premium pour capturer, reconstruire, éditer, publier et explorer des espaces immersifs et spatiaux. La fonctionnalité **AI Image-to-Scene** transforme une ou plusieurs photos, panoramas ou sources compatibles d'un lieu en scène spatiale structurée et éditable. L'utilisateur ne doit pas obtenir uniquement une image 3D : il doit pouvoir sélectionner et manipuler les objets indépendamment.

**Identité VISORA**
- Slogan : *Explore spaces. From anywhere.*
- Direction : premium, moderne, professionnelle, spatiale, futuriste mais lisible.
- Palette : Midnight `#101827`, Deep Navy `#18263B`, Spatial Cyan `#36C8F4`, AI Violet `#7868F5`.
- Dark-first, responsive, panels sobres, typographie claire, micro-interactions discrètes, accents cyan pour les outils spatiaux et violet pour les fonctions IA.

Cibles : immobilier, architecture, hôtels, commerce, bureaux, industrie, logistique, éducation, espaces techniques, showroom, facility management.

## 2. Objectif fonctionnel

Permettre à l'utilisateur de :
1. importer une photo ou plusieurs photos d'une pièce ou d'un espace ;
2. choisir un type d'espace et un mode de reconstruction ;
3. lancer une analyse IA multimodale ;
4. détecter, classifier et segmenter les éléments visibles ;
5. estimer profondeur, structure et placement lorsque les technologies disponibles le permettent ;
6. reconstruire une structure spatiale et créer des objets 3D séparés ;
7. examiner, corriger, accepter ou refuser les détections ;
8. déplacer, tourner, redimensionner, supprimer, dupliquer, remplacer et modifier les objets ;
9. sauvegarder et rouvrir la scène ;
10. transférer la scène dans VISORA Studio pour hotspots, navigation, annotations, plan, parcours guidé, preview et publication.

## 3. Principes de vérité, qualité et provenance

Une reconstruction à partir d'une seule image ne peut pas connaître précisément les dimensions, les parties cachées ni la géométrie hors champ. Ne jamais présenter des dimensions estimées comme exactes. Ne pas inventer silencieusement ce qui n'est pas visible. Permettre à l'utilisateur d'ajouter d'autres angles, une référence dimensionnelle ou un plan pour améliorer la reconstruction.

Afficher les indicateurs de provenance :
- **Capturé** : directement visible dans la source.
- **Reconstruit** : géométrie reconstruite/déduite.
- **Estimé** : dimensions, placement ou géométrie approximative.
- **Généré par IA** : élément inventé/complété par IA.
- **Calibré** : ajusté à l'aide d'une référence réelle.

Afficher les scores de confiance/qualité uniquement lorsqu'ils sont réellement calculés. Les objets placeholders ou proxy doivent être clairement signalés et remplaçables.

## 4. Sources et modes

Sources supportées selon capacités réelles :
- image unique (JPEG, PNG, WebP) ;
- photos multiples prises sous différents angles ;
- panorama 360° ;
- vidéo ;
- plan architectural 2D ;
- modèle 3D existant (GLB/glTF ou formats importables convertis).

Modes à présenter :
1. **Photo → Scène spatiale** : reconstruction simplifiée d'une photo.
2. **Photos multiples → Reconstruction améliorée** : plusieurs angles pour aider à la cohérence et à la géométrie.
3. **Panorama → Espace immersif** : panorama comme environnement immersif et/ou source de reconstruction.
4. **Plan → Structure spatiale** : surfaces, espaces, ouvertures à partir d'un plan (si disponible).
5. **Vidéo → Reconstruction** : extraction de frames et reconstruction (si disponible).

Ne rendre visibles comme modes opérationnels que les capacités réellement implémentées. Les modes futurs peuvent être identifiés « Bientôt disponible ».

## 5. Workflow produit

### Étape 1 — Source
- Écran « Transformer une image en scène ».
- Dropzone, sélection fichiers, preview, ajouter plusieurs angles, retirer/remplacer.
- Afficher format, taille, dimensions, durée, statut et validation média.
- Choisir le type d'espace : séjour, chambre, cuisine, bureau, salle de bain, showroom, entrepôt, espace industriel, autre.
- Description/contexte optionnel.
- Conseils de prise de vue : bonne luminosité, cadrage de la pièce, réduire occlusions, plusieurs angles si possible.
- CTA « Analyser les médias ».

### Étape 2 — Analyse IA
Stages potentiels, uniquement si réellement exécutés :
- validation et préparation ;
- analyse visuelle ;
- identification du type d'espace ;
- détection/classification ;
- segmentation ;
- estimation de profondeur ;
- analyse structure (murs, sol, plafond, portes, fenêtres) ;
- recherche/génération d'assets 3D ;
- placement spatial ;
- assemblage de scène ;
- optimisation ;
- contrôle qualité.

Pour chaque stage : statut (queued, running, done, warning, failed), progression, temps écoulé, durée estimée seulement si justifiable, message utilisateur, logs de diagnostic optionnels, cancel, retry et notifications. Persist les jobs ; ne pas simuler un pipeline réel sans le signaler.

### Étape 3 — Review des détections
Liste des objets avec miniature/masque, nom, catégorie, confidence si disponible, méthode envisagée, provenance et état de validation.

Catégories :
- Structure : murs, sol, plafond, portes, fenêtres, ouvertures.
- Mobilier : canapé, fauteuil, chaise, table, lit, armoire, meubles.
- Équipement : TV, électroménager, équipements.
- Éclairage : lampes et luminaires.
- Décoration : tapis, tableaux, plantes, accessoires.
- Autre / personnalisé.

Actions : accepter/refuser, accepter tout, renommer, changer catégorie, corriger position, fusionner/séparer si pris en charge, remplacer asset, rechercher dans bibliothèque, demander une variante/génération si disponible. Afficher une image source avec overlays/segmentation togglables.

### Étape 4 — Reconstruction
Créer, selon capacités réelles : structure de pièce, surfaces, objets indépendants, placement initial, matériaux, textures, lumière et caméra. Chaque objet garde sa provenance et sa méthode : asset bibliothèque, asset importé, génération IA, géométrie procédurale, proxy/placeholder.

### Étape 5 — Review & Edit
Viewport 3D et outils d'édition. Permettre selection, Move, Rotate, Scale, snapping optionnel, undo/redo, duplication, delete, lock/unlock, hide/show, grouping si disponible, replacement d'asset, matériaux/couleurs, visibilité des couches, reset, save/autosave et retour aux étapes précédentes.

### Étape 6 — Transfert
CTA « Ouvrir dans VISORA Studio ». La scène devient un projet spatial VISORA et permet d'ajouter hotspots, navigation, annotations, plan 2D, parcours guidé, branding, preview, publication, partage et analytics.

## 6. UX / écrans à concevoir

### 6.1 Entrée
Ajouter la fonctionnalité dans le menu Créer, création de projet, module AI/Spatial et éventuellement Dashboard. Titre : **AI Image-to-Scene**. Sous-titre : « Transformez une photo en scène 3D éditable. »

### 6.2 Wizard
Étapes avec progression, sauvegarde et navigation : Source → Analyse → Détections → Reconstruction → Validation → Studio. Garder les écrans simples ; placer les détails techniques dans un panneau repliable.

### 6.3 Import
Dropzone généreuse, preview, import multiple, cartes des sources, validation, mode, type d'espace, conseils, action primaire.

### 6.4 Processing
Source visible, preview progressive si disponible, progression globale, timeline des stages, status badges, détails d'analyse, cancel/retry, notifications. L'état démo doit être explicitement étiqueté.

### 6.5 Review
Layout desktop recommandé :
- gauche : photo source avec overlays et toggles de détection ;
- centre : viewport de scène 3D ;
- droite : detections / Scene Explorer / Inspector ;
- bas : toolbar 3D et actions globales.

Responsive : panels repliables, drawers ou tabs ; éviter de compresser le viewport sur mobile.

### 6.6 Scene Explorer
Arbre hiérarchique :
- Structure : murs, sol, plafond, portes, fenêtres ;
- Mobilier ;
- Équipements ;
- Éclairage ;
- Décoration ;
- Objets personnalisés.

Chaque ligne : icône catégorie, nom, sélection, visibilité, lock, menu contextuel, état asset/proxy/reconstructed/generated. Rechercher, filtrer, grouper et replier les groupes si supporté.

### 6.7 Inspector
Sections/tabs : Général, Transform, Dimensions, Apparence, Source/Provenance.
- nom, catégorie ;
- position X/Y/Z ; rotation X/Y/Z ; scale X/Y/Z ;
- dimensions (largeur/profondeur/hauteur) ;
- couleur, matériau, texture ;
- visibilité, lock ;
- provenance, méthode, confiance/qualité lorsqu'elles existent.

Unités explicites. Les dimensions non calibrées doivent être étiquetées estimées.

### 6.8 Toolbar
Select, Move, Rotate, Scale, Measure (mesures calibrées ou marquées estimées), Camera, Top/Front/Side/Perspective, Grid, Snap, Undo, Redo, Reset view, Zoom to selection, Fullscreen.

## 7. Interactions de scène

- click sélection ;
- gizmo translation/rotation/scale ;
- duplication ;
- delete ;
- renommer ;
- couleur/material ;
- replacement par un asset ;
- hide/show ;
- lock/unlock ;
- group/ungroup si disponible ;
- multi-select si disponible ;
- focus/zoom sur sélection ;
- caméra orbit/pan/zoom ;
- undo/redo ;
- sauvegarde et autosave avec indicateur ;
- état unsaved changes ;
- comparaison source/résultat si possible.

Si aucun asset n'est disponible : proposer proxy/placeholder identifié, recherche library, import asset, génération IA si intégrée, ou ignorer.

## 8. Bibliothèque 3D

Prévoir recherche, catégories, filtres, favoris, tags, preview, dimensions, format, poids, qualité, licence, origine et usage.
Catégories : architecture, mobilier, électroménager, équipement, éclairage, décoration, végétation, industriel, véhicules, custom.
GLB/glTF privilégié pour web lorsque compatible. Vérifier licences et droits. Métadonnées de provenance/licence obligatoires pour assets importés ou catalogues externes.

## 9. Architecture technique cible

Pipeline asynchrone : frontend → API sécurisée → media service → orchestrator → queue → CPU/GPU workers → AI provider adapters → scene assembly → storage/database → frontend.

Composants conceptuels :
- VISORA Frontend ;
- API ;
- upload/media service ;
- AI orchestration ;
- queue/jobs ;
- workers CPU/GPU ;
- adapters/providers IA ;
- segmentation/depth/reconstruction/object generation ;
- scene assembly ;
- database ;
- object storage ;
- cache/CDN ;
- monitoring/logging.

Lifecycle configurable : `QUEUED → VALIDATING → ANALYZING → DETECTING → SEGMENTING → DEPTH_ESTIMATION → ASSET_GENERATION → SCENE_ASSEMBLY → OPTIMIZING → REVIEW_READY`. Ne pas afficher de stages fictifs. Supporter retries, cancellation, idempotency, progress events, timeout, erreurs, partial results, provider fallback selon politique, quotas, crédits et coûts.

Utiliser une abstraction provider pour vision, segmentation, depth, image-to-3D, text-to-3D, reconstruction et enhancement. Sélectionner les fournisseurs après vérification qualité, coûts, licences, disponibilité, latence et conditions d'usage. Ne pas prétendre qu'une intégration existe avant de l'avoir implémentée/configurée.

## 10. Modèle de données conceptuel

Adapter le schéma réel après audit et préserver les données existantes :
- `SpatialReconstructionJob`: tenant/project, status, progress, stage, provider/model, cost/credits, dates, error, retries, creator.
- `ReconstructionSource`: job, media, type, metadata, order.
- `SpatialAnalysis`: summary, room type, detected structure, depth reference, quality, confidence, metadata.
- `DetectedObject`: analysis/source, label, category, confidence, segmentation ref, bounding box, provenance, review status.
- `ObjectReconstruction`: detected object, method, asset, status, provider/model, quality, output ref.
- `SpatialScene`: project/job, name, version, scene data reference, status.
- `SceneStructure`: scene, structure type, geometry, transform, dimensions, provenance, confidence.
- `SceneObject`: scene, detection, asset, name, category, transform, dimensions, material, visibility, lock, provenance, confidence, status.
- `Object3DAsset`: tenant/global, name/category, file/preview refs, format, dimensions, polygon count, materials, license, origin, metadata.
- `SceneCalibration`: scene, reference type/value, calibration data, calibrator/date.
- `AIProcessingStage`: job, stage, status, progress, timestamps, log ref, error.
- `ReconstructionQuality`: scene, geometry/visual quality, completeness, confidence, warnings, evaluation metadata.

Prévoir tenant isolation, relations, index, validations, versioning/soft delete selon les conventions du codebase.

## 11. API/services — opérations conceptuelles

Routes à adapter aux conventions existantes :
- créer job ;
- ajouter/valider sources ;
- lancer analyse ;
- consulter job/status/progress ;
- récupérer détections ;
- review accept/refuse/correction ;
- lancer reconstruction ;
- récupérer scène ;
- modifier transforms/objets ;
- remplacer asset ;
- sauvegarder ;
- annuler/retry ;
- ouvrir/transférer vers Studio.

Exemples indicatifs :
- `POST /spatial/reconstruction-jobs`
- `POST /spatial/reconstruction-jobs/{id}/sources`
- `POST /spatial/reconstruction-jobs/{id}/analyze`
- `GET /spatial/reconstruction-jobs/{id}`
- `GET /spatial/reconstruction-jobs/{id}/detections`
- `POST /spatial/reconstruction-jobs/{id}/detections/review`
- `POST /spatial/reconstruction-jobs/{id}/reconstruct`
- `GET /spatial/scenes/{id}`
- `PATCH /spatial/scenes/{id}/objects/{objectId}`
- `POST /spatial/scenes/{id}/objects/{objectId}/replace`
- `POST /spatial/scenes/{id}/open-studio`

## 12. États UX

Tous les états doivent être conçus : empty, uploading, validating, queued, analyzing, reconstructing, completed, completed with warnings, partial result, failed, cancelled, retrying, no detections, missing asset, uncalibrated scene, saving, saved, unsaved changes, offline/network error. Chaque état doit avoir message, action utile et feedback clair.

## 13. Sécurité, privacy, multi-tenant

- Auth et permissions server-side.
- Isolation tenant des jobs, fichiers, assets privés et scènes.
- Validation MIME/extension/taille/dimensions ; scan de fichiers si approprié.
- Signed URLs et expiration si nécessaire.
- Rate limiting, quotas, crédits.
- Vérification accès aux assets.
- Audit des actions importantes.
- Rétention et suppression contrôlées.
- Protection des photos d'espaces privés.
- Ne pas exposer clés, prompts internes, logs sensibles ou médias privés via liens publics.
- Respect des règles de consentement/privacy du produit.

## 14. Performance

Optimiser assets web/mobile : polygon count, textures, taille GLB, draw calls, LOD/simplification si nécessaire, lazy loading, chargement progressif, CDN/cache pour assets publiés. Préserver la fluidité de l'éditeur. Limiter concurrence GPU selon quotas. Tester desktop/tablette/mobile.

## 15. Analytics

Événements possibles : job initiated, upload success/failure, job completed/failed, processing duration, source count, detected object count, accept/reject, scene created/edited, asset replaced, open Studio, publish. Suivre crédits et coûts, avec privacy et consentement.

## 16. Design system

- Midnight `#101827`, Deep Navy `#18263B`, Cyan `#36C8F4`, Violet `#7868F5`.
- UI premium, professionnelle, spatial, dark-first.
- Panels, surfaces et bordures discrètes ; hiérarchie typographique ; actions cyan ; AI violet ; status colors accessibles.
- Responsive, clavier, focus visible, contraste accessible.
- Animations discrètes et utiles.
- Ne pas sacrifier la lisibilité aux effets visuels.
- Réutiliser le design system VISORA et ses composants.

## 17. Critères d'acceptation MVP

1. Création d'un job de reconstruction.
2. Import et preview média.
3. Validation format/size.
4. Statut job persistant et observable.
5. Analyse avec détections structurées (ou demo mode explicitement étiqueté).
6. Review, correction, acceptation/refus des détections.
7. Scène contenant structure et objets indépendants.
8. Objets sélectionnables et transformables dans le Studio.
9. Transforms et changements persistés.
10. Scene sauvegardée et rouverte.
11. Transfert vers VISORA Studio.
12. Provenance/estimations clairement signalées.
13. Permissions et tenant isolation testées.
14. Aucun bouton décoratif/inactif sans indication.
15. Tests essentiels passent.

## 18. Tests

Functional : import valid/invalid/too large, multi-source, analysis success/partial/failure, retry/cancel, accept/reject detections, object move/rotate/scale, replace asset, save/reopen, transfer Studio.

Security : tenant cross-access denied, private media denied, upload validation, temporary URL expiry, edit permissions, audit.

UX : empty/progress/failure/warnings, mobile, keyboard, accessibility, save status.

## 19. Instructions à l'agent développeur

**Avant de coder :**
1. Auditer repository, stack, architecture, modèle de données, UI, auth, stockage média, jobs/workers et conventions.
2. Identifier les capacités VISORA existantes à réutiliser.
3. Vérifier les technologies et providers AI/3D réellement disponibles, leur qualité, prix, licence et contraintes.
4. Proposer une architecture intégrée, les fichiers à modifier, les migrations, les dépendances, les risques et un plan par phases.
5. Ne pas réécrire le projet inutilement.

**Pendant :**
- réutiliser les composants/design system ;
- implémenter progressivement ;
- types stricts et validation ;
- persister les états ;
- UX complète et erreurs ;
- aucun faux bouton ;
- si provider absent, adapter clairement et présenter un mode démo explicitement, sans le faire passer pour une reconstruction réelle ;
- préserver les fonctionnalités existantes ;
- tests au fil du développement.

**Après chaque phase :** lint, typecheck, tests et build selon le projet ; corriger ; rapporter résumé, fichiers, tests, limitations, configuration requise et prochaines étapes.

## 20. Livrables

- UX/UI complète ;
- wizard import ;
- écran de traitement ;
- review detections ;
- éditeur de scène ;
- Scene Explorer ;
- Inspector ;
- bibliothèque 3D ;
- pipeline AI async ;
- modèle de données et migrations ;
- API/services ;
- workers/jobs et tracking ;
- intégration Studio ;
- permissions/quota ;
- tests ;
- documentation technique et utilisateur.

## 21. Prompt final d'exécution

> Implémente dans VISORA une fonctionnalité premium **AI Image-to-Scene / Spatial Reconstruction** permettant de transformer une photo, plusieurs photos, un panorama ou toute source compatible en scène spatiale structurée et éditable. La scène doit contenir une structure de pièce et des objets 3D indépendants sélectionnables, déplaçables, rotatables, redimensionnables, supprimables, duplicables, remplaçables et modifiables.
>
> Respecte l'ensemble des exigences fonctionnelles, UX, techniques, de confiance, sécurité, performance, modèle de données, workflow et critères d'acceptation de ce document. Commence obligatoirement par auditer le repository et les capacités réellement présentes. Ne suppose pas qu'un provider AI, une reconstruction 3D ou une bibliothèque d'assets est déjà connecté. Distingue strictement fonctionnalités réelles, prototypes et simulations. Propose un plan d'implémentation puis réalise-le par phases en réutilisant la stack, les conventions et le design system existants. Ne casse ni ne remplace inutilement les modules VISORA déjà développés. À chaque phase, exécute les vérifications disponibles et rapporte changements, fichiers, tests, limitations, configuration et prochaines étapes.
