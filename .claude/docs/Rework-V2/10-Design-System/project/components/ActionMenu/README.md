# ActionMenu

Liste d'actions sur un element. S'ouvre par **appui long** sur une carte (mobile), par le bouton "...", ou par clic droit / touche Menu (desktop).

- `items` : `{ id, label, icon, danger }` ou `"-"` pour un separateur. L'action destructive est en dernier, apres un separateur.
- Sur mobile, le menu s'affiche dans une Sheet ; en desktop, en popover ancre au bouton.
