# Roadmap : Recipe Rework v2 (Phase 13)

> Ref spec : `docs/features/recipe-rework-v2/SPEC_RECIPE_REWORK_V2.md`
> DaisyUI v4 | Themes : forest / winter

---

## Phase 13.1 - Migration DB & modeles Prisma

### 13.1.1 Migration Prisma
- [x] Creer migration `recipe_rework_v2`
  - Ajouter `Recipe.servings` (Int, NOT NULL, default 4)
  - Ajouter `Recipe.prepTime` (Int?, nullable)
  - Ajouter `Recipe.cookTime` (Int?, nullable)
  - Ajouter `Recipe.restTime` (Int?, nullable)
  - Creer table `RecipeStep` (id UUID PK, recipeId FK CASCADE, order Int, instruction Text)
  - Index sur `RecipeStep(recipeId, order)`
  - Ajouter `RecipeUpdateProposal.proposedServings` (Int?, nullable)
  - Ajouter `RecipeUpdateProposal.proposedPrepTime` (Int?, nullable)
  - Ajouter `RecipeUpdateProposal.proposedCookTime` (Int?, nullable)
  - Ajouter `RecipeUpdateProposal.proposedRestTime` (Int?, nullable)
  - Creer table `ProposalStep` (id UUID PK, proposalId FK CASCADE, order Int, instruction Text)
  - Index sur `ProposalStep(proposalId, order)`

### 13.1.2 Migration des donnees existantes
- [x] Script SQL dans la migration :
  - Pour chaque `Recipe` avec `content` non vide → inserer un `RecipeStep` (order=0, instruction=content)
  - Pour chaque `RecipeUpdateProposal` avec `proposedContent` non vide → inserer un `ProposalStep` (order=0, instruction=proposedContent)
  - Propositions existantes : `proposedServings` = NULL (pas de changement propose)

### 13.1.3 Suppression des anciens champs
- [x] Supprimer `Recipe.content`
- [x] Supprimer `RecipeUpdateProposal.proposedContent`

### 13.1.4 Mise a jour schema.prisma
- [x] Modele `Recipe` : ajouter champs + relation `steps RecipeStep[]`
- [x] Modele `RecipeStep` : complet avec relation + index
- [x] Modele `RecipeUpdateProposal` : supprimer `proposedContent`, ajouter 4 champs temps/servings + relation `proposedSteps ProposalStep[]`
- [x] Modele `ProposalStep` : complet avec relation + index
- [x] `npx prisma generate` + verifier compilation TS

### 13.1.5 Validation
- [x] Migration appliquee sans erreur sur DB dev
- [x] Donnees existantes migrees (recettes existantes ont chacune 1 step)
- [x] `npx prisma studio` : verifier les tables RecipeStep et ProposalStep
- [ ] Compilation backend OK (`npm run build` dans backend)

---

## Phase 13.2 - Backend : services & helpers

### 13.2.1 Helpers steps
- [x] `recipeService.ts` : creer `upsertSteps(tx, recipeId, steps[])` (meme pattern que `upsertIngredients`)
- [x] `recipeService.ts` : creer `upsertProposalSteps(tx, proposalId, steps[])` (meme pattern que `upsertProposalIngredients`)

### 13.2.2 Prisma selects
- [x] `util/prismaSelects.ts` : ajouter `RECIPE_STEPS_SELECT` + `PROPOSAL_STEPS_SELECT`
- [x] Mettre a jour `RECIPE_RESULT_SELECT` dans `recipeService.ts` : ajouter steps + servings/times

### 13.2.3 Validation backend
- [x] `util/validation.ts` : ajouter fonctions de validation
  - `validateServings(value)` : entier, 1-100
  - `validateTime(value)` : null OK, sinon entier >= 0, <= 10000
  - `validateSteps(steps[])` : array non vide, chaque instruction non vide, max 5000 chars

### 13.2.4 Response formatters
- [x] `util/responseFormatters.ts` : ajouter `formatSteps(steps)` (comme `formatTags`/`formatIngredients`)

