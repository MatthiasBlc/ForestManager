# Spec : Meal Plan Generation (Feature 2 — Generation Automatique)

## Vue d'ensemble

Systeme de generation automatique du planning de repas, extremement modulable et personnalisable. Chaque communaute peut avoir plusieurs jeux de parametres (par saison, regime, etc.). Un jeu definit :

- Des regles de poids sur tags et recettes (favoriser/defavoriser/exclure)
- Des contraintes de frequence par tag (min/max/exact, par planning ou par semaine)
- Un cooldown global par recette (pas la meme recette trop souvent)
- Un cooldown par tag (pas le meme type de cuisine trop souvent)
- Des exclusions de slots (jours ou on ne mange pas ensemble)
- Des epinglages de tag sur un slot (vendredi soir = poisson)
- L'inclusion optionnelle du pool d'idees
- Le respect des slots verrouilles manuellement

L'objectif : generer une liste de menus variee pour la periode du planning (duree libre, pas forcement 7 jours), en suivant des regles precises, sans produire la meme liste chaque fois.

> **Note** : les plannings utilisent des dates reelles (Feature 1). Les exclusions et pins utilisent `DayOfWeek` car ce sont des **patterns recurrents** ("chaque mercredi midi", "chaque vendredi soir"). Au moment de la generation, ces patterns sont mappes aux dates reelles du planning actif. Les contraintes de frequence s'appliquent sur l'ensemble du planning, quelle que soit sa duree.

**Prerequis** : Feature 1 (Meal Plan Manuel) doit etre implementee. Meme feature flag `MEAL_PLAN`.

### Nouvel enum

```prisma
enum FrequencyPer {
  PER_WEEK      // contrainte par tranche de 7 jours (defaut)
  PER_PLANNING  // contrainte sur l'ensemble du planning
}
```

---

## 1. Modele de donnees

### 1.1 MealGenerationParams — N par communaute

```prisma
model MealGenerationParams {
  id           String    @id @default(uuid())
  communityId  String
  name         String    // max 100 chars, ex: "Ete", "Standard", "Regime leger"
  description  String?   // max 500 chars
  cooldownDays Int       @default(3)  // jours min avant qu'une recette revienne
  useIdeas     Boolean   @default(true) // inclure MealIdea dans la generation
  isDefault    Boolean   @default(false) // un seul par communaute
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime? // soft delete

  community    Community @relation(fields: [communityId], references: [id])
  exclusions   MealSlotExclusion[]
  rules        MealGenerationRule[]
  slotPins     MealSlotPin[]

  @@index([communityId, deletedAt])
}
```

**Regles** :

- Soft delete (`deletedAt`)
- `isDefault` : un seul jeu par communaute peut etre `isDefault: true`. Contrainte applicative — quand on set un jeu en default, l'ancien est automatiquement desactive. Un jeu soft-deleted avec `isDefault: true` ne compte pas : `hasDefaultGenerationParams` retourne `false` si le seul jeu isDefault est soft-deleted
- `cooldownDays` : nombre minimum de jours entre deux apparitions d'une meme recette dans le planning. Min 0 (pas de cooldown), defaut 3
- `useIdeas` : si true, les MealIdea (Feature 1) sont incluses dans le pool de generation

### 1.2 MealSlotExclusion — Slots a ne pas generer (pivot)

```prisma
model MealSlotExclusion {
  id       String    @id @default(uuid())
  paramsId String
  day      DayOfWeek
  mealTime MealTime

  params   MealGenerationParams @relation(fields: [paramsId], references: [id], onDelete: Cascade)

  @@unique([paramsId, day, mealTime])
}
```

**Regles** :

- Hard delete en cascade quand le jeu de params est supprime
- Contrainte unique : une seule exclusion par jour+repas par jeu
- Exemple : exclure `TUE/DINNER` = la communaute ne mange jamais ensemble le mardi soir

