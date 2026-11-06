# Plan C3 - Module Recettes

Statut : voir le journal (D160 a D162). Les sous-etapes sont des cases dans `4-Roadmap.md`.
References : `1-CDC-V2.md` S4.3 a S4.5, `11-Modele-Donnees/schema.prisma` sections 4 et 5, `12-Permissions.md` (Recettes), `13-Parcours.md` (P06 a P10), `16-Maquettes/2-Recettes/`, `15-Plan-Tests.md` (Recettes). V1 relue depuis `v1-final` : import (`recipeImportService.ts`, `SPEC_RECIPE_IMPORT.md`), stockage (`GUIDE_MINIO.md`).

## 1. Perimetre

**Dans C3** : referentiels minimaux necessaires aux recettes [D160], recettes simples et composees, revisions, tags, recherche, partage par reference et demandes de partage, adaptation et comparaison, suggestions, suppression et reprise par les moderateurs, crochets du cycle de vie (D18, D83, D84), photos et avatars (MinIO, D146), import par URL et par texte, mode cuisine, lecture hors ligne des recettes ouvertes et desactivation des ecritures hors ligne (D159).

**Hors C3** : gestion des referentiels par le super admin (fusion d'ingredients, traductions, poids par unite, rayons, tags globaux) en C4 ; compteurs lies au planning (fois planifiee, derniere fois cuisinee, D39) en C5 ; notifications des demandes et suggestions en C6 (en C3, elles se lisent dans des listes "en attente") ; export (C6).

## 2. Decoupage [D161]

Tranches verticales : chaque sous-etape livre l'API, le partage (schemas, permissions de module) et les ecrans, avec ses tests (integration, composants) ecrits d'abord [D151].

### C3.1 Referentiels minimaux et domaine pur

- Migration : unites, rayons, ingredients et traductions, tags (globaux et d'espace). Seed idempotent : unites francaises usuelles (g, kg, ml, cl, l, c. a cafe, c. a soupe, tasse, piece, pincee, a gout...), rayons, une dizaine de tags globaux.
- `packages/shared/src/units/` : conversion dans une dimension, mise a l'echelle d'une quantite, formatage a la francaise (virgule, fractions usuelles) ; tests unitaires.
- API : autocompletion d'ingredients (prefixe normalise, synonymes fusionnes D120, `unaccent` + `pg_trgm`), creation a la volee (D09), liste des unites, tags d'espace (creation libre ; renommer, fusionner, supprimer par les moderateurs) et tags globaux.

### C3.2 Recettes simples

- Migration Recettes (sections 5 du schema cible, hors suggestions et partage) et manifeste API `recipes` complet (permissions de la matrice B2).
- API : creer, lire, modifier, supprimer (D57, D10) une recette d'un espace ; liste paginee avec recherche et filtres (texte, tags, ingredients, temps max, auteur), tri.
- Web : E-RECETTES (liste, filtres, etats vide, chargement, erreur), E-RECETTE (detail, portions avec mise a l'echelle), E-RECETTE-EDITION (TopBar en mode edition D136, brouillon local D104), F-AJOUT-RECETTE, F-CONFIRMER. Composants RecipeCard, IngredientRow, QuantityInput (D108).

### C3.3 Revisions

- Instantane a chaque enregistrement (D05, D30), historique, restauration (meme droit que modifier, D55), bouton "Enregistrer la revision N" (D102).
- Web : E-HISTORIQUE.

### C3.4 Recettes composees

- Blocs LOCAL et RECIPE (D24), rendement, refus des boucles et des profondeurs > 3, lien vivant, bases proposees d'abord (D107), mise a l'echelle des quantites a travers les niveaux (domaine pur, teste).
- Web : RecipeBlock, F-AJOUT-BLOC, F-LIER-RECETTE.

### C3.5 Partage

- Partage par reference (D03), sous-recettes partagees ensemble (D26), demandes de partage et confiance de l'auteur (D81, D101), retrait d'un espace de partage (F-REC-9), tags propres a chaque espace (D19).
- Crochets : depart d'un membre (D18, D84 : laisser ou retirer ses recettes perso partagees), purge d'un espace (D83 : rapatriement chez l'auteur). Vue "Mes recettes" de l'espace perso (D82).
- Web : F-PARTAGER, demandes en attente, F-ACTIONS ; F-QUITTER complete (D84).

### C3.6 Adaptation et suggestions

- Adapter pour un espace (D17), badge "original modifie", E-COMPARER-ORIGINAL (D105), "Proposer a l'original".
- Suggestions : diff champ par champ, accepter (revision SUGGESTION), refuser, retirer, convertir en adaptation (D140) ; decision par l'auteur ou un moderateur si l'auteur est parti.
- Web : F-ADAPTER, E-COMPARER-ORIGINAL, E-SUGGESTION-EDITION, E-SUGGESTION.

### C3.7 Photos et avatars (MinIO)

- `core/storage/` : URL presignee PUT courte (60 s), verification serveur (type, taille, dimensions), lecture par URL presignee courte (espaces prives), nettoyage des orphelins. Conversion WebP et redimensionnement dans le navigateur.
- Photo de recette, avatar d'utilisateur et d'espace (D146) ; reseau `minio-net` deja present dans les compose (D147).
- Realisation (D167) : POST signe au lieu de PUT, photo hors revisions, bucket V1 rendu prive, RustFS en dev et test.

### C3.8 Import

- Par URL : JSON-LD Recipe, anti-SSRF a chaque redirection (5 max, resolution DNS, refus des IP privees, locales, link-local et metadata), delai et taille bornes, rate limit. Par texte colle : analyse simple (titre, ingredients, etapes) a relire avant enregistrement. Revision IMPORT.
- Web : F-IMPORT-URL, F-IMPORT-TEXTE (cas HelloFresh de la V1 dans les tests).
- Realisation : D168.

### C3.9 Mode cuisine et hors ligne

- E-MODE-CUISINE (etapes en grand, Wake Lock, ingredients a cocher, F-INGREDIENTS), action principale fixe sur mobile (D100).
- TanStack Query persiste dans IndexedDB (recettes ouvertes, 14 jours), badge hors ligne sur les cartes, ecritures desactivees bouton par bouton avec la raison (D106, D117, D159).

## 3. Definition de fini de C3

- Chaque regle Recettes de la matrice B2 couverte en integration, un test par role genere depuis les permissions du manifeste.
- Ecrans des maquettes Recettes livres en mobile et bureau, tests de composants verts (axe sans violation).
- Import teste contre des pages de fixtures, anti-SSRF teste avec un serveur local qui redirige vers une IP privee.
- Lint, typecheck, build et CI verts ; README du chantier et roadmap a jour.
