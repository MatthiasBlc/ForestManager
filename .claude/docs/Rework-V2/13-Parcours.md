# Parcours utilisateurs - Rework V2 (roadmap B3)

Statut : voir le journal des decisions. Ce document a introduit D60 a D69 (section "Decisions").

Conventions :

- **Mobile first** : chaque parcours est decrit au telephone (375px). Les differences a partir de 768px / 1024px sont notees "Desktop".
- **Ecrans** : identifiants stables, repris par les maquettes (B5). `E-...` = ecran plein, `F-...` = feuille (Sheet : feuille du bas sur mobile, dialogue centre en desktop). La liste complete est en fin de document.
- **Composants** : noms du design system (Button, Field, Sheet, ActionMenu, Toast, CommandPalette, SpaceRail, ModuleNav, TabBar, TopBar, AppShell, RecipeCard, RecipeBlock, IngredientRow, MealSlot, PullToRefresh, EmptyState, Stepper, Chip, Badge, Switch, SegmentedControl, Avatar).
- **Etats communs** a tous les ecrans de liste : chargement (squelettes de cartes, pas de spinner plein ecran), vide (EmptyState avec l'action pour commencer), erreur (message + "Reessayer"), hors ligne (bandeau, D68). Ils ne sont repetes que lorsqu'ils ont un contenu propre au parcours.

---

## P01 - Premiere visite et inscription

- **Declencheur** : visiteur non connecte ouvre l'app (lien, ecran d'accueil du telephone).
- **Ecrans** : E-ACCUEIL-PUBLIC -> E-INSCRIPTION -> (E-VERIF-EMAIL si SMTP) -> E-BIENVENUE -> E-RECETTES de l'espace perso.
- **Etapes** :
  1. E-ACCUEIL-PUBLIC : nom, phrase de presentation, Button primary "Creer un compte", Button "Se connecter".
  2. E-INSCRIPTION : Field email, Field nom d'utilisateur, Field mot de passe (aide : regles), Switch "Rester connecte" (D13). Erreurs sous le champ (email deja utilise, nom pris).
  3. **Avec SMTP** (D21) : E-VERIF-EMAIL "Un lien t'a ete envoye a ...", Button "Renvoyer le lien" (desactive 60 s). Le lien ouvre l'app connectee, Toast "Adresse confirmee". En attendant la confirmation, l'app est utilisable (bandeau discret "Confirme ton adresse"), seules les invitations par email sont bloquees.
  4. **Sans SMTP** (D21) : pas d'ecran de verification, connexion immediate.
  5. E-BIENVENUE (D61) : 3 choix, tous passables : "Creer un espace" (F-CREER-ESPACE), "J'ai un lien d'invitation" (Field lien), "Ajouter ma premiere recette" (F-AJOUT-RECETTE). Lien "Plus tard".
  6. Arrivee sur l'espace perso (D02), module Recettes, EmptyState "Pas encore de recette".
- **Connexion / mot de passe** : E-CONNEXION (email ou nom, mot de passe, "Rester connecte"). "Mot de passe oublie" visible seulement avec SMTP : E-MDP-OUBLIE -> email -> E-MDP-NOUVEAU. Sans SMTP : texte "Demande a l'administrateur de reinitialiser ton mot de passe".
- **Composants** : Field, Button, Switch, Toast, EmptyState.
- **Notifications** : aucune.
- **Decisions** : D02, D13, D21, D34 (textes traduisibles), D61.

## P02 - Creer un espace groupe et inviter par lien