### 1.3 MealGenerationRule — Regles de poids et contraintes (N par jeu)

```prisma
model MealGenerationRule {
  id                 String    @id @default(uuid())
  paramsId           String

  // Cible : tag OU recette (jamais les deux)
  tagId              String?
  recipeId           String?

  // Poids (tous types de regles)
  weight             Float     @default(1.0) // 0.0-2.0
  mealTimeConstraint MealTime? // null = les deux, LUNCH/DINNER = un seul

  // Contraintes de frequence (tag rules uniquement)
  frequencyMin       Int?           // min occurrences (null = pas de min)
  frequencyMax       Int?           // max occurrences (null = pas de max)
  frequencyPer       FrequencyPer?  // PER_WEEK | PER_PLANNING — defaut PER_WEEK si frequencyMin ou Max set

  // Cooldown par tag (tag rules uniquement)
  tagCooldownDays    Int?      // jours min entre 2 recettes du meme tag (null = pas de cooldown tag)

  params             MealGenerationParams @relation(fields: [paramsId], references: [id], onDelete: Cascade)
  tag                Tag?                 @relation(fields: [tagId], references: [id], onDelete: SetNull)
  recipe             Recipe?              @relation(fields: [recipeId], references: [id], onDelete: SetNull)

  @@index([paramsId])
}
```

**Regles** :

- Hard delete en cascade quand le jeu de params est supprime (paramsId)
- Si le tag est supprime → `tagId` passe a null (SetNull). La regle devient orpheline et est ignoree silencieusement a la generation
- Si la recette est soft-deleted → la regle reste (recipeId intact). Si la recette est hard-deleted → `recipeId` passe a null (SetNull). Meme comportement : regle ignoree
- **Un `tagId` OU un `recipeId`, jamais les deux** sur la meme regle. Contrainte applicative
- `weight` : Float entre 0.0 et 2.0
  - `0.0` = completement exclu du tirage
  - `0.01–0.99` = defavorise (moins de chances)
  - `1.0` = neutre (comportement par defaut)
  - `1.01–2.0` = favorise (plus de chances)
  - **Frontend** : jauge 0–200% (0.0 → 0%, 1.0 → 100%, 2.0 → 200%)
- `mealTimeConstraint` : restreint l'application de la regle a un type de repas. `null` = les deux
- **`frequencyMin` / `frequencyMax` / `frequencyPer`** (tag rules uniquement, ignore si recipeId) :
  - `frequencyPer: PER_WEEK` (defaut) : la contrainte s'applique par tranche de 7 jours a partir du `startDate`. Planning de 14 jours = 2 tranches. Planning de 10 jours = tranche 1 (j1→j7) + tranche 2 incomplete (j8→j10). Les memes limites s'appliquent a la tranche incomplete (pas de calcul proportionnel — plus simple et intuitif)
  - `frequencyPer: PER_PLANNING` : la contrainte s'applique sur l'ensemble du planning, quelle que soit la duree
  - `frequencyMin = 2, frequencyMax = 2` → mode exact (exactement 2 par tranche/planning)
  - `frequencyMin = null, frequencyMax = 3` → max 3 par tranche/planning
  - `frequencyMin = 2, frequencyMax = null` → min 2 par tranche/planning
  - `frequencyMin = 2, frequencyMax = 5` → entre 2 et 5 par tranche/planning
  - Validation : si les deux sont set, `frequencyMin <= frequencyMax`
  - `frequencyPer` est ignore si ni `frequencyMin` ni `frequencyMax` ne sont set
- **`tagCooldownDays`** (tag rules uniquement, ignore si recipeId) :
  - Jours minimum entre deux recettes portant le meme tag
  - Exemple : tag "pates", `tagCooldownDays = 2` → pas de pates deux jours de suite
  - Distinct du cooldown global (qui est par recette). Ici c'est par categorie/tag

