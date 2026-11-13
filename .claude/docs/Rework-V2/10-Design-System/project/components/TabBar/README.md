# TabBar

Barre d'onglets du bas sur mobile (sous 768px), icone + libelle toujours visibles.

- **4 modules au maximum, puis "Plus"** (D131) : `items` recoit tous les modules de l'espace dans l'ordre choisi par l'OWNER, la barre n'en montre que les 4 premiers.
- "Plus" (`onMore`) ouvre une feuille avec les modules au-dela du 4e, puis Membres et Reglages. Il est actif (`moreActive`) quand la page courante s'y trouve.
- Moins de modules = moins d'onglets : un espace avec seulement Recettes a 2 onglets (Recettes, Plus).
- Respecte la marge de securite du bas (barre d'accueil de l'iPhone).
