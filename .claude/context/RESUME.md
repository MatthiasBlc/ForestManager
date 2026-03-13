# Resume - Nettoyage docs & contexte MVP propre

## Fait

### Etape 1 : Supprimer `docs/mvp/` ✅

```bash
rm -rf docs/mvp/
```

### Etape 2 : Supprimer roadmaps et manual_tests des features completes ✅

Fichiers supprimes :

- `docs/features/tags-rework/ROADMAP.md` + `MANUAL_TESTS.md`
- `docs/features/ingredients-rework/ROADMAP.md` + `MANUAL_TESTS.md`
- `docs/features/notifications-rework/ROADMAP.md` + `MANUAL_TESTS.md`
- `docs/features/recipe-rework-v2/ROADMAP.md` + `MANUAL_TESTS.md`
- `docs/features/input-validation-security/ROADMAP.md`
- `docs/features/photo-upload/ROADMAP.md` + `MANUAL_TESTS.md`
- `docs/features/audit-refactorisation/ROADMAP.md`

---

## Reste a faire

### Etape 3 : Reecrire `.claude/context/PROGRESS.md`

Remplacer le contenu actuel (73 lignes) par :

```markdown
# Avancement du projet

## MVP COMPLET

Phases 0 a 17 terminees (tags rework, ingredients rework, notifications, recipe v2, input validation, photo upload, recipe import, audit refactorisation, fix HelloFresh).

## Feature en cours : Recipe Import (finalisation)

- **Spec** : `docs/features/recipe-import/SPEC_RECIPE_IMPORT.md`
- **Roadmap** : `docs/features/recipe-import/ROADMAP.md`

## Feature planifiee : E2E Testing

- **Spec** : `docs/features/e2e-testing/SPEC_E2E_TESTING.md`
- **Roadmap** : `docs/features/e2e-testing/ROADMAP.md`

## Idees futures

Voir `docs/0 - brainstorming futur.md`

## Resume de reprise

Si une session precedente a ete interrompue, un fichier `.claude/context/RESUME.md` peut
contenir l'etat exact du travail en cours. Verifier son existence avant de demarrer.
```

---

### Etape 4 : Simplifier `.claude/CLAUDE.md`

#### 4a. Remplacer la section "Phase actuelle" (lignes 39-42)

Ancien :

```
## Phase actuelle

**Phase 16** - Recipe Import : EN COURS.
Voir `.claude/context/PROGRESS.md` pour le detail et les liens vers spec/roadmap.
```

Nouveau :

```
## Phase actuelle

MVP complet (phases 0-17). Voir `.claude/context/PROGRESS.md` pour les features en cours.
```

#### 4b. Remplacer la section "PROGRESS.md : garder le fichier compact" (lignes 59-63)

Ancien :

```
### PROGRESS.md : garder le fichier compact

- Juste un lien vers la phase en cours (spec + roadmap dans `docs/features/`)
- Pas de duplication de la roadmap dans PROGRESS
- Le detail du MVP est dans `docs/mvp/DEVELOPMENT_ROADMAP.md` (archive, ne plus modifier)
```

Nouveau :

```
### PROGRESS.md : garder le fichier compact

- Juste un lien vers la phase en cours (spec + roadmap dans `docs/features/`)
- Pas de duplication de la roadmap dans PROGRESS
```

#### 4c. Remplacer la section "Organisation docs/" (lignes 65-96)

Nouveau contenu :

````
## Organisation docs/

\```
docs/
  0 - brainstorming futur.md       # Idees futures (transversal)
  features/                         # Specs par feature post-MVP
    tags-rework/
      SPEC_TAGS_REWORK.md
    ingredients-rework/
      SPEC_INGREDIENTS_REWORK.md
    recipe-rework-v2/
      SPEC_RECIPE_REWORK_V2.md
    notifications-rework/
      SPEC_NOTIFICATIONS_REWORK.md
    input-validation-security/
      SPEC_INPUT_VALIDATION.md
    photo-upload/
      SPEC_PHOTO_UPLOAD.md
      GUIDE_MINIO.md
    audit-refactorisation/
      SPEC_AUDIT_REFACTORISATION.md
    recipe-import/                    # EN COURS
      SPEC_RECIPE_IMPORT.md
      ROADMAP.md
    e2e-testing/                      # PLANIFIE
      SPEC_E2E_TESTING.md
      ROADMAP.md
\```

Chaque nouvelle feature a son dossier dans `docs/features/` avec au minimum une spec et une roadmap.
````

#### 4d. Remplacer le tableau "Contexte approfondi" (lignes 98-141)

Supprimer toutes les lignes des features COMPLETE et de l'archive MVP. Garder uniquement :

```
## Contexte approfondi (lire selon le besoin)

