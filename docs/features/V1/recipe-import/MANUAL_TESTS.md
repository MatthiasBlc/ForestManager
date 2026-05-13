# Tests manuels : Recipe Import

> Pre-requis : etre connecte sur http://localhost:3000

---

## 1. Acces et affichage

### 1.1 Bouton visible en creation

- [ ] Aller sur la page de creation de recette personnelle (`/recipes/new`)
- [ ] Verifier que le bouton "Importer une recette" est visible a cote du titre "New Recipe"
- [ ] Aller sur la page de creation communautaire (`/communities/:id` → "New Recipe")
- [ ] Verifier que le bouton est egalement present

### 1.2 Bouton absent en edition

- [ ] Ouvrir une recette existante en mode edition (`/recipes/:id/edit`)
- [ ] Verifier que le bouton "Importer une recette" n'est **pas** affiche

### 1.3 Modale

- [ ] Cliquer sur "Importer une recette"
- [ ] Verifier que la modale s'ouvre avec un textarea et les boutons "Annuler" / "Analyser"
- [ ] Verifier que "Analyser" est desactive quand le textarea est vide
- [ ] Cliquer sur "Annuler" → la modale se ferme
- [ ] Cliquer en dehors de la modale → elle se ferme

---

## 2. Import texte brut (niveau 1)

### 2.1 Recette complete

Coller ce texte dans la modale et cliquer "Analyser" :

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

Verifications :

- [ ] La modale se ferme
- [ ] Un toast "Import reussi : titre, 6 ingredients, 6 etapes detectes" apparait
- [ ] Le titre "Gateau au chocolat" est pre-rempli
- [ ] Servings = 6
- [ ] Prep time = 20
- [ ] Cook time = 35
- [ ] 6 ingredients sont pre-remplis avec quantites et unites quand possibles
  - "farine" avec 200 et unite "g"
  - "oeufs" avec 3 et pas d'unite
  - "sucre" avec 150 et unite "g"
  - etc.
- [ ] 6 etapes sont pre-remplies (sans les numeros)
- [ ] Le formulaire est entierement editable apres l'import

### 2.2 Recette minimale

Coller :

```
Salade verte
```

- [ ] Seul le titre est pre-rempli
- [ ] Toast : "Import reussi : titre detectes"

### 2.3 Texte non reconnu

Coller :

```
abc
```

- [ ] Message d'erreur dans la modale : "Aucune recette detectee dans le texte"
- [ ] La modale reste ouverte

### 2.4 Recette avec temps en heures

Coller :

```
Pain maison

Pour 4 personnes
Preparation : 30 min
Cuisson : 45 min
Repos : 2h

Ingredients :
- 500g de farine
- 10g de sel
- 7g de levure
- 30cl d'eau

Etapes :
1. Melanger farine, sel et levure.
2. Ajouter l'eau progressivement.
3. Petrir 10 minutes.
4. Laisser reposer 2 heures.
5. Enfourner a 230C pendant 45 minutes.
```

- [ ] Rest time = 120 (2h converti en minutes)
- [ ] 4 ingredients detectes avec unites (g, g, g, cl)
- [ ] 5 etapes

### 2.5 Recette sans headers de section

Coller :

```
Omelette

4 personnes

3 oeufs
50g de fromage
1 pincee de sel

1. Battre les oeufs
2. Ajouter le fromage
3. Cuire a la poele
```

