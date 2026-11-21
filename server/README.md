# VISORA API

API NestJS adossée à PostgreSQL et à un stockage objet compatible S3. Elle couvre les comptes, les organisations, les projets, les fichiers, la publication, l’accès visiteur et les statistiques.

## Démarrage local (sans Docker)

```bash
cd server
npm install
npm run dev        # PostgreSQL embarqué + émulateur S3 + API sur http://localhost:3000
# dans un autre terminal, à la racine :
npm run dev        # front Vite sur http://localhost:5173 (proxy /api → :3000)
```

`npm run dev` démarre :

- **PostgreSQL 17**, de vrais binaires fournis par le paquet npm `embedded-postgres`. Les données sont dans `server/.dev/dev/pg` et persistent d’un lancement à l’autre.
- **s3rver**, un émulateur S3, avec ses données dans `server/.dev/dev/s3`.
- L’API compilée. Les migrations s’appliquent au démarrage. Le secret JWT de développement est généré une fois dans `.dev/jwt-secret`, qui n’est pas versionné.

Ces outils servent uniquement au développement et aux tests. En production, l’API pointe vers un PostgreSQL et un S3 gérés.

## Tests

```bash
npm test   # compile puis lance les tests e2e (node:test + supertest)
```

Les tests démarrent une base et un S3 éphémères (ports 54331 et 4571) et l’application Nest complète. Ils couvrent :

- l’inscription, la connexion, la rotation du jeton de rafraîchissement et la détection de rejeu, le contrôle d’origine ;
- l’isolation entre organisations et les rôles appliqués côté serveur ;
- la concurrence optimiste (409) ;
- la validation des fichiers par leur contenu et les limites de taille ;
- la publication et l’accès public restreint aux fichiers référencés ;
- les sessions visiteurs idempotentes et les statistiques ;
- la dépublication et la suppression ;
- la médiathèque (`test/media.e2e.test.ts`) : détection des formats et des dimensions, dossiers et favoris, URL signées et falsifiées, requêtes `Range`, corbeille et restauration, protection des fichiers utilisés, isolation entre organisations.

## Variables d’environnement

Voir `.env.example`. La configuration est validée au démarrage : l’application refuse de démarrer si elle est invalide.

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | PostgreSQL ≥ 13, avec les extensions `citext` et `pgcrypto` (créées par la migration) |
| `JWT_SECRET` | ≥ 32 caractères aléatoires ; signe les jetons d’accès de 15 minutes |
| `COOKIE_SECURE` | doit valoir `true` en production (HTTPS) |
| `CORS_ORIGIN` | origines autorisées pour le navigateur (liste séparée par des virgules) |
| `S3_*` | point d’accès, région, bucket et identifiants. `S3_FORCE_PATH_STYLE=true` pour MinIO, R2 ou SeaweedFS |
| `MAX_UPLOAD_MB` | taille maximale d’un fichier (100 par défaut) |

## Déploiement

1. Créer la base PostgreSQL et le bucket S3. En production, le bucket doit exister et ne doit pas être public.
2. `npm ci && npm run build`
3. `npm run migrate` applique les migrations en attente. L’API les applique aussi au démarrage.
4. `NODE_ENV=production npm start`, derrière un proxy HTTPS. `trust proxy` est activé.
5. Servir le front (`npm run build` à la racine, dossier `dist/`) et router `/api` vers l’API sur le **même domaine**. Le cookie de rafraîchissement est `SameSite=Strict` et limité à `/api/auth`.

**Sauvegardes** :

- PostgreSQL : `pg_dump`, ou les sauvegardes automatiques du service géré.
- S3 : versioning du bucket, ou réplication.

Les fichiers sont référencés par `media_files.storage_key` ; une restauration doit garder la base et le bucket cohérents.

## Architecture et décisions

