# VISORA --- Prompt maître de développement de A à Z

## Mission

Agis comme une équipe senior multidisciplinaire (Product Manager, UX/UI
Designer, Architecte logiciel, Frontend/Backend, 3D/WebGL, IA
multimodale, DevOps, QA et sécurité). Ta mission est d'auditer le projet
existant puis de concevoir, développer, tester et livrer **VISORA**, une
plateforme SaaS complète de création, reconstruction assistée par IA,
édition, publication et analyse de visites immersives et
d'environnements spatiaux.

**Règle absolue :** développer un produit fonctionnel et persistant, pas
des maquettes statiques. Inspecter d'abord le repository. Ne pas
réécrire l'application sans raison, ne pas casser les fonctionnalités
existantes, ne pas afficher une fausse réussite, et ne pas déclarer une
fonctionnalité terminée sans tests.

------------------------------------------------------------------------

# 1. Vision et positionnement

-   **Nom :** VISORA
-   **Slogan :** Explore spaces. From anywhere.
-   **FR :** Explorez les lieux, où que vous soyez.
-   **Positionnement :** SaaS premium pour capturer, reconstruire,
    éditer, publier et partager des expériences spatiales immersives.
-   **Approche :** Web-first, AI-assisted, spatial creation, immersive
    tours.

VISORA doit permettre de transformer des photos, panoramas 360°, vidéos,
plans et fichiers 3D en visites immersives interactives, scènes
spatiales et expériences consultables sur le Web.

## Secteurs

Immobilier, entrepôts/logistique, industrie, bureaux, hôtels/tourisme,
showrooms, commerce, éducation, laboratoires, espaces techniques,
construction, facility management, inspection et maintenance.

## Principes produit

1.  Web-first ; Studio principalement desktop ; Viewer responsive
    mobile.
2.  IA assistive : l'utilisateur contrôle et valide les propositions.
3.  Progressive spatial fidelity : choisir le pipeline selon les sources
    et capacités.
4.  Distinguer captured, reconstructed, AI-generated, estimated et
    user-verified.
5.  Ne jamais présenter des mesures estimées comme exactes sans
    calibration.
6.  Une seule photo ne permet pas de reconstruire fidèlement les zones
    non visibles : signaler les extrapolations.
7.  Privacy-first : masquage, floutage, confidentialité et contrôle
    d'accès.
8.  Performance : chargement progressif, assets optimisés, qualité
    adaptative.
9.  SaaS scalable : multi-tenant, rôles, quotas, facturation et
    administration.
10. Jobs fiables : queue, progression, retry, cancel, logs et
    notifications.
11. Pas de boutons factices, de liens morts ou de données de démo
    présentées comme réelles.
12. Architecture modulaire, documentation, tests et maintenabilité.

------------------------------------------------------------------------

# 2. Identité visuelle

Créer une expérience premium, professionnelle, moderne et spatiale,
futuriste mais sobre.

### Palette de référence

-   Midnight `#101827`
-   Deep Navy `#18263B`
-   Surface `#1D2B43`
-   Spatial Cyan `#36C8F4`
-   AI Violet `#7868F5`
-   Success : vert ; Warning : orange ; Error : rouge

Typographie moderne (Inter, Geist ou équivalent disponible). Design
tokens centralisés : couleurs, typographie, spacing, radius, shadows,
z-index.

UI : contrastes lisibles, panneaux sobres, bordures discrètes, cyan pour
actions/états actifs, violet pour IA, micro-interactions légères,
skeletons, empty states, tooltips, toast, confirmation destructive.
Éviter la surcharge décorative et les layouts SaaS génériques.

------------------------------------------------------------------------

# 3. Architecture produit et espaces

## Site public / marketing

Landing page, présentation, fonctionnalités, secteurs, cas d'usage,
galerie de visites, technologie IA, pricing, FAQ, contact, login et
signup.

## SaaS utilisateur

Dashboard, projets, visites, wizard création, import médias,
analyse/génération IA, Studio 3D, preview, publication, partage,
analytics, collaboration, bibliothèque, organisation, abonnement,
profil, paramètres et support.

## Viewer

Viewer immersif, navigation, scènes, hotspots, parcours guidé, plan,
assistant IA, recherche, contact, partage, mobile et VR future si
compatible.

## Admin plateforme

Dashboard, utilisateurs, organisations, projets, visites, plans,
subscriptions, billing, quotas, storage, jobs IA, coûts GPU/compute,
support, logs, audit, sécurité, configuration et feature flags.

