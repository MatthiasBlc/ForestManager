# RecipeCard

Carte d'une recette dans une liste : photo (ou fond teinte), titre, portions et temps, badges d'etat.

- **Toucher** : ouvrir la recette. **Appui long** (500 ms, mobile) ou bouton "..." : menu d'actions (`onActions`). Au clavier : Entree ouvre, touche Menu ou Maj+F10 ouvre les actions.
- Badges : "Composee" et "Base" en `second`, "Adaptee", "Original modifie" en `warning`.
- Grille de 2 colonnes sur mobile, colonnes de 180px minimum au-dela (`fm-grid` dans un conteneur `fm-cq`).
