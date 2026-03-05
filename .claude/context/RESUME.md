# Resume - Photo Upload System

## Branche : `UploadImageSystem`

## Etat : Phases A-G terminees, commits propres, working tree clean

## Commits sur la branche (10 commits, pas de Co-Authored-By)

1. `ed4f361` Phase E input validation (pre-existant)
2. `9d71409` Phase F input validation (pre-existant)
3. `562c196` Phase G.1 input validation (pre-existant)
4. `36b9e9d` Phase A.1 - spec, guide MinIO, docker-compose minio+init
5. `558b4fc` Phase A.2 + B - storage config, S3 SDK, migration imageUrl->imageKey
6. `a20bdef` Phase C - recipe image endpoints (presigned URL, confirm, delete)
7. `2db02be` Phase D - community image endpoints
8. `0bab8e2` Phase E - image cleanup cron job
9. `abeb8e9` Phase F - frontend image upload for recipes (ImageUpload component, imageUtils)
10. `ae25d6a` Phase G - frontend community image upload (CommunityEditForm, CommunityCard, CommunityDetailPage)

## IMPORTANT : revert utilisateur

L'utilisateur a revert les changements frontend de Phase G sur ces fichiers (via son IDE) :
- `frontend/src/models/community.ts` - imageUrl retire de CommunityListItem et CommunityDetail
- `frontend/src/components/communities/CommunityEditForm.tsx` - ImageUpload retire
- `frontend/src/components/communities/CommunityCard.tsx` - image retire
- `frontend/src/pages/CommunityDetailPage.tsx` - avatar et initialImageUrl retires
- `frontend/src/pages/CommunityEditPage.tsx` - ImageUpload retire

Ces fichiers sont dans le commit `ae25d6a` mais le working tree a ete revert par l'utilisateur.
Le backend (`backend/src/controllers/communities.ts` avec imageKey/imageUrl) est OK dans le commit.

## Ce qui reste

### Tests manquants (roadmap)
- B.2 : Tests unitaires storageService (mock S3)
- C.4 : Tests integration endpoints image recettes
- D.4 : Tests integration endpoints image communautes
- E.1 : Tests unitaires imageCleanup cron

### Phase H - Tests E2E et polish
- Test manuel flux complet
- Verifier images invalides
- Verifier permissions
- Tests preprod
- Mettre a jour API_MAP, DB_MODELS, FILE_MAP, TESTS dans `.claude/context/`

### Phase A.3 - VPS MinIO (differe)
- Stack MinIO separee sur VPS avec Traefik
- Buckets preprod/prod, IAM, reseau minio-net

## Note technique
- Le fichier `backend/prisma/migrations/20260305104825_photo_upload_image_key/migration.sql` a des permissions root (cree par Docker). Deja corrige avec `sudo chown`.