------------------------------------------------------------------------

# 4. Multi-tenant, rôles et sécurité des permissions

Rôles possibles : Platform Super Admin, Platform Admin, Support,
Organization Owner, Organization Admin, Project Owner, Editor,
Collaborator, Viewer et Public Visitor.

Permissions sur organisation, projet, média, scènes, Studio,
publication, partage, analytics, billing et administration. Vérifier les
permissions côté serveur, jamais seulement en masquant les contrôles UI.

Prévoir invitations, membres, rôles, transfert de propriété, révocation,
accès public/privé, password-protected tour, liens expirables,
restrictions de domaine ou organisation selon plan.

------------------------------------------------------------------------

# 5. Authentification et onboarding

-   Email/password, confirmation email, forgot/reset password, sessions
    sécurisées, logout, MFA optionnel, OAuth si utile.
-   Onboarding : compte, profil, organisation, secteur, objectif, niveau
    3D, premier projet, tutoriel et checklist.
-   Gestion des sessions et appareils selon possibilités de la stack.

------------------------------------------------------------------------

# 6. Dashboard

Dashboard premium avec : - Bienvenue, actions rapides, Create tour -
Projets récents - Brouillons, visites publiées, processing jobs -
Activité - Notifications - Statistiques : projets, visites, vues, durée
moyenne, médias, stockage et quota - Tutoriels et checklist

Toutes les métriques proviennent de données réelles ou sont
explicitement en mode démo.

------------------------------------------------------------------------

# 7. Projets et visites

Liste en grille/liste : thumbnail, nom, secteur, auteur, dates, statut,
scènes, visibilité et taille.

Actions : ouvrir, renommer, dupliquer, archiver/restaurer, supprimer,
partager, publier, exporter si réellement supporté.

Statuts : Draft, Uploading, AI Analysis, Reconstruction, Editing, Ready
to publish, Published, Failed, Archived.

------------------------------------------------------------------------

# 8. Wizard création de visite

## Étape 1 --- Configuration

Nom, type d'espace, secteur, description, localisation facultative,
objectif, confidentialité, source capture, mode création.

Types : maison/appartement, bureau, entrepôt, industrie, hôtel,
showroom, commerce, école, laboratoire, autre.

Modes : panoramas, photos, reconstruction, vidéo, modèle 3D, hybride.
Expliquer exigences et limites de chaque mode.

## Étape 2 --- Import médias

Images, panoramas 360°, vidéos, modèles 3D, plans, documents, audio
selon support.

Fonctions : drag/drop, upload multiple, progress, validation,
pause/reprise si possible, preview, recherche, organisation,
suppression, metadata, doublons et qualité.

## Étape 3 --- Analyse IA

Analyse qualité, classification, détection de scènes/objets, OCR,
segmentation si disponible, structure, suggestions navigation/hotspots,
description, privacy detections et rapport qualité. L'utilisateur peut
éditer, accepter ou rejeter chaque proposition.

## Étape 4 --- Génération/reconstruction

Choisir pipeline selon media : - Panorama : scènes panoramiques +
links - Photos : reconstruction compatible avec volume/qualité - Video :
extraction frames et reconstruction selon pipeline - Photogrammetry :
pipeline dédié - Gaussian Splatting/NeRF : intégration si validée
techniquement et données adaptées - 3D assets : import/optimisation -
Hybrid : combiner scènes, reconstruction et assets

Afficher stages, progression, logs lisibles, erreurs, retry, cancel et
notifications. Temps estimé seulement s'il est fiable.

## Étape 5 --- Finalisation

Preview, scènes, navigation, hotspots, plan, objets, annotations, guided
tour, apparence, privacy et publication.

------------------------------------------------------------------------

# 9. IA multimodale et reconstruction spatiale

Créer une architecture provider-agnostic : vision multimodale, OCR,
classification, segmentation, object detection, scene analysis,
descriptions, reconstruction, texture processing, recommendations,
assistant, speech-to-text et text-to-speech selon roadmap.

### Pipeline jobs

Validation → preprocessing → extraction images/frames → vision analysis
→ clustering scènes → object detection → spatial estimation →
reconstruction → textures → scenes → navigation/hotspot suggestions →
quality checks → optimization → web packaging.

### Jobs asynchrones

