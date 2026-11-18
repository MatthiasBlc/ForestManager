# Field

Champ de saisie avec son libelle toujours visible au-dessus (pas de libelle dans le placeholder).

- Texte en 16px : evite le zoom automatique de Safari sur iPhone.
- `hint` : aide sous le champ, en `ink-muted`. `error` : remplace l'aide, bordure et texte en `danger`. Le message dit quoi corriger ("Indique un titre"), sans s'excuser.
- `multiline` : zone de texte (etapes, commentaire d'un repas).
- Toutes les autres props vont a l'`input` (`value`, `onChange`, `type`, `inputMode="decimal"` pour une quantite).