### 1.4 MealSlotPin — Epinglage de tag sur un slot (N par jeu)

```prisma
model MealSlotPin {
  id       String    @id @default(uuid())
  paramsId String
  day      DayOfWeek
  mealTime MealTime
  tagId    String

  params   MealGenerationParams @relation(fields: [paramsId], references: [id], onDelete: Cascade)
  tag      Tag                  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([paramsId, day, mealTime])
}
```

**Regles** :

- Hard delete en cascade (paramsId)
- Si le tag epingle est supprime → Cascade sur le pin (le pin disparait, le slot n'est plus epingle)
- Contrainte unique : un seul pin par slot par jeu (un slot ne peut etre epingle qu'a un tag)
- Exemple : `FRI/DINNER` + tag "poisson" → le vendredi soir, le generateur ne pioche que dans les recettes taguees "poisson"
- Un slot ne peut pas etre a la fois exclu et epingle (validation applicative)
- Interagit avec les regles de poids : les poids s'appliquent normalement a l'interieur du pool filtre par le tag epingle

### 1.5 Modification de MealSlot (Feature 1) — ajout `locked`

```prisma
// Ajout au modele MealSlot existant (Feature 1)
model MealSlot {
  // ... champs existants ...
  locked    Boolean   @default(false) // verrouille = la generation ne touche pas ce slot
}
```

**Regles** :

- Un slot verrouille est ignore par la generation, quel que soit le mode (`fillEmptyOnly` ou non)
- Permet de proteger des choix manuels pendant une regeneration
- Le verrouillage est independant du type de slot (meme un slot EMPTY peut etre verrouille = "pas de repas ici cette semaine")
- Toggle via `PATCH /meal-plan/slots/:slotId` avec `{ "locked": true/false }`
- Frontend : icone cadenas visible sur les slots verrouilles

---

## 2. API

### 2.1 Generation Params (nested sous /api/communities/:communityId)

```
GET    /meal-generation-params                           # liste des jeux (memberOf)
POST   /meal-generation-params                           # creer un jeu (MODERATOR)
GET    /meal-generation-params/:paramsId                 # detail avec exclusions + regles + pins (memberOf)
PATCH  /meal-generation-params/:paramsId                 # modifier (MODERATOR)
DELETE /meal-generation-params/:paramsId                 # soft delete (MODERATOR)
POST   /meal-generation-params/:paramsId/duplicate       # dupliquer un jeu (MODERATOR)
```

### 2.2 Exclusions (nested sous params)

```
PUT    /meal-generation-params/:paramsId/exclusions   # set complet des exclusions (MODERATOR)
```

Body : tableau de `{ day, mealTime }`. Remplace toutes les exclusions existantes (delete + re-create en transaction).

### 2.3 Rules (nested sous params)

```
GET    /meal-generation-params/:paramsId/rules            # liste des regles (memberOf)
POST   /meal-generation-params/:paramsId/rules            # ajouter une regle (MODERATOR)
PATCH  /meal-generation-params/:paramsId/rules/:ruleId    # modifier (MODERATOR)
DELETE /meal-generation-params/:paramsId/rules/:ruleId    # supprimer (MODERATOR, hard delete)
```

### 2.4 Slot Pins (nested sous params)

```
PUT    /meal-generation-params/:paramsId/pins   # set complet des pins (MODERATOR)
```

Body : tableau de `{ day, mealTime, tagId }`. Remplace tous les pins existants (meme logique que les exclusions).

**POST /meal-generation-params/:paramsId/duplicate** :

- Cree un nouveau jeu de params avec le meme nom suffixe " (copie)", memes valeurs (cooldownDays, useIdeas), memes exclusions, regles et pins
- `isDefault` est toujours `false` sur la copie
- Retourne le nouveau jeu complet

### 2.5 Flag dans GET /meal-plan

La reponse de `GET /meal-plan` inclut un champ calcule :

```json
{ "hasDefaultGenerationParams": true }
```

Ce flag indique si un jeu de params `isDefault: true` et non soft-deleted existe pour cette communaute. Le frontend l'utilise pour afficher ou masquer le bouton "Remplacer" sur les cartes.

### 2.6 Generation & Replace

```
POST   /meal-plan/generate                    # generer le planning (MODERATOR)
POST   /meal-plan/slots/:slotId/replace       # re-generer 1 slot (MODERATOR)
```

**POST /meal-plan/generate** :

```json
{
  "paramsId": "uuid",
  "fillEmptyOnly": false
}
```

- `paramsId` : jeu de params a utiliser
- `fillEmptyOnly` : si `true`, ne remplit que les slots `EMPTY` (et non verrouilles). Si `false`, regenere tous les slots non-exclus et non-verrouilles

**POST /meal-plan/slots/:slotId/replace** :

```json
{
  "paramsId": "uuid"
}
```

- Re-genere un seul slot en utilisant le meme algorithme, en excluant la recette actuelle
- Refuse si le slot est verrouille (`MEAL_GEN_008`)
- Si le slot est `disabled` → le replace l'active automatiquement (meme comportement que l'edition manuelle — mettre un contenu reactive le slot)
- Le `paramsId` est requis pour savoir quelles regles appliquer
- Ignore `fillEmptyOnly` (action ciblee sur un slot specifique)

---

## 3. Algorithme de generation

### 3.1 Vue d'ensemble

L'algorithme procede en 3 passes :

1. **Passe principale** : remplir les slots en respectant les contraintes hard (exclusions, pins, cooldown, frequencyMax, tagCooldown, verrouillage)
2. **Passe de rattrapage** : satisfaire les contraintes frequencyMin non atteintes
3. **Rapport** : lister les warnings (slots non remplis, contraintes non satisfaites)

### 3.2 Passe principale — Etapes par slot

Ordre de traitement : premier jour midi → premier jour soir → deuxieme jour midi → ... → dernier jour soir (ordre chronologique des dates reelles du planning).

Pour chaque slot :

1. **Skip** si le slot est `disabled` (desactive au niveau du plan)
2. **Skip** si le slot est exclu (MealSlotExclusion — matcher le `DayOfWeek` de la date du slot)
3. **Skip** si le slot est verrouille (`locked = true`)
4. **Skip** si `fillEmptyOnly = true` et le slot n'est pas EMPTY
5. **Construire le pool de recettes eligibles** :
   a. Toutes les recettes de la communaute (non soft-deleted)
   b. Si `useIdeas: true` : ajouter les MealIdea (non soft-deleted) au pool
6. **Appliquer le pin** (si un MealSlotPin existe pour ce slot) :
   - Filtrer le pool : ne garder que les recettes qui portent le tag epingle
7. **Filtrer par mealTimeConstraint** :
   - Pour chaque regle avec `mealTimeConstraint` set : si le slot ne matche pas, la regle ne s'applique pas a ce slot (pas d'exclusion, juste ignore)
   - Pour chaque regle avec `weight = 0.0` et `mealTimeConstraint` matchant ce slot : exclure les recettes ciblees
