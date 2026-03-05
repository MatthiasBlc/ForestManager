# Spec - Systeme d'upload de photos

## Perimetre

- **Photos de recettes** : 1 image de couverture par recette
- **Photos de communautes** : 1 avatar par communaute
- Miniature user : hors scope (evolution future)

## Infrastructure

- **MinIO** self-hosted, stack Docker separee (service d'infra, comme Traefik)
- Bucket dedie par environnement :
  - `forestmanager-images-dev` (local)
  - `forestmanager-images-preprod` (VPS)
  - `forestmanager-images-prod` (VPS)
- Credentials specifiques au projet (policy IAM limitee au bucket)
- Reseau Docker partage (`minio-net`) entre la stack MinIO et la stack ForestManager
- Voir `GUIDE_MINIO.md` pour l'installation et la configuration

## Stockage

### Organisation des fichiers

```
recipes/{recipeId}/cover.webp
communities/{communityId}/avatar.webp
```

### Base de donnees

- Champ `imageKey` (`String?`, nullable) sur `Recipe` et `Community`
- Stocke la **cle relative** (ex: `recipes/abc-123/cover.webp`), pas l'URL complete
- L'URL publique est construite a la volee : `{MINIO_PUBLIC_URL}/{bucket}/{imageKey}`
- Migration facile si changement de domaine ou de provider

## Flux d'upload (presigned PUT)

```
1. Frontend  -->  Backend : POST /api/recipes/:id/upload-url
2. Backend   -->  MinIO   : genere presigned PUT URL (TTL 60s)
3. Backend   -->  Frontend : { uploadUrl, imageKey }
4. Frontend  : convertit image en WebP + resize (max 1600px) cote client
5. Frontend  -->  MinIO   : PUT directement via presigned URL
6. Frontend  -->  Backend : POST /api/recipes/:id/confirm-upload { imageKey }
7. Backend   -->  MinIO   : valide le fichier (MIME, taille)
8a. Validation OK  --> Backend sauvegarde imageKey en DB
8b. Validation KO  --> Backend supprime le fichier MinIO + renvoie erreur
```

Meme flux pour les communautes avec les endpoints adaptes.

## Lecture des images

- **Bucket en public read** (policy publique en lecture)
- Images servies directement par MinIO via Traefik
- Pas de presigned GET (simplicite, performance, cache navigateur)
- Les URLs contiennent des UUIDs donc non devinables
- URL type : `https://s3.matthias-bouloc.fr/forestmanager-images-prod/recipes/{uuid}/cover.webp`

## Contraintes fichier

| Contrainte | Valeur |
|-----------|--------|
| Formats acceptes a l'upload | `image/webp`, `image/jpeg`, `image/png` |
| Format final sur MinIO | WebP (conversion cote frontend) |
| Taille max | **2 MB** |
| Dimensions max | 1600 x 1600 px |
| 1 image par entite | Pas de galerie |

## Permissions

| Action | Qui peut |
|--------|----------|
| Upload photo recette | Auteur de la recette uniquement |
| Upload photo communaute | Createur ou Moderateurs de la communaute |
| Remplacement | Ecrasement (meme cle `cover.webp`), pas de versioning |

Modifier la photo d'une recette dont on n'est pas l'auteur passe par le systeme de propositions de modification existant.

## Suppression et nettoyage

### Soft delete (recette/communaute)

- L'image **reste sur MinIO** tant que l'entite est en soft delete
- Si l'entite est restauree, l'image est toujours disponible

### Cron de nettoyage (hard delete des images orphelines)

- **Job applicatif** (`node-cron`), meme pattern que `notificationCleanup.ts`
- Execute tous les jours a **3h30**
- Supprime les images MinIO des recettes/communautes soft-deleted depuis **> 7 jours**
- Met `imageKey` a `null` en DB apres suppression
- Logs d'execution (info/debug)

### Hard delete d'entite

- Suppression immediate de l'image MinIO associee

## Securite

| Mesure | Detail |
|--------|--------|
| Presigned PUT | TTL 60 secondes |
| Validation post-upload | MIME type + taille verifies cote backend |
| Pas de transit fichier par le backend | Upload direct frontend -> MinIO |
| Credentials par bucket | Isolation des projets sur la meme instance MinIO |
| Rejet si invalide | Suppression du fichier + erreur renvoyee |

## Variables d'environnement (backend)

```env
MINIO_ENDPOINT=minio:9000          # hostname interne Docker (dev) ou s3.matthias-bouloc.fr (prod)
MINIO_ACCESS_KEY=forestmanager
MINIO_SECRET_KEY=<secret>
MINIO_BUCKET=forestmanager-images-dev
MINIO_PUBLIC_URL=http://localhost:9000  # URL publique pour construire les URLs d'images
MINIO_USE_SSL=false                     # true en prod (Traefik TLS)
```

## Endpoints API

### Recettes

| Methode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/recipes/:id/upload-url` | Genere une presigned PUT URL |
| POST | `/api/recipes/:id/confirm-upload` | Confirme et valide l'upload |
| DELETE | `/api/recipes/:id/image` | Supprime l'image |

### Communautes

| Methode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/communities/:id/upload-url` | Genere une presigned PUT URL |
| POST | `/api/communities/:id/confirm-upload` | Confirme et valide l'upload |
| DELETE | `/api/communities/:id/image` | Supprime l'image |

## Schema DB (migration Prisma)

```prisma
model Recipe {
  // ... champs existants
  imageKey  String?   // ex: "recipes/abc-123/cover.webp"
}

model Community {
  // ... champs existants
  imageKey  String?   // ex: "communities/xyz-789/avatar.webp"
}
```