Job ID, project/user/organization, type, status, progress, stage, logs,
inputs, outputs, errors, retry count, timestamps, cost/usage si
mesurable.

Status : Queued, Validating, Processing, Running, Completed, Failed,
Cancelled, Retry scheduled.

### Truth and uncertainty

Annoter la provenance : Captured, Reconstructed, AI-generated,
Estimated, User-edited, Verified. Ne pas inventer la géométrie invisible
ni les dimensions. Indiquer limites et confiance lorsque mesurables.

------------------------------------------------------------------------

# 10. VISORA Studio 3D

Navigation globale : - Scènes - Navigation - Hotspots - Médias - Plan
2D - Objets 3D - Annotations - Parcours guidé - Apparence - Paramètres

Layout : top header, sidebar, panneau gauche contextuel, viewport
central, inspector droite, toolbar, scene strip et status bar. Panels
rétractables, responsive, autosave, undo/redo, preview et publish.

Header : nom projet, statut, undo, redo, preview, save, publish/update,
menu.

## 10.1 Scènes

Liste, thumbnails, recherche, add, rename, duplicate, delete, reorder,
home scene, hide, tags, description, cover, camera, transitions,
visibility et properties.

Types : panorama, image, reconstruction 3D, model scene, video scene,
hybrid.

## 10.2 Navigation

Connections unidirectionnelles/bidirectionnelles, points, flèches,
cibles, transitions, duration, graph, plan, validation des links,
détection scènes isolées et preview parcours.

## 10.3 Hotspots

Types : Information, Video, Document, Navigation, Equipment, Web Link,
Form, Contact, Audio, Gallery, interactive object.

Properties : title, description, type, icon, color, size, position,
orientation, visibility, label, hover, animation, content, action,
target, display conditions.

Actions : fiche, vidéo, document, scène, URL, form, contact, phone/email
et actions autorisées.

## 10.4 Médias

Bibliothèque images, 360, vidéo, document, audio, 3D, textures, favoris
et corbeille. Dossiers, tags, recherche, filtres, tri, sélection
multiple, import, preview, rename, move, delete, metadata, usage
tracking.

Metadata : format, taille, résolution, date, source, folder, processing
status, scene references.

## 10.5 Plan 2D

Import plans, plusieurs plans/étages, scène positions, navigation
points, connections, hotspots, zones, texte, mesures calibrées, layers,
zoom/pan, selection, alignment et route preview.

## 10.6 Objets 3D

Library : industriel, mobilier, décor, sécurité, véhicules,
signalétique, éclairage, architecture, assets importés.

Actions : import, preview, drag/drop, add, select, move, rotate, scale,
duplicate, delete, group, lock, hide, rename.

Transform : X/Y/Z, rotation, scale, uniform scale, pivot, snapping,
alignment, grounding.

Properties : name, description, category, asset, material, visibility,
interaction, shadows si supportées, advanced, dimensions. Priorité
GLB/GLTF. Formats additionnels uniquement avec pipeline fiable.

## 10.7 Annotations

Texte, notes, commentaires, mesures, flèches, zones, points, repères,
annotations techniques. Position, style, couleur, visibilité, édition et
collaboration si roadmap.

## 10.8 Parcours guidé

Tours scénarisés : steps, scene target, hotspot, text, narration, media,
duration, camera, order, preview, publish, duplicate et reorder. IA peut
suggérer, utilisateur valide et modifie.

## 10.9 Apparence

Theme, colors, logo, branding, viewer UI, hotspot/navigation style,
typography, cover, welcome screen, language, white-label selon plan,
custom CSS seulement si sécurisé. Preview live.

## 10.10 Paramètres

Général, visibilité, privacy, access, sharing, password, domains,
analytics, export, processing, quality, notifications, advanced.

------------------------------------------------------------------------

# 11. Viewer visiteur

Viewer simple, immersif, performant : - Immersive 3D/panorama/plan -
Scene navigation - Hotspots - Guided tours - Fullscreen - Zoom/camera -
Share - Help/contact - Search - Mobile touch - Loading and progress -
Scene transitions - Accessible controls - Device fallback

------------------------------------------------------------------------

# 12. Assistant IA de visite

Répondre à partir de sources validées et autorisées : project data,
scene descriptions, hotspots, documents, equipment specs, guided tours
et verified metadata.

Fonctions : Q&A, search, scene recommendation, guided navigation,
summary, equipment explanations, multilingual, voice option.

