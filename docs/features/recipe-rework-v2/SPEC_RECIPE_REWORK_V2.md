# Spec : Recipe Rework v2

> Phase 13 - Rework complet des pages recettes

## Objectif

Transformer les recettes d'un format basique (titre + texte libre + ingredients) vers un format structure et professionnel : nombre de personnes avec scaling des quantites, temps de preparation/cuisson/repos, etapes sequentielles numerotees. Inspiration : Magimix (mobile) pour le layout sequentiel.

---

## 1. Changements Schema DB

### 1.1 Recipe - Nouveaux champs

```prisma
model Recipe {
  // ... champs existants inchanges (id, title, imageUrl, isVariant, etc.)

  // SUPPRIME: content String  (remplace par RecipeStep)

  // NOUVEAUX CHAMPS
  servings  Int           // Nombre de personnes (base pour le scaling)
  prepTime  Int?          // Temps de preparation en minutes
  cookTime  Int?          // Temps de cuisson en minutes
  restTime  Int?          // Temps de repos en minutes

  // NOUVELLE RELATION
  steps     RecipeStep[]

  // ... relations existantes inchangees
}
```

**Suppression du champ `content`** : remplace par la relation `steps`. Migration necessaire (voir section 6).

### 1.2 Nouveau modele : RecipeStep

```prisma
model RecipeStep {
  id          String  @id @default(uuid())
  recipeId    String
  recipe      Recipe  @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  order       Int     // 0-based, definit l'ordre d'affichage
  instruction String  // Texte de l'etape

  @@index([recipeId, order])
}
```

- **Cascade delete** : les steps sont supprimes avec la recette
- **order** : entier 0-based, pas de contrainte unique (gere applicativement)

### 1.3 RecipeUpdateProposal - Modifications

```prisma
model RecipeUpdateProposal {
  // ... champs existants

  // SUPPRIME: proposedContent String

  // NOUVEAUX CHAMPS
  proposedServings  Int?    // null = pas de changement propose
  proposedPrepTime  Int?    // null = pas de changement propose
  proposedCookTime  Int?    // null = pas de changement propose
  proposedRestTime  Int?    // null = pas de changement propose

  // NOUVELLE RELATION
  proposedSteps     ProposalStep[]

  // ... relations existantes inchangees
}
```

### 1.4 Nouveau modele : ProposalStep

```prisma
model ProposalStep {
  id          String                @id @default(uuid())
  proposalId  String
  proposal    RecipeUpdateProposal  @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  order       Int
  instruction String

  @@index([proposalId, order])
}
```

### 1.5 Resume des changements DB

| Action | Modele | Detail |
|--------|--------|--------|
| Ajouter champs | Recipe | `servings`, `prepTime`, `cookTime`, `restTime` |
| Supprimer champ | Recipe | `content` |
| Creer table | RecipeStep | `id`, `recipeId`, `order`, `instruction` |
| Modifier champs | RecipeUpdateProposal | Supprimer `proposedContent`, ajouter `proposedServings`, `proposedPrepTime`, `proposedCookTime`, `proposedRestTime` |
| Creer table | ProposalStep | `id`, `proposalId`, `order`, `instruction` |

---

## 2. Regles metier

### 2.1 Servings (nombre de personnes)

- **Obligatoire** a la creation et la modification d'une recette
- Type : entier positif
- Validation : `min 1, max 100`
- Sert de base pour le calcul proportionnel des quantites d'ingredients

### 2.2 Temps

| Champ | Obligatoire | Type | Validation |
|-------|------------|------|------------|
| `prepTime` | Non | Int (minutes) | `>= 0, <= 10000` |
| `cookTime` | Non | Int (minutes) | `>= 0, <= 10000` |
| `restTime` | Non | Int (minutes) | `>= 0, <= 10000` |

- **Total** calcule cote client : `totalTime = (prepTime ?? 0) + (cookTime ?? 0) + (restTime ?? 0)`
- Affiche uniquement si au moins un temps est defini
- Format d'affichage : `"2h30"` pour 150min, `"45 min"` pour 45min

### 2.3 Etapes (RecipeStep)

- **Au moins 1 etape requise** a la creation/modification
- Chaque etape contient uniquement un texte d'instruction (pas de titre)
- Numerotation automatique basee sur `order` (affichage 1-based : "Etape 1", "Etape 2"...)
- Pas de limite max de steps
- `instruction` : non vide, max 5000 caracteres par etape
- Reordonnancement possible dans le formulaire (drag & drop ou boutons up/down)

### 2.4 Scaling des quantites (client-side uniquement)

```
displayedQuantity = baseQuantity * (selectedServings / recipe.servings)
```

