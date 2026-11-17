# QuantityInput

Saisie d'une ligne d'ingredient dans l'editeur de recette (D108) : **quantite + unite + ingredient**, sur une ligne.

- Quantite : clavier decimal, virgule a la francaise ("1,5"), chiffres en `mono`. Vide = "a gout" ou "selon besoin" via l'unite.
- Unite : liste des unites du referentiel, abregees.
- Ingredient : autocompletion sur le referentiel (6 propositions au plus, fleches + Entree). Un ingredient inconnu se propose en `Ajouter "..."` : il part dans la file des nouveaux ingredients de l'admin, sans bloquer la recette.
- `onRemove` affiche la croix de retrait ; `error` colore la ligne et dit quoi corriger.
- Sous 400px de large (telephone, bloc etroit), l'ingredient passe sur sa propre ligne, pleine largeur : quantite, unite et croix sur la premiere ligne.
