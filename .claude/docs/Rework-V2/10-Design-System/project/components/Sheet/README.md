# Sheet

Panneau modal : **feuille du bas sur mobile**, dialogue centre a partir de 768px de large. Remplace les modales de la V1.

- Mobile : poignee en haut, **glisser vers le bas pour fermer** (au-dela de 110px), toucher le voile ferme aussi. Desktop : Echap ou la croix.
- `title` obligatoire (titre et nom accessible). Boutons du pied : prop `footer`, ou enfant **SheetFooter** (zone nommee, utilisable telle quelle dans les maquettes) ; pleine largeur sur mobile, a droite en desktop, toujours visibles quand le contenu defile.
- `contained` : se place dans son conteneur au lieu de l'ecran (apercus, maquettes).
- Usage : editer un repas, choisir un espace de partage, confirmer une suppression.