### 13.2.5 Service recipeService.ts
- [x] `createRecipe()` : accepter `servings`, `prepTime`, `cookTime`, `restTime`, `steps[]` au lieu de `content`
- [x] `updateRecipe()` : accepter nouveaux champs, remplacer steps si fournis (deleteMany + upsertSteps)
- [x] `syncLinkedRecipes()` : synchroniser `servings`, `prepTime`, `cookTime`, `restTime`, `steps[]` vers recettes liees

### 13.2.6 Service communityRecipeService.ts
- [x] `createCommunityRecipe()` : accepter et propager les nouveaux champs (servings, times, steps)

### 13.2.7 Service shareService.ts
- [x] `forkRecipe()` : copier `servings`, `prepTime`, `cookTime`, `restTime` + dupliquer les `RecipeStep` (nouveaux UUIDs)
- [x] `publishRecipe()` : idem

### 13.2.8 Service proposalService.ts (bonus)
- [x] `acceptProposal()` : appliquer proposedServings/times/steps sur recette + propager
- [x] `rejectProposal()` : variante avec proposedSteps + proposedServings/times

### 13.2.9 Service orphanHandling.ts (bonus)
- [x] Variantes creees avec les bons champs (servings/times/steps au lieu de content)

---

## Phase 13.3 - Backend : controllers & routes

### 13.3.1 Controller recipes.ts
- [x] `createRecipe` : remplacer validation `content` par validation `servings` + `steps[]` + `times`
- [x] `updateRecipe` : idem, champs optionnels pour patch partiel
- [x] `getRecipe` : inclure `steps` (ordonnees), `servings`, `prepTime`, `cookTime`, `restTime` dans la reponse. Supprimer `content`
- [x] `getRecipes` (liste) : inclure `servings`, `prepTime`, `cookTime`, `restTime` dans chaque item

### 13.3.2 Controller communityRecipes.ts
- [x] `createCommunityRecipe` : memes changements que createRecipe
- [x] `getCommunityRecipes` (liste) : inclure servings + times

### 13.3.3 Controller proposals.ts
- [x] `createProposal` : accepter `proposedServings`, `proposedPrepTime`, `proposedCookTime`, `proposedRestTime`, `proposedSteps[]` au lieu de `proposedContent`
- [x] `getProposal` : inclure les nouveaux champs + `proposedSteps[]` dans la reponse
- [x] `listProposals` : inclure les nouveaux champs
- [x] `acceptProposal` : appliquer proposedServings/times/steps sur la recette + declencher sync
- [x] `rejectProposal` : la variante creee doit heriter des proposedSteps (pas de content)

### 13.3.4 Codes erreur
- [x] Ajouter `RECIPE_006` a `RECIPE_008` dans les controllers avec messages clairs

### 13.3.5 Validation
- [x] Compilation backend OK (source code, hors tests)
- [ ] Tests manuels API (Postman/curl) : create, get, update, delete recette avec nouveau format
- [ ] Verifier sync bidirectionnelle avec les nouveaux champs

### 13.3.6 Controller recipeShare.ts (bonus)
- [x] `shareRecipe` : inclure steps + servings/times dans le fork
- [x] `publishToCommunities` : inclure steps + servings/times dans le publish

### 13.3.7 Controller recipeVariants.ts (bonus)
- [x] `getVariants` : inclure servings/times dans la reponse

---

## Phase 13.4 - Backend : tests

### 13.4.1 Tests integration recipes
- [ ] Adapter `__tests__/integration/recipes.test.ts` :
  - Create : envoyer `servings` + `steps[]` au lieu de `content`
  - Get : verifier presence `steps[]`, `servings`, `prepTime`, `cookTime`, `restTime`
  - Update : tester update partiel des steps, servings, times
  - Supprimer toute reference a `content`
