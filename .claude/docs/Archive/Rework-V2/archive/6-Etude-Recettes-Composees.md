# Etude - Recettes composees (recettes a base de recettes)

Statut : **ETUDE**, decision D24 en attente. Remplace la question des sections (Q07).

## 1. Le besoin

- **Assembler** : "Escalope milanaise et compotee de tomates cerises" = la recette d'escalope + la recette de compotee, sans rien reecrire.
- **Reutiliser** : la sauce teriyaki sert dans "Poulet teriyaki et riz" et dans "Saumon teriyaki et brocolis". C'est la meme sauce : la corriger une fois doit servir partout.
- **Completer** : une recette composee a souvent ses propres ingredients et etapes (le riz, l'assemblage, le dressage).

## 2. Proposition : la recette est faite de blocs

Une recette = une suite ordonnee de **blocs**. Deux types de bloc :

| Bloc             | Contenu                                               | Exemple                   |
| ---------------- | ----------------------------------------------------- | ------------------------- |
| **Bloc local**   | Un titre optionnel, des ingredients, des etapes       | "Riz", "Assemblage"       |
| **Bloc recette** | Un lien vers une autre recette + la quantite utilisee | "Sauce teriyaki : 150 ml" |

- Une recette simple = un seul bloc local sans titre : l'ecran reste celui d'aujourd'hui.
- Les sections de la V1 du brainstorming ("Sauce", "Viande", "Assemblage") sont des blocs locaux titres. Un bloc local peut plus tard etre "extrait en recette" pour devenir reutilisable.

Exemple :

```
Saumon teriyaki et brocolis (2 pers.)
  [recette] Sauce teriyaki ........ 150 ml     -> ouvre la recette de la sauce
  [local]   Saumon et brocolis : 2 paves, 300 g de brocolis, 3 etapes
  [local]   Assemblage : 2 etapes
```

## 3. Quantites : le rendement

Pour savoir "combien de sauce", chaque recette a un **rendement** : une quantite et une unite. Par defaut ce sont des portions ("4 personnes"), mais une base peut rendre "300 ml", "12 pieces" ou "1 pate".

- Le bloc recette indique la quantite utilisee **dans l'unite du rendement** : 150 ml de sauce teriyaki (qui rend 300 ml), soit un facteur 0,5.
- Quand on change les portions de la recette composee, le facteur suit : 4 personnes au lieu de 2 -> 300 ml de sauce.
- La liste de courses et le planning **deplient** les blocs recette pour additionner les vrais ingredients.

## 4. Lien vivant ou fige

| Option                  | Comportement                                                                              | Pour / contre                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Vivant** (recommande) | Le bloc affiche toujours la version actuelle de la sous-recette.                          | Corriger la sauce corrige tous les plats ; c'est le but du besoin "reutiliser". |
| Fige sur une revision   | Le bloc garde la version du moment ; un badge signale qu'une version plus recente existe. | Stable, mais on perd la correction partout.                                     |
| Copie a l'insertion     | Le contenu est recopie dans un bloc local.                                                | Simple, mais ne repond pas a "reutiliser".                                      |

Le lien vivant suffit : si quelqu'un veut une sauce differente pour un plat, il **adapte** la sauce (D17) et pointe vers son adaptation.

## 5. Regles a tenir

- **Pas de boucle** : une recette ne peut pas se contenir elle-meme, directement ou par une chaine. Profondeur maximale proposee : 3 niveaux.
- **Visibilite** : une recette composee partagee dans un espace doit pouvoir montrer ses sous-recettes. Proposition : partager une recette composee partage aussi ses sous-recettes dans cet espace (l'ecran de partage les liste). Si une sous-recette ne peut pas etre partagee (elle n'appartient pas a l'utilisateur), le bloc s'affiche en "recette non disponible" avec son nom.
- **Suppression** d'une sous-recette utilisee ailleurs : l'auteur est prevenu ("utilisee dans 3 recettes") ; si elle est supprimee quand meme, les blocs passent en "recette supprimee" et proposent de recuperer son contenu en bloc local.
- **Adaptation** d'une recette composee (D17) : les blocs recette restent des liens vers les memes sous-recettes ; on peut remplacer un lien par une adaptation de la sous-recette.
- **Suggestions** : une suggestion sur la recette composee porte sur ses blocs locaux et ses liens (quantite, ajout, retrait), jamais sur le contenu de la sous-recette, qui a ses propres suggestions.
- **Planning de repas** : un slot pointe vers la recette composee ; la generation la traite comme une recette ordinaire. Une sous-recette peut etre marquee "base" pour ne pas etre proposee seule par le generateur (une sauce n'est pas un repas).
- **Vue cuisine** : les etapes sont presentees bloc par bloc, sous-recettes depliees dans l'ordre.

## 6. Impact sur le modele de donnees

```
Recipe(yieldQuantity, yieldUnitId, isBase, ...)
  \- RecipeBlock(order, kind: LOCAL|RECIPE, title?)
        LOCAL  -> ingredients (RecipeIngredient.blockId) + etapes (RecipeStep.blockId)
        RECIPE -> subRecipeId, quantity (dans l'unite de rendement de la sous-recette)
```

Les revisions (D05) photographient les blocs ; un bloc recette vivant enregistre seulement l'identifiant de la sous-recette.

## 7. A trancher

- Lien vivant (recommande) ou fige ?
- Recettes composees et blocs locaux en V2.0, ou blocs locaux seuls en V2.0 et liens en V2.1 ?
- Partager une recette composee partage-t-il automatiquement ses sous-recettes ?
