# VISORA

Plateforme de création et de visite d’espaces immersifs, organisée en deux expériences.

| Espace | Routes | Contenu |
|---|---|---|
| **Créateur** | `#/` tableau de bord · `#/tours` · `#/publications` · `#/analytics` · `#/settings` · `#/studio/:id` | Gestion des visites, statistiques, Studio 3D (module Objets 3D) |
| **Visiteur** | `#/explorer` · `#/visite/:id` | Galerie des visites publiées, viewer immersif en lecture seule |

## Lancer le projet

```bash
cd server && npm install && npm run dev   # API + PostgreSQL + S3, en local sans Docker (voir server/README.md)
npm install && npm run dev                # front sur http://localhost:5173 (proxy /api vers :3000)
```

- `npm test` : tests unitaires du front (store du Studio, statistiques, validation des imports).
- `cd server && npm test` : tests de bout en bout de l’API, sur PostgreSQL et S3.

## Données

Les données vivent sur le serveur : projets et statistiques dans PostgreSQL, modèles 3D dans S3.

- **Accès** : l’espace créateur et le Studio demandent un compte. L’inscription crée une organisation dont on est propriétaire. L’espace visiteur est anonyme et ne sert que les versions publiées, par lien ou via la galerie publique si le propriétaire l’a choisi.
- **Tableau de bord** : chiffres réels calculés par l’API (`/api/orgs/:id/stats`). Vues, visiteurs uniques et durées proviennent des sessions enregistrées par le viewer. Les sessions de moins de 2 s ne comptent pas dans la durée moyenne.
- **IA, équipe et abonnement** : aucun service n’est connecté. Les panneaux et les pages l’indiquent, et aucune donnée fictive n’est affichée.
- **Mode démonstration** (Paramètres, ou menu du profil) : remplace les chiffres du tableau de bord par ceux de la maquette (`src/creator/demoData.ts`). Un bandeau permanent le signale. Rien n’est enregistré, et les listes de visites restent réelles.
- **Adaptateur IndexedDB** (`src/services/localBackend.ts`) : sert uniquement aux tests unitaires.

| Fichier | Rôle |
|---|---|
| `server/` | API NestJS : comptes, organisations, rôles, projets, fichiers S3, publication, accès public, statistiques ([documentation](server/README.md)) |
| `src/services/api.ts` | Client HTTP : jeton d’accès en mémoire, rafraîchissement partagé, erreurs typées |
| `src/services/persistence.ts` | Interface du stockage des projets (API dans l’application, IndexedDB dans les tests) |
| `src/store/session.ts` | Session utilisateur et organisation active |
| `src/creator/AuthPages.tsx` | Connexion et inscription |
| `src/router.ts` | Routeur par hash : pages protégées, redirection après connexion, garde des modifications non enregistrées du Studio |
| `src/store/workspace.ts` | Projets et statistiques de l’organisation, mode démo |
| `src/services/analytics.ts` | Formatage des durées ; calculs de statistiques utilisés par les tests |
| `src/creator/*` | Espace créateur : mise en page, tableau de bord, graphiques SVG, pages, création de visite, illustration du bandeau (rendue à partir des assets 3D VISORA) |
| `src/visitor/VisitorSpace.tsx` | Espace visiteur : galerie, viewer, partage, plein écran, marche tactile, enregistrement des sessions |
| `src/studio/StudioApp.tsx` | Studio 3D ouvert sur un projet donné |

Les couleurs du graphique de répartition ont été validées pour les déficiences de la vision des couleurs. Les pourcentages sont toujours affichés en clair.

---

## Studio 3D — module Objets 3D