- [ ] Nouveaux tests :
  - Validation `servings` (0, -1, 101, null → erreur)
  - Validation `steps` (vide, instruction vide → erreur)
  - Validation `times` (negatif, > 10000 → erreur)
  - Scaling : pas de test backend (client-side only)

### 13.4.2 Tests integration communityRecipes
- [ ] Adapter `__tests__/integration/communityRecipes.test.ts` : memes changements

### 13.4.3 Tests integration proposals
- [ ] Adapter `__tests__/integration/proposals.test.ts` :
  - Creer proposal avec `proposedSteps[]` au lieu de `proposedContent`
  - Accepter proposal → verifier que la recette a les nouveaux steps/servings/times
  - Rejeter proposal → verifier que la variante a les proposedSteps

### 13.4.4 Tests integration share & variants
- [ ] Adapter `__tests__/integration/share.test.ts` : verifier copie des steps + servings + times lors du fork
- [ ] Adapter `__tests__/integration/variants.test.ts` : verifier que les variantes ont les steps

### 13.4.5 Tests unitaires
- [ ] `validation.test.ts` : tester `validateServings`, `validateTime`, `validateSteps`
- [ ] `responseFormatters.test.ts` : tester `formatSteps`

### 13.4.6 Validation
- [ ] `npm run test:backend` → tous les tests passent

---

## Phase 13.5 - Frontend : types & API client

### 13.5.1 Types frontend
- [ ] `models/recipe.ts` :
  - Ajouter `RecipeStep` interface (`id`, `order`, `instruction`)
  - `RecipeDetail` : supprimer `content`, ajouter `servings`, `prepTime`, `cookTime`, `restTime`, `steps: RecipeStep[]`
  - `RecipeListItem` : ajouter `servings`, `prepTime`, `cookTime`, `restTime`
  - `CommunityRecipeListItem` : idem (herite de RecipeListItem)
  - `Proposal` : supprimer reference a `proposedContent`, ajouter `proposedServings`, `proposedPrepTime`, `proposedCookTime`, `proposedRestTime`, `proposedSteps: { id, order, instruction }[]`
  - `ProposalInput` : supprimer `proposedContent`, ajouter `proposedServings`, `proposedPrepTime?`, `proposedCookTime?`, `proposedRestTime?`, `proposedSteps: { instruction: string }[]`

### 13.5.2 API client
- [ ] `network/api.ts` :
  - `RecipeInput` : supprimer `content`, ajouter `servings`, `prepTime?`, `cookTime?`, `restTime?`, `steps: { instruction: string }[]`
  - Verifier que `createRecipe`, `updateRecipe`, `createCommunityRecipe`, `createProposal` envoient les bons champs

### 13.5.3 Validation
- [ ] Compilation frontend OK (`npm run build` dans frontend)

---

## Phase 13.6 - Frontend : composants utilitaires

### 13.6.1 Utilitaire formatDuration
- [ ] `utils/formatDuration.ts` : fonction `formatDuration(minutes: number): string`
  - `45` → `"45 min"`
  - `90` → `"1h30"`
  - `120` → `"2h"`
  - `0` → `"0 min"`

### 13.6.2 Utilitaire scaleQuantity
- [ ] `utils/scaleQuantity.ts` : fonction `scaleQuantity(baseQty: number | null, baseServings: number, selectedServings: number): number | null`
  - Retourne null si baseQty est null
  - Calcul : `baseQty * (selectedServings / baseServings)`
  - Arrondi 2 decimales, suppression zeros inutiles

### 13.6.3 Composant TimeBadges
- [ ] `components/recipes/TimeBadges.tsx`
  - Props : `prepTime`, `cookTime`, `restTime` (tous `number | null`)
  - Affiche uniquement les temps definis (non null)
  - Utilise DaisyUI `stats` responsive (`stats-vertical` sur mobile via classe conditionnelle ou `stats` horizontal)
  - Chaque temps dans un `stat` : icone (FaClock prep, FaFire cuisson, FaPause repos) + label + valeur formatee
  - Total en dessous si au moins 1 temps defini : texte gras
  - Ne rend rien si tous les temps sont null

