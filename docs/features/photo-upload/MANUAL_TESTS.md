# Tests manuels - Phase 15 Photo Upload System

## Prerequis

- App demarree (`npm run docker:up:build`)
- MinIO demarre et accessible (`http://localhost:9001`)
- 1 compte user (User A) proprietaire d'au moins 1 recette
- 1 compte user (User B) membre d'une communaute mais pas auteur de la recette de User A
- 1 communaute dont User A est createur ou moderateur
- Images de test :
  - 1 image JPEG valide (< 2 MB)
  - 1 image PNG valide (< 2 MB)
  - 1 image WebP valide (< 2 MB)
  - 1 image trop grande (> 5 MB)
  - 1 fichier non-image (ex: .txt, .pdf)

---

## 1. Upload image recette - Flux complet

### 1.1 Creation de recette avec image

- [ ] Aller sur la page de creation de recette
- [ ] Zone d'upload visible avec texte "Cliquer ou glisser une image"
- [ ] Cliquer sur la zone → ouvre le selecteur de fichiers
- [ ] Selectionner une image JPEG → preview affichee
- [ ] Indicateur de progression visible pendant le traitement
- [ ] Remplir les champs obligatoires et sauvegarder
- [ ] Recette creee avec l'image visible sur la page de detail

### 1.2 Edition de recette - Ajout d'image

