# Spec : Recipe Import

> Import de recettes depuis du texte brut ou une URL

## Objectif

Permettre a l'utilisateur de pre-remplir le formulaire de creation de recette en collant du texte ou une URL. L'import n'a pas besoin d'etre parfait : il doit reduire l'effort de saisie. L'utilisateur corrige toujours avant de valider.

---

## 1. Vue d'ensemble

### 1.1 Flux utilisateur

```
Page creation recette
     |
     v
[Bouton "Importer une recette"]    (visible uniquement en creation, pas en edition)
     |
     v
Modale d'import
  - Un seul champ textarea
  - Placeholder : "Collez un texte de recette ou une URL..."
  - Bouton "Analyser"
     |
     v
Detection automatique du type d'input :
  - Commence par http:// ou https:// → Import URL (niveau 2)
  - Sinon → Import texte (niveau 1)
     |
     v
Parsing → ParsedRecipe
     |
     v
Pre-remplissage du formulaire existant
Modale se ferme
     |
     v
L'utilisateur verifie, corrige, complete
     |
     v
Validation normale (bouton "Create recipe")
```

### 1.2 Principes

- **Aucune modification du schema DB** : l'import produit exactement les memes donnees que la saisie manuelle
- **Pas de sauvegarde intermediaire** : le parsing remplit le state du formulaire, c'est tout
- **Best-effort** : un champ non reconnu est simplement ignore (laisse vide dans le formulaire)
- **Pas de LLM, pas de service payant**

---

## 2. Structure de donnees intermediaire

Le parsing (texte ou URL) produit un `ParsedRecipe` qui sera mappe vers le state du formulaire.

```typescript
interface ParsedRecipe {
  title: string | null;
  servings: number | null;
  prepTime: number | null;       // en minutes
  cookTime: number | null;       // en minutes
  restTime: number | null;       // en minutes
  ingredients: ParsedIngredient[];
  steps: string[];               // textes bruts des etapes
}

interface ParsedIngredient {
  raw: string;                   // texte original (ex: "200g de farine")
  quantity: number | null;       // 200
  unitAbbreviation: string | null; // "g"
  name: string | null;           // "farine"
}
```

---

## 3. Niveau 1 — Import texte brut

### 3.1 Ou s'execute le parsing

**Cote client (frontend uniquement).** Pas besoin de backend : c'est du parsing de texte par regex/heuristiques. Un service `parseRecipeText(text: string): ParsedRecipe`.

### 3.2 Algorithme de parsing

Le parser fonctionne par detection de sections et extraction ligne par ligne.

#### Etape 1 : Nettoyage

- Supprimer les lignes vides en debut/fin
- Normaliser les sauts de ligne (`\r\n` → `\n`)
- Supprimer les lignes composees uniquement de tirets, egals, underscores (separateurs visuels)

#### Etape 2 : Detection du titre

- La premiere ligne non vide, si elle fait **moins de 100 caracteres** et ne ressemble pas a un header de section → c'est le titre
- Headers de section detectes (insensible a la casse, avec/sans `:`) : `ingredients`, `preparation`, `etapes`, `instructions`, `recette`, `pour`, `temps`, `description`, `directions`, `method`

#### Etape 3 : Detection des sections

Scanner chaque ligne pour detecter les headers de section :

| Pattern (case-insensitive) | Section |
|---|---|
| `ingr[ée]dients?` | INGREDIENTS |
| `pr[ée]paration`, `[ée]tapes?`, `instructions?`, `directions?`, `method`, `proc[ée]d[ée]` | STEPS |

Les lignes entre un header de section et le suivant appartiennent a cette section.

**Fallback** si aucun header n'est detecte :
- Les lignes qui matchent le pattern ingredient (voir 3.3) → section INGREDIENTS
- Les lignes numerotees (`1.`, `2.`) ou les paragraphes restants → section STEPS

#### Etape 4 : Extraction des ingredients (section INGREDIENTS)

Pour chaque ligne de la section ingredients :

1. Supprimer les puces en debut de ligne : `-`, `*`, `•`, `–`, `—`
2. Appliquer les regex d'extraction dans l'ordre :