```
Composants DaisyUI utilises :
- stats / stat / stat-title / stat-value / stat-desc
- ou badge badge-outline avec icones (plus compact)
```

**Choix recommande** : badges en ligne (plus compact, coherent avec les tags)

```jsx
{/* Exemple structure */}
<div className="flex flex-wrap gap-2">
  {prepTime != null && (
    <div className="badge badge-outline gap-1">
      <FaClock className="w-3 h-3" /> Prep {formatDuration(prepTime)}
    </div>
  )}
  {cookTime != null && (
    <div className="badge badge-outline gap-1">
      <FaFire className="w-3 h-3" /> Cuisson {formatDuration(cookTime)}
    </div>
  )}
  {restTime != null && (
    <div className="badge badge-outline gap-1">
      <FaPause className="w-3 h-3" /> Repos {formatDuration(restTime)}
    </div>
  )}
  {totalTime > 0 && (
    <div className="badge badge-primary gap-1">
      Total {formatDuration(totalTime)}
    </div>
  )}
</div>
```

### 13.6.4 Composant ServingsSelector
- [ ] `components/recipes/ServingsSelector.tsx`
  - Props : `baseServings: number`, `value: number`, `onChange: (n: number) => void`
  - DaisyUI `join` pour grouper les elements : bouton `-` + input + bouton `+`
  - Input editable directement (type number, min 1, max 100)
  - Boutons avec classes `btn btn-sm join-item`
  - Input avec classe `input input-bordered input-sm join-item w-16 text-center`
  - Label "personnes" a cote

```jsx
{/* Exemple structure */}
<div className="flex items-center gap-2">
  <div className="join">
    <button className="btn btn-sm join-item" onClick={decrement}>-</button>
    <input
      type="number"
      className="input input-bordered input-sm join-item w-16 text-center"
      value={value}
      onChange={handleChange}
      min={1} max={100}
    />
    <button className="btn btn-sm join-item" onClick={increment}>+</button>
  </div>
  <span className="text-sm text-base-content/70">personnes</span>
</div>
```

### 13.6.5 Composant StepEditor (formulaire)
- [ ] `components/form/StepEditor.tsx`
  - Props : `value: { instruction: string }[]`, `onChange: (steps) => void`
  - Liste ordonnee de textareas numeros
  - Chaque step : numero badge + textarea DaisyUI `textarea textarea-bordered` + boutons reorder (haut/bas) + bouton supprimer
  - Bouton "Ajouter une etape" en bas : `btn btn-outline btn-sm gap-2` + icone FaPlus
  - Bouton supprimer desactive s'il ne reste qu'1 step
  - Boutons reorder : `btn btn-ghost btn-xs` avec FaArrowUp / FaArrowDown, desactives aux extremites

```jsx
{/* Exemple structure par step */}
<div className="flex gap-2 items-start">
  <div className="badge badge-neutral mt-3">{index + 1}</div>
  <textarea
    className="textarea textarea-bordered flex-1"
    value={step.instruction}
    onChange={...}
    rows={3}
    placeholder={`Etape ${index + 1}...`}
    maxLength={5000}
  />
  <div className="flex flex-col gap-1">
    <button className="btn btn-ghost btn-xs" disabled={index === 0}>
      <FaArrowUp />
    </button>
    <button className="btn btn-ghost btn-xs" disabled={index === last}>
      <FaArrowDown />
    </button>
    <button className="btn btn-ghost btn-xs text-error" disabled={total === 1}>
      <FaTimes />
    </button>
  </div>
</div>
```

### 13.6.6 Tests unitaires utils
- [ ] `__tests__/unit/utils/formatDuration.test.ts`
- [ ] `__tests__/unit/utils/scaleQuantity.test.ts`

### 13.6.7 Validation
- [ ] Compilation frontend OK
- [ ] Tests frontend passent