Sécurité : pas d'hallucination, inconnues signalées, sources/références
si possible, permissions respectées, aucune fuite cross-project, rate
limits et coûts.

------------------------------------------------------------------------

# 13. Publication, partage et embed

Publishing workflow : preview, quality checklist, privacy checklist,
publish, update, unpublish, versioning si possible.

Share modes : public, private, password, organization-only,
invitation-only, expiring link, domain restrictions selon plan.

Embed : iframe responsive, configuration, copy code, preview.

QR : génération, download, print-ready, analytics tracking selon
consentement.

------------------------------------------------------------------------

# 14. Analytics

Metrics : views, unique visitors si mesurables, sessions, average
duration, completion, scenes visited, hotspot clicks, guided tour
completion, device, referrer, share activity. Geographic analytics
seulement avec consentement et conformité.

Visuals : KPI cards, time series, scene popularity, hotspot engagement,
devices, funnel et activity.

------------------------------------------------------------------------

# 15. Collaboration

Invitations, members, roles, comments, feedback, review mode,
annotations collaboratives, activity history, ownership, version
history, conflict management. Realtime editing est une phase avancée ;
ne pas simuler.

------------------------------------------------------------------------

# 16. Billing et plans

Plans configurables : Free/Trial, Starter, Pro, Business, Enterprise
(offre/prix à valider, ne pas hardcoder).

Quotas possibles : projects, published tours, storage, AI credits,
reconstruction jobs, views, members, branding, analytics, collaboration,
export, domains, API.

Billing : plan, usage, invoices, payment method, billing history,
upgrade/downgrade, cancel, trial, renewal, failed payment, grace period.
Intégrer un payment provider compatible marchés ciblés. Aucune
transaction ne doit être fictive.

------------------------------------------------------------------------

# 17. Administration plateforme

Dashboard : users, organizations, projects, published tours, jobs,
usage, storage, AI costs, revenue si billing, errors, support.

Users : search, details, status, roles, organization, usage, admin
actions, audit.

Organizations : members, projects, plan, quota, usage, status.

Projects/tours : processing, publication, storage, owner, privacy,
actions.

AI jobs : queue, status, stage, progress, provider, cost, duration,
retry, cancel, logs.

Storage : usage par organization/project, assets, outputs,
lifecycle/cleanup.

Support : tickets, user/project, priority, status, assignment,
attachments, internal notes, resolution.

Audit logs : actions sensibles.

------------------------------------------------------------------------

# 18. Notifications

In-app/email : job completion/failure, publish, share, invitation,
billing, quota, support et security. Utiliser SSE/WebSocket ou polling
contrôlé selon stack.

------------------------------------------------------------------------

# 19. Architecture technique --- à adapter après audit

Ne pas imposer de stack si le projet existant est cohérent. Examiner
avant d'ajouter des dépendances.

Options : - Frontend : Next.js, React, TypeScript, Tailwind, UI/design
system existant - 3D : Three.js, React Three Fiber, Drei selon besoin -
Backend : Node, NestJS ou APIs structurées existantes - Database :
PostgreSQL - ORM : celui du projet ou équivalent - Cache/queue : Redis +
BullMQ ou alternatives - Storage : S3-compatible + CDN + signed URLs -
AI : provider abstraction - Workers : jobs media/AI, GPU workers si
pipeline requis - Observability : logs structurés, metrics, tracing,
error monitoring

Séparer frontend, API, data, storage, processing, AI orchestration et
workers. Documenter les décisions.

------------------------------------------------------------------------

# 20. Data model domaines

Entités possibles : User, Organization, Membership, Role, Permission,
Project, Tour, Scene, SceneMedia, MediaAsset, Folder, NavigationPoint,
NavigationConnection, Hotspot, HotspotContent, SceneObject3D, Asset3D,
Annotation, Zone, GuidedTour, GuidedTourStep, ViewerSession,
AnalyticsEvent, ShareLink, Publication, Version, AIJob, AIJobStage,
AIOutput, Subscription, Plan, UsageRecord, Invoice, Payment,
Notification, SupportTicket, AuditLog.

Principes : FK, indexes, unique constraints, tenant isolation, soft
delete si nécessaire, timestamps, versioning, validation, migrations,
seed dev et data access layer. Commencer par le domaine MVP puis
étendre.

------------------------------------------------------------------------

# 21. API / services

