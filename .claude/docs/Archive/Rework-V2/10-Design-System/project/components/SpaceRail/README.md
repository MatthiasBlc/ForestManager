# SpaceRail

Navigation entre espaces, inspiree de Discord : l'espace perso en tete, un separateur, les groupes, puis "+" pour creer ou rejoindre un espace.

- **A partir de 768px** : rail vertical a gauche, 72px. **Sur mobile**, le rail est remplace par le bouton d'espace de la TopBar et la feuille SpaceSwitcher (D130) : dans l'AppShell, le rail se masque des que la TopBar recoit `space`. La bande horizontale reste disponible hors AppShell, mais n'est plus utilisee dans l'application.
- Chaque espace montre son avatar, sinon ses initiales sur sa teinte (`tint-1` a `tint-5`). L'espace actif passe du rond au carre arrondi avec un repere.
- Une pastille signale des nouveautes. Entrer dans un espace applique sa teinte a toute l'interface (`data-space`).
- **Espace en suppression** (`deleting: { daysLeft }`, D66) : icone grisee et compte a rebours "J-12" ; visible seulement de l'OWNER, qui peut encore annuler. Le libelle accessible le dit en toutes lettres.