- **Aucune ecriture en DB** lors du changement de servings par l'utilisateur
- Arrondi a 2 decimales max, suppression des zeros inutiles (ex: `2.50` → `2.5`, `3.00` → `3`)
- Si `ingredient.quantity` est null → pas de scaling, affichage tel quel
- Si `recipe.servings` n'est pas defini (recettes migrees non editees) → selecteur masque, pas de scaling
- Le selecteur remet les valeurs par defaut quand l'utilisateur quitte la page

### 2.5 Codes erreur

| Code | Message | Contexte |
|------|---------|----------|
| `RECIPE_006` | At least one step is required | Create/Update sans steps |
| `RECIPE_007` | Step instruction cannot be empty | Step avec instruction vide |
| `RECIPE_008` | Invalid servings value | servings < 1 ou > 100 |
| `RECIPE_009` | Invalid time value | Temps negatif ou > 10000 |

---

## 3. Changements API

### 3.1 Create Recipe - `POST /api/recipes/`

**Input (nouveau format) :**
```json
{
  "title": "Brioche a la praline",
  "imageUrl": "https://...",
  "servings": 6,
  "prepTime": 30,
  "cookTime": 45,
  "restTime": 120,
  "tags": ["brioche", "praline"],
  "ingredients": [
    { "name": "farine", "quantity": 500, "unitId": "uuid-g" },
    { "name": "pralines roses", "quantity": 200, "unitId": "uuid-g" }
  ],
  "steps": [
    { "instruction": "Melanger la farine et le sel dans un grand saladier." },
    { "instruction": "Ajouter les oeufs et le lait tiede." },
    { "instruction": "Petrir 10 minutes puis laisser reposer 2h." },
    { "instruction": "Incorporer les pralines concassees et enfourner a 180C." }
  ]
}
```

**Champ supprime** : `content`

**Validations ajoutees** :
- `servings` : requis, entier, 1-100
- `steps` : requis, array non vide
- `steps[].instruction` : requis, non vide, max 5000 chars
- `prepTime`, `cookTime`, `restTime` : optionnels, entier, 0-10000

### 3.2 Update Recipe - `PATCH /api/recipes/:recipeId`

Memes champs que create, tous optionnels (patch partiel). Si `steps` est fourni, les anciens steps sont supprimes et remplaces (meme logique que les ingredients actuels).

### 3.3 Get Recipe - `GET /api/recipes/:recipeId`

**Output (nouveau format) :**
```json
{
  "id": "uuid",
  "title": "Brioche a la praline",
  "imageUrl": "https://...",
  "servings": 6,
  "prepTime": 30,
  "cookTime": 45,
  "restTime": 120,
  "createdAt": "...",
  "updatedAt": "...",
  "creatorId": "uuid",
  "creator": { "id": "uuid", "username": "alice" },
  "tags": [...],
  "ingredients": [...],
  "steps": [
    { "id": "uuid", "order": 0, "instruction": "Melanger la farine..." },
    { "id": "uuid", "order": 1, "instruction": "Ajouter les oeufs..." },
    { "id": "uuid", "order": 2, "instruction": "Petrir 10 minutes..." },
    { "id": "uuid", "order": 3, "instruction": "Incorporer les pralines..." }
  ],
  "communityId": "uuid",
  "community": { "id": "uuid", "name": "Famille" }
}
```

**Champ supprime** : `content`

### 3.4 Create Proposal - `POST /api/recipes/:recipeId/proposals`

**Input (nouveau format) :**
```json
{
  "proposedTitle": "Brioche a la praline rose",
  "proposedServings": 8,
  "proposedPrepTime": 25,
  "proposedCookTime": 40,
  "proposedRestTime": 120,
  "proposedSteps": [
    { "instruction": "Melanger la farine et le sel." },
    { "instruction": "Ajouter les oeufs battus et le lait tiede." }
  ],
  "proposedIngredients": [...]
}
```

**Champ supprime** : `proposedContent`

### 3.5 Get Proposal - `GET /api/proposals/:proposalId`

Output inclut les nouveaux champs : `proposedServings`, `proposedPrepTime`, `proposedCookTime`, `proposedRestTime`, `proposedSteps[]`.

### 3.6 Accept Proposal

Lors de l'acceptation d'une proposition, la recette est mise a jour avec :
- `servings` → `proposedServings` (si non null)
- `prepTime` → `proposedPrepTime` (si non null)
- `cookTime` → `proposedCookTime` (si non null)
- `restTime` → `proposedRestTime` (si non null)
- Steps → remplaces par `proposedSteps` (si non vide)
- Ingredients → remplaces par `proposedIngredients` (si non vide, inchange)
- La synchronisation bidirectionnelle s'applique (steps, servings, temps syncs vers recettes liees)

