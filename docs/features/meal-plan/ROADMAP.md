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

- [ ] `GET /api/communities/:communityId/meal-plan/archives` — liste paginee (memberOf)
- [ ] `GET /api/communities/:communityId/meal-plan/archives/:planId` — detail archive + slots (memberOf)
- [ ] Validation : le plan demande doit appartenir a la communaute et etre ARCHIVED
- [ ] Tests unitaires archives

---

## Phase 5 — Backend API Meal Ideas

- [ ] Creer `controllers/mealIdeas.ts`
- [ ] Creer `routes/mealIdeas.ts`
- [ ] `GET /api/communities/:communityId/meal-ideas` — liste paginee, search par nom (memberOf)
- [ ] `POST /api/communities/:communityId/meal-ideas` — creer idee (memberOf)
- [ ] `PATCH /api/communities/:communityId/meal-ideas/:ideaId` — modifier (createur ou MODERATOR)
- [ ] `DELETE /api/communities/:communityId/meal-ideas/:ideaId` — soft delete (createur ou MODERATOR)
- [ ] Validation : name max 255, comment max 500, recipeId optionnel et valide
- [ ] Brancher les routes dans `app.ts`
- [ ] Tests unitaires CRUD idees
- [ ] Tests permissions (createur vs MODERATOR)

---

## Phase 6 — Frontend : creation de planning

- [ ] Page planning dans la section communaute
- [ ] Conditionner l'acces a la feature `MEAL_PLAN` (masquer si non activee)
- [ ] Formulaire creation : date debut, date fin, nombre de personnes par defaut
- [ ] Apercu visuel du planning avec checkboxes pour desactiver des slots
- [ ] Option "Reprendre les desactivations du planning precedent"
- [ ] Message "Le planning actuel sera archive" si plan actif existe
- [ ] Appel API POST + affichage du plan cree

---

## Phase 7 — Frontend : vue planning (desktop)

- [ ] Grille N colonnes (jours) x 2 lignes (midi/soir)
- [ ] Scroll horizontal ou pagination si > 7 jours
- [ ] En-tete : jour de la semaine + date
- [ ] Carte slot : nom recette ou texte libre, badge servings
- [ ] Slot EMPTY : "+" cliquable
- [ ] Slot disabled : grise avec "+" discret
- [ ] Slot locked : icone cadenas
- [ ] Slot recette soft-deleted : badge "Recette supprimee", style grise
- [ ] Clic carte → drawer/modal detail (lien recette, commentaire, servings editable)
- [ ] Boutons creer/supprimer plan, toggle editableByMembers (MODERATOR)

---

## Phase 8 — Frontend : edition de slot

- [ ] Modal d'edition au clic sur un slot
- [ ] Recherche de recettes (autocomplete) : communaute en priorite, perso en secondaire
- [ ] Recette perso non dans la communaute → popup "Ajouter a la communaute ?"
  - [ ] Si oui → publish (flow existant) → slot pointe vers la copie
  - [ ] Si non → bascule FREE_TEXT avec nom pre-rempli
- [ ] Mode texte libre : champ freeText + champ commentaire
- [ ] Mode EMPTY : bouton reset
- [ ] Toggle disabled/enabled
- [ ] Toggle locked/unlocked
- [ ] Edition servings directe sur la carte ou dans le modal

---

## Phase 9 — Frontend : drag & drop (swap)

- [ ] Installer `@dnd-kit/core` (ou verifier si deja present)
- [ ] Implementer le drag & drop entre slots (swap du contenu)
- [ ] Feedback visuel pendant le drag (zone de drop highlight)
- [ ] Appel API swap au drop
- [ ] Gestion optimiste + rollback en cas d'erreur

---

## Phase 10 — Frontend : vue mobile

- [ ] Layout mobile : cartes-jours empilees verticalement
- [ ] En-tete carte : jour de la semaine + date
- [ ] Chaque carte-jour contient 2 sous-cartes (midi / soir)
- [ ] Slots disabled grises
- [ ] Scroll vertical natif
- [ ] Meme fonctionnalites que desktop (edition, swap via drag & drop)
- [ ] Breakpoint responsive (grille desktop → cartes mobile)

---

## Phase 11 — Frontend : archives

- [ ] Onglet "Archives" dans la page planning
- [ ] Liste des anciens plannings (dates, nb slots remplis)
- [ ] Clic → vue read-only du planning archive (meme grille, sans edition)

---

## Phase 12 — Frontend : liste d'idees

- [ ] Onglet ou panel "Idees" dans la page planning
- [ ] Liste paginee avec recherche
- [ ] Formulaire creation/edition d'idee (nom, commentaire, lien recette optionnel)
- [ ] Bouton supprimer (createur ou MODERATOR)
- [ ] Lien vers la recette si recipeId present

---

## Phase 13 — Mise a jour docs & contexte

- [ ] Mettre a jour `.claude/context/DB_MODELS.md` (nouveaux modeles + enums)
- [ ] Mettre a jour `.claude/context/API_MAP.md` (nouveaux endpoints)
- [ ] Mettre a jour `.claude/context/PROGRESS.md`
- [ ] Mettre a jour `.claude/CLAUDE.md` (table features)
- [ ] Mettre a jour `.claude/context/FILE_MAP.md` si necessaire
