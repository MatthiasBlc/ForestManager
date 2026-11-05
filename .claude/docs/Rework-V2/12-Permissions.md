# Matrice des permissions - Rework V2

Statut : voir le journal des decisions. Les regles reprennent les decisions du journal ; ce document a introduit D50 a D59 et les questions P1 a P7, toutes tranchees depuis (references en fin de document).

Les droits sont verifies **cote serveur a chaque requete**, a partir du role dans l'espace concerne ; l'interface ne fait que masquer ce qui est interdit.

## Acteurs

| Code | Acteur      | Definition                                                                               |
| ---- | ----------- | ---------------------------------------------------------------------------------------- |
| VIS  | Visiteur    | Personne non connectee.                                                                  |
| CON  | Connecte    | Utilisateur connecte, non membre de l'espace concerne.                                   |
| MEM  | Membre      | MEMBER de l'espace concerne.                                                             |
| MOD  | Moderateur  | MODERATOR de l'espace concerne.                                                          |
| OWN  | Owner       | OWNER de l'espace concerne (un seul par espace GROUP ; seul membre de son espace perso). |
| ANC  | Ancien      | Ancien membre de l'espace, ou compte supprime (auteur affiche "ancien membre").          |
| ADM  | Super admin | AdminUser de la plateforme, session isolee, 2FA, chaque action tracee dans l'audit.      |

Un meme utilisateur est MEM, MOD ou OWN selon l'espace. "Auteur" se cumule avec son role.

## Legende