---

## Phase 13.7 - Frontend : RecipeDetailPage

### 13.7.1 Rework RecipeDetailPage
- [ ] Supprimer l'affichage de `recipe.content`
- [ ] Ajouter section `TimeBadges` apres le titre et les meta-infos
- [ ] Ajouter section tags (inchange, mais deplace apres les temps)
- [ ] Ajouter `ServingsSelector` en en-tete de la section ingredients
  - Etat local `selectedServings` initialise a `recipe.servings`
  - Les quantites d'ingredients affichees utilisent `scaleQuantity()`
- [ ] Section ingredients : quantites recalculees dynamiquement via `scaleQuantity`
- [ ] Section etapes : affichage sequentiel numerote
  - Chaque etape dans un bloc `bg-base-200 rounded-lg p-4` avec numero en badge
  - Ou utilisation du composant DaisyUI `timeline timeline-vertical` avec numero dans `timeline-middle` et instruction dans `timeline-end timeline-box`

```jsx
{/* Proposition: steps avec timeline DaisyUI */}
<ul className="timeline timeline-vertical timeline-compact">
  {recipe.steps.map((step, i) => (
    <li key={step.id}>
      {i > 0 && <hr />}
      <div className="timeline-middle">
        <div className="badge badge-primary">{i + 1}</div>
      </div>
      <div className="timeline-end timeline-box">
        {step.instruction}
      </div>
      {i < recipe.steps.length - 1 && <hr />}
    </li>
  ))}
</ul>
```

**Alternative plus simple** (blocs cartes numerotees) :
```jsx
<div className="space-y-4">
  {recipe.steps.map((step, i) => (
    <div key={step.id} className="flex gap-4 items-start">
      <div className="badge badge-primary badge-lg">{i + 1}</div>
      <p className="flex-1 whitespace-pre-wrap">{step.instruction}</p>
    </div>
  ))}
</div>
```

### 13.7.2 Validation
- [ ] Test visuel : verifier le layout sequentiel complet
- [ ] Tester le scaling des quantites (changer le selecteur → les quantites changent)
- [ ] Tester avec recette sans temps (pas de section temps affichee)
- [ ] Tester avec recette migree (1 step, servings=4)

---

## Phase 13.8 - Frontend : RecipeFormPage

### 13.8.1 Rework RecipeFormPage
- [ ] Supprimer le champ `content` (textarea unique)
- [ ] Ajouter champ `servings` (obligatoire) : `input input-bordered w-24` type number
- [ ] Ajouter ligne de temps optionnels : 3 inputs en ligne (prep, cuisson, repos)
  - Labels clairs, placeholder "min", `input input-bordered w-24` chacun
  - Layout responsive : en ligne sur desktop, empile sur mobile
- [ ] Remplacer le textarea instructions par le composant `StepEditor`
- [ ] Mettre a jour le `onSubmit` : envoyer `servings`, `prepTime`, `cookTime`, `restTime`, `steps[]` au lieu de `content`
- [ ] Mettre a jour le `loadRecipe` (mode edition) : charger et pre-remplir les nouveaux champs

### 13.8.2 Validation
- [ ] Creation recette avec tous les champs → succes
- [ ] Edition recette existante → pre-remplissage correct
- [ ] Validation : servings vide → erreur, 0 steps → erreur
- [ ] Test avec recette migree : 1 step pre-rempli, servings=4

---

## Phase 13.9 - Frontend : Proposals

### 13.9.1 ProposeModificationModal
- [ ] Supprimer le textarea `proposedContent`
- [ ] Ajouter champ `proposedServings` (pre-rempli avec valeur actuelle)
- [ ] Ajouter champs temps (pre-remplis avec valeurs actuelles)
- [ ] Ajouter `StepEditor` pre-rempli avec les steps actuels de la recette
- [ ] Mettre a jour la detection de changement (`hasChanges`) : comparer servings, temps, steps individuellement
- [ ] Mettre a jour le `handleSubmit` : envoyer les nouveaux champs