APIs pour Auth, Users, Organizations, Projects, Tours, Scenes, Media,
Upload, Processing, AI Jobs, Navigation, Hotspots, Plan, Objects,
Annotations, Guided Tours, Viewer, Publish, Share, Analytics, Billing,
Admin, Support.

API principles : validation, typed responses, pagination, filtering,
sorting, auth, permissions, rate limits, consistent errors, idempotency,
versioning si nécessaire, OpenAPI si REST.

------------------------------------------------------------------------

# 22. Media pipeline et stockage

Workflow : upload → validation → metadata → safety scan si applicable →
thumbnail → transcoding → panorama processing → texture/3D optimization
→ storage → CDN → lifecycle/delete.

Conserver séparément Original, Derived, Preview, Thumbnail, Processing
Output et Reconstruction Output. Ne pas stocker les gros fichiers dans
la DB.

------------------------------------------------------------------------

# 23. Performance

Application : code splitting, lazy loading, virtualized lists, cache,
optimized queries, pagination, responsive images, CDN, compression.

Viewer : progressive loading, optimized textures, adaptive quality,
mobile fallback, scene preloading intelligent, asset streaming si
adapté.

Studio : limiter rerenders, viewport optimization, efficient selection,
cleanup resources, workers si nécessaire, metrics.

------------------------------------------------------------------------

# 24. Sécurité et privacy

Authentication, authorization, tenant isolation, server-side permission
checks, secure sessions, CSRF selon stack, rate limiting, upload
validation, file limits, MIME validation, malware scan si applicable,
secure storage, signed URLs, secrets management, audit, deletion,
backups, encryption, privacy compliance, content moderation et AI abuse
controls.

------------------------------------------------------------------------

# 25. QA et tests

### Unit

Models, services, permissions, validation, transformations, AI
orchestration.

### Integration

API, DB, upload, processing, publishing, sharing, billing.

### E2E critical path

1.  Signup/login
2.  Create project
3.  Upload
4.  Start analysis
5.  Review results
6.  Create scenes
7.  Edit Studio
8.  Navigation
9.  Hotspot
10. Object
11. Preview
12. Publish
13. Share
14. Analytics

Tester desktop, tablet, mobile viewer, browser compatibility,
accessibility, performance et regression.

------------------------------------------------------------------------

# 26. DevOps

Environments dev/staging/prod, environment variables, secrets,
migrations, CI, tests, build, deploy, rollback, monitoring, backups,
recovery, CDN, worker deployment et GPU workers éventuels.

Documenter setup, run, test, deploy, worker startup, env vars,
migrations et backup/restore. Aucun secret dans le repo.

------------------------------------------------------------------------

# 27. Roadmap recommandée

### Phase 0 --- Audit & Foundation

Repository, stack, architecture, data, auth, existing modules, risks,
technical plan.

### Phase 1 --- SaaS foundation

Design system, auth, users, organizations, dashboard, project CRUD,
storage, permissions.

### Phase 2 --- Media ingestion

Upload, library, metadata, preview, folders, validation, processing.

### Phase 3 --- MVP tour builder

Panorama viewer, scene management, navigation, hotspots, save, preview,
publish, share.

### Phase 4 --- AI pipeline

Media analysis, quality, scene suggestions, descriptions,
navigation/hotspot suggestions, job queue.

### Phase 5 --- Advanced Studio

Plan 2D, objects 3D, annotations, guided tours, appearance, settings.

### Phase 6 --- Spatial reconstruction

Photogrammetry / Gaussian Splatting / NeRF integration selon
feasibility, capture quality, GPU budget, accuracy validation.

### Phase 7 --- Advanced Viewer

AI assistant, search, voice, mobile optimization, VR compatible.

### Phase 8 --- Monetization

Plans, quotas, billing, usage.

### Phase 9 --- Collaboration

Members, permissions, comments, review, versioning.

### Phase 10 --- Admin

Support, jobs, usage, costs, audit, analytics.

### Phase 11 --- Production hardening

Security, performance, accessibility, QA, backup, observability,
release.

------------------------------------------------------------------------

# 28. MVP première version

Priorité au MVP réellement livrable :

-   Authentication
-   Dashboard
-   Projects
-   Creation wizard
-   Media upload
-   Media library
-   Basic AI media analysis
-   Panorama scenes
-   Scene management
-   Navigation between scenes
-   Hotspots
-   Studio
-   Viewer
-   Preview
-   Publish
-   Share
-   Basic analytics
-   Persistence
-   Basic admin
-   Error handling
-   Responsive viewer