- **Declencheur** : bouton "+" du SpaceRail, ou E-BIENVENUE.
- **Ecrans** : F-CREER-ESPACE -> E-RECETTES (nouvel espace) -> F-INVITER.
- **Etapes** :
  1. F-CREER-ESPACE : Field nom, Field description (optionnel), choix de teinte (5 pastilles de la teinte de l'ambiance, D32), photo (optionnel). Button primary "Creer l'espace". Le createur devient OWNER (D06). Seul le module Recettes est actif (D33).
  2. Arrivee dans l'espace : SpaceRail montre la nouvelle icone active, l'interface prend la teinte. EmptyState du module Recettes avec deux actions : "Ajouter une recette" et "Inviter des membres".
  3. F-INVITER (D07), deux onglets SegmentedControl :
     - **Lien** : duree (SegmentedControl 1 jour / 7 jours / 30 jours), nombre d'usages (Stepper, illimite possible), Button "Creer le lien" puis "Copier le lien" (Toast "Lien copie"). Liste des liens actifs avec usages restants et ActionMenu "Revoquer".
     - **Nom d'utilisateur** : Field nom exact (pas d'autocompletion globale), Button "Inviter". Erreur "Aucun compte avec ce nom" si inconnu.
  4. Desktop : F-INVITER aussi accessible depuis E-MEMBRES.
- **Notifications** : invitation par nom -> la personne invitee recoit une notification "X t'invite dans Famille".
- **Decisions** : D06, D07, D32, D33.

## P03 - Rejoindre un espace via un lien

- **Declencheur** : ouverture d'un lien `/i/<code>`.
- **Ecrans** : E-REJOINDRE -> (E-INSCRIPTION ou E-CONNEXION si non connecte) -> E-REJOINDRE -> E-RECETTES de l'espace.
- **Etapes** :
  1. E-REJOINDRE (D62) : avatar et nom de l'espace, nombre de membres, nom de qui a cree le lien. Button primary "Rejoindre Famille".
  2. Non connecte : "Creer un compte pour rejoindre" / "Se connecter" ; apres inscription ou connexion, retour automatique sur E-REJOINDRE (le code est conserve), un clic de confirmation reste necessaire.
  3. Lien expire, revoque ou epuise : E-REJOINDRE affiche "Ce lien n'est plus valable. Demande un nouveau lien a un membre de l'espace." Pas d'information sur l'espace.
  4. Deja membre : redirection vers l'espace, Toast "Tu fais deja partie de Famille".
- **Invitation par nom** : la notification ouvre F-INVITATION (Accepter / Refuser).
- **Notifications** : les moderateurs et l'OWNER recoivent "Y a rejoint Famille" ; activite de l'espace.
- **Decisions** : D07, D62.

## P04 - Creer une recette (saisie, import URL, import texte)

- **Declencheur** : Button "Nouvelle recette" (E-RECETTES), CommandPalette "Nouvelle recette", E-BIENVENUE.
- **Ecrans** : F-AJOUT-RECETTE -> (F-IMPORT-URL | F-IMPORT-TEXTE) -> E-RECETTE-EDITION -> E-RECETTE.
- **Etapes** :
  1. F-AJOUT-RECETTE (D63) : trois choix : "Saisir", "Importer depuis un lien", "Coller un texte". La recette sera creee dans l'espace courant (rappel en tete : "Dans Famille").
  2. F-IMPORT-URL : Field lien, Button "Importer". Chargement : "Lecture de la recette...". Echec : "Cette page ne contient pas de recette lisible. Essaie Coller un texte." (bascule proposee).
  3. F-IMPORT-TEXTE (D28) : Field multiline, Button "Analyser". Le texte est decoupe en titre, ingredients, etapes.
  4. E-RECETTE-EDITION, pre-rempli si import : titre, photo, rendement (Stepper + unite : "pers." par defaut, ml, pieces), temps (preparation, cuisson, repos), blocs (RecipeBlock en edition) : ingredients (quantite, unite, ingredient avec autocompletion ; un ingredient inconnu est cree a la volee, D09), etapes (reordonnables), tags de l'espace (Chip, creation libre, D08/D19), tags globaux. Les champs issus d'un import et douteux sont signales "A verifier" (Badge warning).
  5. Button primary "Enregistrer" -> E-RECETTE, Toast "Recette enregistree". Revision 1 creee (D05).
  6. Quitter avec des modifications : F-CONFIRMER "Abandonner les modifications ?".
