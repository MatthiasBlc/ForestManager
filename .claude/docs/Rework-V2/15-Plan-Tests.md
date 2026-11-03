# Plan de tests V2

Statut : **PROPOSE** (roadmap B8), en attente de validation. Decisions nouvelles D77 a D79 en fin de document ; architecture de reference : `14-Architecture.md`.

## 1. Pyramide

| Niveau              | Ce qu'il verifie                                                                                                                                                                                                                                                | Outil                                            | Ou                                        | Volume vise                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------- | ----------------------------------------------- |
| **Unitaire**        | Logique pure : mise a l'echelle des recettes composees, conversions d'unites, detection des boucles et de la profondeur des blocs, calcul des permissions, algorithme de generation du planning, diff des revisions, parsing de l'import (JSON-LD, texte colle) | Vitest                                           | `packages/shared`, `apps/*/src/**/domain` | Le plus nombreux, rapide (< 10 s)               |
| **Integration API** | Chaque route : validation, permissions par role, regles metier, effets en base, notifications et activite emises                                                                                                                                                | Vitest + Supertest sur **vraie base PostgreSQL** | `apps/api/test`                           | Une suite par module et par domaine du socle    |
| **Composants**      | Ecrans et composants : rendu, etats (chargement, vide, erreur, hors ligne), interactions, accessibilite de base                                                                                                                                                 | Vitest + Testing Library + MSW                   | `apps/web/src/**/*.test.tsx`              | Composants du design system + ecrans principaux |
| **E2E**             | Parcours complets dans un vrai navigateur, front + API + base                                                                                                                                                                                                   | Playwright (+ axe)                               | `e2e/`                                    | Une quinzaine de parcours critiques             |

Regle : un comportement se teste au niveau **le plus bas** qui le prouve. Les E2E ne re-testent pas les regles deja couvertes en integration ; ils prouvent que les morceaux tiennent ensemble.

## 2. Outils [D77]

- **Vitest** partout (unitaires, integration, composants) : un seul lanceur, meme syntaxe que la V1.
- **Supertest** sur l'app Express sans ouvrir de port.
- **PostgreSQL de test** dans Docker (`docker compose -f docker/compose.test.yml`), migrations appliquees au demarrage, **base remise a zero entre fichiers de test** (TRUNCATE des tables hors referentiels), referentiels seedes une fois.
- **Testing Library** + `user-event` ; **MSW** pour simuler l'API, avec des handlers generes depuis les schemas Zod partages (les reponses mockees sont valides par construction).
- **Playwright** (Chromium, WebKit pour Safari iOS, emulation mobile 390x844 par defaut ; un projet desktop 1280x800) ; **@axe-core/playwright** pour l'accessibilite.
- Tous les tests tournent **dans Docker** en local, comme en V1 (les variables d'environnement n'existent pas hors conteneur).

## 3. Perimetre par domaine

### Socle

