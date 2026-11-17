# RadioGroup

Choisir **une** option parmi quelques-unes (2 a 6), toutes visibles : qui peut inviter, visibilite, ambiance. Remplace un menu deroulant quand les choix tiennent a l'ecran (D96).

- Chaque option : `label`, `hint` facultatif (une ligne d'explication), `disabled`.
- Ligne entiere cliquable (44px minimum) ; l'option choisie prend `accent-soft`.
- Au-dela de 6 choix, ou avec un visuel par ligne : OptionList.
- `swatches` (D137) : apercu en pastilles a droite de l'option, par exemple les couleurs d'une ambiance dans Profil > Apparence. Valeurs CSS libres, puisqu'une ambiance autre que la courante n'a pas de token actif.