- **Etats** : brouillon conserve localement si l'app se ferme (pas de perte de saisie) ; hors ligne : Enregistrer desactive avec "Reviens en ligne pour enregistrer" (D68).
- **Notifications** : activite de l'espace "X a ajoute Gratin de pates" (pas de notification individuelle).
- **Decisions** : D05, D08, D09, D19, D28, D63.

## P05 - Recette composee

- **Declencheur** : dans E-RECETTE-EDITION, Button "Ajouter un bloc".
- **Ecrans** : E-RECETTE-EDITION -> F-AJOUT-BLOC -> F-LIER-RECETTE -> E-RECETTE-EDITION.
- **Etapes** :
  1. F-AJOUT-BLOC : "Bloc local" (titre, ingredients, etapes) ou "Lier une recette".
  2. F-LIER-RECETTE : recherche parmi les recettes visibles dans l'espace courant (les recettes "Base" d'abord, D24) ; choix de la quantite dans le rendement de la sous-recette (Stepper + unite : "150 ml" si la sauce rend 300 ml). Une recette qui creerait une boucle ou depasserait 3 niveaux est grisee avec la raison.
  3. Retour dans l'edition : le bloc lie apparait (RecipeBlock linked, couleur second), repliable, non modifiable ici (lien "Ouvrir la sauce").
  4. Dans E-RECETTE : le bloc lie se deplie, quantites mises a l'echelle des portions (Stepper du rendement).
  5. Option "Extraire en recette" sur un bloc local (ActionMenu) : cree une recette Base a partir du bloc et remplace le bloc par un lien.
- **Partage** : partager la recette composee partage ses sous-recettes (D26), voir P06.
- **Decisions** : D24, D26.

## P06 - Partager ou adapter une recette

- **Declencheur** : ActionMenu d'une RecipeCard (appui long ou "...") ou d'E-RECETTE : "Partager dans un espace", "Adapter pour un espace".
- **Partager** (D03, D26) :
  1. F-PARTAGER (D65) : liste des espaces dont on est membre, avec case cochee pour ceux ou la recette est deja visible (l'espace d'origine est coche et grise). Cocher = partager, decocher = retirer le partage.
  2. Si la recette a des sous-recettes : encart "Seront aussi partagees : Sauce teriyaki".
  3. Button "Enregistrer" -> Toast "Partagee dans TOM".
- **Adapter** (D17) :
  1. F-ADAPTER : choix de l'espace cible (un seul), Field titre pre-rempli ("Gratin de pates - version Colloc" modifiable). Button "Adapter".
  2. E-RECETTE-EDITION de l'adaptation, deja remplie ; Enregistrer cree une recette de l'espace cible liee a l'original.
  3. Plus tard, quand l'original change : Badge warning "Original modifie" sur la RecipeCard et un bandeau dans E-RECETTE avec "Comparer avec l'original" -> E-COMPARER-ORIGINAL (deux colonnes sur desktop, onglets Original / Adaptation sur mobile, differences surlignees). Button "Marquer comme vu" fait disparaitre le badge.
- **Notifications** : partage -> activite de l'espace cible "X a partage Gratin de pates". Adaptation -> l'auteur de l'original recoit "Ta recette a ete adaptee dans Colloc" (sans le contenu si l'auteur n'est pas membre de Colloc).
- **Decisions** : D03, D17, D26, D65.

## P07 - Suggerer une modification, puis accepter ou refuser

- **Declencheur** : membre non auteur, ActionMenu d'E-RECETTE "Suggerer une modification".
- **Ecrans** : E-SUGGESTION-EDITION -> E-RECETTE ; cote auteur : notification -> E-SUGGESTION -> E-RECETTE.
- **Etapes (suggereur)** :
  1. E-SUGGESTION-EDITION (D64) : meme editeur que E-RECETTE-EDITION, bandeau "Tu proposes une modification a Matthias", Field "Message (optionnel)". Button "Envoyer la suggestion". Toast "Suggestion envoyee".
  2. La suggestion est listee sur E-RECETTE (onglet ou section "Suggestions", Badge "1 en attente").
