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

## Points ouverts apres B5b (a trancher avant B9)

- [ ] Brief : Matthias est-il OWNER de Colloc ? E-MODULES et F-DEMANDE-MODULE le supposent (demande de Planning pour Colloc).
- [ ] Doublon : l'idee transformee en recette existe dans deux canevas (F-IDEE-RECETTE dans Planning, E-RECETTE-EDITION-Idee dans Recettes). En garder une, l'autre renvoie.
- [ ] Admin, reinitialisation sans SMTP (A12b) : hypotheses de l'agent a valider (mot de passe temporaire valable 24 h et une fois ; ancien mot de passe valable jusqu'a son usage ; autres sessions fermees ensuite).
- [ ] Admin, reglages plateforme (A13) en lecture seule : la configuration reste en variables d'environnement (14-Architecture). A confirmer.
- [ ] Admin A01 affiche "Etape 1 sur 2" alors qu'une premiere connexion passe par A01a (3 etapes).
- [ ] En-tetes d'edition (E-RECETTE-EDITION, E-SUGGESTION-EDITION) gardes en "Annuler / titre / Enregistrer" fait main : ajouter une action principale a la TopBar du DS, ou garder tel quel.
- [ ] Navigation en mode Play du canevas Recettes : les fleches de retour de la TopBar ne menent nulle part (les anciens liens le faisaient).
- [ ] D-ACCUEIL (bureau) ne montre pas d'espace en suppression dans le rail ; E-APPARENCE garde ses boutons d'ambiance avec apercu (RadioGroup n'affiche pas d'apercu). Acceptable en l'etat ?
