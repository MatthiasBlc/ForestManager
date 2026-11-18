# OptionList

Liste de lignes selectionnables avec un visuel : choix d'un profil de generation, d'un format d'export, d'espaces, resultats de recherche d'une recette a lier.

- Ligne : visuel (`icon`, `avatar` ou `space`), `label`, `hint`, `badge` facultatif, puis une coche.
- Un seul choix par defaut ; `multiple` pour plusieurs (cases carrees).
- `selectable={false}` : lignes de navigation (chevron a droite), sans etat choisi, pour une liste de resultats.
- Hauteur de ligne 56px. Dans une feuille, le bouton de validation va dans le pied (SheetFooter).
