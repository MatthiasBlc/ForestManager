# TopBar

En-tete de l'ecran. **Mobile** : espace courant en bouton (D130), titre de la page, loupe, notifications. **A partir de 768px** : champ de recherche (ouvre la palette Ctrl K), notifications, avatar ; le rail montre l'espace.

- `title`, `unread` (pastille), `user`, `onSearch`, `onNotifications`.
- `space` + `onSpace` : sur mobile, le titre laisse la place au bouton d'espace (icone, nom de l'espace, nom de la page dessous, chevron) qui ouvre le SpaceSwitcher. A utiliser sur les ecrans de premier niveau d'un module.
- `onBack` : fleche de retour a gauche (`arrow-left`), pour les ecrans de second niveau (une recette, un reglage) ; le titre reste celui de la page.
- **Mode edition** (D136) : `onCancel` (bouton "Annuler", ou `cancelLabel`), `action` + `onAction` (bouton principal a droite, `actionDisabled` tant que le formulaire est invalide). Pas de recherche ni de notifications : l'ecran est une saisie. Pour les editeurs de recette et de suggestion.
