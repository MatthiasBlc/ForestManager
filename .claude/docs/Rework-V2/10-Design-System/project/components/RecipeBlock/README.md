# RecipeBlock

Un bloc d'une recette composee : **bloc local** (ses ingredients et etapes) ou **recette liee** (lien vivant vers une autre recette, avec la quantite utilisee).

- `kind` : `local` ou `linked`. Une recette liee a une bordure et un en-tete `second` et l'icone de lien.
- `factor` multiplie les quantites (portions de la recette x part utilisee de la sous-recette) ; `quantity` affiche la part utilisee ("150 ml").
- Repliable. Une recette simple n'a qu'un bloc local sans titre.
