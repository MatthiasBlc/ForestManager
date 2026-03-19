# Resume de reprise — Meal Generation Phase 10

## Tache suivante

Phase 10 du ROADMAP_GENERATION : Frontend generation + rapport

## Ce qui est fait (Phases 1-9)

- Backend complet : modeles, API CRUD params/exclusions/rules/pins, algorithme generation, endpoints generate + replace
- Frontend : verrouillage slots (Phase 7), page params avec exclusions/pins (Phase 8), edition regles inline (Phase 9)
- Tous les tests passent (backend + frontend)

## Phase 10 — A faire

1. **Bouton "Generer le planning"** (MODERATOR only) dans la page MealPlan
2. **Selecteur jeu de params** (pre-selectionne sur isDefault)
3. **Toggle fillEmptyOnly** (checkbox)
4. **Modal confirmation** si ecrasement de slots non verrouilles (fillEmptyOnly=false)
5. **Affichage rapport** post-generation : slotsGenerated, slotsSkipped, warnings
6. **Warning visuel** pour frequencyMin non atteint, pool epuise, etc.
7. **Bouton "Remplacer"** sur chaque carte slot (masque si locked ou pas de jeu par defaut)
8. **Modal confirmation** au clic sur "Remplacer"

## API a consommer (backend deja pret)

- `POST /api/communities/:communityId/meal-plan/generate` — body: `{ paramsId, fillEmptyOnly }`
- `POST /api/communities/:communityId/meal-plan/slots/:slotId/replace` — body: `{ paramsId }`
- Les fonctions API frontend pour ces 2 endpoints n'existent PAS encore dans mealApi.ts

## Fichiers cles a modifier

- `frontend/src/network/mealApi.ts` — ajouter generateMealPlan + replaceMealSlot
- `frontend/src/network/api.ts` — wirer dans APIManager
- `frontend/src/models/mealPlan.ts` — ajouter types GenerateResponse (plan + report)
- `frontend/src/pages/MealPlanPage.tsx` — bouton generer + logique
- `frontend/src/components/mealPlan/` — composant(s) pour le slot card (bouton remplacer), modal generation, affichage rapport

## Modeles backend de reference (response generate)

```json
{
  "plan": { ... },
  "report": {
    "slotsGenerated": 10,
    "slotsSkipped": { "excluded": 2, "locked": 1, "alreadyFilled": 0 },
    "slotsEmpty": 1,
    "warnings": [
      { "type": "POOL_EXHAUSTED", "slotDay": "THU", "slotMealTime": "DINNER", "reason": "..." },
      { "type": "FREQUENCY_MIN_NOT_MET", "tagId": "uuid", "tagName": "...", "required": 3, "actual": 2, "reason": "..." }
    ]
  }
}
```

## Rapport qualite (post Phase 9, 2026-03-19)

| Check          | Status                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Frontend TS    | 0 errors                                                                                          |
| Frontend lint  | 0 errors, 0 warnings                                                                              |
| Frontend tests | 546/546 pass                                                                                      |
| Backend TS     | 5 errors pre-existants (imageKey dans proposalService, recipeService, shareService)               |
| Backend lint   | 14 errors (3 unused vars dans mealGeneration.ts, 11 pre-existants), 21 warnings (no-explicit-any) |
| Backend tests  | 1010/1010 pass                                                                                    |
| npm audit      | 1 high severity (socket.io-parser 4.0.0-4.2.5) frontend + backend                                 |

### A corriger avant merge

- **Backend lint** : 3 unused vars dans `backend/src/services/mealGeneration.ts` (MealSlot import, pool arg, slotIndexMap var)
- **npm audit** : `npm audit fix` dans frontend/ et backend/ pour socket.io-parser
- **Backend TS** : 5 erreurs imageKey pre-existantes (hors scope meal-generation)

## Notes

- `hasDefaultGenerationParams` est deja dans la response GET /meal-plan (utiliser pour masquer bouton Remplacer)
- Phase 7 a deja le lock toggle, mais le masquage du bouton Remplacer sur slots locked est dans Phase 10
- Voir spec section 6.4 et 6.5 pour le detail UX
