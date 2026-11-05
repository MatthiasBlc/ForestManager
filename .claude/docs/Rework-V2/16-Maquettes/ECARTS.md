# Ecarts releves pendant les maquettes (B5)

Liste unique, a traiter avant la validation finale (B9). Cocher au fil de l'eau.

## Design system : a ajouter ou corriger

- [x] Icones `arrow-left` (retour), `wifi-off` (hors ligne), et icones de l'admin (tag, regle, bouclier) [D109]
- [x] Composant de choix d'une option : boutons radio et nuancier de couleur (teinte d'espace) [D96]
- [x] Composant liste d'options selectionnables (choix d'un profil, d'un export, resultats de recherche d'une recette)
- [x] Composant QuantityInput : quantite + unite + ingredient avec autocompletion [D108]
- [x] SpaceRail : etat "espace en suppression" (icone grisee, compte a rebours) [D66, D96]
- [x] AppShell et pied de Sheet : accepter leurs zones comme enfants nommes, pour etre utilisables tels quels dans les maquettes et l'application (aujourd'hui recomposes a la main par les quatre canevas) : enfants nommes (SpaceRail, ModuleNav, TopBar, ShellMain, TabBar) et SheetFooter

- [x] SpaceRail : variante mobile = selecteur d'espace dans l'en-tete + feuille de liste des espaces [D130]
- [x] TabBar : 4 modules maximum puis "Plus" [D131]
- [x] Ajoute en plus : Skeleton (etats de chargement), TopBar `onBack` (retour) et `space` (bouton d'espace mobile)

Publie le 2026-11-04 (Design System, version 7). Les canevas de maquettes ont encore l'ancienne copie du bundle dans `project/ds/forestui/` : a recopier a l'etape suivante.

## Ecrans manquants

- [x] Admin : utilisateurs (reinitialisation de mot de passe sans SMTP, D21)
- [x] Admin : configuration de la 2FA au premier login
- [x] Admin : reglages de la plateforme (SMTP, Bugsink, stockage)
- [x] Recettes : refus d'une suggestion (motif, conversion en adaptation)
- [x] Recettes : sous-recette non visible ("recette non disponible")
- [x] Etats de chargement (aucun canevas ne les montre)
- [x] Planning : conversion d'une idee en recette (F-IDEE-RECETTE dans Planning, E-RECETTE-EDITION-Idee dans Recettes)

- [x] Planning mobile : vue "Semaine" compacte et selecteur Jour | Semaine [D111]
- [x] Rappel de verification d'email par notification dans l'app, sans blocage [D90]

## Coherence

- [x] Remplacer la bande d'espaces en haut par le selecteur d'en-tete dans toutes les maquettes mobiles [D130] (feuille F-ESPACES dans Acces et espaces)

- [x] Ajouter F-DEMANDE-PARTAGE a l'inventaire des ecrans de `13-Parcours.md`
- [x] Recette "Saumon teriyaki" : revision 4 partout
- [x] Repartition des espaces selon les canevas (OWNER de Colloc, TOM ; espaces "Cousins" et "Vacances 2025" ajoutes) : aligner sur le brief

Fait le 2026-11-04 (canevas Acces et espaces v36, Recettes v33, Planning et profil v22, Administration v20). Les ecrans de premier niveau ont la TopBar avec le bouton d'espace, ceux de second niveau une fleche de retour. L'AppShell en zones nommees n'est utilise par aucun canevas (corrige dans le DS v8 apres coup ; les canevas 1 et 4 gardent le CSS v7, sans effet visible).

## Points ouverts apres B5b (tranches le 2026-11-04, D132 a D138)

- [x] Matthias OWNER de Colloc, ajoute au brief [D132]
- [x] Idee transformee en recette : une seule maquette, E-RECETTE-EDITION-Idee (canevas Recettes) ; F-IDEE-RECETTE supprimee [D133]
- [x] Reinitialisation sans SMTP : mot de passe temporaire 24 h, usage unique [D134]
- [x] Reglages de la plateforme en lecture seule [D135]
- [x] Plus de compteur d'etapes a la connexion admin [D138]
- [x] TopBar en mode edition ajoutee au DS (v9) [D136] ; maquettes d'edition a passer dessus
- [x] Apercu en pastilles dans RadioGroup (DS v9) [D137] ; E-APPARENCE a passer dessus
- [x] Fleches de retour reliees en mode presentation (canevas Recettes)
- [x] Pas de maquette bureau supplementaire pour l'espace en suppression (le composant SpaceRail le montre)
- [x] Verifier le rendu des quatre canevas (fait le 2026-11-04 dans Chrome, artboard par artboard)

## Revue du rendu (2026-11-04)

Rien de casse a l'affichage ; ecarts releves :

- [x] Recettes : fonds de F-PARTAGER, F-PARTAGER-Demande, F-DEMANDE-PARTAGE et F-ADAPTER encore avec l'ancien en-tete texte ("Famille - Recettes"), pas la TopBar [D130]
- [x] Recettes bureau : liens en bleu par defaut du navigateur (E-RECETTE "historique", E-COMPARER-ORIGINAL), peu lisibles
- [x] DS, QuantityInput trop serre sur mobile : noms d'ingredients tronques dans E-RECETTE-EDITION ("creme fraic", "gruyere rap")
- [x] DS, SegmentedControl : barre de defilement parasite quand il prend toute la largeur (E-PLANNING-semaine)
- [x] Planning : E-PROFILS-GENERATION mobile, le Stepper "Delai" deborde a droite
- [x] Profil : F-SUPPRIMER-COMPTE presente Colloc comme espace dont Matthias est membre, alors qu'il en est OWNER [D132]
- [x] Recherche bureau : la palette s'ouvre en haut a gauche au lieu d'etre centree ; espace invente "Grand-mere et cousins" (hors brief)
- [x] Teinte 5 "Cendre" (Foyer) : le bouton principal gris parait desactive (E-PLANNING-vide, F-CREER-PLANNING, E-SUGGESTION-EDITION, F-DEMANDE-PARTAGE) ; a trancher
- [x] Details : E-REJOINDRE annonce 5 membres pour Famille (6 au brief) ; Lea "Moderateur" en mobile, "Moderatrice" en bureau ; dates en format americain dans F-CREER-PLANNING (rendu du champ date natif)

Corrige le 2026-11-04 (DS v10 ; Acces v37, Recettes v35, Planning v24, Admin v24).

- [ ] Revoir dans Chrome les ecrans corriges (fonds des feuilles de partage, liens bureau, QuantityInput, Stepper du profil, palette bureau, dates, espace Foyer)
