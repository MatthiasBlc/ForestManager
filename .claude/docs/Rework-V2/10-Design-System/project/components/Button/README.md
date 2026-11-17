# Button

Declenche une action. Libelle = un verbe a l'infinitif, en minuscules apres la majuscule : "Nouvelle recette", "Partager".

- `variant` : `primary` (fond `accent`, une seule fois par ecran, pour l'action principale), `secondary` (par defaut), `ghost` (actions de barre d'outils), `danger` (suppression, toujours apres une confirmation).
- `size` : `md` (44px de haut, cible tactile) par defaut ; `sm` (36px) seulement en desktop dans des listes denses.
- `icon` : nom d'icone place avant le libelle. `block` : pleine largeur (pieds de feuilles sur mobile).
- Fourni par l'appelant : `children` (libelle), `onClick`.
- A ne pas faire : deux boutons `primary` cote a cote ; un bouton sans libelle (utiliser IconButton).