8. **Exclure par cooldown recette** (global) :
   - Exclure les recettes deja planifiees dans les `cooldownDays` precedents (slots deja remplis dans cette generation)
9. **Exclure par cooldown tag** :
   - Pour chaque regle tag avec `tagCooldownDays` set : exclure les recettes portant ce tag si une recette avec le meme tag a ete planifiee dans les N jours precedents
10. **Exclure par frequencyMax** :
    - Pour chaque regle tag avec `frequencyMax` set : compter les slots deja remplis (dans cette generation) avec une recette portant ce tag. Si le max est atteint → exclure toutes les recettes portant ce tag
11. **Calculer le poids final** de chaque recette restante (voir 3.3)
12. **Tirage aleatoire pondere**
13. **Ecrire le slot** : `type: RECIPE` ou `type: FREE_TEXT` (si MealIdea sans recipeId)

### 3.3 Calcul du poids final

Pour une recette donnee dans un slot donne :

1. Poids de base = `1.0`
2. Pour chaque regle tag applicable (la recette possede le tag ET mealTimeConstraint matche le slot) : `poids *= rule.weight`
3. Pour chaque regle recette applicable (match direct ET mealTimeConstraint matche le slot) : `poids *= rule.weight`
4. Si poids final = `0.0` → recette exclue
5. Sinon → poids final utilise pour le tirage pondere