```
Pattern principal :
/^(\d+[.,]?\d*)\s*(g|kg|ml|cl|l|cs|cc|cas|cac|pincee|pincees|gousse|gousses|tranche|tranches|feuille|feuilles|brin|brins|botte|bottes|piece|pieces)?\s*(?:de\s+|d')?(.+)$/i

Variante fractions :
/^(\d+\/\d+)\s*(...)?\s*(?:de\s+|d')?(.+)$/i

Variante "a gout" / sans quantite :
/^(.+?)[\s,]*(?:[àa]\s*go[uû]t|selon\s*(?:besoin|envie|go[uû]t))$/i → quantity=null, unit=null

Fallback : pas de match → raw=ligne, quantity=null, unit=null, name=ligne entiere
```

3. Mapping des unites parsees vers les abbreviations existantes en DB :

| Parse | Abbreviation DB |
|---|---|
| `g` | `g` |
| `kg` | `kg` |
| `ml` | `ml` |
| `cl` | `cl` |
| `l` | `L` |
| `cs`, `cas` | `c. a s.` |
| `cc`, `cac` | `c. a c.` |
| `pincee`, `pincees` | `pincee` |
| `gousse`, `gousses` | `gousse` |
| `tranche`, `tranches` | `tranche` |
| `feuille`, `feuilles` | `feuille` |
| `brin`, `brins` | `brin` |
| `botte`, `bottes` | `botte` |
| `piece`, `pieces` | `piece` |

**Note** : le mapping exact des abbreviations devra etre verifie/ajuste avec les valeurs reelles en base au moment de l'implementation. La table `Unit` contient les abbreviations de reference.

#### Etape 5 : Extraction des etapes (section STEPS)

Pour chaque ligne de la section etapes :

1. Supprimer les numeros en debut : `1.`, `1)`, `1 -`, `Etape 1 :`
2. Supprimer les puces : `-`, `*`, `•`
3. Ignorer les lignes vides
4. Chaque ligne non vide = une etape

#### Etape 6 : Extraction des metadonnees (scan global)

Scanner toutes les lignes pour extraire :

| Donnee | Patterns (case-insensitive) |
|---|---|
| servings | `/(\d+)\s*(?:personnes?\|pers\.?\|parts?\|portions?\|servings?)/i` |
| prepTime | `/(?:pr[ée]p(?:aration)?)\s*:?\s*(\d+)\s*(?:min(?:utes?)?)/i` |
| cookTime | `/(?:cu(?:isson\|ire))\s*:?\s*(\d+)\s*(?:min(?:utes?)?)/i` |
| restTime | `/(?:repos?\|pause)\s*:?\s*(\d+)\s*(?:min(?:utes?)?)/i` |
| temps generique | `/(?:temps)\s*:?\s*(\d+)\s*(?:min(?:utes?)?)/i` → prepTime si aucun autre temps |

Pour les durees en heures : `/(\d+)\s*h(?:eures?)?\s*(\d+)?/` → convertir en minutes.

### 3.3 Exemples de parsing

**Input :**
```
Gateau au chocolat

Pour 6 personnes
Preparation : 20 min
Cuisson : 35 min

Ingredients :
- 200g de farine
- 3 oeufs
- 150g de sucre
- 100g de beurre
- 200g de chocolat noir
- 1 sachet de levure

Preparation :
1. Prechauffer le four a 180C.
2. Faire fondre le chocolat avec le beurre.
3. Melanger la farine, le sucre et la levure.
4. Ajouter les oeufs un a un.
5. Incorporer le chocolat fondu.
6. Verser dans un moule et enfourner 35 minutes.
```

