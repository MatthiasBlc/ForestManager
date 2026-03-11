# Roadmap : Recipe Import

> **Spec** : `docs/features/recipe-import/SPEC_RECIPE_IMPORT.md`
> **Branche** : `ImportRecipeSystem`

---

## Phase A — Parser texte (frontend)

### A.1 - Service de parsing texte

- [x] Creer `frontend/src/services/recipeParser.ts`
  - Fonction `parseRecipeText(text: string): ParsedRecipe`
  - Types `ParsedRecipe`, `ParsedIngredient`
- [x] Implementer le nettoyage (normalisation sauts de ligne, suppression separateurs)
- [x] Implementer la detection du titre (premiere ligne courte, pas un header de section)
- [x] Implementer la detection des sections (headers ingredients/etapes)
- [x] Implementer le fallback sans headers (pattern matching ligne par ligne)

### A.2 - Extraction des ingredients

- [x] Parser les lignes d'ingredients : quantite + unite + nom
  - Patterns : `200g farine`, `3 oeufs`, `1/2 citron`, `sel a gout`
  - Suppression des puces (`-`, `*`, `•`)
  - Gestion des particules (`de`, `d'`)
- [x] Mapping des unites parsees vers les abbreviations DB (table de correspondance)

### A.3 - Extraction des etapes et metadonnees

- [x] Parser les etapes : suppression numeros/puces, chaque ligne non vide = 1 etape
- [x] Extraction servings : regex `(\d+) personnes/pers/portions`
- [x] Extraction temps : regex prep/cuisson/repos en minutes ou heures
- [x] Conversion heures → minutes (`1h30` → 90)

### A.4 - Tests unitaires du parser

- [x] Test cas nominal (recette complete bien formatee)
- [x] Test recette sans headers de section (detection par pattern)
- [x] Test ingredients varies (avec/sans unite, fractions, "a gout")
- [x] Test temps en heures (`1h30`), en minutes (`45 min`), mixtes
- [x] Test texte avec separateurs visuels (lignes de tirets, etc.)
- [x] Test texte minimal (juste un titre)
- [x] Test texte vide → resultat vide

---

## Phase B — Import URL (backend)

### B.1 - Endpoint et validation

- [x] Installer `cheerio` (`npm install cheerio`)
- [x] Creer `backend/src/controllers/recipeImport.ts`
  - `POST /api/recipes/import-url`
  - Validation URL (format, longueur max 2000, protocole http/https uniquement)
  - Protection SSRF (rejeter adresses privees/internes)
- [x] Ajouter la route dans `backend/src/routes/recipes.ts`
- [x] Codes erreur : `IMPORT_001` (URL invalide), `IMPORT_002` (fetch echoue), `IMPORT_003` (pas de recette)

### B.2 - Service d'extraction JSON-LD

- [x] Creer `backend/src/services/recipeImportService.ts`
  - Fetch de l'URL (timeout 10s, max 5 MB, max 5 redirects)
  - User-Agent standard (pas de bot UA)
- [x] Extraction JSON-LD : chercher `<script type="application/ld+json">`
  - Objet direct `@type: "Recipe"`
  - Dans `@graph[]`
  - Type avec namespace ou array
- [x] Mapping champs JSON-LD → ParsedRecipe
  - `name` → title
  - `recipeYield` → servings (extraire nombre)
  - `prepTime`/`cookTime` → ISO 8601 duration → minutes
  - `totalTime` → fallback prepTime si aucun autre temps
  - `recipeIngredient[]` → parser chaque string (reutiliser la logique du parser texte)
  - `recipeInstructions` → gerer string, array de strings, HowToStep[], HowToSection[]
- [x] Si pas de JSON-LD → erreur `IMPORT_003` (pas de fallback HTML)

### B.3 - Tests backend

- [x] Test URL invalide → 400 IMPORT_001
- [x] Test URL inaccessible → 422 IMPORT_002
- [x] Test page sans JSON-LD → 422 IMPORT_003
- [x] Test SSRF : URL vers 127.0.0.1, 192.168.x → 400
- [x] Test JSON-LD valide (mock) → ParsedRecipe correcte
- [x] Test formats varies de recipeInstructions (string, HowToStep, HowToSection)
- [x] Test ISO 8601 durations (PT30M, PT1H30M, PT2H)
- [x] Test non authentifie → 401