**Exemple** :

- Recette "Ratatouille" a les tags `vegetarien` et `ete`
- Regle tag `vegetarien` : weight 1.5 (150%)
- Regle tag `ete` : weight 1.8 (180%)
- Poids final = 1.0 x 1.5 x 1.8 = 2.7 (tres favorisee)

### 3.4 Passe de rattrapage — frequencyMin

Apres la passe principale, verifier les contraintes `frequencyMin` :

- Si `frequencyPer: PER_PLANNING` : verifier le compteur global sur l'ensemble du planning
- Si `frequencyPer: PER_WEEK` : verifier chaque tranche de 7 jours separement. Un deficit dans la tranche 2 ne peut pas etre comble par un exces dans la tranche 1

Pour chaque tranche (ou pour le planning entier si PER_PLANNING) :

1. Pour chaque regle tag avec `frequencyMin` set :
   - Compter les slots remplis avec une recette portant ce tag dans la tranche/planning
   - Si le compteur < frequencyMin → **deficit a combler dans cette tranche**
2. Pour chaque deficit :
   a. Identifier les slots remplacables : slots non-verrouilles, non-exclus, non-epingles, qui n'ont PAS de recette avec ce tag
   b. Trier ces slots par "poids de la recette actuelle" (ascendant) → remplacer en priorite les choix les moins "importants"
   c. Pour chaque slot a remplacer : tirer une recette portant le tag manquant (en respectant cooldown et les autres contraintes)
   d. Si impossible (pas assez de recettes avec ce tag, ou pas assez de slots remplacables) → warning dans le rapport

**Ordre de priorite des contraintes** (en cas de conflit) :

1. Verrouillage (absolu, jamais outrepasse)
2. Exclusion de slot (absolu)
3. Pin de slot (absolu)
4. frequencyMax (hard — jamais depasse)
5. Cooldown recette (hard)
6. Cooldown tag (hard)
7. frequencyMin (best effort — rattrapage, mais peut echouer)
8. Poids (soft — influence probabiliste)

### 3.5 Cooldown recette (global, cross-planning)

Le cooldown s'applique en deux phases :

1. **Intra-generation** : les recettes deja tirees pendant cette generation sont exclues pour les slots suivants dans la fenetre du cooldown
2. **Cross-planning** : au demarrage de la generation, les slots remplis du **plan archive precedent** (le plus recent) sont egalement pris en compte. Si "Ratatouille" etait dimanche soir dans l'ancien planning et `cooldownDays = 3`, elle est exclue de lundi, mardi et mercredi du nouveau planning

**Calcul de la distance** : on compare les dates reelles. Si l'ancien planning se terminait le 23/03 et le nouveau commence le 24/03, la distance est de 1 jour (gap respecte, le cooldown s'applique bien).

Si aucun plan archive n'existe (premier planning de la communaute) → uniquement l'intra-generation.

Exemple intra-generation : si lundi midi a recu "Ratatouille" et `cooldownDays = 3`, alors "Ratatouille" est exclue des tirages pour mardi, mercredi et jeudi (midi et soir).

### 3.6 Cooldown tag (cross-planning)