| Domaine                   | A couvrir                                                                                                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comptes                   | Inscription, connexion, "Rester connecte" (duree du cookie), deconnexion, verification d'email **avec et sans SMTP configure** [D21], mot de passe oublie, reinitialisation par admin, suppression de compte et anonymisation [D20], export perso [D37]                               |
| Espaces                   | Creation (espace perso automatique a l'inscription [D02]), un seul OWNER, transfert de propriete, depart, exclusion, promotion et retrogradation [D06], suppression avec delai de 30 jours et restauration [D22], export d'espace limite a un par jour et trace dans l'activite [D37] |
| Invitations               | Lien (expiration, nombre d'usages, revocation, jeton hache), invitation par username exact, absence d'enumeration des comptes [D07]                                                                                                                                                   |
| Modules                   | Recettes accorde et actif a la creation ; demande d'acces, acceptation et refus par le super admin, activation et desactivation par l'OWNER ; `MODULE_001` sur un module non accorde ou inactif [D33]                                                                                 |
| Permissions               | Pour chaque route : un test par role (OWNER, MODERATOR, MEMBER, non-membre, anonyme). La matrice B2 sert de table de cas generee automatiquement.                                                                                                                                     |
| Notifications et activite | Creation, groupement, preferences par categorie et par espace, temps reel                                                                                                                                                                                                             |
| Temps reel                | Un non-membre ne peut pas rejoindre la room d'un espace ; un membre exclu est retire de la room                                                                                                                                                                                       |
| Admin                     | 2FA obligatoire, session de 30 min, audit de chaque action, referentiels, catalogue de modules, file des demandes d'acces                                                                                                                                                             |
| Securite                  | CSRF, rate limiting, taille des corps, anti-SSRF de l'import a chaque redirection (serveur local de test qui redirige vers une IP privee)                                                                                                                                             |

### Module Recettes

- Contenu : blocs locaux et liens vers d'autres recettes, rendement, mise a l'echelle, refus des boucles et des profondeurs > 3 [D24].
- Partage par reference et partage automatique des sous-recettes [D03, D26] ; retrait d'un espace ; suppression avec liste des espaces touches.
- Adaptation liee : creation, badge "original modifie", ecran de comparaison [D17].
- Suggestions : acceptation -> nouvelle revision ; refus -> rien de cree ; conversion en adaptation ; tranchage par un moderateur si l'auteur est parti [D04, D18].
- Revisions en instantane JSON, restauration [D05, D30].
- Tags globaux et tags propres a chaque espace [D19, D27].
- Import par URL et par texte colle [D28] : jeux de pages et de textes reels fixes dans le depot (dont HelloFresh, cas V1).
- Compteurs : nombre de fois planifiee, derniere fois cuisinee [D39].

### Module Planning

- Repas configurables par espace [D11], grille, verrouillage, echange, idees de repas et conversion en recette.
- Generation : regles par tag et par recette, poids, frequences, cooldowns, exclusions, epinglages ; une recette "base" n'est jamais proposee seule [D24]. **Tests unitaires deterministes** de l'algorithme (graine aleatoire fixee) en plus de l'integration.

### Referentiels

- Conversions d'unites (dans une dimension et via le poids d'une unite pour un ingredient), rayons [D36], noms traduits avec repli sur le francais [D34], fusion de doublons d'ingredients par l'admin [D09].

### Front

- Design system : chaque composant dans ses etats, dans les **six themes** (rendu sans erreur, contraste verifie par axe).
- Gestes [D38] : fermeture de la feuille au glisser, appui long qui ouvre le menu d'actions (et son equivalent bouton), tirer pour rafraichir.
- Changement d'espace : la teinte de l'espace s'applique.

## 4. Parcours E2E critiques

Chaque parcours tourne en **mobile** (projet par defaut) ; ceux marques (D) tournent aussi en **desktop**.

1. Inscription, arrivee dans l'espace perso, premiere recette. (D)
2. Creer un espace, inviter par lien, le second compte rejoint par le lien.
3. Partager une recette perso dans un espace ; un membre la voit, ne peut pas la modifier, peut la suggerer.
4. Suggestion acceptee (nouvelle revision visible) puis suggestion refusee (rien de cree).
5. Adapter une recette pour un autre espace, modifier l'adaptation, l'original n'a pas bouge ; l'original change, le badge apparait, la comparaison s'ouvre.
6. Recette composee : lier une sauce, changer les portions, quantites recalculees ; modifier la sauce, le plat suit (lien vivant).
7. Importer une recette depuis une URL de test, corriger le formulaire, enregistrer.
8. OWNER demande l'acces au Planning, le super admin accepte, l'OWNER l'active, le module apparait dans la navigation. (D)
9. Remplir le planning a la main, verrouiller un repas, generer le reste de la semaine.
10. Un membre quitte l'espace ; ses recettes restent, reprises par un moderateur.
11. Supprimer un espace puis le restaurer dans le delai.
12. Hors ligne : ouvrir une recette et le planning, couper le reseau, recharger, tout reste lisible, les boutons de modification sont desactives avec le bandeau "Hors ligne".
13. Connexion admin avec 2FA, fusion de deux ingredients. (D)
14. Navigation au clavier seul sur les ecrans principaux (D) ; palette Ctrl K.
15. Changer d'ambiance et de mode dans Profil > Apparence ; le choix persiste apres reconnexion.

## 5. Donnees de test [D79]

- **Fabriques partagees** dans `packages/test-utils` (utilisateur, espace avec membres et roles, recette simple, recette composee, plan) utilisees par l'integration et par les seeds E2E.
- **Referentiels** : le meme seed que la prod (unites, conversions, rayons, tags globaux, modules), jamais de donnees de demo dans la prod.
- **E2E** : chaque parcours cree ses donnees par une route de test reservee a l'environnement `test` (`POST /api/v1/__test/scenario`, absente du build de prod, verifiee par un test), puis remise a zero.
- **Import** : pages HTML et textes de reference stockes dans `apps/api/test/fixtures/import/`, servis par un serveur local pendant les tests (aucun appel a Internet en CI).
- UUID "introuvable" : `00000000-0000-4000-8000-000000000000` (convention V1).

## 6. CI [D78]

Sur chaque push et chaque pull request :

| Etape                                               | Bloquant                                        |
| --------------------------------------------------- | ----------------------------------------------- |
| Lint + format (ESLint, Prettier)                    | Oui                                             |
| Typecheck de tout le monorepo                       | Oui                                             |
| Controle des cles i18n manquantes                   | Oui                                             |
| Unitaires + integration API (PostgreSQL de service) | Oui                                             |
| Composants (dont rendu des six themes)              | Oui                                             |
| E2E parcours critiques (Chromium mobile + desktop)  | Oui                                             |
| E2E WebKit (Safari)                                 | Oui sur `master`, informatif sur `Developement` |
| Couverture sous les seuils                          | Oui                                             |
| `npm audit` (vulnerabilites hautes et critiques)    | Oui                                             |

Les traces Playwright, captures et videos des echecs sont gardees comme artefacts de CI pendant 7 jours.

## 7. Cibles de couverture

Des seuils qui protegent sans pousser a tester pour le chiffre :

| Zone                              | Lignes | Branches |
| --------------------------------- | ------ | -------- |
| `packages/shared` (logique pure)  | 90 %   | 85 %     |
| `apps/api` (services et routes)   | 80 %   | 70 %     |
| `apps/web` (composants et ecrans) | 60 %   | 50 %     |

La matrice des permissions est couverte a **100 % des couples route x role** par les tests generes (section 3).

## 8. Accessibilite

- **axe** dans les E2E sur chaque ecran visite (zero violation "serious" ou "critical").
- **Contrastes** : un test unitaire relit `tokens.json` du design system et verifie, pour les six themes, les paires texte / fond a 4.5:1 et les bordures et le focus a 3:1 (la meme verification que celle faite a la creation des tokens).
- **Clavier** : parcours 14 ; focus visible, ordre logique, feuilles fermables avec Echap et focus rendu.
- **Lecteurs d'ecran** : noms accessibles des icones seules et des controles, verifies par Testing Library (`getByRole` avec `name`).
- **Cibles tactiles** : test de composants qui mesure les controles interactifs (>= 44 px).

## 9. Hors ligne et PWA

- **Composants** : etat "Hors ligne" simule (MSW en erreur reseau + `navigator.onLine` faux) : bandeau visible, mutations desactivees, donnees du cache affichees.
- **E2E** : parcours 12 avec `context.setOffline(true)` de Playwright ; verification que le service worker est enregistre et que la coquille se charge sans reseau.
- **Mise a jour** : nouveau build -> bandeau "Nouvelle version disponible" -> rechargement.
- **Persistance** : le cache TanStack Query survit au rechargement et expire apres 14 jours (horloge simulee).

## 10. Tests manuels

Une **feuille de recette** courte avant chaque mise en prod : installation sur un vrai iPhone et un vrai Android, gestes tactiles, mode cuisine (ecran allume), photo prise avec l'appareil, notifications temps reel entre deux appareils.

## 11. Decisions proposees

| #   | Decision                                                                                                                                                                                                                                                | Statut   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| D77 | Outils : Vitest partout, Supertest sur vraie base PostgreSQL remise a zero entre fichiers, Testing Library + MSW avec handlers issus des schemas Zod, Playwright mobile + desktop avec axe.                                                             | PROPOSEE |
| D78 | CI bloquante : lint, typecheck, cles i18n, unitaires, integration, composants, E2E critiques, couverture, `npm audit` ; WebKit bloquant sur `master` seulement ; seuils 90 / 80 / 60 % (shared / api / web).                                            | PROPOSEE |
| D79 | Donnees de test : fabriques partagees dans `packages/test-utils`, seed des referentiels identique a la prod, scenarios E2E crees par une route reservee a l'environnement de test, fixtures d'import servies localement (aucun appel a Internet en CI). | PROPOSEE |

## 12. Questions pour le proprietaire

- **Q-TEST-1 E2E en CI** : (a) parcours critiques a chaque push et PR [recommande, une quinzaine de parcours, quelques minutes] ; (b) seulement sur les PR vers `master` ; (c) la nuit uniquement.
- **Q-TEST-2 Navigateurs** : (a) Chromium + WebKit (Safari iOS) [recommande, l'app est surtout utilisee sur telephone] ; (b) Chromium seul ; (c) Chromium, WebKit et Firefox.
- **Q-TEST-3 Seuils de couverture** : (a) 90 / 80 / 60 % [recommande] ; (b) plus stricts (95 / 90 / 75 %) ; (c) pas de seuil bloquant, rapport seulement.