- [ ] Le parser detecte les ingredients par pattern (lignes commencant par un chiffre sans format d'etape)
- [ ] Les etapes numerotees sont detectees
- [ ] Servings = 4

---

## 3. Import URL (niveau 2)

### 3.1 URL valide avec JSON-LD

Coller une URL de recette d'un site connu (exemples a tester) :

- [ ] `https://www.marmiton.org/recettes/recette_pate-a-crepes_12372.aspx`
- [ ] `https://www.750g.com/gateau-au-yaourt-r89.htm`
- [ ] `https://www.cuisineaz.com/recettes/gateau-au-chocolat-en-poudre-13tried.aspx`

Pour chaque URL :

- [ ] Le spinner de chargement s'affiche
- [ ] La modale se ferme apres le parsing
- [ ] Le formulaire est pre-rempli (titre, servings, temps, ingredients, etapes)
- [ ] Le toast de succes s'affiche
- [ ] Les donnees sont coherentes avec la recette originale

### 3.2 Detection automatique URL

- [ ] Coller `https://example.com` → le texte "URL detectee — l'import se fera via le site web" apparait sous le textarea
- [ ] Effacer et coller du texte normal → le message disparait

### 3.3 URL sans recette

- [ ] Coller `https://www.google.com` et cliquer "Analyser"
- [ ] Message d'erreur : "Aucune recette detectee sur cette page"
- [ ] La modale reste ouverte

### 3.4 URL invalide

- [ ] Coller `https://site-qui-nexiste-pas-12345.com/recette` et cliquer "Analyser"
- [ ] Message d'erreur : "Impossible d'acceder a cette URL"

---

## 4. Matching des ingredients

### 4.1 Ingredients connus en base

Si la base contient des ingredients du seed (farine, sucre, beurre, etc.) :

- [ ] Importer une recette contenant "farine"
- [ ] Verifier que le champ ingredient affiche "farine" et que l'autocomplete le reconnait comme existant (pas de badge "nouveau")
- [ ] Verifier que l'unite est pre-selectionnee (g si detectee par le parser)

### 4.2 Ingredients inconnus

- [ ] Importer une recette contenant un ingredient inexistant (ex: "noix de muscade")
- [ ] Le nom est pre-rempli dans le champ texte
- [ ] L'ingredient apparaitra comme "New ingredient" dans le dropdown si on clique dessus

---

## 5. Confirmation avant ecrasement

### 5.1 Formulaire vide

- [ ] Ouvrir le formulaire vierge
- [ ] Importer une recette → pas de dialog de confirmation, import direct

### 5.2 Formulaire deja rempli

- [ ] Remplir manuellement le titre "Ma recette"
- [ ] Cliquer "Importer une recette", coller un texte valide, cliquer "Analyser"
- [ ] Un `window.confirm` apparait : "Le formulaire contient deja des donnees..."
- [ ] Cliquer "Annuler" → le formulaire garde ses donnees, la modale reste ouverte
- [ ] Recommencer et cliquer "OK" → le formulaire est ecrase par l'import

---

## 6. Import puis creation

### 6.1 Creer la recette apres import

- [ ] Importer une recette complete (texte ou URL)
- [ ] Verifier/ajuster les donnees pre-remplies
- [ ] Cliquer "Create recipe"
- [ ] Verifier que la recette est creee correctement
- [ ] Ouvrir la recette creee et verifier que toutes les donnees correspondent

### 6.2 Import dans une communaute

- [ ] Aller dans une communaute → "New Recipe"
- [ ] Importer via texte ou URL
- [ ] Creer la recette
- [ ] Verifier qu'elle apparait dans la communaute et en recette perso

---

## 7. Cas limites

### 7.1 Texte tres long

- [ ] Coller un texte de plus de 10000 caracteres (copier une recette 10 fois)
- [ ] Le parsing fonctionne sans crash ni freeze

### 7.2 Caracteres speciaux

- [ ] Coller une recette avec des accents (e, a, u, c) et des caracteres speciaux
- [ ] Le parsing fonctionne correctement

### 7.3 Import multiple

- [ ] Importer une premiere recette
- [ ] Sans sauvegarder, importer une deuxieme recette (confirmer l'ecrasement)
- [ ] Le formulaire reflete la deuxieme recette

---

## 8. Securite (verification backend)

### 8.1 Non authentifie

```bash
curl -X POST http://localhost:3001/api/recipes/import-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

- [ ] Reponse 401 Unauthorized

### 8.2 SSRF

```bash
# Tester via le frontend apres connexion ou via curl avec cookie de session
```

- [ ] URL `http://localhost:3001/health` → erreur (pas "Impossible d'acceder")
- [ ] URL `http://127.0.0.1/test` → erreur
- [ ] URL `http://192.168.1.1/test` → erreur