Distinct du cooldown recette. Fonctionne par tag et non par recette individuelle. Applique egalement le principe cross-planning : les slots du plan archive precedent sont pris en compte pour calculer si le cooldown tag est respecte sur les premiers jours du nouveau planning.

Exemple : tag "pates", `tagCooldownDays = 2`. Si lundi midi a recu "Carbonara" (taguee "pates"), alors AUCUNE recette taguee "pates" ne sera tiree pour lundi soir et mardi midi (2 slots = ~1 jour de distance).

Le cooldown tag se mesure en **jours** (comme le cooldown recette) : chaque jour contient 2 slots. Un `tagCooldownDays = 1` signifie que le tag ne peut pas apparaitre le meme jour une 2e fois NI le lendemain.

### 3.7 Gestion des MealIdea

Si `useIdeas: true` :

- Les idees **avec** `recipeId` : traitees comme la recette liee (memes regles tag/recette s'appliquent)
- Les idees **sans** `recipeId` : poids de base `1.0`, aucune regle tag/recette ne s'applique (pas de tags). Non affectees par frequencyMin/Max ni tagCooldown. Si tiree, le slot passe en `type: FREE_TEXT` avec `freeText = idea.name` et `comment = idea.comment`

### 3.8 Pool insuffisant

Si le pool de recettes eligibles est vide pour un slot (tout exclu par cooldown/regles/contraintes) :

- Le slot reste `EMPTY`
- Warning dans la reponse avec le slot concerne et les raisons (quelles contraintes ont elimine le pool)

### 3.9 Conflits de contraintes

Cas ou les contraintes sont impossibles a satisfaire simultanement :

| Conflit                                                                                   | Comportement                                                             |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| frequencyMin tag A = 10 mais seulement 8 slots non-exclus                                 | Remplir au max possible, warning "min non atteint"                       |
| frequencyMin tag A + frequencyMin tag B > slots disponibles (tags mutuellement exclusifs) | Satisfaire dans l'ordre de declaration des regles, warning pour le reste |
| frequencyMax tag A = 2 et slot epingle sur tag A pour 3 slots                             | Les pins sont absolus, frequencyMax est depasse, warning                 |
| tagCooldown empecherait de satisfaire frequencyMin                                        | Cooldown prioritaire, frequencyMin en best effort, warning               |

Le systeme ne refuse JAMAIS de generer. Il fait au mieux et rapporte les ecarts.

---

## 4. Permissions

| Action                                        | Droit requis                                          |
| --------------------------------------------- | ----------------------------------------------------- |
| Voir les jeux de params, regles, pins         | Membre de la communaute                               |
| Creer / modifier / supprimer un jeu de params | MODERATOR                                             |
| Gerer les exclusions, regles et pins          | MODERATOR                                             |
| Lancer une generation                         | MODERATOR                                             |
| Remplacer un slot (re-roll)                   | MODERATOR                                             |
| Verrouiller/deverrouiller un slot             | Meme permission que modifier un slot (voir Feature 1) |

---

## 5. Codes erreur

| Code         | Message                                                   |
| ------------ | --------------------------------------------------------- |
| MEAL_GEN_001 | Generation params not found                               |
| MEAL_GEN_002 | No meal plan exists (creer le plan d'abord via Feature 1) |
| MEAL_GEN_003 | Invalid rule: must have tagId OR recipeId, not both       |
| MEAL_GEN_004 | Weight must be between 0.0 and 2.0                        |
| MEAL_GEN_005 | Cannot have multiple default params for same community    |
| MEAL_GEN_006 | Rule not found                                            |
| MEAL_GEN_007 | Slot is excluded in this params set                       |
| MEAL_GEN_008 | Slot is locked                                            |
| MEAL_GEN_009 | Frequency constraints only apply to tag rules             |
| MEAL_GEN_010 | frequencyMin must be <= frequencyMax                      |
| MEAL_GEN_011 | tagCooldownDays only applies to tag rules                 |
| MEAL_GEN_012 | Slot cannot be both excluded and pinned                   |
| MEAL_GEN_013 | Cannot generate on an archived plan                       |

---

## 6. UX Frontend

### 6.1 Page parametres de generation

- Accessible depuis la page planning (onglet ou section dediee)
- Liste des jeux de params avec badge "par defaut" sur le jeu actif
- CRUD complet : creer, editer, dupliquer, supprimer
- Pour chaque jeu : grille d'exclusion (7x2 checkboxes pour cocher les slots a exclure)

### 6.2 Edition des regles

- Section dans le detail d'un jeu de params
- Deux types de regles affichees separement :

**Regles par tag** :

- Autocomplete tag communaute
- Jauge poids 0–200% (slider visuel avec paliers : 0% exclu, 100% neutre, 200% double)
- Contrainte LUNCH/DINNER (select optionnel)
- Frequence : toggle "Pas de contrainte / Exact / Plage"
  - Exact → 1 champ nombre
  - Plage → 2 champs min/max (chacun optionnel)
  - Select `frequencyPer` : "Par semaine" (defaut) / "Par planning entier"
- Cooldown tag : champ nombre optionnel (jours)

**Regles par recette** :

- Autocomplete recette communaute
- Jauge poids 0–200%
- Contrainte LUNCH/DINNER

### 6.3 Epinglage de tags sur des slots

- Grille 7x2 (meme layout que les exclusions)
- Chaque case : select tag optionnel (autocomplete)
- Un slot ne peut pas etre epingle ET exclu (validation visuelle immediate)
- Exemple : case "VEN/DINNER" → select "poisson" = vendredi soir, uniquement des recettes poisson

### 6.4 Generation

- Bouton "Generer le planning" sur la page planning (visible MODERATOR uniquement)
- Selecteur du jeu de params (pre-selectionne sur le jeu `isDefault`)
- Toggle `fillEmptyOnly` : "Remplir uniquement les slots vides" (checkbox)
- Si `fillEmptyOnly: false` et des slots non-vides et non-verrouilles existent → modal de confirmation "Les slots non verrouilles seront regeneres"
- Apres generation : affichage du resultat avec warnings si contraintes non satisfaites

### 6.5 Bouton "Remplacer" sur chaque carte

- Visible uniquement si un jeu de params par defaut existe
- Masque sur les slots verrouilles
- Icone refresh sur la carte du slot
- Au clic → modal de confirmation "Remplacer ce repas par une autre suggestion ?"
- Utilise le jeu de params par defaut pour le re-roll

### 6.6 Verrouillage de slots

- Icone cadenas sur chaque carte de slot
- Clic pour toggle verrouille/deverrouille
- Slot verrouille : cadenas ferme, style visuel distinct (bordure, opacite differente)
- Le bouton "Remplacer" disparait quand le slot est verrouille
- Meme permission que l'edition de slot (Feature 1)

---

## 7. Rapport de generation

La reponse de `POST /meal-plan/generate` inclut :

```json
{
  "plan": { ... },
  "report": {
    "slotsGenerated": 10,
    "slotsSkipped": {
      "excluded": 2,
      "locked": 1,
      "alreadyFilled": 0
    },
    "slotsEmpty": 1,
    "warnings": [
      {
        "type": "POOL_EXHAUSTED",
        "slotDay": "THU",
        "slotMealTime": "DINNER",
        "reason": "All recipes excluded by cooldown and frequency constraints"
      },
      {
        "type": "FREQUENCY_MIN_NOT_MET",
        "tagId": "uuid",
        "tagName": "vegetarien",
        "required": 3,
        "actual": 2,
        "reason": "Not enough eligible recipes with this tag"
      }
    ]
  }
}
```

Types de warning :

- `POOL_EXHAUSTED` : aucune recette eligible pour un slot
- `FREQUENCY_MIN_NOT_MET` : frequencyMin non atteint (meme apres rattrapage)
- `FREQUENCY_MAX_EXCEEDED` : frequencyMax depasse a cause d'un pin (cas rare)
- `CONFLICTING_CONSTRAINTS` : deux contraintes se contredisent

---

## 8. Seed & Tests

- Les jeux de params sont propres a chaque communaute, pas de seed global necessaire
- **Seed de test** : creer un jeu de params "Standard" avec quelques regles, exclusions et pins pour la communaute de test
- Tests unitaires algorithme :
  - Poids simples (tag + recette)
  - Cooldown recette
  - Cooldown tag
  - frequencyMax (respect strict)
  - frequencyMin (passe de rattrapage)
  - Exact (min == max)
  - Pin de slot
  - Verrouillage
  - fillEmptyOnly
  - Pool insuffisant
  - Conflits de contraintes (warnings)
- Tests integration : endpoints CRUD params/rules/exclusions/pins + generate + replace

---

## 9. Relations avec Feature 1

| Element Feature 1              | Utilisation Feature 2                                                            |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `MealPlan` + `MealSlot`        | La generation ecrit dans les memes slots                                         |
| `MealSlot.locked`              | Nouveau champ ajoute pour Feature 2 (mais utilisable manuellement des Feature 1) |
| `MealIdea`                     | Incluse dans le pool si `useIdeas: true`                                         |
| `MealSlotType`                 | La generation produit `RECIPE` ou `FREE_TEXT` (idees sans recette)               |
| Enums `DayOfWeek` / `MealTime` | Reutilises pour exclusions, pins et contraintes                                  |

Le champ `locked` sur MealSlot est ajoute des Feature 1 (migration) mais son usage principal est dans Feature 2. En Feature 1, il permet simplement de "proteger" un slot visuellement.

---

## 10. Tableau recapitulatif des leviers de personnalisation

| Levier                     | Granularite              | Portee       | Exemple                                                                 |
| -------------------------- | ------------------------ | ------------ | ----------------------------------------------------------------------- |
| **Poids (weight)**         | Par tag ou par recette   | Probabiliste | "Plus de recettes d'ete" (tag ete = 180%)                               |
| **Exclusion (weight = 0)** | Par tag ou par recette   | Hard         | "Jamais de fondue en ete" (tag fondue = 0%)                             |
| **mealTimeConstraint**     | Par regle                | Hard         | "Salades uniquement le midi" (tag salade, LUNCH)                        |
| **Cooldown recette**       | Global (toutes recettes) | Hard         | "Pas la meme recette avant 3 jours"                                     |
| **Cooldown tag**           | Par tag                  | Hard         | "Pas de pates 2 jours de suite" (tagCooldown = 2)                       |
| **Frequence max**          | Par tag                  | Hard         | "Max 3 repas carnes par semaine" (frequencyMax = 3, PER_WEEK)           |
| **Frequence min**          | Par tag                  | Best effort  | "Min 2 repas vegetariens par semaine" (frequencyMin = 2, PER_WEEK)      |
| **Frequence exacte**       | Par tag                  | Best effort  | "Exactement 1 repas poisson par planning" (min = max = 1, PER_PLANNING) |
| **Portee frequence**       | Par regle                | Mode         | PER_WEEK (defaut, scale selon duree) / PER_PLANNING (fixe)              |
| **Exclusion de slot**      | Par jour+repas           | Hard         | "Pas de repas mardi soir"                                               |
| **Pin de tag sur slot**    | Par jour+repas+tag       | Hard         | "Vendredi soir = poisson"                                               |
| **Verrouillage**           | Par slot                 | Hard         | "Garder mon choix de dimanche midi"                                     |
| **fillEmptyOnly**          | Generation entiere       | Mode         | "Ne remplir que les trous"                                              |
| **useIdeas**               | Generation entiere       | Pool         | "Inclure les idees dans le tirage"                                      |