La reconstruction spatiale avancée est une phase séparée. Le MVP peut
déjà créer une vraie valeur via panoramas, navigation, hotspots, médias
et assets 3D, sans promettre une reconstruction impossible ou coûteuse.

------------------------------------------------------------------------

# 29. UX states

Toutes les pages et fonctions doivent traiter : loading, empty, error,
success, disabled, permission denied, responsive, keyboard focus,
tooltip, toast, confirmation et retry.

Éviter : boutons inactifs, liens morts, formulaires sans validation,
réussite fictive, erreurs silencieuses, données de test confondues avec
données réelles.

------------------------------------------------------------------------

# 30. Méthode de travail obligatoire

## A --- Audit

Inspecter repository, stack, pages, components, database, APIs, auth,
storage, 3D engine, AI, tests, deployment. Produire un audit : existant,
manquant, problèmes, risques.

## B --- Plan

Plan par phases, tâches, dépendances, risques, choix techniques,
unknowns, MVP et deferred scope.

## C --- Design

Harmoniser tokens, navigation, layouts, components, responsive, states.

## D --- Développement

Pour chaque module : implement → test → verify → fix → document →
regression test. Avancer par petites unités vérifiables.

## E --- Rapport final

Fonctionnalités livrées, architecture, fichiers créés/modifiés, tests,
réussis/échoués, limitations, backlog, instructions de lancement et
déploiement.

------------------------------------------------------------------------

# 31. Règles strictes de l'agent

1.  Auditer avant de modifier.
2.  Ne pas réécrire l'app sans nécessité.
3.  Ne pas supprimer l'existant.
4.  Pas de fake persistence.
5.  Pas de reconstruction déclarée réussie sans exécution réelle.
6.  Pas de mesure exacte sans calibration.
7.  Aucun secret commité.
8.  Permissions backend obligatoires.
9.  Architecture modulaire.
10. Dépendances minimales et justifiées.
11. Pas de page statique pour simuler une fonctionnalité.
12. Tous les boutons ont une action ou un état disabled explicite.
13. Tester avant de déclarer terminé.
14. Viewer performant.
15. Accessibilité.
16. Séparation frontend/API/processing/AI.
17. Retry et erreurs.
18. Décisions techniques documentées.
19. Design system VISORA respecté.
20. Livrables vérifiables.

------------------------------------------------------------------------

# 32. Definition of Done

La première version production est validée lorsque :

-   Un utilisateur peut s'inscrire et se connecter.
-   Il peut créer ou rejoindre une organisation.
-   Il peut créer un projet.
-   Il importe des médias réellement stockés et traités.
-   Il crée et organise des scènes.
-   Il crée la navigation et les hotspots.
-   Il édite dans le Studio.
-   Il prévisualise la visite.
-   Il publie et partage.
-   Un visiteur navigue sur desktop/mobile.
-   Les analytics basiques fonctionnent.
-   Les données sont persistantes.
-   Les permissions sont sécurisées.
-   Les erreurs sont gérées.
-   Les jobs IA sont suivis.
-   Les quotas/coûts sont contrôlables.
-   Les tests critiques passent.
-   Le déploiement et les backups sont documentés.

------------------------------------------------------------------------

# 33. Instructions finales

Développe **VISORA de A à Z** en commençant par un audit du projet et de
son environnement. Identifie ce qui existe, ce qui est incomplet et ce
qui doit être créé. N'effectue pas une réécriture globale non justifiée.

Propose un plan de développement par phases, puis réalise les phases de
manière progressive et vérifiable. Priorise un MVP fonctionnel avant les
technologies de reconstruction les plus coûteuses.

Le résultat attendu est une plateforme SaaS professionnelle, sécurisée,
scalable et premium avec : - Marketing site et onboarding - SaaS
dashboard et projects - Media upload/library - AI multimodal analysis -
Spatial generation/reconstruction pipeline - Studio 3D complet - Viewer
immersif - Navigation, hotspots, plan, objets et annotations - Guided
tours - AI visitor assistant - Publication, sharing, embed, QR -
Analytics - Collaboration - Billing - Admin - Security, tests,
monitoring, documentation et deployment

**Priorité absolue :** livrer une application cohérente, maintenable,
performante et réellement fonctionnelle. Avancer module par module.
Chaque étape doit être testée et démontrable. Ne jamais simuler une
fonction qui n'est pas réellement implémentée.
