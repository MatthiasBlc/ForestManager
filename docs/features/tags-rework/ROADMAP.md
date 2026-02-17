# Roadmap : Rework Tags (Phase 10)

> **Spec** : `docs/features/tags-rework/SPEC_TAGS_REWORK.md`
> **Branche** : `TagsRework`

---

## 10.1 - Schema & Migration

- [x] Migration Prisma : enrichir Tag (scope, communityId, status, createdById)
- [x] Nouveau modele TagSuggestion
- [x] Nouveau modele UserCommunityTagPreference
- [x] Nouveau modele ModeratorNotificationPreference
- [x] Migration des tags existants → scope=GLOBAL, status=APPROVED
- [x] Tests migration

## 10.2 - Backend Tags (CRUD + validation)

- [x] Refactoring recipeService : upsertTags → logique scope-aware
- [x] Endpoint autocomplete tags : scope-aware (global + communaute)
- [x] Creation tag pending (membre sur recette communautaire)
- [x] Reutilisation tag pending existant (meme communaute)
- [x] Regles d'unicite (global vs communaute vs pending)
- [x] Gestion tags au fork inter-communaute (tags inconnus → pending)
- [x] Tags sur recette perso : global + communautes selon preferences
- [x] Tests unitaires + integration

## 10.3 - Backend Administration tags

- [x] Endpoints moderateur : GET/POST/PUT/DELETE community tags
- [x] Endpoints moderateur : approve/reject tag pending
- [x] Cascade rejet : hard delete tag + RecipeTags + notifications
- [x] Cascade validation : update status + notifications
- [x] Adaptation endpoints SuperAdmin (filtre scope)
- [x] Tests

## 10.4 - Backend TagSuggestion

- [x] Endpoint POST tag-suggestion (suggerer tag sur recette d'autrui)
- [x] Endpoint accept/reject par owner
- [x] Workflow 2 etapes : owner → moderateur (si tag inconnu)
- [x] Auto-rejet suggestions sur recettes orphelines
- [x] Cascade moderateur approve/reject → TagSuggestion PENDING_MODERATOR
- [x] Tests (29 tests)

## 10.5 - Backend Preferences & Notifications

- [x] Endpoints UserCommunityTagPreference (GET/PUT)
- [x] Endpoints ModeratorNotificationPreference (GET/PUT global + par communaute)
- [x] Notifications WebSocket : tag:pending, tag:approved, tag:rejected
- [x] Notifications WebSocket : tag-suggestion:pending-mod
- [x] Filtrage notifications selon preferences moderateur (notificationService)
- [x] Tests (25 tests)

## 10.6 - Frontend Tags (refactoring)

- [x] Composant TagBadge : style normal vs pending
- [x] Autocomplete tags : scope-aware (global + communaute filtree)
- [x] Creation recette : gestion tag inconnu → pending
- [x] Edition recette : idem
- [x] Affichage tags pending sur RecipeDetailPage
- [x] Tests composants

## 10.7 - Frontend Administration tags

- [x] Page moderateur : liste tags communaute (APPROVED + PENDING)
- [x] Actions moderateur : creer, renommer, supprimer tag communaute
- [x] Actions moderateur : valider/rejeter tag pending
- [x] Adaptation pages SuperAdmin (filtre scope)
- [x] Tests

## 10.8 - Frontend TagSuggestion

- [x] Bouton "Suggerer un tag" sur recette d'autrui
- [x] Vue owner : liste suggestions recues, accept/reject
- [x] Notifications temps reel tag suggestions
- [x] Tests

## 10.9 - Frontend Preferences

- [ ] Page profil : toggle visibilite tags par communaute
- [ ] Page profil moderateur : toggle notifications tags par communaute + global
- [ ] Tests
