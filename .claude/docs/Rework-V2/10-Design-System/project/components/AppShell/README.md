# AppShell

Structure de toute l'application, **mobile first** : elle s'adapte a la largeur de son conteneur.

- **Telephone** : bande des espaces en haut, en-tete, contenu, barre d'onglets en bas.
- **A partir de 768px** : rail des espaces a gauche, en-tete avec recherche, contenu ; plus de barre d'onglets.
- **A partir de 1024px** : rail + barre du module (ModuleNav) + contenu.
- `tint` : teinte de l'espace courant, appliquee a tout ce qui est dedans. Fourni par l'appelant : `rail`, `nav`, `top`, `tabbar`, `children`.