---

## 4. Synchronisation bidirectionnelle

### 4.1 Champs synchronises

| Champ | Synchro | Notes |
|-------|---------|-------|
| `title` | Oui | Inchange |
| `imageUrl` | Oui | Inchange |
| `ingredients` | Oui | Inchange |
| `steps` | **Oui** | Nouveau - delete all + recreate |
| `servings` | **Oui** | Nouveau |
| `prepTime` | **Oui** | Nouveau |
| `cookTime` | **Oui** | Nouveau |
| `restTime` | **Oui** | Nouveau |
| `tags` | Non | Inchange - tags sont locaux |

### 4.2 Logique de sync pour les steps

Meme pattern que les ingredients : lors de la sync, supprimer tous les steps de la recette liee puis recreer depuis la source.

```typescript
// Dans syncLinkedRecipes
if (data.steps !== undefined) {
  for (const linkedId of linkedRecipeIds) {
    await tx.recipeStep.deleteMany({ where: { recipeId: linkedId } });
    await upsertSteps(tx, linkedId, data.steps);
  }
}
```

---

## 5. Frontend

### 5.1 RecipeDetailPage - Layout sequentiel

Structure de haut en bas (identique mobile et desktop, max-w-3xl centre) :

```
+-----------------------------------------------+
| [< Retour]                                    |
+-----------------------------------------------+
| [IMAGE HERO pleine largeur]                   |
+-----------------------------------------------+
| TITRE                              [Actions]  |
| by Alice | In: Famille                         |
+-----------------------------------------------+
| [Prep 30min] [Cuisson 45min] [Repos 2h]       |
| Total : 3h15                                   |
+-----------------------------------------------+
| [Tags: brioche, praline, ...]                  |
+-----------------------------------------------+
| INGREDIENTS                 [- 6 pers +]       |
| ----------------------------------------       |
| * 500g Farine                                  |
| * 200g Pralines roses                          |
| * 3 Oeufs                                     |
| * 25cl Lait                                   |
+-----------------------------------------------+
| ETAPES                                         |
| ----------------------------------------       |
| 1. Melanger la farine et le sel dans un       |
|    grand saladier.                             |
|                                                |
| 2. Ajouter les oeufs et le lait tiede.        |
|                                                |
| 3. Petrir 10 minutes puis laisser reposer     |
|    2h.                                         |
|                                                |
| 4. Incorporer les pralines concassees et      |
|    enfourner a 180C pendant 45 minutes.        |
+-----------------------------------------------+
| [Proposals / Tag Suggestions si owner]         |
+-----------------------------------------------+
```

### 5.2 Composants de temps

**TimeBadges** : badges en ligne affichant chaque temps defini.
- Icones distinctes par type (horloge prep, flamme cuisson, pause repos)
- Le total est affiche separement, en gras
- Non affiche si aucun temps defini

**Formatage** :
```typescript
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}
// 45 → "45 min", 90 → "1h30", 120 → "2h"
```

### 5.3 Selecteur de personnes

