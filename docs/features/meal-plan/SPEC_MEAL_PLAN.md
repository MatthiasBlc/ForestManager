# Spec : Meal Plan (Feature 1 — Planning Manuel)

## Vue d'ensemble

Gestion manuelle d'un planning de repas par communaute. Chaque planning couvre une periode libre (dates de debut et fin configurables, duree max 31 jours). Un seul planning actif par communaute a la fois, les anciens sont archives et consultables. Les membres peuvent consulter, modifier et reorganiser les repas via drag & drop (swap). Un pool d'idees communautaire permet de stocker des suggestions de repas pour usage futur (et pour la Feature 2 — generation automatique).

**Feature code** : `MEAL_PLAN` (non attribuee par defaut, activation admin par communaute)

---

## 1. Modele de donnees

### 1.1 Enums

```prisma
enum DayOfWeek {
  MON
  TUE
  WED
  THU
  FRI
  SAT
  SUN
}

enum MealTime {
  LUNCH
  DINNER
}

enum MealSlotType {
  EMPTY
  RECIPE
  FREE_TEXT
}

enum MealPlanStatus {
  ACTIVE
  ARCHIVED
}
```

> `DayOfWeek` n'est PAS utilise dans MealSlot (qui utilise des dates reelles). Il est conserve pour Feature 2 (patterns d'exclusion et d'epinglage recurrents dans les jeux de generation).

### 1.2 MealPlan — N par communaute, 1 ACTIVE a la fois

```prisma
model MealPlan {
  id                String         @id @default(uuid())
  communityId       String
  startDate         DateTime       @db.Date  // premier jour du planning
  endDate           DateTime       @db.Date  // dernier jour du planning
  status            MealPlanStatus @default(ACTIVE)
  defaultServings   Int            @default(4)
  editableByMembers Boolean        @default(false)
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  community         Community      @relation(fields: [communityId], references: [id])
  slots             MealSlot[]

  @@unique([communityId, status]) // contrainte partielle : un seul ACTIVE par communaute (voir note)
  @@index([communityId, status])
}
```

**Regles** :

- **1 plan ACTIVE par communaute**. Contrainte applicative (la contrainte unique `[communityId, status]` ne fonctionne pas directement pour les ARCHIVED multiples — verifier en applicatif)
- `startDate` / `endDate` : dates reelles, `startDate <= endDate`, duree max 31 jours
- `status` : `ACTIVE` = planning courant, `ARCHIVED` = consultation seule
- A la creation d'un nouveau plan, l'ancien ACTIVE passe automatiquement en ARCHIVED
- Pas de contrainte de continuite : il peut y avoir des gaps entre plannings (ex: vacances)
- Pas de chevauchement autorise entre plannings de la meme communaute (validation applicative sur les dates)
- `defaultServings` : valeur par defaut utilisee a la creation des slots. La modification ulterieure n'affecte PAS les slots existants
- `editableByMembers` : si `false` (defaut), seuls les MODERATOR peuvent modifier les slots. Si `true`, tous les membres peuvent modifier. Bascule via `PATCH /meal-plan`

### 1.3 MealSlot — N par plan (2 par jour dans la plage)

```prisma
model MealSlot {
  id        String       @id @default(uuid())
  planId    String
  date      DateTime     @db.Date  // date reelle (ex: 2026-03-23)
  mealTime  MealTime
  servings  Int
  type      MealSlotType @default(EMPTY)
  disabled  Boolean      @default(false)
  locked    Boolean      @default(false)
  recipeId  String?
  freeText  String?      // max 255 chars
  comment   String?      // max 500 chars
  updatedAt DateTime     @updatedAt

  plan      MealPlan     @relation(fields: [planId], references: [id], onDelete: Cascade)
  recipe    Recipe?      @relation(fields: [recipeId], references: [id])

  @@unique([planId, date, mealTime])
  @@index([planId, date])
}
```

**Regles** :

- Hard delete en cascade quand le plan est supprime
- Contrainte unique `[planId, date, mealTime]` : un seul slot par date+repas
- `date` : date reelle dans la plage `[plan.startDate, plan.endDate]`
- `disabled` : slot grise, pas de repas prevu. Le generateur (Feature 2) le skip. Mais un membre peut manuellement y ajouter un repas → quand on set un type RECIPE ou FREE_TEXT sur un slot disabled, `disabled` repasse a `false` automatiquement
- `locked` : verrouille pour la generation (Feature 2). Utilise des Feature 1 pour l'UX (cadenas visuel). Voir SPEC_MEAL_GENERATION pour le detail
- `recipeId` : FK vers Recipe. Les recettes sont soft-deleted, donc le recipeId reste intact. L'API renvoie un flag `isDeleted` si la recette est soft-deleted. Le frontend affiche "Recette supprimee" en grise
- `type: EMPTY` reset complet : recipeId, freeText et comment sont mis a null