**Output :**
```typescript
{
  title: "Gateau au chocolat",
  servings: 6,
  prepTime: 20,
  cookTime: 35,
  restTime: null,
  ingredients: [
    { raw: "200g de farine", quantity: 200, unitAbbreviation: "g", name: "farine" },
    { raw: "3 oeufs", quantity: 3, unitAbbreviation: null, name: "oeufs" },
    { raw: "150g de sucre", quantity: 150, unitAbbreviation: "g", name: "sucre" },
    { raw: "100g de beurre", quantity: 100, unitAbbreviation: "g", name: "beurre" },
    { raw: "200g de chocolat noir", quantity: 200, unitAbbreviation: "g", name: "chocolat noir" },
    { raw: "1 sachet de levure", quantity: 1, unitAbbreviation: null, name: "sachet de levure" }
  ],
  steps: [
    "Prechauffer le four a 180C.",
    "Faire fondre le chocolat avec le beurre.",
    "Melanger la farine, le sucre et la levure.",
    "Ajouter les oeufs un a un.",
    "Incorporer le chocolat fondu.",
    "Verser dans un moule et enfourner 35 minutes."
  ]
}
```

---

## 4. Niveau 2 — Import URL

### 4.1 Pourquoi le backend est necessaire

Le browser ne peut pas fetch une page HTML tierce (CORS). Le backend agit comme proxy : il recoit l'URL, fetch la page, extrait les donnees, et les renvoie au frontend.

### 4.2 Endpoint

```
POST /api/recipes/import-url
```

**Request :**
```json
{
  "url": "https://www.marmiton.org/recettes/recette_gateau-au-chocolat_12345.aspx"
}
```

**Response (succes) :**
```json
{
  "data": {
    "title": "Gateau au chocolat",
    "servings": 6,
    "prepTime": 20,
    "cookTime": 35,
    "restTime": null,
    "ingredients": [
      { "raw": "200g flour", "quantity": 200, "unitAbbreviation": "g", "name": "flour" },
      ...
    ],
    "steps": [
      "Prechauffer le four a 180C.",
      ...
    ]
  }
}
```

**Reponse = meme structure `ParsedRecipe` que le niveau 1.** Le frontend traite le resultat de maniere identique.

**Erreurs :**

| Code | HTTP | Message | Contexte |
|---|---|---|---|
| `IMPORT_001` | 400 | Invalid URL format | URL mal formee |
| `IMPORT_002` | 422 | Could not fetch URL | Timeout, DNS, connexion refusee |
| `IMPORT_003` | 422 | No recipe data found | Pas de JSON-LD Recipe ni de donnees extractibles |

### 4.3 Logique backend

#### Etape 1 : Validation URL

- URL valide (protocole `http` ou `https`)
- Longueur max : 2000 caracteres

#### Etape 2 : Fetch de la page

- `GET` sur l'URL avec un User-Agent standard (pas de bot UA)
- Timeout : 10 secondes
- Taille max response : 5 MB (proteger contre les fichiers volumineux)
- Suivre les redirects (max 5)

#### Etape 3 : Extraction JSON-LD (methode principale)

Chercher dans le HTML les balises `<script type="application/ld+json">` et parser le JSON.

Patterns a detecter :
1. Objet direct : `{ "@type": "Recipe", ... }`
2. Dans un `@graph` : `{ "@graph": [ { "@type": "Recipe", ... }, ... ] }`
3. Type avec namespace : `"@type": "schema:Recipe"` ou `"@type": ["Recipe"]`

Champs a extraire depuis le JSON-LD `schema.org/Recipe` :

| Champ JSON-LD | Champ ParsedRecipe | Transformation |
|---|---|---|
| `name` | `title` | Tel quel |
| `recipeYield` | `servings` | Extraire le nombre : `/(\d+)/` |
| `prepTime` | `prepTime` | ISO 8601 duration → minutes (`PT30M` → 30, `PT1H` → 60) |
| `cookTime` | `cookTime` | ISO 8601 duration → minutes |
| `totalTime` | `prepTime` (fallback) | Si aucun autre temps, utiliser comme prepTime |
| `recipeIngredient` | `ingredients` | Array de strings → parser chaque string comme niveau 1 |
| `recipeInstructions` | `steps` | Voir ci-dessous |

**Parsing de `recipeInstructions`** (format variable selon les sites) :
- Array de strings : chaque string = une etape
- Array d'objets `HowToStep` : `item.text` = une etape
- Array d'objets `HowToSection` : `section.itemListElement` → array de `HowToStep`
- String unique : splitter par `\n` ou numeros

