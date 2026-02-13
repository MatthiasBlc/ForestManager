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

- [ ] Endpoints moderateur : GET/POST/PUT/DELETE community tags
- [ ] Endpoints moderateur : approve/reject tag pending
- [ ] Cascade rejet : hard delete tag + RecipeTags + notifications
- [ ] Cascade validation : update status + notifications
- [ ] Adaptation endpoints SuperAdmin (filtre scope)
- [ ] Tests

## 10.4 - Backend TagSuggestion

- [ ] Endpoint POST tag-suggestion (suggerer tag sur recette d'autrui)
- [ ] Endpoint accept/reject par owner
- [ ] Workflow 2 etapes : owner → moderateur (si tag inconnu)
- [ ] Auto-rejet suggestions sur recettes orphelines
- [ ] Tests

## 10.5 - Backend Preferences & Notifications

- [ ] Endpoints UserCommunityTagPreference (GET/PUT)
- [ ] Endpoints ModeratorNotificationPreference (GET/PUT)
- [ ] Notifications WebSocket : tag:pending, tag:approved, tag:rejected
- [ ] Notifications WebSocket : tag-suggestion:new, approved, rejected
- [ ] Filtrage notifications selon preferences moderateur
- [ ] Tests

## 10.6 - Frontend Tags (refactoring)

- [ ] Composant TagBadge : style normal vs pending
- [ ] Autocomplete tags : scope-aware (global + communaute filtree)
- [ ] Creation recette : gestion tag inconnu → pending
- [ ] Edition recette : idem
- [ ] Affichage tags pending sur RecipeDetailPage
- [ ] Tests composants

## 10.7 - Frontend Administration tags

- [ ] Page moderateur : liste tags communaute (APPROVED + PENDING)
- [ ] Actions moderateur : creer, renommer, supprimer tag communaute
- [ ] Actions moderateur : valider/rejeter tag pending
- [ ] Adaptation pages SuperAdmin (filtre scope)
- [ ] Tests

## 10.8 - Frontend TagSuggestion

- [ ] Bouton "Suggerer un tag" sur recette d'autrui
- [ ] Vue owner : liste suggestions recues, accept/reject
- [ ] Notifications temps reel tag suggestions
- [ ] Tests

## 10.9 - Frontend Preferences

- [ ] Page profil : toggle visibilite tags par communaute
- [ ] Page profil moderateur : toggle notifications tags par communaute + global
- [ ] Tests