**ServingsSelector** : composant `[- ] 6 personnes [+]`
- Boutons `-` et `+` pour incrementer/decrementer
- Input editable directement (l'utilisateur peut taper un nombre)
- Min 1, max 100
- Valeur par defaut : `recipe.servings`
- Etat local uniquement (pas de persistance)
- Au changement → recalcul reactif de toutes les quantites d'ingredients affichees

### 5.4 RecipeFormPage - Nouveau layout

```
+-----------------------------------------------+
| Titre *                                        |
| [input]                                        |
+-----------------------------------------------+
| Image URL (optionnel)                          |
| [input]                                        |
+-----------------------------------------------+
| Nombre de personnes *     Temps (optionnels)   |
| [  6  ]                   Prep [  30  ] min    |
|                            Cuisson [  45  ] min|
|                            Repos [ 120  ] min  |
+-----------------------------------------------+
| Tags                                           |
| [TagSelector]                                  |
+-----------------------------------------------+
| Ingredients                                    |
| [IngredientList existant]                      |
+-----------------------------------------------+
| Etapes *                                       |
| 1. [textarea]                          [X]     |
| 2. [textarea]                          [X]     |
| 3. [textarea]                          [X]     |
| [+ Ajouter une etape]                         |
+-----------------------------------------------+
| [Annuler]                    [Creer recette]   |
+-----------------------------------------------+
```

**StepEditor** : composant de liste d'etapes
- Chaque etape : numero + textarea auto-resize + bouton supprimer
- Bouton "Ajouter une etape" en bas
- Reordonnancement par boutons haut/bas (ou drag & drop si souhaite en v2+)
- Minimum 1 etape (le bouton supprimer est desactive s'il n'en reste qu'une)

### 5.5 ProposeModificationModal

- Remplace le textarea `proposedContent` par le `StepEditor`
- Ajoute le champ `proposedServings` (pre-rempli avec la valeur actuelle)
- Ajoute les 3 champs de temps (pre-remplis avec les valeurs actuelles)
- Detection de changement : compare chaque champ individuellement

### 5.6 RecipeCard (vues liste)

Ajouts legers sur les cartes recettes :
- Badge temps total (si defini) : ex: `[3h15]`
- Badge servings : ex: `[6 pers.]`
- Positionnement sous les tags existants

### 5.7 Types frontend

```typescript
// models/recipe.ts - modifications

export interface RecipeStep {
  id: string;
  order: number;
  instruction: string;
}

export interface RecipeDetail {
  // ... champs existants
  // SUPPRIME: content: string;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  restTime: number | null;
  steps: RecipeStep[];
}

export interface RecipeListItem {
  // ... champs existants
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  restTime: number | null;
}
```

---

## 6. Migration

### 6.1 Strategie

Migration en 2 temps (dans une seule migration Prisma) :

1. **Ajout des nouvelles colonnes et tables** :
   - `Recipe.servings` : default 4 (temporaire pour les recettes existantes)
   - `Recipe.prepTime`, `cookTime`, `restTime` : nullable, default null
   - Table `RecipeStep`
   - `RecipeUpdateProposal.proposedServings`, `proposedPrepTime`, `proposedCookTime`, `proposedRestTime` : nullable
   - Table `ProposalStep`

2. **Migration des donnees** (script SQL dans la migration) :
   - Pour chaque recette existante avec `content` non vide → creer un `RecipeStep` avec `order: 0` et `instruction: content`
   - Pour chaque proposal existante avec `proposedContent` non vide → creer un `ProposalStep` avec `order: 0` et `instruction: proposedContent`

3. **Suppression des anciennes colonnes** :
   - `Recipe.content`
   - `RecipeUpdateProposal.proposedContent`

### 6.2 Valeurs par defaut pour les recettes existantes

| Champ | Valeur migration | Raison |
|-------|-----------------|--------|
| `servings` | 4 | Standard le plus courant |
| `prepTime` | null | Pas de donnee existante |
| `cookTime` | null | Pas de donnee existante |
| `restTime` | null | Pas de donnee existante |
| `steps` | 1 step avec le contenu actuel | Preservation des donnees |

---

## 7. Impact sur les features existantes

### 7.1 Fork / Share

`forkRecipe` dans `shareService.ts` doit copier les nouveaux champs :
- `servings`, `prepTime`, `cookTime`, `restTime`
- Copie de tous les `RecipeStep` (avec nouveaux UUIDs)

### 7.2 Community Recipe Creation

`createCommunityRecipe` dans `communityRecipeService.ts` : meme traitement que create classique, avec steps.

### 7.3 Proposal Accept

`acceptProposal` doit appliquer les nouveaux champs proposes (servings, temps, steps) et declencher la sync.

### 7.4 Activity Events

Pas de changement - les events existants (`RECIPE_CREATED`, `RECIPE_UPDATED`) restent valides.

### 7.5 Notifications

Pas d'impact - les notifications existantes fonctionnent par type d'event, pas par contenu.

---

## 8. Cas limites et edge cases

| Cas | Comportement |
|-----|-------------|
| Recette migree non editee (servings=4 par defaut) | Le selecteur affiche 4, l'utilisateur peut modifier en editant la recette |
| Ingredients sans quantite dans le scaling | Affiches tels quels, pas de calcul |
| Scaling avec valeur non entiere (ex: 3 oeufs pour 4 pers, demande pour 6) | Affiche 4.5, arrondi a 2 decimales |
| Suppression de toutes les etapes dans le form | Impossible - le bouton supprimer est desactive quand il reste 1 seule etape |
| Proposal sans changement de servings | `proposedServings` envoi la valeur actuelle. Comparaison frontend pour detection |
| Temps a 0 | Valide (ex: prepTime=0 pour une recette sans prep). Affiche "0 min" |
| Tous les temps a null | Pas de section temps affichee |

---

## 9. Hors scope (futur)

- Drag & drop pour reordonner les etapes (boutons up/down suffisent pour v2)
- Image par etape (necessite le systeme d'upload - feature separee)
- Groupes d'etapes / sections nommees
- Conversion automatique d'unites (impliquerait un systeme de conversion)
- Impression / mode recette
- Timer integre aux etapes