- **Etapes (decideur : l'auteur, ou un moderateur si l'auteur n'est plus membre, D04/D18)** :
  1. Notification "Lea propose une modification de Gratin de pates" -> E-SUGGESTION : message, differences bloc par bloc (ajouts, retraits, quantites modifiees surlignees).
  2. Button primary "Accepter" -> nouvelle revision (D05), Toast "Recette mise a jour". Button "Refuser" -> F-CONFIRMER avec Field motif optionnel ; rien n'est cree.
  3. Si la recette a change depuis (base de revision depassee) : bandeau "La recette a ete modifiee depuis cette suggestion" ; accepter reste possible, les differences sont recalculees sur la version actuelle.
- **Apres refus** : le suggereur recoit "Ta suggestion a ete refusee" avec le motif et un Button "En faire mon adaptation" (D04, D17).
- **Historique** : E-HISTORIQUE (ActionMenu "Historique") liste les revisions ; l'auteur peut restaurer (cree une nouvelle revision).
- **Decisions** : D04, D05, D17, D18, D64.

## P08 - Un auteur quitte l'espace

- **Declencheur** : E-REGLAGES-ESPACE "Quitter l'espace" (ou exclusion par un moderateur, E-MEMBRES).
- **Etapes** :
  1. F-QUITTER : "Tes recettes creees dans Famille y restent ; les moderateurs pourront les modifier. Pour chacune de tes recettes partagees depuis ton espace perso, choisis : la laisser dans Famille ou retirer le partage." Rien n'est retire d'office (D84). OWNER : impossible sans transfert -> F-TRANSFERER (choix d'un membre) ou suppression de l'espace (P13).
  2. Apres depart : sur ses recettes restees, l'auteur s'affiche "ancien membre" (Avatar neutre). Les suggestions en attente passent aux moderateurs.
- **Notifications** : moderateurs : "X a quitte Famille. 2 suggestions en attente sur ses recettes." ; activite de l'espace.
- **Decisions** : D06, D18, D84.

## P09 - Demander l'acces a un module et l'activer

- **Declencheur** : OWNER, E-REGLAGES-ESPACE > "Modules", ou carte "Decouvrir les modules" sur l'EmptyState du rail de modules.
- **Ecrans** : E-MODULES -> F-DEMANDE-MODULE ; cote admin : E-ADMIN-DEMANDES ; retour : notification -> E-MODULES.
- **Etapes** :
  1. E-MODULES : catalogue des modules, chacun avec Badge de statut (Disponible, Beta, Bientot) et etat pour cet espace : "Actif", "Accorde, desactive" (Switch), "Demande en cours", "Demander l'acces". Les membres non OWNER voient la liste en lecture seule.
  2. F-DEMANDE-MODULE : Field message optionnel ("Pour planifier nos repas de la semaine"), Button "Envoyer la demande". Toast "Demande envoyee".
  3. Admin (E-ADMIN-DEMANDES) : file des demandes (espace, demandeur, module, message, date), Button "Accorder" / "Refuser" avec motif.
  4. Accorde : l'OWNER recoit "Le module Planning est disponible pour Famille", Button "Activer" (dans la notification ou sur E-MODULES). Le Switch active le module : il apparait dans ModuleNav / TabBar de tous les membres.
  5. Refuse : notification avec le motif ; une nouvelle demande reste possible.
- **Notifications** : admin (nouvelle demande), OWNER (accorde / refuse), membres (activite "Le planning est active").
- **Decisions** : D10, D33, D40.

## P10 - Planning : remplir une semaine, generer, verrouiller, echanger

- **Declencheur** : TabBar / ModuleNav "Planning" (module accorde et actif).
- **Ecrans** : E-PLANNING -> F-REPAS ; F-GENERER ; E-PROFILS-GENERATION ; E-IDEES.
- **Etapes** :
  1. Premiere ouverture : EmptyState "Pas encore de planning", Button "Creer le planning" -> F-CREER-PLANNING (dates de debut et de fin, portions par defaut). Les repas affiches suivent les reglages de l'espace (D11 : midi et soir par defaut).
  2. E-PLANNING mobile : jour par jour (SegmentedControl Jour / Semaine ; vue Jour par defaut sur mobile), une liste de MealSlot par repas. Desktop : grille jours x repas.
  3. Remplir : toucher un MealSlot vide -> F-REPAS : recherche de recette (espace d'abord, puis mes recettes avec "Partager dans l'espace" propose), ou texte libre + commentaire ; Stepper portions ; Switch "Verrouiller". Button "Enregistrer".
  4. Generer : Button "Generer" -> F-GENERER : profil de generation (liste), periode, "Remplacer les repas non verrouilles" (Switch). Resultat : rapport (repas remplis, regles non tenues) dans la feuille, Button "Garder" / "Annuler".
  5. Remplacer un repas : ActionMenu du MealSlot "Proposer un autre repas" (relance la generation sur ce repas, confirmation).
  6. Echanger (D69) : desktop, glisser-deposer un MealSlot sur un autre ; mobile, ActionMenu "Echanger avec..." puis toucher le repas cible (mode selection avec bandeau "Choisis le repas a echanger", Annuler).
  7. Verrouiller : ActionMenu "Verrouiller" (cadenas sur le MealSlot) ; la generation ne le touche pas.
  8. PullToRefresh sur E-PLANNING pour voir les modifications des autres membres.
- **Droits** : modification selon le role minimal regle par l'espace (F-MPL-3, matrice B2) ; sinon lecture seule avec mention.
- **Notifications** : activite "Planning de la semaine genere par X" ; pas de notification individuelle par repas.
- **Decisions** : D11, F-MPL-1 a F-MPL-5, D69.

## P11 - Mode cuisine

- **Declencheur** : Button "Mode cuisine" sur E-RECETTE ; MealSlot du jour -> "Cuisiner".
- **Ecrans** : E-MODE-CUISINE.
- **Etapes** (D67) :
  1. Plein ecran, ecran maintenu allume (D35 ; si refuse par le navigateur, petit texte "L'ecran peut s'eteindre").
  2. Haut : Stepper portions. Button "Ingredients" -> F-INGREDIENTS (IngredientRow a cocher, par bloc, sous-recettes depliees).
  3. Etape courante en `body-lg`, "Etape 3 sur 7", bloc courant en titre. Buttons "Precedente" / "Suivante" en bas (cibles larges) ; pas de glisser lateral obligatoire.
  4. Fin : "Bon appetit", Button "Quitter".
- **Hors ligne** : fonctionne pour une recette deja ouverte (D35).
- **Decisions** : D24, D35, D38, D67.

## P12 - Exporter ses recettes ou un espace

- **Declencheur** : E-PROFIL > "Exporter mes recettes" ; OWNER : E-REGLAGES-ESPACE > "Exporter l'espace".
- **Ecrans** : F-EXPORT.
- **Etapes** :
  1. F-EXPORT : format (SegmentedControl JSON / Markdown), Switch "Inclure les photos" (archive zip). Button "Preparer l'export".
  2. Preparation (quelques secondes) puis Button "Telecharger". Export d'espace : rappel "Les membres verront dans l'activite que tu as exporte l'espace" ; limite atteinte : "Un export par jour. Prochain export possible demain a 14:02."
- **Notifications** : activite de l'espace "X a exporte l'espace" (D37).
- **Decisions** : D37.

## P13 - Changer d'ambiance

- **Declencheur** : E-PROFIL > "Apparence" -> E-APPARENCE.
- **Etapes** : SegmentedControl ambiance (Braise, Sous-bois, Potager) avec apercu miniature ; SegmentedControl mode (Systeme, Clair, Sombre) ; densite et taille du texte. Application immediate, pas de bouton Enregistrer. Les espaces gardent leur numero de teinte.
- **Decisions** : D32.

## P14 - Supprimer un espace, puis le restaurer

- **Declencheur** : OWNER, E-REGLAGES-ESPACE > "Supprimer l'espace".
- **Ecrans** : F-SUPPRIMER-ESPACE ; E-ESPACE-EN-SUPPRESSION.
- **Etapes** :
  1. F-SUPPRIMER-ESPACE : consequences ("Les 6 membres perdront l'acces. Tu pourras restaurer l'espace pendant 30 jours."), proposition d'export avant (P12), Field "Tape Famille pour confirmer", Button danger "Supprimer".
  2. Pour les membres : l'espace disparait du rail ; notification "Famille a ete supprime par X".
  3. Pour l'OWNER (D66) : l'icone reste dans son rail, grisee, Badge "J-30". L'ouvrir montre E-ESPACE-EN-SUPPRESSION : "Famille sera definitivement supprime le 3 decembre", Button primary "Restaurer l'espace".
  4. Restauration : tout revient, membres notifies "Famille a ete restaure".
  5. Apres 30 jours : purge, l'icone disparait.
- **Decisions** : D22, D66.

## P15 - Supprimer son compte

- **Declencheur** : E-PROFIL > "Supprimer mon compte".
- **Ecrans** : F-SUPPRIMER-COMPTE.
- **Etapes** :
  1. Si l'utilisateur est OWNER d'espaces groupe : liste de ces espaces avec leur futur OWNER, designe automatiquement (MODERATOR le plus ancien, sinon MEMBER le plus ancien ; seul membre : espace supprime avec le delai de 30 jours) (D51). Les membres sont prevenus.
  2. Consequences : "Ton espace perso et ses recettes seront supprimes. Tes recettes dans les groupes resteront, signees ancien membre." Proposition d'export (P12).
  3. Mot de passe pour confirmer, Button danger "Supprimer mon compte". Deconnexion, E-ACCUEIL-PUBLIC avec message "Ton compte a ete supprime".
- **Decisions** : D20, D06, D51.

## P16 - Recherche globale

- **Declencheur** : Ctrl K (desktop) ou loupe de la TopBar (mobile, plein ecran).
- **Ecrans** : F-RECHERCHE (CommandPalette).
- **Etapes** : resultats groupes (Recettes, Ingredients, Membres, Espaces, Actions), fleches + Entree ; choisir un ingredient ouvre E-RECETTES filtre sur cet ingredient. Les recettes d'autres espaces affichent le nom de l'espace.
- **Decisions** : CDC S5.1.

## P17 - Notifications

- **Declencheur** : IconButton cloche (compteur) dans la TopBar.
- **Ecrans** : E-NOTIFICATIONS ; E-NOTIF-PREFERENCES.
- **Etapes** : liste groupee par jour, non lues en premier ; toucher = ouvrir la cible et marquer lu ; "Tout marquer comme lu" ; PullToRefresh. Preferences par categorie et par espace (Switch).
- **Decisions** : F-NOT-1, F-NOT-2.

---

## Decisions

| #   | Decision                                                                                                                                                                                                             | Statut  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| D60 | A l'ouverture, l'app reprend le dernier espace et module visites. L'accueil a widgets (E-ACCUEIL) est l'ecran d'entree de l'espace perso.                                                                            | VALIDEE |
| D61 | Apres l'inscription, un ecran de bienvenue a 3 choix passables (creer un espace, rejoindre par lien, ajouter une recette). Pas de visite guidee en plusieurs ecrans.                                                 | VALIDEE |
| D62 | Un lien d'invitation montre l'espace (nom, avatar, membres) avant de rejoindre ; il survit a l'inscription ou la connexion ; rejoindre demande un clic de confirmation. Un lien invalide ne montre rien de l'espace. | VALIDEE |
| D63 | Une seule porte d'entree pour creer une recette (Saisir, Importer un lien, Coller un texte) ; tout import aboutit au meme editeur pre-rempli, champs douteux marques "A verifier".                                   | VALIDEE |
| D64 | Une suggestion se redige dans l'editeur de recette en "mode suggestion" ; l'auteur l'accepte ou la refuse en entier en V2.0 (pas d'acceptation partielle).                                                           | VALIDEE |
| D65 | Le partage se regle dans une seule feuille a cases (espaces ou la recette est visible) : cocher partage, decocher retire.                                                                                            | VALIDEE |
| D66 | Un espace en suppression reste visible, grise, dans le rail de son OWNER seulement, avec le compte a rebours et "Restaurer".                                                                                         | VALIDEE |
| D67 | Mode cuisine : une etape a la fois en grand, boutons Precedente / Suivante, ingredients dans une feuille, ecran maintenu allume.                                                                                     | VALIDEE |
| D68 | Hors ligne : bandeau permanent "Hors ligne", actions d'ecriture desactivees avec la raison, pas de file d'attente de modifications ; brouillon de recette conserve localement.                                       | VALIDEE |
| D69 | Echanger deux repas : glisser-deposer en desktop ; sur mobile, ActionMenu "Echanger avec..." puis toucher le repas cible (pas de glisser-deposer tactile, conflit avec le defilement).                               | VALIDEE |

## Questions pour le proprietaire (tranchees)

Toutes tranchees : QP1 par D60, QP2 par D61, QP3 par D64, QP4 par D69, QP5 par D84 (l'ecran "Quitter" demande pour chaque recette).

- **QP1 - Ecran d'ouverture** : (a) dernier espace et module visites (recommande, D60) ; (b) toujours l'accueil a widgets ; (c) toujours l'espace perso.
- **QP2 - Accueil des nouveaux** : (a) ecran de bienvenue a 3 choix passables (recommande, D61) ; (b) visite guidee en plusieurs etapes ; (c) rien, arrivee directe dans l'espace perso vide.
- **QP3 - Acceptation d'une suggestion** : (a) en entier seulement en V2.0 (recommande, D64) ; (b) bloc par bloc des la V2.0 ; (c) ligne par ligne.
- **QP4 - Echange de repas sur mobile** : (a) menu "Echanger avec..." puis toucher la cible (recommande, D69) ; (b) glisser-deposer apres un appui long ; (c) les deux.
- **QP5 - Recette partagee depuis l'espace perso quand on quitte un groupe** : (a) le partage est retire, la recette reste dans l'espace perso (recommande : c'est le contenu de l'auteur, D18 vise les recettes creees dans le groupe) ; (b) le partage reste, la recette devient modifiable par les moderateurs ; (c) demander a l'auteur au moment du depart.

---

## Inventaire des ecrans (entree des maquettes B5)

| Id                      | Type    | Titre                            | Parcours           |
| ----------------------- | ------- | -------------------------------- | ------------------ |
| E-ACCUEIL-PUBLIC        | Ecran   | Presentation, non connecte       | P01, P15           |
| E-INSCRIPTION           | Ecran   | Creer un compte                  | P01, P03           |
| E-CONNEXION             | Ecran   | Se connecter                     | P01, P03           |
| E-VERIF-EMAIL           | Ecran   | Confirme ton adresse (SMTP)      | P01                |
| E-MDP-OUBLIE            | Ecran   | Mot de passe oublie (SMTP)       | P01                |
| E-MDP-NOUVEAU           | Ecran   | Nouveau mot de passe (SMTP)      | P01                |
| E-BIENVENUE             | Ecran   | Bienvenue, 3 choix               | P01                |
| E-ACCUEIL               | Ecran   | Accueil a widgets (espace perso) | D60                |
| E-REJOINDRE             | Ecran   | Rejoindre un espace par lien     | P03                |
| F-INVITATION            | Feuille | Accepter une invitation par nom  | P03                |
| F-CREER-ESPACE          | Feuille | Creer un espace                  | P01, P02           |
| F-INVITER               | Feuille | Inviter (lien / nom)             | P02                |
| F-ESPACES               | Feuille | Changer d'espace, mobile (D130)  | Tous               |
| E-MEMBRES               | Ecran   | Membres et roles                 | P02, P08           |
| E-REGLAGES-ESPACE       | Ecran   | Reglages de l'espace             | P08, P09, P12, P14 |
| F-QUITTER               | Feuille | Quitter l'espace                 | P08                |
| F-TRANSFERER            | Feuille | Transferer la propriete          | P08, P15           |
| E-MODULES               | Ecran   | Modules de l'espace              | P09                |
| F-DEMANDE-MODULE        | Feuille | Demander l'acces a un module     | P09                |
| E-ADMIN-DEMANDES        | Ecran   | Admin : demandes d'acces         | P09                |
| E-RECETTES              | Ecran   | Liste des recettes de l'espace   | P01, P02, P04, P16 |
| E-RECETTE               | Ecran   | Detail d'une recette             | P04 a P07, P11     |
| E-RECETTE-EDITION       | Ecran   | Creer / modifier une recette     | P04, P05, P06      |
| F-AJOUT-RECETTE         | Feuille | Nouvelle recette : 3 choix       | P01, P04           |
| F-IMPORT-URL            | Feuille | Importer depuis un lien          | P04                |
| F-IMPORT-TEXTE          | Feuille | Coller un texte                  | P04                |
| F-AJOUT-BLOC            | Feuille | Ajouter un bloc                  | P05                |
| F-LIER-RECETTE          | Feuille | Lier une recette                 | P05                |
| F-PARTAGER              | Feuille | Partager dans des espaces        | P06                |
| F-DEMANDE-PARTAGE       | Feuille | Demande de partage recue (D101)  | P06, P17           |
| F-ADAPTER               | Feuille | Adapter pour un espace           | P06                |
| E-COMPARER-ORIGINAL     | Ecran   | Comparer avec l'original         | P06                |
| E-SUGGESTION-EDITION    | Ecran   | Rediger une suggestion           | P07                |
| E-SUGGESTION            | Ecran   | Examiner une suggestion          | P07, P08           |
| E-HISTORIQUE            | Ecran   | Historique des revisions         | P07                |
| F-ACTIONS               | Feuille | Menu d'actions (ActionMenu)      | P06, P07, P10      |
| F-CONFIRMER             | Feuille | Confirmation generique           | P04, P07, P10      |
| E-MODE-CUISINE          | Ecran   | Mode cuisine                     | P11                |
| F-INGREDIENTS           | Feuille | Ingredients a cocher             | P11                |
| E-PLANNING              | Ecran   | Planning (jour / semaine)        | P10                |
| F-CREER-PLANNING        | Feuille | Creer le planning                | P10                |
| F-REPAS                 | Feuille | Modifier un repas                | P10                |
| F-GENERER               | Feuille | Generer le planning + rapport    | P10                |
| E-PROFILS-GENERATION    | Ecran   | Profils de generation et regles  | P10                |
| E-IDEES                 | Ecran   | Idees de repas                   | P10                |
| F-EXPORT                | Feuille | Exporter                         | P12, P14, P15      |
| E-PROFIL                | Ecran   | Profil                           | P12, P13, P15      |
| E-APPARENCE             | Ecran   | Apparence (ambiance, mode)       | P13                |
| F-SUPPRIMER-ESPACE      | Feuille | Supprimer l'espace               | P14                |
| E-ESPACE-EN-SUPPRESSION | Ecran   | Espace en suppression, restaurer | P14                |
| F-SUPPRIMER-COMPTE      | Feuille | Supprimer mon compte             | P15                |
| F-RECHERCHE             | Feuille | Recherche globale (Ctrl K)       | P16                |
| E-NOTIFICATIONS         | Ecran   | Notifications                    | P17                |
| E-NOTIF-PREFERENCES     | Ecran   | Preferences de notifications     | P17                |

Hors parcours mais a maquetter (administration plateforme, reprise V1) : tableau de bord admin, referentiels (ingredients, unites, rayons, tags globaux), catalogue des modules, espaces, moderation des recettes, changelog, journal d'audit, connexion admin 2FA.