**Parsing ISO 8601 durations** :
```
PT30M → 30
PT1H → 60
PT1H30M → 90
PT2H → 120
```
Regex : `/^PT(?:(\d+)H)?(?:(\d+)M)?$/` → `hours * 60 + minutes`

#### Pas de fallback HTML

Si aucun JSON-LD Recipe n'est trouve, renvoyer directement l'erreur `IMPORT_003`. Pas de tentative d'extraction du contenu HTML brut : les resultats seraient trop aleatoires (menus, pubs, commentaires melanges). L'utilisateur peut toujours copier-coller le texte de la recette manuellement (niveau 1).

### 4.4 Securite

- **Pas de SSRF** : interdire les URLs pointant vers des adresses privees/internes (127.0.0.1, 10.x, 192.168.x, localhost, etc.)
- **Rate limiting** : meme rate limit que les autres endpoints authentifies
- **Authentification** : endpoint protege par session (comme tous les endpoints /api/)
- **Pas de stockage** : l'URL et le contenu ne sont pas persistes

### 4.5 Dependances backend

- **Fetch HTTP** : `node-fetch` ou le `fetch` natif Node 18+ (deja disponible)
- **HTML parsing** : `cheerio` (leger, pas de headless browser) — pour extraire les `<script>` JSON-LD et le contenu texte en fallback
- **Pas de Puppeteer/Playwright** : trop lourd, inutile pour JSON-LD

---

## 5. Frontend — Integration dans le formulaire

### 5.1 Composants

#### ImportRecipeModal

