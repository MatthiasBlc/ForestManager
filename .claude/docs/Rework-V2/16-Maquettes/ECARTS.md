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

- [ ] Admin : utilisateurs (reinitialisation de mot de passe sans SMTP, D21)
- [ ] Admin : configuration de la 2FA au premier login
- [ ] Admin : reglages de la plateforme (SMTP, Bugsink, stockage)
- [ ] Recettes : refus d'une suggestion (motif, conversion en adaptation)
- [ ] Recettes : sous-recette non visible ("recette non disponible")
- [ ] Etats de chargement (aucun canevas ne les montre)
- [ ] Planning : conversion d'une idee en recette (renvoie a l'editeur du canevas Recettes, a relier)

- [ ] Planning mobile : vue "Semaine" compacte et selecteur Jour | Semaine [D111]
- [ ] Rappel de verification d'email par notification dans l'app, sans blocage [D90]

## Coherence

- [ ] Remplacer la bande d'espaces en haut par le selecteur d'en-tete dans toutes les maquettes mobiles [D130]

- [ ] Ajouter F-DEMANDE-PARTAGE a l'inventaire des ecrans de `13-Parcours.md`
- [ ] Recette "Saumon teriyaki" : revision 3 sur mobile, 4 en bureau et dans l'historique, a harmoniser
- [ ] Repartition des espaces selon les canevas (OWNER de Colloc, TOM ; espaces "Cousins" et "Vacances 2025" ajoutes) : aligner sur le brief