### 1.4 MealIdea — Pool d'idees communautaire

```prisma
model MealIdea {
  id          String    @id @default(uuid())
  communityId String
  name        String    // max 255 chars
  comment     String?   // max 500 chars
  recipeId    String?   // null = idee pure, non-null = lien vers recette existante
  createdById String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  community   Community @relation(fields: [communityId], references: [id])
  recipe      Recipe?   @relation(fields: [recipeId], references: [id])
  createdBy   User?     @relation(fields: [createdById], references: [id], onDelete: SetNull)

  @@index([communityId, deletedAt])
}
```

**Regles** :

- Soft delete (`deletedAt`)
- `createdById` : SetNull si l'utilisateur est supprime
- `recipeId` : optionnel, permet de lier une idee a une recette existante (pour la future Feature 2)
- Cascade hard delete quand la communaute est soft-deleted (meme logique que UserCommunityTagPreference)

---

## 2. Feature flag

- Code : `MEAL_PLAN`
- `isDefault: false` — doit etre activee par l'admin (SuperAdmin) pour chaque communaute via `POST /api/admin/communities/:communityId/features/:featureId`
- A prevoir dans le seed de test (upsert idempotent)
- Si feature non activee : la section planning n'est pas accessible cote frontend, les endpoints retournent `403` avec code `MEAL_005`

---

## 3. API

### 3.1 Middleware requis

Un middleware `requireFeature('MEAL_PLAN')` verifie que la feature est activee pour la communaute. Applique sur tous les endpoints meal-plan et meal-ideas.

### 3.2 Meal Plan (nested sous /api/communities/:communityId)

```
GET    /meal-plan                   # Plan ACTIVE complet + tous ses slots (memberOf)
GET    /meal-plan/archives          # Liste des plans ARCHIVED, pagine (memberOf)
GET    /meal-plan/archives/:planId  # Detail d'un plan archive + slots (memberOf)
POST   /meal-plan                   # Creer un plan + slots (MODERATOR)
DELETE /meal-plan                   # Supprimer le plan ACTIVE + cascade slots (MODERATOR)
PATCH  /meal-plan                   # Update defaultServings et/ou editableByMembers (MODERATOR)
PATCH  /meal-plan/slots/:slotId     # Update un slot (permission dynamique)
POST   /meal-plan/slots/swap        # Swap contenu de 2 slots (permission dynamique)
```

### 3.3 Meal Ideas (nested sous /api/communities/:communityId)

```
GET    /meal-ideas                  # Liste paginee, searchable (memberOf)
POST   /meal-ideas                  # Creer une idee (memberOf)
PATCH  /meal-ideas/:ideaId          # Modifier (createur ou MODERATOR)
DELETE /meal-ideas/:ideaId          # Soft delete (createur ou MODERATOR)
```

---

## 4. Logique metier

### 4.1 Creation d'un plan (POST /meal-plan)

**Body** :

```json
{
  "startDate": "2026-03-23",
  "endDate": "2026-03-30",
  "defaultServings": 3,
  "disabledSlots": [
    { "date": "2026-03-23", "mealTime": "LUNCH" },
    { "date": "2026-03-25", "mealTime": "LUNCH" },
    { "date": "2026-03-30", "mealTime": "DINNER" }
  ],
  "copyDisabledFromPrevious": false
}
```

Quand un MODERATOR cree le plan :