| Besoin                              | Fichier                                                             |
| ----------------------------------- | ------------------------------------------------------------------- |
| Avancement & phase en cours         | `.claude/context/PROGRESS.md`                                       |
| Tests: commandes, inventaire, infra | `.claude/context/TESTS.md`                                          |
| Endpoints API complets              | `.claude/context/API_MAP.md`                                        |
| Schema DB & modeles Prisma          | `.claude/context/DB_MODELS.md`                                      |
| Arborescence fichiers source        | `.claude/context/FILE_MAP.md`                                       |
| Idees futures                       | `docs/0 - brainstorming futur.md`                                   |
| **Feature : Recipe Import**         |                                                                     |
| Spec Recipe Import                  | `docs/features/recipe-import/SPEC_RECIPE_IMPORT.md`                 |
| Roadmap Recipe Import               | `docs/features/recipe-import/ROADMAP.md`                            |
| **Feature : E2E Testing**           |                                                                     |
| Spec E2E Testing                    | `docs/features/e2e-testing/SPEC_E2E_TESTING.md`                     |
| Roadmap E2E Testing                 | `docs/features/e2e-testing/ROADMAP.md`                              |
| **Specs features (reference)**      |                                                                     |
| Tags Rework                         | `docs/features/tags-rework/SPEC_TAGS_REWORK.md`                     |
| Ingredients Rework                  | `docs/features/ingredients-rework/SPEC_INGREDIENTS_REWORK.md`       |
| Recipe Rework v2                    | `docs/features/recipe-rework-v2/SPEC_RECIPE_REWORK_V2.md`           |
| Input Validation                    | `docs/features/input-validation-security/SPEC_INPUT_VALIDATION.md`  |
| Notifications Rework                | `docs/features/notifications-rework/SPEC_NOTIFICATIONS_REWORK.md`   |
| Photo Upload                        | `docs/features/photo-upload/SPEC_PHOTO_UPLOAD.md`                   |
| Guide MinIO                         | `docs/features/photo-upload/GUIDE_MINIO.md`                         |
| Audit Refactorisation               | `docs/features/audit-refactorisation/SPEC_AUDIT_REFACTORISATION.md` |
```

---

### Etape 5 : Mettre a jour `docs/0 - brainstorming futur.md`

Remplacer la section (lignes 89-95) :

```
# Update des docs et petit ménage dans Progress.md ?

Mettre à jour les différents doc, archiver les features terminées (pourquoi pas même les delete si ce n'est plus nécessaire, en conservant le nécessaire dans une documentation globale un wiki dans le github ? autre?)
Mettre à jour les fichiers claude et les suivi du travail.
On considère ici le mvp propre, ce qui arrivera par la suite sera des features qui viendront se greffer sur la production.
Progress.md a toujours besoin de conserver des références aux étapes de construction du mvp ?
```

Par :

```
# ~~Update des docs et petit ménage dans Progress.md ?~~ DONE

docs/mvp/ supprime, roadmaps des features terminees supprimees, PROGRESS/CLAUDE.md simplifies.
Les specs fonctionnelles (SPEC_*.md) sont conservees dans docs/features/ comme reference.
```

---

### Etape 6 : Mettre a jour `.claude/context/TESTS.md`

Ligne 45, remplacer :

```
## Inventaire des tests (~1271 tests)
```

Par :

```
## Inventaire des tests (~810 tests backend + ~469 tests frontend = ~1279 tests)
```

Note : verifier le nombre exact en lisant les totaux des tableaux (802 backend d'apres le dernier comptage PROGRESS). Le total dans TESTS.md dit 1271 mais les tableaux listent 665 integration + 137 unit backend + 469 frontend = 1271. Garder ~1271 si c'est toujours correct, ou mettre a jour si de nouveaux tests ont ete ajoutes depuis.

---

### Etape 7 : Mettre a jour `.claude/context/FILE_MAP.md`

A la fin du fichier (section "Configuration racine", apres ligne 452), l'arborescence docs n'est pas listee dans FILE_MAP.md donc rien a changer dans FILE_MAP sauf si on veut ajouter une section docs.

Verifier que rien dans FILE_MAP ne reference les fichiers supprimes. Actuellement FILE_MAP ne couvre que `backend/src/`, `frontend/src/` et la config racine — pas `docs/`. Donc **aucune modification necessaire** dans FILE_MAP.

---

### Verification finale

```bash
git status
```

Verifier :

- `docs/mvp/` supprime
- 12 fichiers ROADMAP/MANUAL_TESTS supprimes dans `docs/features/`
- `PROGRESS.md`, `CLAUDE.md`, `brainstorming futur.md`, `TESTS.md` modifies
- Aucun fichier reference dans CLAUDE.md ne pointe vers un fichier supprime

Puis supprimer ce fichier `RESUME.md` une fois le nettoyage termine.