---

## Phase C — Frontend : modale d'import et integration

### C.1 - Methode API frontend

- [x] Ajouter dans `frontend/src/network/api.ts` :
  - `importRecipeFromUrl(url: string): Promise<ParsedRecipe>`
  - POST vers `/api/recipes/import-url`

### C.2 - Composant ImportRecipeModal

- [x] Creer `frontend/src/components/ImportRecipeModal.tsx`
  - Textarea (10 lignes, placeholder avec exemple texte + URL)
  - Bouton "Analyser" (disabled si vide)
  - Loading spinner (pour import URL)
  - Zone d'erreur (messages traduits depuis les codes erreur)
- [x] Detection auto du type d'input (URL si commence par `http://` ou `https://`)
- [x] Si texte → appel `parseRecipeText()` (synchrone, local)
- [x] Si URL → appel `APIManager.importRecipeFromUrl()` (async, backend)

### C.3 - Integration dans RecipeFormPage

- [x] Ajouter bouton "Importer une recette" (visible uniquement en creation)
  - Icone `FaFileImport`, style bouton outline
  - Place a cote du titre "New Recipe"
- [x] State pour afficher/masquer la modale
- [x] Callback `onImport(parsed: ParsedRecipe)` :
  - `window.confirm()` si le formulaire a deja des donnees
  - Pre-remplir title, servings, prepTime, cookTime, restTime, steps
  - Matching des ingredients (voir C.4)
  - Toast de succes avec resume

### C.4 - Matching des ingredients

- [x] Apres parsing, pour chaque `ParsedIngredient` :
  - Matcher `unitAbbreviation` contre les unites chargees (case-insensitive sur `abbreviation`)
  - Appeler `APIManager.searchIngredients(name, 5)` en parallele (`Promise.all`)
  - Si match exact (name identique case-insensitive) → utiliser `ingredientId` + suggested unit
  - Sinon → pre-remplir `name` en texte brut, `ingredientId` reste undefined
- [x] Mapper vers `IngredientInput[]` et appeler `setIngredients()`

### C.5 - Tests frontend

- [ ] Test ImportRecipeModal : rendu, detection URL vs texte
- [ ] Test pre-remplissage du formulaire apres import
- [ ] Test confirmation ecrasement (formulaire deja rempli)
- [ ] Test gestion erreurs (URL invalide, fetch echoue)

---

## Phase D — Polish et documentation

### D.1 - Cas limites

- [ ] Verifier le comportement avec des textes tres longs (>10000 chars)
- [ ] Verifier le comportement avec des URLs qui mettent longtemps (timeout 10s respecte)
- [ ] Verifier que les caracteres speciaux (accents, emojis) ne cassent pas le parsing

### D.2 - Mise a jour documentation

- [x] Mettre a jour `.claude/context/API_MAP.md` (nouveau endpoint)
- [x] Mettre a jour `.claude/context/FILE_MAP.md` (nouveaux fichiers)
- [ ] Mettre a jour `.claude/context/PROGRESS.md`

---

## Resume

| Phase | Scope                           | Dependances               |
| ----- | ------------------------------- | ------------------------- |
| **A** | Parser texte (frontend, pur TS) | Aucune                    |
| **B** | Import URL (backend, cheerio)   | Aucune (independant de A) |
| **C** | Modale + integration formulaire | A + B                     |
| **D** | Polish + docs                   | C                         |

Phases A et B sont independantes et peuvent etre developpees en parallele.

---

## Resume tests

- **Frontend** : 463 tests (59 parser + 404 existants)
- **Backend** : 798 tests (52 import + 746 existants)

---

## Notes pour la reprise

1. Consulter cette roadmap pour voir les cases cochees
2. La spec complete est dans `SPEC_RECIPE_IMPORT.md` (meme dossier)
3. Aucune modification de schema DB requise
4. Seule dependance npm ajoutee : `cheerio` (backend)
5. Le parser texte est isole dans un service sans dependance → facile a tester unitairement