| Valeur   | Sens                                                                               |
| -------- | ---------------------------------------------------------------------------------- |
| `Oui`    | Autorise.                                                                          |
| `-`      | Interdit.                                                                          |
| `Auteur` | Seulement s'il est l'auteur de la recette (et encore membre de l'espace concerne). |
| `Soi`    | Seulement pour lui-meme (son compte, son invitation, sa suggestion).               |
| `Cond.`  | Autorise sous condition : voir la note.                                            |

## Compte

| Action                                                                         |  VIS  |  CON  | MEM | MOD | OWN | ANC | ADM | Source            | Note                                                                                                       |
| ------------------------------------------------------------------------------ | :---: | :---: | :-: | :-: | :-: | :-: | :-: | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Creer un compte                                                                |  Oui  |   -   |  -  |  -  |  -  |  -  |  -  | F-ACC-1           | L'espace perso est cree en meme temps.                                                                     |
| Se connecter, "rester connecte" 30 jours                                       |  Oui  |   -   |  -  |  -  |  -  |  -  |  -  | F-ACC-2, D13      |                                                                                                            |
| Verifier son email, "mot de passe oublie"                                      | Cond. |   -   |  -  |  -  |  -  |  -  |  -  | F-ACC-3, D21      | Seulement si un SMTP est configure ; sinon l'ecran n'apparait pas.                                         |
| Modifier son profil, son mot de passe, son apparence (ambiance, mode, densite) |   -   |  Soi  | Soi | Soi | Soi |  -  |  -  | F-ACC-4, D32      |                                                                                                            |
| Voir le profil d'un autre utilisateur (username, avatar)                       |   -   | Cond. | Oui | Oui | Oui |  -  | Oui | D50               | Seulement s'il partage au moins un espace avec lui. Pas d'annuaire ni de recherche globale d'utilisateurs. |
| Exporter ses propres recettes                                                  |   -   |  Soi  | Soi | Soi | Soi |  -  |  -  | D37               | Toutes les recettes dont il est l'auteur, quel que soit l'espace.                                          |
| Supprimer son compte                                                           |   -   |  Soi  | Soi | Soi | Soi |  -  |  -  | F-ACC-5, D20, D51 | Recettes partagees conservees, auteur anonymise ; s'il est OWNER d'espaces, transfert automatique (D51).   |
| Reinitialiser le mot de passe d'un utilisateur                                 |   -   |   -   |  -  |  -  |  -  |  -  | Oui | D21, D134         | Utile sans SMTP : mot de passe temporaire de 24 h a usage unique, a changer a la connexion (D134).         |

## Espace perso

| Action                                                  | VIS | CON | MEM | MOD | OWN | ANC |  ADM  | Source   | Note                                                                                  |
| ------------------------------------------------------- | :-: | :-: | :-: | :-: | :-: | :-: | :---: | -------- | ------------------------------------------------------------------------------------- |
| Voir et utiliser son espace perso                       |  -  |  -  |  -  |  -  | Soi |  -  | Cond. | D02, D52 | Personne d'autre que lui. Le super admin seulement pour une moderation motivee (D52). |
| Changer l'avatar et la teinte de son espace perso       |  -  |  -  |  -  |  -  | Soi |  -  |   -   | D02      |                                                                                       |
| Inviter quelqu'un dans son espace perso                 |  -  |  -  |  -  |  -  |  -  |  -  |   -   | CDC S3.2 | Impossible : l'espace perso n'a qu'un membre.                                         |
| Supprimer son espace perso                              |  -  |  -  |  -  |  -  |  -  |  -  |   -   | D02      | Seulement avec la suppression du compte.                                              |
| Demander l'acces a un module, activer un module accorde |  -  |  -  |  -  |  -  | Soi |  -  |   -   | D33      | Memes regles qu'un groupe.                                                            |

## Espace groupe

| Action                                                           | VIS |  CON  | MEM | MOD |  OWN  |  ANC  |  ADM  | Source        | Note                                                                                                                                       |
| ---------------------------------------------------------------- | :-: | :---: | :-: | :-: | :---: | :---: | :---: | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Creer un espace groupe                                           |  -  |  Oui  | Oui | Oui |  Oui  |  Oui  |   -   | F-SPC-1, D51  | Tout utilisateur connecte. Il en devient OWNER. Plafond anti-abus : 20 espaces possedes.                                                   |
| Voir le contenu de l'espace (modules actifs, recettes, planning) |  -  |   -   | Oui | Oui |  Oui  |   -   | Cond. | D03, D52      | Super admin : seulement pour une moderation motivee et tracee (D52).                                                                       |
| Voir la liste des membres et leurs roles                         |  -  |   -   | Oui | Oui |  Oui  |   -   |  Oui  | F-SPC-4       |                                                                                                                                            |
| Rejoindre par un lien d'invitation                               |  -  | Cond. |  -  |  -  |   -   | Cond. |   -   | D07           | Lien valide (non expire, non revoque, usages restants). Un membre exclu ne peut pas revenir par un lien, seulement par invitation directe. |
| Creer, revoquer un lien d'invitation                             |  -  |   -   |  -  | Oui |  Oui  |   -   |   -   | D07, CDC S3.1 |                                                                                                                                            |
| Inviter par username exact                                       |  -  |   -   |  -  | Oui |  Oui  |   -   |   -   | D07           |                                                                                                                                            |
| Accepter ou refuser une invitation recue                         |  -  |  Soi  |  -  |  -  |   -   |  Soi  |   -   | F-SPC-3       |                                                                                                                                            |
| Annuler une invitation envoyee                                   |  -  |   -   |  -  | Oui |  Oui  |   -   |   -   | F-SPC-2       |                                                                                                                                            |
| Exclure un MEMBER                                                |  -  |   -   |  -  | Oui |  Oui  |   -   |   -   | D06, D53      |                                                                                                                                            |
| Exclure un MODERATOR                                             |  -  |   -   |  -  |  -  |  Oui  |   -   |   -   | D53           | Un moderateur n'exclut jamais un autre moderateur.                                                                                         |
| Promouvoir MEMBER -> MODERATOR, retrograder MODERATOR -> MEMBER  |  -  |   -   |  -  |  -  |  Oui  |   -   |   -   | D06           |                                                                                                                                            |
| Transferer la propriete a un membre                              |  -  |   -   |  -  |  -  |  Oui  |   -   |   -   | D06, D92      | Le nouvel OWNER doit accepter ; l'ancien devient MODERATOR.                                                                                |
| Quitter l'espace                                                 |  -  |   -   | Soi | Soi | Cond. |   -   |   -   | D06, D22      | L'OWNER doit d'abord transferer la propriete. Le dernier membre qui part supprime l'espace (delai de 30 jours).                            |
| Renommer, changer description, avatar et teinte                  |  -  |   -   |  -  | Oui |  Oui  |   -   |   -   | CDC S3.1      |                                                                                                                                            |
| Supprimer l'espace (masque, restaurable 30 jours, puis purge)    |  -  |   -   |  -  |  -  |  Oui  |   -   |  Oui  | D22           | Membres prevenus. Super admin : moderation, avec motif.                                                                                    |
| Restaurer un espace supprime pendant les 30 jours                |  -  |   -   |  -  |  -  |  Oui  |   -   |  Oui  | D22           |                                                                                                                                            |
| Exporter toutes les recettes de l'espace                         |  -  |   -   |  -  |  -  |  Oui  |   -   |   -   | D37           | Une fois par jour, inscrit dans le fil d'activite.                                                                                         |
| Voir le fil d'activite de l'espace                               |  -  |   -   | Oui | Oui |  Oui  |   -   |   -   | F-SPC-7       |                                                                                                                                            |

## Modules

| Action                                                                             | VIS | CON | MEM | MOD | OWN | ANC | ADM | Source   | Note                                                         |
| ---------------------------------------------------------------------------------- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | -------- | ------------------------------------------------------------ |
| Voir les modules actifs de l'espace                                                |  -  |  -  | Oui | Oui | Oui |  -  | Oui | D33      |                                                              |
| Voir le catalogue des modules de la plateforme (statuts disponible, beta, bientot) |  -  |  -  | Oui | Oui | Oui |  -  | Oui | D33, D54 | Lecture pour tous les membres ; seul l'OWNER agit.           |
| Demander l'acces a un module pour l'espace                                         |  -  |  -  |  -  |  -  | Oui |  -  |  -  | D33      |                                                              |
| Annuler sa demande en attente                                                      |  -  |  -  |  -  |  -  | Oui |  -  |  -  | D33      |                                                              |
| Accepter ou refuser une demande d'acces                                            |  -  |  -  |  -  |  -  |  -  |  -  | Oui | D33      |                                                              |
| Accorder ou retirer un module de sa propre initiative                              |  -  |  -  |  -  |  -  |  -  |  -  | Oui | D33      | Retrait : donnees conservees et masquees (voir cas limites). |
| Activer ou desactiver un module accorde                                            |  -  |  -  |  -  |  -  | Oui |  -  |  -  | D33      | Desactiver masque le module pour tous ; ses donnees restent. |

## Recettes

| Action                                                                                                               | VIS | CON |  MEM   |  MOD  |  OWN  |  ANC  |  ADM  | Source              | Note                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------- | :-: | :-: | :----: | :---: | :---: | :---: | :---: | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Voir une recette visible dans l'espace (origine ou partagee), son historique, ses compteurs                          |  -  |  -  |  Oui   |  Oui  |  Oui  |   -   | Cond. | D03, D05, D39       | Super admin : moderation motivee (D52).                                                                                                                                                                                                 |
| Creer une recette dans l'espace, l'importer par URL ou par texte                                                     |  -  |  -  |  Oui   |  Oui  |  Oui  |   -   |   -   | F-REC-4, D28        | Dans l'espace perso : son OWNER.                                                                                                                                                                                                        |
| Modifier une recette (cree une revision)                                                                             |  -  |  -  | Auteur |  Oui  |  Oui  |   -   |   -   | D05, D06, D57, D122 | Recettes de l'espace d'origine : auteur, MOD et OWNER de l'espace d'origine. Les moderateurs d'un espace ou elle est seulement partagee ne la modifient pas. Super admin : jamais (lecture et moderation seulement, D52, D122).         |
| Restaurer une revision anterieure                                                                                    |  -  |  -  | Auteur |  Oui  |  Oui  |   -   |   -   | D05, D55            | Memes droits que modifier.                                                                                                                                                                                                              |
| Partager dans un autre espace (par reference)                                                                        |  -  |  -  | Cond.  | Cond. | Cond. |   -   |   -   | D03, D81            | Auteur : directement. Autre membre : demande acceptee par l'auteur, ou directement si l'auteur a autorise les membres de cet espace (D81). Etre membre des deux espaces. Auteur parti : les MOD / OWNER de l'espace d'origine decident. |
| Accepter ou refuser une demande de partage de sa recette ; autoriser les membres d'un espace a partager ses recettes |  -  |  -  | Auteur | Cond. | Cond. |   -   |   -   | D81                 | Auteur. MOD / OWNER de l'espace d'origine seulement si l'auteur n'en est plus membre.                                                                                                                                                   |
| Retirer une recette d'un espace ou elle est partagee                                                                 |  -  |  -  | Auteur |  Oui  |  Oui  |   -   |  Oui  | F-REC-9, D122       | Auteur, ou MOD / OWNER de cet espace de partage. Super admin : moderation, motif obligatoire et audit ; la recette reste chez son auteur (D52, D122).                                                                                   |
| Adapter pour un espace (copie liee a l'original)                                                                     |  -  |  -  |  Oui   |  Oui  |  Oui  |   -   |   -   | D17                 | Il faut voir l'original et etre membre de l'espace cible. L'adaptation lui appartient.                                                                                                                                                  |
| Comparer une adaptation avec l'original, marquer "vu"                                                                |  -  |  -  |  Oui   |  Oui  |  Oui  |   -   |   -   | D17                 | Comparer : tout membre qui voit l'adaptation. Marquer vu : ceux qui peuvent modifier l'adaptation.                                                                                                                                      |
| Supprimer une recette (disparait de tous les espaces)                                                                |  -  |  -  | Auteur |  Oui  |  Oui  |   -   |  Oui  | F-REC-10, D57       | Auteur. MOD / OWNER de l'espace d'origine seulement si l'auteur n'en est plus membre. Super admin : moderation, avec motif (D52, D122).                                                                                                 |
| Marquer une recette comme "base" (exclue de la generation)                                                           |  -  |  -  | Auteur |  Oui  |  Oui  |   -   |   -   | D24                 | Memes droits que modifier.                                                                                                                                                                                                              |
| Mode cuisine, cocher les ingredients, changer les portions affichees                                                 |  -  |  -  |  Oui   |  Oui  |  Oui  |   -   |   -   | F-REC-12            | Rien n'est enregistre sur la recette.                                                                                                                                                                                                   |
| Recette d'un auteur parti : la reprendre (modifier, trancher, retirer, supprimer)                                    |  -  |  -  |   -    |  Oui  |  Oui  |   -   |   -   | D18, D57            | MOD et OWNER de l'espace d'origine.                                                                                                                                                                                                     |
| Acceder a ses anciennes recettes apres avoir quitte l'espace                                                         |  -  |  -  |   -    |   -   |   -   | Cond. |   -   | D18, D59            | Non dans l'espace quitte ; il garde celles dont l'origine est un autre espace. S'il revient, il retrouve ses droits d'auteur (D59).                                                                                                     |

## Recettes composees

| Action                                                         | VIS | CON |  MEM   |  MOD  |  OWN  | ANC | ADM | Source   | Note                                                                                                                                                                  |
| -------------------------------------------------------------- | :-: | :-: | :----: | :---: | :---: | :-: | :-: | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ajouter un bloc lie a une autre recette                        |  -  |  -  | Auteur |  Oui  |  Oui  |  -  |  -  | D24      | Droit de modifier la recette composee ET voir la sous-recette.                                                                                                        |
| Voir le contenu d'une sous-recette liee                        |  -  |  -  | Cond.  | Cond. | Cond. |  -  |  -  | D24, D26 | Seulement si elle est visible dans l'espace ; sinon le bloc affiche "recette non disponible" avec son nom.                                                            |
| Partager une recette composee (partage auto des sous-recettes) |  -  |  -  | Auteur |   -   |   -   |  -  |  -  | D26, D81 | Les sous-recettes dont il est l'auteur sont partagees avec elle ; celles d'un autre ne le sont pas et s'affichent "non disponible" (liste affichee avant de valider). |
| Modifier une sous-recette depuis la recette composee           |  -  |  -  | Auteur |  Oui  |  Oui  |  -  |  -  | D24      | Non : on ouvre la sous-recette, avec ses propres droits. Le lien est vivant.                                                                                          |

## Suggestions

| Action                                                 | VIS | CON |  MEM   |  MOD  |  OWN  | ANC | ADM | Source         | Note                                                                                  |
| ------------------------------------------------------ | :-: | :-: | :----: | :---: | :---: | :-: | :-: | -------------- | ------------------------------------------------------------------------------------- |
| Suggerer une modification                              |  -  |  -  | Cond.  | Cond. | Cond. |  -  |  -  | D04            | Tout membre qui voit la recette, sauf son auteur.                                     |
| Voir les suggestions d'une recette                     |  -  |  -  |  Oui   |  Oui  |  Oui  |  -  |  -  | D04            |                                                                                       |
| Retirer sa propre suggestion en attente                |  -  |  -  |  Soi   |  Soi  |  Soi  |  -  |  -  | D04            |                                                                                       |
| Accepter (nouvelle revision) ou refuser une suggestion |  -  |  -  | Auteur |  Oui  |  Oui  |  -  |  -  | D04, D18       | Auteur. MOD / OWNER de l'espace d'origine seulement si l'auteur n'en est plus membre. |
| Transformer sa suggestion refusee en adaptation        |  -  |  -  |  Soi   |  Soi  |  Soi  |  -  |  -  | D04, D17, D140 | L'adaptation est la seule copie possible (D140).                                      |

## Tags

| Action                                                                 | VIS | CON |  MEM   | MOD | OWN | ANC | ADM | Source       | Note                                                                               |
| ---------------------------------------------------------------------- | :-: | :-: | :----: | :-: | :-: | :-: | :-: | ------------ | ---------------------------------------------------------------------------------- |
| Creer, renommer, fusionner, traduire un tag global                     |  -  |  -  |   -    |  -  |  -  |  -  | Oui | F-REF-1, D34 |                                                                                    |
| Poser ou retirer un tag global sur une recette                         |  -  |  -  | Auteur | Oui | Oui |  -  |  -  | D19          | Les tags globaux suivent la recette : memes droits que modifier.                   |
| Creer un tag d'espace (en taguant une recette)                         |  -  |  -  |  Oui   | Oui | Oui |  -  |  -  | D08, D19     |                                                                                    |
| Poser ou retirer un tag d'espace sur une recette visible dans l'espace |  -  |  -  |  Oui   | Oui | Oui |  -  |  -  | D19, D27     | Propre a cet espace : n'affecte pas les autres espaces ou la recette est partagee. |
| Renommer, fusionner, supprimer un tag d'espace                         |  -  |  -  |   -    | Oui | Oui |  -  |  -  | D08          |                                                                                    |

## Ingredients et unites

| Action                                                    | VIS | CON | MEM | MOD | OWN | ANC | ADM | Source           | Note                                 |
| --------------------------------------------------------- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | ---------------- | ------------------------------------ |
| Utiliser un ingredient, une unite, un rayon existant      |  -  |  -  | Oui | Oui | Oui |  -  |  -  | F-REF-3, F-REF-4 |                                      |
| Creer un ingredient a la volee (utilisable tout de suite) |  -  |  -  | Oui | Oui | Oui |  -  |  -  | D09              | Marque "nouveau" pour la file admin. |
| Fusionner, renommer, traduire les ingredients             |  -  |  -  |  -  |  -  |  -  |  -  | Oui | D09, D34         |                                      |
| Gerer unites, conversions et rayons                       |  -  |  -  |  -  |  -  |  -  |  -  | Oui | D36              |                                      |

## Planning

| Action                                                                                 | VIS | CON |  MEM  | MOD | OWN | ANC | ADM | Source        | Note                                                                          |
| -------------------------------------------------------------------------------------- | :-: | :-: | :---: | :-: | :-: | :-: | :-: | ------------- | ----------------------------------------------------------------------------- |
| Voir le planning, les archives, les idees de repas                                     |  -  |  -  |  Oui  | Oui | Oui |  -  |  -  | CDC S4.6      | Si le module est accorde et actif.                                            |
| Modifier un repas (recette, texte libre, portions, commentaire), echanger, verrouiller |  -  |  -  | Cond. | Oui | Oui |  -  |  -  | F-MPL-3, D58  | Role minimal regle par l'OWNER ; MEMBER par defaut.                           |
| Remplacer un repas par la generation (un seul repas)                                   |  -  |  -  | Cond. | Oui | Oui |  -  |  -  | D58           | Memes droits que modifier un repas.                                           |
| Creer, archiver, supprimer un planning ; regler les repas de la journee                |  -  |  -  |   -   | Oui | Oui |  -  |  -  | D11, D58      |                                                                               |
| Gerer les jeux de parametres de generation (regles, exclusions, epinglages)            |  -  |  -  |   -   | Oui | Oui |  -  |  -  | D58           |                                                                               |
| Generer tout un planning                                                               |  -  |  -  |   -   | Oui | Oui |  -  |  -  | D58           | Les repas verrouilles ne bougent pas.                                         |
| Ajouter une idee de repas                                                              |  -  |  -  |  Oui  | Oui | Oui |  -  |  -  | CDC S4.6      |                                                                               |
| Modifier, supprimer une idee                                                           |  -  |  -  | Cond. | Oui | Oui |  -  |  -  | CDC S4.6      | Membre : seulement ses propres idees.                                         |
| Convertir une idee en recette                                                          |  -  |  -  |  Oui  | Oui | Oui |  -  |  -  | F-MPL-4       | La recette creee a pour auteur celui qui convertit.                           |
| Liste de courses (V2.1) : creer, cocher, archiver                                      |  -  |  -  | Cond. | Oui | Oui |  -  |  -  | F-SHP-4, D141 | Role minimal regle par l'OWNER ; MEMBER par defaut, comme le planning (D141). |

## Notifications et activite

| Action                                             | VIS | CON | MEM | MOD | OWN | ANC | ADM | Source   | Note |
| -------------------------------------------------- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | -------- | ---- |
| Recevoir les notifications qui le concernent       |  -  | Oui | Oui | Oui | Oui |  -  |  -  | F-NOT-1  |      |
| Regler ses preferences par categorie et par espace |  -  | Soi | Soi | Soi | Soi |  -  |  -  | F-NOT-2  |      |
| Voir le journal d'audit de la plateforme           |  -  |  -  |  -  |  -  |  -  |  -  | Oui | CDC S3.3 |      |

## Administration

| Action                                                                       | VIS | CON | MEM | MOD | OWN | ANC | ADM | Source        | Note                                     |
| ---------------------------------------------------------------------------- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | ------------- | ---------------------------------------- |
| Tableau de bord, file des demandes de modules, file des nouveaux ingredients |  -  |  -  |  -  |  -  |  -  |  -  | Oui | CDC S4.9      |                                          |
| Moderer une recette ou un espace (masquer, supprimer) avec motif             |  -  |  -  |  -  |  -  |  -  |  -  | Oui | CDC S3.3, D52 |                                          |
| Gerer le changelog                                                           |  -  |  -  |  -  |  -  |  -  |  -  | Oui | CDC S4.10     |                                          |
| Se connecter a la place d'un utilisateur                                     |  -  |  -  |  -  |  -  |  -  |  -  |  -  | D52           | Interdit, y compris pour le super admin. |

## Cas limites

| Situation                                                            | Regle                                                                                                                                                                                             | Source   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Dernier OWNER qui veut partir                                        | Il doit transferer la propriete ou supprimer l'espace. S'il est le dernier membre, partir supprime l'espace (restaurable 30 jours).                                                               | D06, D22 |
| OWNER qui supprime son compte                                        | Transfert automatique au MODERATOR le plus ancien, sinon au MEMBER le plus ancien ; seul : espace supprime avec delai.                                                                            | D51      |
| Auteur parti puis revenu                                             | Il retrouve ses droits d'auteur ; les modifications faites entre-temps par les moderateurs restent dans l'historique.                                                                             | D57, D59 |
| Membre exclu                                                         | Acces coupe immediatement (y compris temps reel) ; ses recettes restent, reprises par les moderateurs ; ses suggestions en attente sont annulees ; il ne revient que par invitation directe.      | D18, D53 |
| Sous-recette liee non visible                                        | Le bloc affiche "recette non disponible" avec son nom ; pas de quantites depliees ; la liste de courses signale les ingredients manquants.                                                        | D24, D26 |
| Recette composee retiree d'un espace                                 | On propose de retirer aussi les sous-recettes partagees automatiquement avec elle, si aucune autre recette de l'espace ne les utilise.                                                            | D26      |
| Espace d'origine supprime alors que la recette est partagee ailleurs | La recette est rapatriee dans l'espace perso de son auteur, ses partages et adaptations restent. Si l'auteur n'existe plus : elle reste dans les espaces de partage, geree par leurs moderateurs. | D22, D83 |
| Original d'une adaptation supprime                                   | L'adaptation vit seule, le lien affiche "original supprime".                                                                                                                                      | D17      |
| Module desactive ou retire avec des donnees                          | Donnees conservees indefiniment et masquees ; reactivation ou nouvel acces = tout revient ; elles partent seulement avec l'espace.                                                                | D33, D85 |
| Suggestion en attente quand la recette change                        | La suggestion reste basee sur sa revision ; le diff est recalcule sur la version courante et les conflits sont signales ; elle reste tranchable.                                                  | D04, D05 |
| Changement de role pendant une action                                | Les droits sont verifies a chaque requete cote serveur ; l'interface se met a jour par le temps reel.                                                                                             | CDC S6.2 |
| Lien d'invitation utilise apres expiration ou revocation             | Refuse avec un message clair ; l'utilisateur peut demander un nouveau lien a un moderateur.                                                                                                       | D07      |
| Compte supprime auteur de suggestions ou d'idees                     | Ses suggestions en attente sont annulees ; ses idees de repas restent, auteur anonymise.                                                                                                          | D20      |

## Decisions

Introduites par ce document, reportees dans le journal des decisions (qui porte leur statut).

### D50 - Pas d'annuaire d'utilisateurs - VALIDEE (2026-11-03)

- Un profil (username, avatar) n'est visible que par les personnes qui partagent un espace avec lui. Aucune recherche globale ; invitation par lien ou username exact (D07).

### D51 - Suppression du compte d'un OWNER - VALIDEE (2026-11-03)

- La propriete de chaque espace passe automatiquement au MODERATOR le plus ancien, sinon au MEMBER le plus ancien ; les membres sont prevenus. S'il etait seul, l'espace est supprime avec le delai de 30 jours (D22). Plafond anti-abus : 20 espaces possedes par utilisateur.

### D52 - Acces du super admin au contenu - VALIDEE (2026-11-03)

- Pas de navigation libre dans les espaces. Acces seulement pour une moderation (signalement, demande d'un utilisateur), avec un motif saisi et trace dans l'audit. Jamais de connexion a la place d'un utilisateur.

### D53 - Exclusion des moderateurs - VALIDEE (2026-11-03)

- Un MODERATOR exclut des MEMBER ; seul l'OWNER exclut ou retrograde un MODERATOR.

### D54 - Catalogue des modules visible par tous les membres - VALIDEE (2026-11-03)

- Lecture du catalogue et des statuts pour tous les membres ; seul l'OWNER demande l'acces et active.

### D55 - Restaurer une revision - VALIDEE (2026-11-03)

- Meme droit que modifier la recette (auteur, ou MOD / OWNER de l'espace d'origine).

### D56 - Partager dans un autre espace : l'auteur seulement - AMENDEE par D81 (demande de partage + confiance par espace, voir le journal)

- Partager par reference expose le contenu de l'auteur : lui seul le decide. Les autres membres adaptent la recette pour leur espace (D17).

### D57 - Recette d'un auteur parti - VALIDEE (2026-11-03)

- MOD et OWNER de l'espace d'origine peuvent la modifier, trancher ses suggestions, la retirer et la supprimer. Ses partages dans d'autres espaces restent ; les moderateurs de ces espaces peuvent seulement les retirer.

### D58 - Droits du planning - VALIDEE (2026-11-03)

- Modifier un repas : role minimal regle par l'OWNER, MEMBER par defaut. Creer, archiver un planning, regler les repas de la journee, gerer les parametres et generer tout un planning : MODERATOR et OWNER.

### D59 - Retour d'un ancien membre - VALIDEE (2026-11-03)

- Le lien auteur d'une recette n'est jamais casse (sauf compte supprime, anonymise) : un auteur qui revient retrouve ses droits d'auteur sur ses recettes de l'espace.

## Questions pour le proprietaire (tranchees)

Toutes tranchees : la decision retenue est indiquee apres chaque question.

### P1 - Espace d'origine supprime alors que ses recettes sont partagees ailleurs : que deviennent-elles ?

- **Tranchee** : D83.

- **Rapatriees dans l'espace perso de l'auteur** (recommande) : L'auteur garde son contenu, partages et adaptations restent.
- Supprimees avec l'espace : Elles disparaissent de partout (restaurables 30 jours avec l'espace).
- Au choix de l'OWNER : L'ecran de suppression liste les recettes partagees ailleurs et l'OWNER choisit.

### P2 - Donnees d'un module desactive par l'OWNER ou retire par le super admin : combien de temps les garder ?

- **Tranchee** : D85.

- **Indefiniment, masquees** (recommande) : Reactiver redonne tout ; aucun risque de perte.
- 12 mois, avec preavis : Purge apres 12 mois, l'OWNER est prevenu et peut exporter.
- Supprimees a la desactivation : Apres confirmation forte de l'OWNER.

### P3 - Qui peut partager une recette dans un autre espace (D56) ?

- **Tranchee** : D56, amendee par D81.

- **L'auteur seulement** (recommande) : Les autres membres l'adaptent pour leur espace.
- Aussi les MOD / OWNER de l'espace d'origine : Utile pour diffuser une recette du groupe.
- Tout membre qui la voit : Le plus ouvert, mais l'auteur ne controle plus ou va son contenu.

### P4 - Catalogue des modules (D54) : qui le voit et qui demande ?

- **Tranchee** : D54.

- **Tous les membres le voient, l'OWNER demande** (recommande) : Les membres decouvrent les modules et peuvent en parler a l'OWNER.
- L'OWNER seul : Comme ecrit dans D33.
- Tout membre demande, l'OWNER valide avant envoi : Plus de demandes, une etape de plus.

### P5 - Role minimal par defaut pour modifier un repas du planning (D58) ?

- **Tranchee** : D58.

- **MEMBER** (recommande) : Tout le monde remplit le planning de la famille.
- MODERATOR : Seuls les moderateurs l'organisent ; les membres proposent des idees.

### P6 - Acces du super admin au contenu des espaces (D52) ?

- **Tranchee** : D52.

- **Pour une moderation, avec motif et audit** (recommande) : Equilibre entre vie privee et capacite d'agir.
- Libre, trace dans l'audit : Plus simple a operer, moins respectueux de la vie privee.
- Aucun acces : Seulement les signalements et les metadonnees ; impossible de verifier un contenu.

### P7 - Suppression du compte d'un OWNER (D51) ?

- **Tranchee** : D51.

- **Transfert automatique au plus ancien moderateur** (recommande) : Les groupes continuent sans intervention.
- Bloquee tant qu'il n'a pas transfere : Il doit choisir lui-meme un successeur pour chaque espace.
