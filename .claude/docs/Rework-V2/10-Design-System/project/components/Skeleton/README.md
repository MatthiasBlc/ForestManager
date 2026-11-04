# Skeleton

Etat de chargement : des formes grises qui reprennent celles du contenu attendu, au lieu d'un indicateur qui tourne.

- `kind` : `lines` (texte), `row` (ligne de liste avec visuel), `card` (grille de RecipeCard).
- N'apparait qu'au-dela de 300 ms d'attente, pour ne pas clignoter.
- Annonce "Chargement" aux lecteurs d'ecran ; s'arrete d'onduler avec `prefers-reduced-motion`.
