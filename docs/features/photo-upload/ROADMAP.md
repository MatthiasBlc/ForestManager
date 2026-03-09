# Roadmap - Systeme d'upload de photos

Spec : `SPEC_PHOTO_UPLOAD.md`
Guide infra : `GUIDE_MINIO.md`
Tests manuels : `MANUAL_TESTS.md`

---

## Phase A - Infrastructure MinIO

### A.1 - MinIO local (docker-compose dev)
- [x] Ajouter le service `minio` au docker-compose.yml
- [x] Ajouter le service `minio-init` (creation bucket + policy auto)
- [x] Ajouter le volume `minio-data`
- [x] Verifier que `docker compose up` demarre MinIO + cree le bucket
- [x] Tester l'acces console sur `http://localhost:9001`

### A.2 - Variables d'environnement
- [x] Ajouter les variables MINIO_* au `.env.development` (ou equivalent)
- [x] Ajouter les variables MINIO_* au `.env.example` / documentation
- [x] Ajouter la config MinIO dans le backend (fichier de config centralise)

### A.3 - Stack MinIO VPS (preprod + prod)
- [x] Documenter le docker-compose de la stack MinIO pour Portainer
- [x] Creer les buckets preprod et prod
- [x] Configurer la policy public read sur chaque bucket
- [x] Creer le user `forestmanager` + policy IAM
- [x] Configurer les variables d'environnement dans Portainer (preprod)
- [x] Ajouter le reseau `minio-net` aux stacks ForestManager (preprod)
- [x] Verifier la connectivite backend -> MinIO sur le VPS

---

## Phase B - Backend : service MinIO + migration DB

### B.1 - Migration Prisma
- [x] Ajouter `imageKey String?` sur le modele `Recipe` (rename depuis imageUrl)
- [x] Ajouter `imageKey String?` sur le modele `Community`
- [x] Generer et appliquer la migration

### B.2 - Service MinIO (backend)
- [x] Installer le SDK S3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`)
- [x] Creer `src/services/storageService.ts` :
  - `generatePresignedUploadUrl(key: string): Promise<string>`
  - `deleteObject(key: string): Promise<void>`
  - `headObject(key: string): Promise<{ contentType, contentLength }>`
- [x] Creer `src/config/storage.ts` (lecture des variables d'env)
- [x] Tests unitaires du service (mock S3)

---

## Phase C - Backend : endpoints upload recettes

### C.1 - Endpoint presigned URL
- [x] `POST /api/recipes/:id/upload-url`
  - Verifier que l'user est l'auteur de la recette
  - Generer la cle : `recipes/{recipeId}/cover.webp`
  - Retourner `{ uploadUrl, imageKey }`
- [x] Validation : recette existante, non soft-deleted, user = auteur

### C.2 - Endpoint confirmation upload
- [x] `POST /api/recipes/:id/confirm-upload`
  - Verifier que le fichier existe sur MinIO (headObject)
  - Valider MIME type (webp, jpeg, png) et taille (< 2 MB)
  - Si OK : sauvegarder `imageKey` en DB
  - Si KO : supprimer le fichier MinIO + erreur
- [x] Validation des memes permissions (auteur)

### C.3 - Endpoint suppression image
- [x] `DELETE /api/recipes/:id/image`
  - Supprimer le fichier MinIO
  - Mettre `imageKey` a null en DB
- [x] Validation : auteur uniquement

### C.4 - Tests
- [x] Tests d'integration pour les 3 endpoints recettes
- [x] Tests des cas d'erreur (pas auteur, recette inexistante, fichier invalide)

---

## Phase D - Backend : endpoints upload communautes

### D.1 - Endpoint presigned URL
- [x] `POST /api/communities/:id/upload-url`
  - Verifier que l'user est createur ou moderateur
  - Generer la cle : `communities/{communityId}/avatar.webp`
  - Retourner `{ uploadUrl, imageKey }`

### D.2 - Endpoint confirmation upload
- [x] `POST /api/communities/:id/confirm-upload`
  - Meme logique que recettes (head, validate, save ou delete)

### D.3 - Endpoint suppression image
- [x] `DELETE /api/communities/:id/image`

### D.4 - Tests
- [x] Tests d'integration pour les 3 endpoints communautes
- [x] Tests des cas d'erreur

---

## Phase E - Backend : cron nettoyage + suppression cascade

### E.1 - Cron de nettoyage des images orphelines
- [x] Creer `src/jobs/imageCleanup.ts` (meme pattern que `notificationCleanup.ts`)
- [x] Cron a 3h30 : chercher recettes/communautes soft-deleted > 7 jours avec imageKey non null
- [x] Supprimer les fichiers MinIO correspondants
- [x] Mettre imageKey a null en DB
- [x] Logs info/debug
- [x] Tests unitaires

### E.2 - Suppression cascade (hard delete)
- [x] N/A : pas de hard delete pour Recipe/Community dans le code actuel (soft delete uniquement)
- [x] Le cron couvre le nettoyage apres 7 jours de soft delete

---

## Phase F - Frontend : composant d'upload recettes

### F.1 - Utilitaire de conversion d'image
- [x] Creer un utilitaire `imageUtils.ts` :
  - Conversion en WebP (Canvas API)
  - Resize a max 1600px (plus grand cote)
  - Validation taille < 2 MB
  - Validation format (jpeg, png, webp)

### F.2 - Composant ImageUpload
- [x] Composant reutilisable : zone de drop / bouton de selection
- [x] Preview de l'image avant upload
- [x] Indicateur de progression (upload vers MinIO)
- [x] Gestion des erreurs (fichier trop gros, format invalide, echec upload)

### F.3 - Integration page recette
- [x] Ajouter le composant sur le formulaire de creation/edition de recette
- [x] Appel backend pour presigned URL -> upload -> confirm
- [x] Affichage de l'image de couverture existante
- [x] Bouton de suppression de l'image
- [x] Affichage de l'image sur la page de detail de la recette

---

## Phase G - Frontend : upload communautes

### G.1 - Integration page communaute
- [x] Ajouter le composant ImageUpload sur les settings de communaute
- [x] Meme flux : presigned URL -> upload -> confirm
- [x] Affichage de l'avatar existant
- [x] Bouton de suppression
- [x] Affichage de l'avatar dans les listes et pages de communaute

---

## Phase H - Tests end-to-end et polish

- [ ] Test manuel du flux complet : upload, affichage, remplacement, suppression
- [ ] Test du cron de nettoyage (simuler un soft delete > 7 jours)
- [ ] Verifier le comportement avec des images invalides (trop grandes, mauvais format)
- [ ] Verifier les permissions (non-auteur ne peut pas uploader)
- [ ] Tests sur l'environnement preprod
- [ ] Mettre a jour API_MAP, DB_MODELS, FILE_MAP, TESTS dans `.claude/context/`

### H.1 - Bugfixes preprod (decouverts lors des tests)
- [x] Fix presigned URLs : utiliser l'endpoint public (`MINIO_PUBLIC_URL`) au lieu de l'endpoint interne Docker pour les URLs destinees au frontend
- [x] Fix CSP frontend : ajouter `blob:` a `img-src` pour les previews locales, ajouter `https://s3.matthias-bouloc.fr` a `connect-src` pour les uploads MinIO