| Sujet | Décision |
|---|---|
| Versions | NestJS 11, TypeORM 0.3 et Zod 3 sont épinglés : versions éprouvées, plutôt que les majeures très récentes. |
| Schéma | Migrations SQL explicites (`src/database/migrations`). `synchronize` est désactivé. Contraintes `CHECK`, clés étrangères `ON DELETE`, index sur l’organisation et les dates. |
| Mots de passe | `scrypt` natif de Node (N = 2^15), comparaison à temps constant, hachage factice pour les e-mails inconnus (pas d’énumération des comptes). |
| Sessions | Jeton d’accès JWT de 15 minutes, gardé en mémoire côté client. Jeton de rafraîchissement aléatoire, stocké uniquement sous forme de hash SHA-256, renouvelé à chaque usage. Son rejeu révoque toutes les sessions de l’utilisateur. |
| Autorisations | `AccessService` vérifie le rôle (owner > admin > editor > viewer) sur chaque projet et fichier. Un non-membre reçoit un 404, ce qui ne révèle pas l’existence de la ressource. |
| Concurrence | `UPDATE … WHERE revision = $base`. En cas de conflit, le 409 renvoie la version courante, que le Studio propose de recharger ou d’écraser. |
| Publication | Copie figée du document (`publications`). Les visiteurs ne voient jamais le brouillon. Deux visibilités : `unlisted` (accès par lien, valeur par défaut) ou `public` (galerie). |
| Fichiers | Upload via l’API : stockage temporaire sur disque, vérification de la signature binaire, SHA-256, puis envoi vers S3. La clé de stockage n’est jamais exposée. L’accès public n’est accordé qu’aux fichiers référencés par la version publiée (n’importe où dans le document : asset, panorama, hotspot). |
| Médiathèque | Formats reconnus par leur contenu : GLB, PNG, JPEG, WebP, MP4/MOV, WebM, PDF, MP3, WAV. Les dimensions des images sont lues dans l’en-tête ; une image 2:1 de 2000 px ou plus est classée « panorama ». Dossiers, favoris, corbeille (suppression logique), restauration. La suppression définitive renvoie 409 `file_in_use` si le brouillon ou la publication référence le fichier. |
| URL signées | `GET /api/files/:id/url` renvoie `/api/media/:id?exp&sig` (HMAC-SHA256, 1 h), utilisable par `<img>`, `<video>` et `<audio>`, qui ne peuvent pas envoyer d’en-tête Authorization. Requêtes `Range` prises en charge (lecture vidéo et audio). |
| Partage | `PATCH /api/projects/:id/publication` : visibilité, mot de passe (hash scrypt), expiration. Une visite expirée répond 410. Une visite protégée répond 401 `password_required` jusqu’à `POST /api/public/tours/:id/access`, qui délivre un jeton HMAC de 12 h (en-tête `x-tour-access`, ou paramètre `?access=` pour les médias). Changer le mot de passe révoque les jetons. Les visites protégées ou expirées n’apparaissent jamais dans la galerie. |
| Document | `hotspots` et `navigation` font partie du document versionné, avec un schéma borné (au plus 10 000 éléments chacun). |
| S3 | `requestChecksumCalculation: WHEN_REQUIRED` : les SDK récents encodent les uploads en flux (`aws-chunked`), encodage que plusieurs services compatibles S3 stockent tel quel. L’intégrité est vérifiée par SHA-256. |
| Statistiques | Calculées en SQL (`viewer_sessions`). Les sessions sont idempotentes (même id, durée croissante, plafond de 4 h) et horodatées par le serveur. Les visites de moins de 2 s sont exclues des durées. |
| Erreurs | Format unique `{ error: { code, message, details? } }`. Les erreurs 500 sont journalisées côté serveur, sans détail exposé au client. |
| Limitation de débit | 600 requêtes par minute et par IP. Authentification : 10 par minute. Sessions visiteurs : 60 par minute. |

## Limites connues et suite

- **E-mails** : pas d’envoi, donc pas de confirmation d’adresse, de réinitialisation du mot de passe ni d’invitation de membres. Les rôles existent et sont appliqués.
- **Fichiers** : ils transitent par l’API. Les URL signées et le CDN sont à prévoir pour les gros volumes, avec une configuration CORS du bucket. Les fichiers d’assets supprimés dans le Studio ne sont pas encore purgés de S3, car l’annulation (Ctrl+Z) doit pouvoir les restaurer ; une tâche de nettoyage est à ajouter.
- **Non commencé** : IA et file de tâches (Redis/BullMQ), facturation, quotas, administration de la plateforme.
- **S3 en développement** : s3rver est un émulateur ancien (2022), utilisé uniquement en local et dans les tests. Pour un environnement plus proche de la production, pointer `S3_*` vers MinIO, SeaweedFS ou un bucket de développement.