### 13.9.2 ProposalsList
- [ ] Adapter l'affichage des proposals : montrer les steps proposes au lieu du texte
- [ ] Afficher les changements de servings/temps proposes

### 13.9.3 Validation
- [ ] Creer une proposition avec changements de steps → succes
- [ ] Accepter → recette mise a jour avec les nouveaux steps
- [ ] Rejeter → variante creee avec les steps proposes

---

## Phase 13.10 - Frontend : RecipeCard & listes

### 13.10.1 RecipeCard
- [ ] Ajouter badges compacts : temps total + servings
  - Sous les tags existants
  - `badge badge-ghost badge-sm gap-1` avec icone

### 13.10.2 RecipeListRow
- [ ] Memes ajouts que RecipeCard si utilise en mode liste

### 13.10.3 Validation
- [ ] Verifier les cartes sur la page recettes perso
- [ ] Verifier les cartes sur la page communaute

---

## Phase 13.11 - Tests frontend

### 13.11.1 Tests composants nouveaux
- [ ] `__tests__/unit/components/recipes/TimeBadges.test.tsx`
- [ ] `__tests__/unit/components/recipes/ServingsSelector.test.tsx`
- [ ] `__tests__/unit/components/form/StepEditor.test.tsx`

### 13.11.2 Tests pages adaptees
- [ ] Adapter `__tests__/unit/pages/RecipeFormPage.test.tsx` : nouveau format formulaire
- [ ] Adapter `__tests__/unit/components/proposals/ProposeModificationModal.test.tsx`
- [ ] Adapter `__tests__/unit/components/recipes/RecipeCard.test.tsx` : nouveaux badges
- [ ] Adapter MSW handlers (`mswHandlers.ts`) : retourner les nouveaux champs dans les mocks

### 13.11.3 Validation
- [ ] `npm run test:frontend` → tous les tests passent

---

## Phase 13.12 - Finalisation

### 13.12.1 Tests manuels complets
- [ ] Creer une recette complete (servings + temps + ingredients + steps)
- [ ] Editer la recette (modifier steps, servings, temps)
- [ ] Consulter la recette : layout sequentiel, scaling fonctionne
- [ ] Proposer une modification (steps + servings) → accepter → verifier recette mise a jour
- [ ] Proposer une modification → rejeter → verifier variante avec steps proposes
- [ ] Partager une recette → verifier copie des steps/servings/times
- [ ] Publier une recette perso vers une communaute → verifier sync
- [ ] Modifier une recette synchronisee → verifier sync bidirectionnelle
- [ ] Verifier recettes migrees (1 step, servings=4, pas de temps)

### 13.12.2 Tests complets suite
- [ ] `npm test` → backend + frontend passent

### 13.12.3 Nettoyage
- [ ] Supprimer le code mort (references a `content`, `proposedContent`)
- [ ] Supprimer les interfaces legacy non utilisees (ex: `Recipe` avec `content`)

### 13.12.4 Mise a jour contexte projet
- [ ] `.claude/context/DB_MODELS.md` : ajouter RecipeStep, ProposalStep, nouveaux champs
- [ ] `.claude/context/API_MAP.md` : mettre a jour les inputs/outputs des endpoints recettes et proposals
- [ ] `.claude/context/FILE_MAP.md` : ajouter les nouveaux fichiers (composants, utils)
- [ ] `.claude/context/TESTS.md` : ajouter les nouveaux tests
- [ ] `.claude/context/PROGRESS.md` : marquer Phase 13 complete

### 13.12.5 Documentation
- [ ] `docs/features/recipe-rework-v2/MANUAL_TESTS.md` : checklist tests manuels detailles
- [ ] Mettre a jour `docs/0 - brainstorming futur.md` : marquer "Rework des pages recettes (v2)" comme DONE

### 13.12.6 Brainstorm update
- [ ] Marquer la feature comme DONE dans le brainstorming
