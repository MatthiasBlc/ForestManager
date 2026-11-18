# Reference

Documents vivants du produit, tenus a jour a chaque decision [D221]. Le chantier en cours renvoie ici ; il ne les recopie pas.

| Fichier                    | Role                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `CDC.md`                   | Cahier des charges : la conclusion. Version et historique dans le fichier.               |
| `Journal-des-Decisions.md` | Decisions `D##` : le debat (constat, options, choix). Chercher le numero vu dans le CDC. |
| `Permissions.md`           | Matrice des permissions par acteur et par module.                                        |
| `Parcours.md`              | Parcours et inventaire des ecrans.                                                       |
| `Architecture.md`          | Stack, organisation du depot, infra, deploy.                                             |
| `Plan-Tests.md`            | Strategie de tests (TDD, Vitest, Playwright, accessibilite, feuille de recette).         |
| `Design-System.md`         | Regles du design system ; le code fait foi pour les jetons et les composants.            |

Le code fait foi pour le schema (`apps/api/prisma/schema.prisma`), les routes (`apps/api/src/**/routes.ts`) et le style (`apps/web/src/styles/`).

Un renvoi vers un fichier numerote (`23-Plan-C6b.md`, `16-Maquettes/`...) designe un document du chantier Rework V2, archive dans `../Archive/Rework-V2/`.
