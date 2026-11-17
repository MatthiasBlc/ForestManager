# AppShell

Structure de toute l'application, **mobile first** : elle s'adapte a la largeur de son conteneur.

- **Telephone** : en-tete avec le bouton d'espace (D130), contenu, barre d'onglets en bas (4 modules puis "Plus", D131).
- **A partir de 768px** : rail des espaces a gauche, en-tete avec recherche, contenu ; plus de barre d'onglets.
- **A partir de 1024px** : rail + barre du module (ModuleNav) + contenu.
- `tint` : teinte de l'espace courant, appliquee a tout ce qui est dedans.
- **Deux facons de remplir les zones**, au choix :
  - en props : `rail`, `nav`, `top`, `tabbar`, et le contenu en `children` ;
  - en **enfants nommes** (sans `rail` ni `top`) : SpaceRail, ModuleNav, TopBar, ShellMain (le contenu) et TabBar poses directement dans l'AppShell, dans n'importe quel ordre ; chacun prend sa zone. C'est la forme a utiliser dans les maquettes.
  - Un enveloppement en `display: contents` autour de chaque zone (runtime des maquettes) est accepte.