Modale avec :
- Textarea (10 lignes minimum, redimensionnable)
- Placeholder : `"Collez un texte de recette ou une URL (ex: https://marmiton.org/...)"`
- Bouton "Analyser" (disabled si textarea vide)
- Indicateur de chargement (pour l'import URL)
- Zone d'erreur (si le parsing echoue ou ne trouve rien)

#### Bouton d'import dans RecipeFormPage

- Visible **uniquement en mode creation** (pas en edition)
- Place sous le titre de page "New Recipe", avant le formulaire
- Style : bouton secondaire/outline, avec une icone (ex: `FaFileImport`)
- Texte : "Importer une recette"

### 5.2 Pre-remplissage du formulaire

Quand le parsing retourne un `ParsedRecipe`, le formulaire est pre-rempli :

| Champ ParsedRecipe | State du formulaire | Logique |
|---|---|---|
| `title` | `reset({ title })` via react-hook-form | Si non null |
| `servings` | `setServings(value)` | Si non null, sinon garder 4 |
| `prepTime` | `setPrepTime(String(value))` | Si non null |
| `cookTime` | `setCookTime(String(value))` | Si non null |
| `restTime` | `setRestTime(String(value))` | Si non null |
| `steps` | `setSteps(steps.map(s => ({ instruction: s })))` | Si non vide |
| `ingredients` | `setIngredients(mapped)` | Voir 5.3 |

### 5.3 Matching des ingredients

Pour chaque `ParsedIngredient`, le frontend doit tenter de matcher avec les ingredients et unites existants.

#### Matching des unites

1. Charger les unites via `APIManager.getUnits()` (deja fait au montage de `IngredientList`)
2. Pour chaque `ParsedIngredient.unitAbbreviation` :
   - Chercher dans les unites chargees celle dont `abbreviation` correspond (case-insensitive)
   - Si trouve → `unitId` de cette unite
   - Si non trouve → `unitId` reste `undefined`

#### Matching des ingredients

1. Pour chaque `ParsedIngredient.name` non null :
   - Appeler `APIManager.searchIngredients(name, 1)` pour tenter un match exact
   - Si le premier resultat a un nom identique (case-insensitive, apres trim) → utiliser son `id` comme `ingredientId`
   - Sinon → `ingredientId` reste `undefined`, le `name` est quand meme pre-rempli dans le champ texte

2. **Optimisation** : les appels de search sont faits en parallele (`Promise.all`) pour tous les ingredients, avec un debounce global pour ne pas surcharger l'API.

#### Resultat du mapping

```typescript
// Pour chaque ParsedIngredient
const mapped: IngredientInput = {
  name: parsed.name ?? parsed.raw,    // fallback sur le texte brut
  quantity: parsed.quantity ?? undefined,
  unitId: matchedUnitId ?? undefined,
  ingredientId: matchedIngredientId ?? undefined,
};
```

### 5.4 Feedback utilisateur

Apres le pre-remplissage, afficher un toast de succes avec un resume :
- `"Import reussi : titre, X ingredients, Y etapes detectes"`
- Si certains champs n'ont pas pu etre extraits, le mentionner : `"Import partiel : aucun ingredient detecte"`

### 5.5 Gestion des erreurs

| Situation | Comportement |
|---|---|
| Textarea vide | Bouton "Analyser" desactive |
| Parsing texte qui ne detecte rien (0 ingredients, 0 steps, pas de titre) | Message dans la modale : "Aucune recette detectee dans le texte. Verifiez le format." |
| URL invalide | Message : "URL invalide" |
| URL inaccessible (timeout, 404...) | Message : "Impossible d'acceder a cette URL" |
| URL sans donnees de recette | Message : "Aucune recette detectee sur cette page" |
| Erreur reseau | Message : "Erreur de connexion" |

La modale reste ouverte en cas d'erreur pour permettre a l'utilisateur de corriger.

### 5.6 Confirmation avant ecrasement

Si le formulaire contient deja des donnees (titre non vide OU ingredients non vides OU steps modifies), afficher un `window.confirm()` avant d'ecraser :

> "Le formulaire contient deja des donnees. L'import va remplacer les champs detectes. Continuer ?"

Les champs non detectes par l'import ne sont pas effaces.

---

## 6. Architecture fichiers

### Backend

```
backend/src/
  controllers/
    recipeImport.ts          # Controller endpoint import-url
  services/
    recipeImportService.ts   # Logique fetch URL + extraction JSON-LD + fallback HTML
  routes/
    recipes.ts               # Ajouter route POST /import-url
```

### Frontend

```
frontend/src/
  services/
    recipeParser.ts          # parseRecipeText() — parsing texte brut (niveau 1)
  components/
    ImportRecipeModal.tsx     # Modale d'import
  pages/
    RecipeFormPage.tsx        # Ajouter bouton import + callback pre-remplissage
  network/
    api.ts                   # Ajouter methode importRecipeFromUrl()
```

---

## 7. Validation

L'import ne valide rien. Le formulaire existant se charge de la validation au moment du submit (titre requis, au moins 1 step, servings 1-100, etc.). L'utilisateur peut soumettre un formulaire partiellement pre-rempli apres avoir complete les champs manquants.

---

## 8. Limites acceptees

| Limite | Raison |
|---|---|
| Pas de parsing parfait des ingredients | Trop de formats differents, l'utilisateur corrige |
| Pas de detection de tags | Les tags sont specifiques a l'app, impossible a deviner |
| Pas de detection d'image | Complexe (droits d'auteur, hotlinking), hors scope |
| Pas de support des sites en SPA (React/Vue rendus cote client) | Necessiterait Puppeteer, trop lourd |
| Pas de support des sites avec anti-bot (Cloudflare, captcha) | Impossible sans headless browser |
| Unites non reconnues ignorees | L'utilisateur selectionne manuellement |

---

## 9. Hors scope (futur)

- Import par photo (OCR d'une recette sur papier)
- Import depuis un fichier (PDF, JSON, CSV)
- Parsing assiste par IA/LLM (modele open-source local)
- Detection automatique de la langue
- Import batch (plusieurs recettes a la fois)
- Sauvegarde de brouillons d'import

---

## 10. Codes erreur (resume)

| Code | HTTP | Message |
|---|---|---|
| `IMPORT_001` | 400 | Invalid URL format |
| `IMPORT_002` | 422 | Could not fetch URL |
| `IMPORT_003` | 422 | No recipe data found |