Éditeur 3D Web pour ajouter, placer, transformer et configurer des objets dans les scènes d’une visite VISORA.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests unitaires (store, persistance, validation d’import)
npm run build      # typecheck + build de production
```

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · three.js + React Three Fiber + Drei · Zustand · IndexedDB (`idb-keyval`).

Le dépôt ne contenait que des maquettes (`docs/`) : aucune convention ni backend existants à respecter.

## Modules du Studio

| Module | Contenu |
|---|---|
| **Scènes** | Mise en page de la maquette `docs/VISORA 3D Warehouse Scene Editor.png`. Scènes 3D (environnement modélisé) ou 360° (image équirectangulaire de la bibliothèque). Liste numérotée, réorganisable par glisser-déposer ou au clavier (flèches sur la poignée) ; réorganiser ne change jamais la scène d’accueil. Inspecteur à onglets : **Général** (nom, description, vignette choisie dans la bibliothèque ou capturée depuis la vue, icône, ordre, scène d’accueil, visibilité, verrouillage de la caméra pour le visiteur, tags utilisés par la recherche), **Vue & caméra** (vue initiale), **Transitions** (départs et arrivées de la scène), **Avancé** (type, panorama, ambiance, dimensions, contenu). Duplication (objets et hotspots), suppression en cascade. |
| **Navigation** | Mise en page de la maquette `docs/VISORA 3D Navigation Dashboard.png`. Panneau à onglets **Connexions** / **Points**, avec recherche et menu par connexion : placer le point ou le retour, changer le sens, supprimer. Inspecteur à onglets : **Connexion** (type bidirectionnel ou sens unique, transition en fondu doux ou immédiate, durée, flèche au sol, cible de navigation, retour), **Point** (destination, libellé, placement en un clic), **Parcours** (parcours guidés qui empruntent la connexion). Flèche et cible ne peuvent pas être masquées toutes les deux. Sous le viewport : le plan 2D du site (étage de la scène courante) et le graphe de navigation. La barre du bas affiche la **qualité de la navigation** (accessibilité, impasses, points cassés) et le nombre de connexions. |
| **Hotspots** | Mise en page de la maquette `docs/VISORA Studio 3D Hotspot Editor.png`. Neuf types : information, vidéo, document, navigation, **équipement** (fiche de caractéristiques), lien web, **formulaire**, contact, image. Liste de la scène ou de toute la visite, filtre par type, menu par hotspot. Inspecteur à onglets : **Général** (type, titre, description, icône, couleur, taille, position, « toujours visible » : sinon masqué quand un objet le cache, étiquette, effet au survol), **Contenu** (média, lien, destination, coordonnées, caractéristiques, champs du formulaire), **Style** (étiquette titre seul ou titre et sous-titre, pulsation), **Actions** (comportement au clic, bouton « En savoir plus », test). Sous la vue : palette des types (un clic crée le hotspot puis on le place dans la vue) et aperçu de ce que verra le visiteur. Le **formulaire** n’envoie rien par VISORA : il ouvre la messagerie du visiteur avec un e-mail prérempli vers l’adresse choisie. |
| **Médias** | Mise en page de la maquette `docs/Visora 3D Media Library Dashboard.png`. Import multiple avec progression, détection du type par le serveur (images 360° reconnues au rapport 2:1), filtres par type avec compteurs, dossiers, favoris, tri, recherche, vue grille (taille réglable) ou liste, sélection multiple (déplacer, corbeille), menu par média. Durée réelle des vidéos et des sons lue dans le fichier. Détails à onglets (Général, Utilisation, Métadonnées) et **visionneuse 360°** pour les panoramas. Corbeille avec restauration ; la suppression définitive est refusée si le média est utilisé. |
| **Plan 2D** | Mise en page de la maquette `docs/VISORA Logistics 2D Floor Plan Dashboard.png`. Plusieurs plans (étages), chacun basé sur une image de la bibliothèque. Outils : sélectionner, **point de navigation** (placer une scène), **connexion** (deux scènes cliquées créent une connexion dans les deux sens), **hotspot** (épingle qui mène à la scène puis ouvre le hotspot, pour le visiteur aussi), **zone** (rectangle nommé et coloré), texte, mesure, plan (image, **calibration** : deux points et une distance réelle ; sans elle, aucune mesure n’est affichée). Codes de scène S01, S02…, points masquables aux visiteurs, colorables et réaffectables à une autre scène. Inspecteur du point : Général, Lien (réglages des connexions de la scène), Style, Avancé. Onglet **Aperçu du parcours** : trajet numéroté d’un parcours guidé sur le plan. La barre du bas donne la **qualité du plan**. |
| **Parcours guidé** | Plusieurs parcours. Étapes ordonnées : scène, cadrage capturé (cap, inclinaison, champ), titre, commentaire, durée. Les étapes dont la scène est absente ou masquée sont signalées. Aperçu dans le Studio. |
| **Annotations** | Notes placées dans les scènes. « Studio uniquement » : note d’équipe jamais envoyée au visiteur. « Publique » : libellé visible dans la visite. |
| **Apparence** | Couleur d’accent, logo, écran d’accueil (titre, texte), commandes affichées au visiteur (scènes, plan, parcours, partage, plein écran), avec aperçu. |
| **Paramètres** | Nom, type, description, sauvegarde automatique. Partage : lien, galerie publique, **mot de passe** et **date d’expiration** (vérifiés par le serveur), **code d’intégration** (iframe, mode `?embed=1` sans retour à la galerie), **QR code** PNG, dépublication. |
| **Objets 3D** | Voir plus bas. |

Le viewport des modules (hors Objets 3D) reprend les commandes de la maquette :

- un joystick : avancer ou reculer dans une scène 3D, tourner la vue sinon ; le centre revient à la vue de départ ;
- la scène courante et sa position (« 2 / 12 ») ;
- scène précédente et suivante, avec la transition ;
- lecture de l’aperçu du premier parcours guidé ; le bouton est désactivé s’il n’y en a aucun ;
- « Plan du site », désactivé sans plan ;
- le zoom, la rotation automatique 360°, et la bande de vignettes des scènes, masquable.

La barre du bas affiche :

- la **qualité de la visite**, un score calculé sur le contenu réel : accessibilité des scènes, images 360°, vignettes, descriptions, hotspots complets, navigation et parcours valides (`src/studio/tour/quality.ts`) ; le détail renvoie au module concerné ;
- les nombres de scènes, de points de navigation, de hotspots et de parcours ;
- la taille réelle des fichiers du projet. Aucun quota n’est affiché, car la facturation n’existe pas encore.

Dans l’espace visiteur :

- les hotspots et la navigation fonctionnent, avec la transition entre scènes ;
- le bouton **Plan** ouvre le plan de l’étage courant ; un clic sur une scène y mène ;
- le bouton **Parcours guidé** lance la lecture (pause, précédent, suivant, progression) ;
- les scènes masquées ne sont pas accessibles.

Toutes ces modifications sont annulables (Ctrl+Z). Logique du plan et des parcours : `src/store/planActions.ts`. Plan partagé entre Studio et viewer : `src/components/plan/PlanCanvas.tsx`. Lecteur : `src/components/viewport/GuidedTourPlayer.tsx`.

Logique : `src/store/tourActions.ts`. Couches 3D partagées par le Studio et le viewer (sphère 360°, marqueurs, transitions, contenus des hotspots) : `src/components/viewport/TourLayers.tsx`. Modules : `src/studio/tour/*` et `src/studio/media/*`.

## Enregistrement et publication

Le projet (scènes, assets, instances, favoris) est enregistré par l’API dans PostgreSQL. Les modèles importés sont convertis en GLB dans le navigateur, puis envoyés à l’API, qui les valide et les stocke dans S3.

- **Enregistrer** (Ctrl+S) crée une nouvelle révision. Si un autre onglet, une autre session ou un autre membre a enregistré entre-temps, le serveur répond 409 et une boîte de dialogue propose de recharger ou d’écraser.
- **Publier** est distinct de l’enregistrement : le Studio enregistre d’abord, puis publie exactement la révision enregistrée, sous forme de copie figée servie aux visiteurs.
- La sauvegarde automatique se configure dans le menu « ⋮ » (désactivée, 30 s, 2 min).
- Les imports sont validés côté client (`src/services/importValidation.ts`) **et** côté serveur, par la signature binaire du fichier.

## Architecture

| Fichier | Rôle |
|---|---|
| `src/types.ts` | Modèle de données : `Asset3D` (bibliothèque), `SceneObject3D` (instance dans une scène), `Scene`, `ProjectDoc` |
| `src/store/editor.ts` | Store central : données, sélection, historique annuler/rétablir (instantanés, fusion des éditions rapides), sauvegarde/publication/conflits, état de l’interface |
| `src/store/objectActions.ts` | Commandes partagées (suppression confirmée, dupliquer, masquer, verrouiller, grouper, poser au sol, centrer…) |
| `src/lib/transforms.ts` | Calculs de matrices pour grouper, dégrouper et changer de parent sans déplacer les objets |
| `src/lib/actions.ts` | Vocabulaire d’actions commun aux objets et aux hotspots (info, fiche, document, vidéo, scène, lien) |
| `src/three/procedural.ts` | 41 assets VISORA générés en code (géométries et matériaux partagés) |
| `src/three/assetCache.ts` | Chargement GLB, clones par instance, compteur de références et libération mémoire différée, styles par instance |
| `src/three/thumbnails.ts` | Miniatures via un rendu hors écran partagé |
| `src/three/registry.ts` | Pont entre l’interface DOM et la scène 3D (id → Object3D, API caméra et lancer de rayons) |
| `src/services/importValidation.ts` | Validation pure : formats, taille, signatures binaires, unités, alertes « modèle lourd » |
| `src/services/importer.ts` | Import GLB/GLTF/OBJ(+MTL)/FBX/STL → statistiques → optimisation des textures → conversion en GLB unique |
| `src/components/viewport/*` | Viewport : modes 3D / immersif / plan 2D / visiteur, gizmo, sélection, glisser-déposer, mesures, magnétisme |
| `src/components/library/*` | Bibliothèque (recherche, filtres, tris, grille/liste, favoris), aperçu 3D, dialogue d’import |
| `src/components/hierarchy/*` | Hiérarchie : arbre, renommage, visibilité, verrouillage, réorganisation par glisser-déposer |
| `src/components/inspector/*` | Inspecteur : Général, Transform, Style, Actions, Avancé |
| `src/components/layout/*` | Barre supérieure, navigation Studio, sélecteur de scènes, barre de statut |

## Raccourcis

W / E / R : déplacer / tourner / redimensionner · F : cadrer · Ctrl+D : dupliquer · Suppr : supprimer · H : masquer · L : verrouiller · Ctrl+G / Ctrl+Maj+G : grouper / dégrouper · Ctrl+Z / Ctrl+Y : annuler / rétablir · Ctrl+S : enregistrer · Alt+clic : sélectionner un objet à l’intérieur d’un groupe. En mode immersif et visiteur : ZQSD/WASD ou flèches pour se déplacer.

## Limites connues

- USD/USDZ n’est pas pris en charge ; l’import affiche un message explicite.
- Les objets en sélection multiple ne se transforment qu’en translation. Rotation et échelle se font objet par objet.
- La suppression d’un asset de la bibliothèque est logique (`deletedAt`) pour rester annulable. Les fichiers correspondants restent dans IndexedDB.
- Pas de LOD ni d’occlusion culling. Le frustum culling est actif et la géométrie est partagée entre les instances d’un même asset.
