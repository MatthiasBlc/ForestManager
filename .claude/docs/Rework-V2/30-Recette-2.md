# Seconde recette preprod (2026-11-13)

Faite par Claude dans Chrome (bureau 1140 px et fenetre etroite 505 px, Linux), sur `preprod-forestmanager.matthias-bouloc.fr` (release 2.0.0, run `e24bee9`). Condition d'entree de C8 [D205] : aucune ligne en echec ni remarque ouverte. Journal brut de la session : ce fichier le remplace.

Comptes : `testrecette1` (session restee ouverte, deconnecte en cours de recette : mot de passe a reinitialiser depuis l'admin si besoin), `testrecette3` et `testrecette4` crees pour la recette (mot de passe commun dans le scratchpad de la session, non versionne). Espaces : "Coloc recette" (testrecette1, 3 membres), "Duo recette" (testrecette3 + testrecette4).

## 1. Resultat par ligne de la feuille

| Ligne              | Resultat           | Notes                                                                                                                                                               |
| ------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| r-import-texte     | OK avec defauts    | D4, D5, D2                                                                                                                                                          |
| r-import-url       | OK avec defauts    | D2, D13 (Marmiton quiche lorraine)                                                                                                                                  |
| r-composee         | OK                 | creation d'une base liee a la quiche, portions suivies ; R5, R6                                                                                                     |
| r-ajout-lot        | OK                 | quiche composee + gratin, sous-recette annoncee ; R12                                                                                                               |
| g-portions         | OK                 | R4                                                                                                                                                                  |
| c-lecture          | OK avec defaut     | D9 ; R7                                                                                                                                                             |
| c-ecran            | OK (technique)     | verrou d'ecran demande, accorde, relache a la sortie ; les 3 min reelles restent au telephone                                                                       |
| p-remplacer        | OK                 | ajout, remplacement, retrait (rev 3, 4, 5)                                                                                                                          |
| p-avatar           | OK                 | recadreur, profil, barre, espace perso, membres (image de test, pas la galerie)                                                                                     |
| e-lien             | OK                 | lien 1 j / 2 pers., inscription de testrecette3 par le lien ; R13                                                                                                   |
| e-partage          | OK avec defaut     | D15                                                                                                                                                                 |
| e-adapter          | OK                 | original intact ; R2                                                                                                                                                |
| e-suggestion       | OK sauf temps reel | acceptation -> revision 2, notification lue, historique ; cloche en direct entre deux comptes non testable (un seul navigateur)                                     |
| pl-activer         | non refait         | deja actif dans "Coloc recette"                                                                                                                                     |
| pl-semaine         | OK avec defaut     | D8 ; R9                                                                                                                                                             |
| pl-toucher         | OK                 | clic = recette, clic droit = F-REPAS                                                                                                                                |
| pl-glisser-souris  | OK                 | vers case vide, echange, verrou suit, Echap annule                                                                                                                  |
| pl-glisser-doigt   | OK (simule)        | appui long, souleve, fantome, echange (evenements pointeur `touch`)                                                                                                 |
| pl-accueil         | OK                 | repas-recette, repas texte (?day=), lien Planning ; R10                                                                                                             |
| nav-mobile         | OK                 | onglets, profil sans bande, planning membre                                                                                                                         |
| g-sheet            | OK (simule)        | glisser l'en-tete ferme la feuille                                                                                                                                  |
| g-appui-long       | OK (simule)        | carte de recette et repas : menu, sans selection de texte                                                                                                           |
| g-tirer            | OK (simule)        | le planning se recharge                                                                                                                                             |
| o-avion / o-retour | OK (simule)        | bandeau, recette deja ouverte lisible, Modifier desactive, retour du reseau ; mode avion reel au telephone ; R16                                                    |
| i-installer        | OK (technique)     | manifeste, icones 192/512/maskable, service worker actif ; installation reelle au telephone                                                                         |
| a-apparence        | OK                 | Potager + clair + compacte conserves apres deconnexion                                                                                                              |
| a-export-espace    | OK                 | Markdown + photos, suppression (nom exact), J-30, restauration (2 membres, recette)                                                                                 |
| d-export           | OK                 | JSON, 7 recettes ; D14                                                                                                                                              |
| d-inscription      | OK                 | testrecette3 (par lien), testrecette4 (ecran Bienvenue)                                                                                                             |
| Au proprietaire    | a faire            | i-maj (prochain deploy), d-admin (2FA), d-temps-reel et cloche en direct (deux appareils), a-bugsink, c-ecran 3 min, mode avion reel ; lignes Discord apres la prod |

Console : aucune erreur.

## 2. Defauts a corriger

- **D1 Defilement garde d'un ecran a l'autre** : `.fm-shell-main` n'est jamais remis en haut au changement de route (aucun `scrollTo` dans `apps/web/src`). Apres "Enregistrer" dans l'editeur, la fiche s'ouvre descendue (163 px, titre coupe). Reproduit deux fois.
- **D2 Ecart au CDC (D103)** : "Les champs importes douteux portent un badge 'A verifier'" : seul le bandeau "3 quantites a verifier" existe, aucune ligne n'est marquee (`recipe-editor-page.tsx` ne lit pas `line.check`).
- **D3 Erreur de titre qui reste** : apres "Enregistrer" sans titre, "Donne un titre a la recette." et le contour rouge restent une fois le titre saisi.
- **D4 Note d'ingredient invisible** : "- sel, poivre" donne le nom "sel" et la note "poivre" ; l'editeur n'a pas de champ de note : "poivre" n'est ni visible ni modifiable a l'edition (la fiche affiche "sel, poivre"). Une ligne "sel, poivre" devrait donner deux ingredients, ou la note doit etre editable.
- **D5 Deux temps sur une ligne** : "Preparation : 20 min - Cuisson : 1 h 15" n'est pas reconnu et devient l'etape 1 (`TIME` n'accepte qu'un temps par ligne).
- **D6 Notification d'invitation** : invitation acceptee depuis la carte de l'accueil, la notification "t'invite dans Duo recette" reste non lue (cloche a 1) ; la toucher mene a l'accueil perso au lieu de l'espace.
- **D7 Accueil perime apres adhesion** : apres avoir rejoint un espace, "Recemment ajoutees" reste vide jusqu'au rechargement.
- **D8 Generation sur les jours passes** : "Cette semaine" un vendredi couvre lundi a jeudi ; avec "Remplacer", le repas passe de lundi midi est remplace (historique reecrit, compteurs "planifiee N fois" faux).
- **D9 Ordre du mode cuisine** : pour une recette composee, l'etape du plat ("Cuire les pates... napper de sauce", 1/5) passe avant les etapes de la sauce (2 a 5).
- **D10 Donnees laissees a la deconnexion** : `fm:lastSpace`, `fm:lastSection`, `fm:recent-recipes` (titres) restent dans le `localStorage`, non lies au compte. Pas de fuite visible (palette filtree) mais lisibles sur un appareil partage.
- **D11 Entree sur "Rester connecte"** : bascule l'interrupteur au lieu d'envoyer le formulaire ; rien ne se passe.
- **D12 Tags au-dessus du voile** : fenetres ouvertes depuis une liste de recettes, la rangee de tags et sa barre de defilement restent claires au-dessus du voile (une fois a travers la fenetre). Le hit-test est correct : defaut de rendu Chrome (Linux, barres classiques), a confirmer sur telephone.
- **D13 Import Marmiton** : etapes coupees en milieu de phrase ("Etaler la pate dans un moule," / "la piquer..."), etapes vides de sens ("C'est pret", "Deguster") : 11 etapes pour 6 ; titre avec le suffixe "la meilleure recette" ; photo non reprise.
- **D14 Promesse de reimport** : export JSON "Se reimportera dans Forest Manager" alors que le reimport est en V2.1 (D192).
- **D15 Message faux** : un membre sur `/edit` d'une recette visible lit "Elle a ete supprimee, ou elle n'est pas visible dans cet espace".

## 3. Remarques (finition)

- R1 Fiche sans photo : grand bandeau vide (~140 px) au-dessus du titre, bureau et mobile.
- R2 Noms repetes : "par testrecette1 - testrecette1" (auteur puis espace perso du meme nom), cartes "testrecette1 - par testrecette1", "Adaptee de Gratin dauphinois - testrecette1 (testrecette1)".
- R3 Casse : "Beurre", "Echalote" (referentiel) au milieu de noms en minuscules.
- R4 Portions : "33,33 cl", "16,67 cl" a 4 pers. ; arrondir.
- R5 Bloc lie : "8" sans unite (fiche et feuille Ingredients) ; clic au milieu du bloc sans effet ; temps de la recette composee sans la sous-recette.
- R6 "Lier une recette" : "Quantite utilisee" vide et sous la liste, bouton pale sans explication ; preremplir avec les portions.
- R7 Mode cuisine : fleches du clavier sans effet en bureau ; noms non alignes quand l'unite est longue ; "Terminer" ramene la fiche aux portions d'origine.
- R8 Rangee de tags : barre de defilement epaisse et sombre en bureau ; affichee aussi dans un espace vide.
- R9 Toasts : "3 repas ajoutes" alors qu'un remplace ; "2 recettes ajoutees" alors que 3 arrivent ; pas de badge Base dans "Mes recettes a ajouter".
- R10 Planning ouvert par `?day=` : le jour vise n'est pas mis en avant en bureau.
- R11 Contrastes : onglet actif des choix segmentes (Recette / Texte libre, Clair / Sombre) a peine visible ; en Potager, focus rouge = air d'erreur ; bandeau "Mode suggestion" couleur d'alerte.
- R12 F-REPAS en bureau : barre de defilement interne pour quelques pixels.
- R13 Pages d'acces : "Plus tard" ressemble a du texte ; date "14/11/2026" contre "14 novembre" ailleurs ; aucun lien actif liste dans "Coloc recette" alors que celui du 12/11 (7 j) devrait l'etre s'il n'a pas ete revoque (a verifier).
- R14 Profil : icone de maison pour "Langue" ; meme icone pour "Apparence" et "Nouveautes".
- R15 Accueil : "Tes recettes les plus cuisinees" liste celles des espaces (testrecette3 n'a rien cuisine) ; colonne de droite vide en bureau.
- R16 Hors ligne : "les modifications attendront le reseau" laisse croire a une file d'attente alors que les boutons sont desactives.
- R17 Activite : ni modification de recette, ni suppression / restauration d'espace (types non declares) : a confirmer.
- R18 Menu "Creer une recette" : chevron sur "Saisir" seulement.

## 4. Suivi des corrections

Tri du proprietaire (2026-11-13) : tout corriger avant la prod ; ses propres lignes (telephone, deux appareils, admin, Bugsink) sont jugees bonnes.

Defauts corriges le 2026-11-13 (TDD, suite complete verte, non deployes) :

- D1 `AppShell` remet `<main>` en haut a chaque changement de chemin (pas pour un simple `?day=`).
- D2 badge "A verifier" sur chaque ligne importee douteuse ; il tombe des que la ligne est touchee.
- D3 les erreurs de l'editeur sont recalculees a chaque saisie apres le premier essai.
- D4 la precision d'une ligne (note) s'affiche et se modifie quand elle existe ; "sel, poivre" / "sel et poivre noir" donnent une ligne "a gout" par assaisonnement connu.
- D5 plusieurs temps sur une ligne ("Preparation : 20 min - Cuisson : 1 h 15").
- D6 l'avis d'invitation porte l'invitation (`targetType` `SpaceInvitation`) ; accepte, refuse, annule ou rejoint par lien : marque lu ; apres une arrivee il mene a l'espace (`url`).
- D7 apres une arrivee (lien ou invitation), espaces, accueil et notifications sont recharges.
- D8 la generation part d'aujourd'hui : les jours passes ne sont jamais regeneres (semaine passee : bouton desactive).
- D9 mode cuisine : les sous-recettes passent avant les blocs de la recette.
- D10 deconnexion et suppression du compte effacent les cles `fm:` du `localStorage` (brouillons compris) ; l'apparence reste.
- D11 Entree sur un interrupteur envoie le formulaire, Espace bascule.
- D12 (et R8) rangees de puces sans barre de defilement ; avec une souris elles passent a la ligne. A reconfirmer sur telephone.
- D13 etapes coupees recousues, "C'est pret" / "Deguster" / "Bon appetit" ecartes, suffixes "la meilleure recette" retires, photo de la page reprise (lue par l'API, `POST .../recipes/import/image`, meme anti-SSRF, puis envoyee comme une photo choisie).
- D14 JSON : "Donnees completes, lisibles par d'autres outils".
- D15 "Modification reservee" avec "Proposer une modification".
- R8 en plus : un espace sans recette n'affiche ni recherche ni filtres.

Remarques faites le 2026-11-13 :

- R1 fiche sans photo : plus de bandeau vide, le titre monte.
- R2 l'espace d'origine n'est plus cite quand il porte le nom de l'auteur (espace perso) : fiche, cartes de l'accueil, adaptation, partage, comparaison (`byline`).
- R3 noms d'ingredients enregistres avec l'initiale en minuscule (sigles gardes) par l'API et l'admin (`ingredientDisplayName`) ; migration `ingredient_case` pour les noms existants.
- R4 quantite metrique mise a l'echelle : entier a partir de 10, sinon une decimale (la quantite saisie n'est pas arrondie).
- R5 bloc lie sans unite : portions de la sous-recette ("8 pers.") sur la fiche et en mode cuisine ; toucher l'en-tete deplie ; temps de la fiche = temps propre + sous-recettes (`totalMinutes` des sous-recettes dans l'API).
- R6 F-LIER-RECETTE : quantite preremplie avec toute la recette, champ dans le pied (toujours visible), bouton "Choisis une recette" tant que rien n'est choisi.
- R7 mode cuisine : fleches gauche / droite ; colonne des quantites a largeur fixe ; "Terminer" et "Quitter" gardent les portions (`?servings=` sur la fiche).
- R8 voir D12.
- R9 generation : "1 repas ajoute et 1 remplace" ; ajout de mes recettes : ", avec N sous-recette(s)" ; badge Base dans "Mes recettes a ajouter".
- R10 planning en bureau : le jour vise par `?day=` est encadre dans la grille.
- R11 choix segmentes : actif en accent (fond et contour) ; focus Potager en bleu `second` (il valait la couleur d'erreur), dans le design system aussi ; bandeau "Mode suggestion" en `second`.
- R12 fenetre centree (bureau) : hauteur max `100% - 48px` au lieu de 88 %.
- R13 "Plus tard" en bouton secondaire (Rejoindre, Bienvenue) ; date du lien en toutes lettres. Lien du 12/11 absent : le code masque un lien revoque, expire ou epuise (conforme) ; a confirmer en preprod.
- R15 widget renomme "Les plus cuisinees dans tes espaces" (le planning est collectif) ; nombre impair de widgets : le dernier prend toute la largeur ; cartes en colonnes automatiques (140 px min).
- Au passage : test instable de la photo de profil corrige (avatar relu dans le `waitFor`) ; `bundle.css` du design system resynchronise avec `ds.css`.
- R14 icones globe (Langue) et megaphone (Nouveautes).
- R16 bandeau : "pour modifier, attends le retour du reseau".
- R18 chevron aussi sur "Un lien" et "Un texte colle".

Verifie dans Chrome sur la stack de dev (2026-11-13) : R1 a R3, R5 a R7, R10 a R13, R15.

- R17 tranche par le proprietaire (2026-11-17) : seule la restauration d'un espace entre au fil (`core.space.restored`, "a restaure l'espace.") ; pas de ligne par modification de recette (fil trop charge), ni pour une suppression (espace plus visible).

Deploy preprod le 2026-11-17 (CI #29 verte, E2E alignes sur les nouveaux libelles). Revue en preprod le meme jour avec deux comptes neufs (revue2a867, revue2b867, espace "Revue duo") :

- Conformes : migration des noms d'ingredients (existants en minuscule), R1, R2, R3, R5 (8 pers., 50 min, en-tete qui deplie), D6 (invitation acceptee depuis l'accueil : cloche a zero, arrivee dans l'espace), D7, D10 (cles `fm:` effacees a la deconnexion), D11 (Entree sur "Rester connecte" envoie le formulaire), D12 / R8 (puces a la ligne, sous le voile), D15, R11 (bandeau suggestion), R14, R15, R18.
- Non revus en preprod : planning (D8, R9, R10, R12 ; module non accorde a l'espace de revue, verifies en dev), D12 sur un vrai telephone, lien du 12/11 de "Coloc recette" (R13, comptes de revue non membres), import Marmiton (D13).
- Ecart releve : une carte de recette composee affichait son temps propre ("20 min") quand la fiche affichait le total ("50 min"). Corrige : l'API renvoie le total, sous-recettes visibles comprises, dans la liste comme sur la fiche.
- Planning revu ensuite en preprod (module accorde d'office par l'admin a "Revue duo") : D8 (periode du mardi au dimanche, lundi passe intact), R9 ("2 repas ajoutes"), R10 (samedi encadre) conformes.

Tour de l'admin en preprod (2026-11-17) : tableau de bord, demandes, catalogue et "Accorder a un espace", ingredients (en minuscule), unites, rayons, tags, espaces, changelog, journal, reglages. Corrige dans la foulee (TDD, unitaires et E2E verts) :

- IP des clients : la chaine est Traefik puis le nginx du front ; `TRUST_PROXY` passe de 1 a 2 en preprod et prod (avant, l'API voyait l'IP de Traefik pour tout le monde : journal faux et limites de debit partagees par tous les utilisateurs).
- Module accorde (d'office ou sur demande) : range apres les modules de l'espace (il passait devant Recettes, a egalite de rang). Les espaces deja servis en preprod gardent leur ordre ; l'OWNER peut le changer.
- Journal d'audit : "Planning des repas -> Revue duo" au lieu du code `meal-plan` (nom de l'espace enregistre avec l'action).
- Utilisateurs : colonne Espaces plus large, dates sur une ligne, bouton "Reinitialiser" sous l'en-tete "Mot de passe" (plus de defilement horizontal).

Laisses tels quels : badge "A traduire" sur toutes les unites, rayons et tags (traduction anglaise prevue plus tard) ; brouillon du changelog 2.0.0 vide : voulu, la premiere version V2 n'a pas de tag precedent et ses notes s'ecrivent a la main dans l'admin avant de la publier ; les versions suivantes sont preremplies a partir des commits.

Revue mobile en preprod (2026-11-17, Chrome a 390 px, souris) : liste, fiche, mode cuisine et feuille Ingredients, planning (vue Jour, F-REPAS), menu "Plus", notifications, apparence (focus Potager bleu) conformes. Remarque : dans le bandeau des jours du Planning, aujourd'hui n'avait pas de repere visuel quand un autre jour etait choisi (seulement `aria-current`) ; tranche par le proprietaire et corrige le 2026-11-17 (TDD) : fond accent clair, comme dans la grille bureau. Le defilement au doigt des tags (D12) reste a voir sur un vrai telephone.

Tests du proprietaire sur un vrai telephone (2026-11-17) : conformes, dont le defilement au doigt des tags (D12).

Deploy preprod du 2026-11-17 (CI #31, `9e61d88`) : carte "Pates sauce tomate" de "Revue duo" a 50 min et repere d'aujourd'hui dans le bandeau des jours du Planning (fond accent clair, theme sombre, 390 px) conformes. IP reelle au journal d'audit : a verifier par le proprietaire apres une connexion admin.