- [ ] Aller sur une recette existante sans image (en tant qu'auteur)
- [ ] Cliquer "Modifier"
- [ ] Zone d'upload visible
- [ ] Glisser-deposer une image PNG → preview affichee
- [ ] Sauvegarder
- [ ] Image visible sur la page de detail

### 1.3 Remplacement d'image

- [ ] Aller sur une recette avec image (en tant qu'auteur)
- [ ] Cliquer "Modifier"
- [ ] Image actuelle affichee avec bouton de suppression
- [ ] Cliquer sur la zone ou selectionner une nouvelle image
- [ ] Nouvelle preview affichee (remplace l'ancienne)
- [ ] Sauvegarder
- [ ] Nouvelle image visible sur la page de detail
- [ ] Ancienne image supprimee de MinIO (verifier dans la console MinIO)

### 1.4 Suppression d'image

- [ ] Aller sur une recette avec image (en tant qu'auteur)
- [ ] Cliquer "Modifier"
- [ ] Cliquer le bouton de suppression (X ou poubelle) sur l'image
- [ ] Image disparait, zone d'upload vide reapparait
- [ ] Sauvegarder
- [ ] Page de detail sans image (placeholder ou rien)
- [ ] Image supprimee de MinIO

---

## 2. Upload image communaute - Flux complet

### 2.1 Ajout d'avatar communaute

- [ ] Aller sur les parametres d'une communaute (en tant que createur/moderateur)
- [ ] Zone d'upload avatar visible
- [ ] Selectionner une image WebP → preview affichee
- [ ] Sauvegarder
- [ ] Avatar visible sur la page de la communaute
- [ ] Avatar visible dans la liste des communautes

### 2.2 Remplacement d'avatar

- [ ] Communaute avec avatar existant
- [ ] Parametres → selectionner nouvelle image
- [ ] Preview mise a jour
- [ ] Sauvegarder
- [ ] Nouveau avatar affiche partout

### 2.3 Suppression d'avatar

- [ ] Communaute avec avatar existant
- [ ] Parametres → cliquer bouton supprimer
- [ ] Avatar supprime, zone vide
- [ ] Sauvegarder
- [ ] Avatar par defaut (initiales ou placeholder) affiche

---

## 3. Validation et erreurs

### 3.1 Fichier trop volumineux

- [ ] Tenter d'uploader une image > 5 MB (avant conversion)
- [ ] Message d'erreur affiche : "Image trop volumineuse"
- [ ] Pas de preview, pas d'upload

### 3.2 Format non supporte

- [ ] Tenter d'uploader un fichier .txt ou .pdf
- [ ] Message d'erreur : "Format non supporte"
- [ ] Pas de preview, pas d'upload

### 3.3 Image corrompue

- [ ] Tenter d'uploader un fichier renomme en .jpg mais qui n'est pas une image
- [ ] Message d'erreur affiche
- [ ] Pas d'upload

### 3.4 Conversion WebP

- [ ] Uploader une image JPEG de 1.5 MB
- [ ] Verifier dans MinIO que le fichier stocke est en .webp
- [ ] Taille reduite par rapport a l'original

### 3.5 Redimensionnement

- [ ] Uploader une image de 4000x3000 pixels
- [ ] Verifier dans MinIO que l'image est redimensionnee (max 1600px cote le plus long)

---

## 4. Permissions

### 4.1 Non-auteur ne peut pas uploader sur une recette

- [ ] Se connecter en tant que User B
- [ ] Aller sur une recette de User A
- [ ] Pas de bouton "Modifier" ou zone d'upload visible
- [ ] Tenter d'acceder directement a l'URL d'edition → redirection ou erreur 403

### 4.2 Non-moderateur ne peut pas uploader sur une communaute

- [ ] Se connecter en tant que membre simple (pas createur ni moderateur)
- [ ] Aller sur les parametres de la communaute
- [ ] Pas d'acces aux parametres ou zone d'upload non visible

### 4.3 Utilisateur non connecte

- [ ] Se deconnecter
- [ ] Tenter d'acceder a une page d'edition de recette → redirection vers login

---

## 5. Affichage des images

### 5.1 Page de detail recette

- [ ] Image de couverture affichee en haut de la page
- [ ] Image responsive (s'adapte a la taille de l'ecran)
- [ ] Cliquer sur l'image → agrandissement (lightbox) ou rien selon implementation

### 5.2 Liste des recettes

- [ ] Miniature de l'image visible dans la carte recette
- [ ] Recettes sans image → placeholder ou couleur de fond

### 5.3 Page communaute

- [ ] Avatar affiche dans l'en-tete de la communaute
- [ ] Avatar affiche dans la liste des communautes
- [ ] Communautes sans avatar → initiales ou placeholder

### 5.4 Chargement

- [ ] Images chargees en lazy loading (pas de blocage de la page)
- [ ] Placeholder ou skeleton pendant le chargement

---

## 6. Cron de nettoyage des images orphelines

### 6.1 Simulation de nettoyage (en local)

Pour tester le cron, on peut simuler une recette soft-deleted > 7 jours :

1. Creer une recette avec image
2. Soft-delete la recette (supprimer via l'UI)
3. En DB, modifier `deletedAt` pour qu'il date de plus de 7 jours :
   ```sql
   UPDATE "Recipe" SET "deletedAt" = NOW() - INTERVAL '8 days' WHERE id = '<recipe-id>';
   ```
4. Declencher manuellement le job ou attendre 03:30
5. Verifier :
   - [ ] Image supprimee de MinIO
   - [ ] `imageKey` mis a null en DB

### 6.2 Verification des logs

- [ ] Les logs du cron affichent les images nettoyees
- [ ] Pas d'erreur dans les logs

---

## 7. URLs publiques

### 7.1 Acces direct aux images

- [ ] Copier l'URL d'une image depuis l'inspecteur du navigateur
- [ ] Ouvrir l'URL dans un nouvel onglet (non connecte)
- [ ] Image accessible publiquement

### 7.2 URL correcte

- [ ] URL de la forme : `http://localhost:9000/forestmanager-images-dev/recipes/{id}/cover.webp`
- [ ] En preprod : `https://s3.matthias-bouloc.fr/forestmanager-images-preprod/recipes/{id}/cover.webp`

---

## 8. Tests sur environnement preprod (VPS)

- [ ] Deployer la branche sur preprod
- [ ] Repeter les tests 1.1 a 1.4 (upload recette)
- [ ] Repeter les tests 2.1 a 2.3 (upload communaute)
- [ ] Verifier que les images sont stockees dans le bucket `forestmanager-images-preprod`
- [ ] Verifier que les URLs publiques fonctionnent (`https://s3.matthias-bouloc.fr/...`)

---

## Resume des tests

| Section | Description             | Status |
| ------- | ----------------------- | ------ |
| 1       | Upload image recette    | [ ]    |
| 2       | Upload image communaute | [ ]    |
| 3       | Validation et erreurs   | [ ]    |
| 4       | Permissions             | [ ]    |
| 5       | Affichage des images    | [ ]    |
| 6       | Cron de nettoyage       | [ ]    |
| 7       | URLs publiques          | [ ]    |
| 8       | Tests preprod           | [ ]    |