1. Valider les dates : `startDate <= endDate`, duree max 31 jours, pas de chevauchement avec un autre plan
2. Si un plan ACTIVE existe → le passer en ARCHIVED
3. Creer le `MealPlan` avec `status: ACTIVE`
4. Creer les slots pour chaque date dans `[startDate, endDate]` × LUNCH/DINNER, tous `type: EMPTY`, `servings` herite du `defaultServings`
5. Si `disabledSlots` fourni → marquer ces slots comme `disabled: true`
6. Si `copyDisabledFromPrevious: true` → recuperer le pattern de disabled du plan archive le plus recent, mapper les jours de la semaine (ex: si l'ancien avait mercredi midi disabled, le nouveau aussi sur tous ses mercredis midi)
7. Retourner le plan complet avec tous ses slots

**Nombre de slots** : `(nombre de jours dans la plage) × 2`. Exemple : du 23 au 30 mars = 8 jours = 16 slots.

### 4.2 Update d'un slot (PATCH /meal-plan/slots/:slotId)

**Body possible** :

```json
{ "type": "RECIPE", "recipeId": "uuid", "comment": "Prevoir sauce a part" }
```

```json
{ "type": "FREE_TEXT", "freeText": "Resto japonais", "comment": "Reserver a l'avance" }
```

```json
{ "type": "EMPTY" }
```

```json
{ "servings": 6 }
```

```json
{ "disabled": true }
```

```json
{ "locked": true }
```

**Regles de validation** :

- `type: RECIPE` → `recipeId` requis, doit etre une recette de la communaute (non soft-deleted)
- `type: FREE_TEXT` → `freeText` requis, non vide, max 255 chars
- `type: EMPTY` → reset complet : recipeId, freeText, comment mis a null
- `servings` : modifiable independamment du type (min 1)
- `comment` : max 500 chars, optionnel sur tous les types (sauf EMPTY qui le reset)
- `disabled: true` → grise le slot. Si le slot avait un contenu, il est conserve mais le slot est visuellement grise
- `disabled: false` → reactive le slot
- Quand on set `type: RECIPE` ou `type: FREE_TEXT` sur un slot `disabled: true` → le slot repasse automatiquement a `disabled: false`
- Le plan doit etre ACTIVE (pas d'edition sur les archives)

### 4.3 Swap de slots (POST /meal-plan/slots/swap)

```json
{ "slotIdA": "uuid", "slotIdB": "uuid" }
```

Echange le contenu complet des deux slots : `type`, `recipeId`, `freeText`, `comment`, `servings`. Les proprietes `date`, `mealTime`, `disabled` et `locked` ne changent pas (fixes au slot).

**Validation** : les deux slots doivent appartenir au meme plan ACTIVE. Un slot ne peut pas etre swappe avec lui-meme (`MEAL_007`).

### 4.4 Recherche de recette pour un slot

Quand un membre edite un slot et cherche une recette (cote frontend) :

1. **Priorite 1** : recettes de la communaute (`communityId` match)
2. **Priorite 2** : recettes personnelles du membre (pas dans la communaute)
   - Si selectionnee → popup "Cette recette n'est pas dans la communaute. L'ajouter ?"
   - Si oui → `POST /api/recipes/:id/publish` (flow existant) → cree une copie communautaire → le slot pointe vers la copie
   - Si non → le slot passe en `FREE_TEXT` avec le nom de la recette pre-rempli, le membre peut ajouter un commentaire (les autres membres n'auront pas acces a la recette originale)
3. **Fallback** : champ libre (`FREE_TEXT`) avec commentaire optionnel

### 4.5 Archives

- Les plans archives sont en lecture seule
- `GET /meal-plan/archives` : liste paginee, triee par `startDate` descendant
- `GET /meal-plan/archives/:planId` : detail complet d'un plan archive + ses slots
- Les slots des archives conservent leur etat au moment de l'archivage
- Pas d'edition, pas de swap, pas de drag & drop sur les archives

### 4.6 Suppression

- `DELETE /meal-plan` : supprime le plan ACTIVE + cascade hard delete des slots
- Suppression de communaute : hard delete en cascade de tous les MealPlan (ACTIVE + ARCHIVED), MealSlot et MealIdea (meme logique que UserCommunityTagPreference)

---

## 5. Permissions

| Action                                                         | Droit requis                                             |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| Voir le plan actif et les archives                             | Membre de la communaute                                  |
| Creer / supprimer le plan                                      | MODERATOR                                                |
| Modifier `defaultServings` et `editableByMembers`              | MODERATOR                                                |
| Modifier un slot (type, recette, texte, commentaire, servings) | MODERATOR toujours. Membre si `editableByMembers = true` |
| Disable/enable un slot                                         | MODERATOR toujours. Membre si `editableByMembers = true` |
| Lock/unlock un slot                                            | MODERATOR toujours. Membre si `editableByMembers = true` |
| Swap de slots                                                  | MODERATOR toujours. Membre si `editableByMembers = true` |
| Voir les idees                                                 | Membre                                                   |
| Creer une idee                                                 | Membre                                                   |
| Modifier / supprimer une idee                                  | Createur de l'idee OU MODERATOR                          |

---

## 6. Codes erreur

| Code     | Message                                                               |
| -------- | --------------------------------------------------------------------- |
| MEAL_001 | Plan not found                                                        |
| MEAL_002 | An active plan already exists (use creation flow which auto-archives) |
| MEAL_003 | Slot not found                                                        |
| MEAL_004 | Recipe not found in this community                                    |
| MEAL_005 | Feature not enabled for this community                                |
| MEAL_006 | Idea not found                                                        |
| MEAL_007 | Cannot swap a slot with itself                                        |
| MEAL_008 | Plan duration exceeds 31 days                                         |
| MEAL_009 | startDate must be before or equal to endDate                          |
| MEAL_010 | Plan dates overlap with an existing plan                              |
| MEAL_011 | Cannot edit an archived plan                                          |

---

## 7. Activity Log & Notifications

- **Pas d'ActivityLog** pour les modifications de slots — le planning est une donnee collaborative "live", pas un evenement. Trop de bruit dans le feed communautaire.
- **Pas de notifications push** pour les mises a jour du planning en Feature 1. Le feed visuel suffit.

---

## 8. UX Frontend

### 8.1 Vue desktop — Grille dynamique

- N colonnes (1 par jour dans la plage du planning) x 2 lignes (midi / soir)
- Si le planning fait plus de 7 jours → scroll horizontal ou pagination par semaine
- En-tete de colonne : jour de la semaine + date (ex: "Lun 23/03")
- Chaque carte : nom de la recette ou texte libre, badge nombre de personnes
- Clic sur une carte → drawer/modal de detail (lien recette, commentaire, servings editable)
- Slot EMPTY → affiche un "+" cliquable pour editer
- Slot disabled → grise, "+" discret pour ajouter manuellement (ce qui re-enable le slot)
- Slot locked → icone cadenas
- Recette soft-deleted → badge "Recette supprimee", style grise, lien desactive, slot modifiable
- Drag & drop entre slots → swap du contenu (bibliotheque : `@dnd-kit/core`)

### 8.2 Vue mobile — Cartes empilees

- Chaque jour = une carte (bloc) empilee verticalement (scroll vertical natif)
- En-tete de carte : jour de la semaine + date
- A l'interieur de chaque carte-jour : 2 sous-cartes (midi / soir)
- Slots disabled : sous-carte grisee avec "+" discret
- Navigation fluide en scroll vertical
- Meme fonctionnalites que desktop (edition, swap via drag & drop)

### 8.3 Creation d'un planning

- Formulaire : date de debut, date de fin, nombre de personnes par defaut
- Grille de pre-desactivation : apercu visuel du planning avec checkboxes pour desactiver des slots
- Option "Reprendre les desactivations du planning precedent" (si archive existante)
- Si un plan actif existe → message "Le planning actuel sera archive"

### 8.4 Vue archives

- Onglet "Archives" dans la page planning
- Liste des anciens plannings avec dates et nombre de slots remplis
- Clic → vue read-only du planning archive (meme grille, sans edition)

### 8.5 Edition d'un slot

- Modal avec recherche de recettes (autocomplete)
  - Resultats communaute en priorite
  - Resultats perso du membre en secondaire (avec indication visuelle)
- Bascule vers texte libre si besoin
- Champ commentaire toujours accessible

### 8.6 Vue liste d'idees

- Panel ou onglet separe dans la page planning
- Liste paginee, searchable
- Chaque idee : nom, commentaire, lien optionnel vers recette existante
- Actions : creer, editer, supprimer
- Future Feature 2 : "convertir en recette" (creer une recette depuis l'idee, puis lier via recipeId)

---

## 9. Seed & Tests

- **Feature** : upsert `MEAL_PLAN` dans le seed (idempotent, `code` unique)
- **Seeds de test** : creer un plan ACTIVE avec quelques slots remplis et disabled pour la communaute de test
- La feature n'est PAS attribuee aux communautes par defaut — attribution manuelle via admin

---

## 10. Hors scope (Feature 2 — Generation automatique)

Les elements suivants sont notes mais hors scope de cette spec :

- `MealGenerationParams` (jeux de parametres multiples par communaute)
- Regles par tags (avec poids 0–200%), poids sur recettes specifiques
- Contraintes de frequence par tag (min/max/exact)
- Cooldown recette et cooldown tag
- Epinglage de tag sur un slot (patterns par jour de la semaine)
- Exclusion de slots pour la generation (patterns par jour de la semaine)
- Bouton "Remplacer en conservant les criteres" sur chaque carte
- Utilisation de la MealIdea list dans le generateur
- `fillEmptyOnly` mode pour la generation

La `MealIdea` et le champ `locked` sur MealSlot sont deja concus (des Feature 1) pour etre utilisables par Feature 2 sans refactor DB.
