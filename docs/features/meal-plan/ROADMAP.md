# Roadmap : Meal Plan (Feature 1 — Planning Manuel)

Spec : `docs/features/meal-plan/SPEC_MEAL_PLAN.md`

---

## Phase 1 — Modele de donnees & migration

- [x] Ajouter les enums `DayOfWeek`, `MealTime`, `MealSlotType`, `MealPlanStatus` dans `schema.prisma`
- [x] Creer le modele `MealPlan` (communityId, startDate, endDate, status, defaultServings, editableByMembers)
- [x] Creer le modele `MealSlot` (planId, date, mealTime, type, disabled, locked, recipeId?, freeText?, comment?, servings)
- [x] Creer le modele `MealIdea` (communityId, name, comment?, recipeId?, createdById?, deletedAt)
- [x] Ajouter les relations dans `Community`, `Recipe`, `User`
- [x] Generer et appliquer la migration Prisma
- [x] Upsert Feature `MEAL_PLAN` (code unique, isDefault: false) dans le seed
- [x] Seed de test : creer un plan ACTIVE avec slots remplis + disabled pour la communaute de test
- [x] Verifier que le seed passe sans erreur (idempotent)

---

## Phase 2 — Middleware & Feature guard

- [x] Creer middleware `requireFeature(featureCode)` generique (ou verifier s'il existe deja)
- [x] Le middleware verifie que la feature est activee pour la communaute (CommunityFeature, revokedAt null)
- [x] Retourne 403 avec code `MEAL_005` si feature non activee
- [x] Tests middleware requireFeature

---

## Phase 3 — Backend API Meal Plan

- [x] Creer `controllers/mealPlan.ts`
- [x] Creer `routes/mealPlan.ts`
- [x] `GET /api/communities/:communityId/meal-plan` — plan ACTIVE + tous les slots + recipe data (memberOf)
- [x] `POST /api/communities/:communityId/meal-plan` — creer plan + slots (MODERATOR)
  - [x] Validation dates (startDate <= endDate, max 31 jours, pas de chevauchement)
  - [x] Auto-archivage du plan actif existant
  - [x] Creation dynamique des slots (N jours x 2 repas)
  - [x] Support `disabledSlots` et `copyDisabledFromPrevious`
- [x] `DELETE /api/communities/:communityId/meal-plan` — supprimer plan ACTIVE + cascade (MODERATOR)
- [x] `PATCH /api/communities/:communityId/meal-plan` — update defaultServings / editableByMembers (MODERATOR)
- [x] `PATCH /api/communities/:communityId/meal-plan/slots/:slotId` — update slot (permission dynamique)
  - [x] Validation type (RECIPE/FREE_TEXT/EMPTY)
  - [x] Auto-enable du slot disabled quand on set un contenu
  - [x] Refus si plan ARCHIVED
- [x] `POST /api/communities/:communityId/meal-plan/slots/swap` — swap 2 slots (permission dynamique)
- [x] Gestion recette soft-deleted : renvoyer flag `isDeleted` dans la reponse
- [x] Codes erreur MEAL_001 a MEAL_011
- [x] Brancher les routes dans `app.ts` (sous communaute routes, avec requireFeature)
- [x] Tests unitaires plan CRUD (creation, archivage auto, validation dates)
- [x] Tests unitaires slots (update, swap, disabled auto-enable, locked)
- [x] Tests permissions (MODERATOR vs membre, editableByMembers toggle)
- [x] Tests feature guard (403 si feature desactivee)
- [x] Tests plan archive non-editable

---

## Phase 4 — Backend API Archives

- [x] `GET /api/communities/:communityId/meal-plan/archives` — liste paginee (memberOf)
- [x] `GET /api/communities/:communityId/meal-plan/archives/:planId` — detail archive + slots (memberOf)
- [x] `DELETE /api/communities/:communityId/meal-plan/archives/:planId` — supprimer archive (MODERATOR)
- [x] Validation : le plan demande doit appartenir a la communaute et etre ARCHIVED
- [x] Tests unitaires archives

---

## Phase 5 — Backend API Meal Ideas

- [x] Creer `controllers/mealIdeas.ts`
- [x] Creer `routes/mealIdeas.ts`
- [x] `GET /api/communities/:communityId/meal-ideas` — liste paginee, search par nom (memberOf)
- [x] `POST /api/communities/:communityId/meal-ideas` — creer idee (memberOf)
- [x] `PATCH /api/communities/:communityId/meal-ideas/:ideaId` — modifier (createur ou MODERATOR)
- [x] `DELETE /api/communities/:communityId/meal-ideas/:ideaId` — soft delete (createur ou MODERATOR)
- [x] Validation : name max 255, comment max 500, recipeId optionnel et valide
- [x] Brancher les routes dans `communities.ts`
- [x] Tests unitaires CRUD idees
- [x] Tests permissions (createur vs MODERATOR)

---

## Phase 6 — Frontend : creation de planning

- [x] Page planning dans la section communaute (`MealPlanPage.tsx`)
- [x] Conditionner l'acces a la feature `MEAL_PLAN` (403 si non activee)
- [x] Formulaire creation : date debut, date fin, nombre de personnes par defaut
- [x] Apercu visuel du planning avec checkboxes pour desactiver des slots
- [x] Option "Reprendre les desactivations du planning precedent"
- [x] Message "Le planning actuel sera archive" si plan actif existe
- [x] Appel API POST + affichage du plan cree

---

## Phase 7 — Frontend : vue planning (desktop)

- [x] Grille N colonnes (jours) x 2 lignes (midi/soir)
- [x] Scroll horizontal si > 7 jours
- [x] En-tete : jour de la semaine + date
- [x] Carte slot : nom recette ou texte libre, badge servings
- [x] Slot EMPTY : "+" cliquable
- [x] Slot disabled : grise
- [x] Slot locked : icone cadenas
- [x] Slot recette soft-deleted : badge "Deleted recipe", style barre
- [x] Clic carte → modal edition
- [x] Boutons creer/supprimer plan, settings (MODERATOR)

---

## Phase 8 — Frontend : edition de slot

- [x] Modal d'edition au clic sur un slot (`SlotEditModal.tsx`)
- [x] Recherche de recettes (autocomplete communaute)
- [x] Mode texte libre : champ freeText + champ commentaire
- [x] Mode EMPTY : onglet reset
- [x] Toggle disabled/enabled
- [x] Toggle locked/unlocked (MODERATOR)
- [x] Edition servings dans le modal

---

## Phase 9 — Frontend : drag & drop (swap)

- [x] Utilisation HTML5 native drag & drop
- [x] Implementer le drag & drop entre slots (swap du contenu)
- [x] Feedback visuel pendant le drag (opacity)
- [x] Appel API swap au drop
- [x] Gestion optimiste via state update

---

## Phase 10 — Frontend : vue mobile

- [x] Layout mobile : cartes-jours empilees verticalement (via `useIsMobile`)
- [x] En-tete carte : jour de la semaine + date
- [x] Chaque carte-jour contient 2 sous-cartes (midi / soir)
- [x] Slots disabled grises
- [x] Scroll vertical natif
- [x] Meme fonctionnalites que desktop (edition, drag & drop)
- [x] Breakpoint responsive automatique

---

## Phase 11 — Frontend : archives

- [x] Onglet "Archives" dans la page planning
- [x] Liste des anciens plannings (dates, nb slots remplis)
- [x] Clic → vue read-only du planning archive (meme grille, sans edition)
- [x] Suppression archive (MODERATOR)

---

## Phase 12 — Frontend : liste d'idees

- [x] Onglet "Ideas" dans la page planning (`MealIdeasPanel.tsx`)
- [x] Liste paginee avec recherche
- [x] Formulaire creation/edition d'idee (nom, commentaire)
- [x] Bouton supprimer
- [x] Lien vers la recette si recipeId present

---

## Phase 13 — Mise a jour docs & contexte

- [x] Mettre a jour `.claude/context/DB_MODELS.md` (nouveaux modeles + enums)
- [x] Mettre a jour `.claude/context/API_MAP.md` (nouveaux endpoints)
- [x] Mettre a jour `.claude/context/PROGRESS.md`
- [x] Mettre a jour `.claude/CLAUDE.md` (table features)
- [x] Mettre a jour `.claude/context/FILE_MAP.md` si necessaire
- [x] Mettre a jour `.claude/context/TESTS.md`
