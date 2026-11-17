# Bugsink (suivi d'erreurs)

Recepteur des erreurs de l'API et du navigateur [D75, D196]. Compatible avec les
SDK Sentry. Un seul Bugsink sert la preprod et la prod, un projet par
environnement. Rien ici n'est deploye par la CI.

## Mise en place (une fois, depuis Portainer)

1. Verifier sur Docker Hub (`bugsink/bugsink`) que la version de `compose.yml`
   a plus de deux semaines, et que `/health/ready` existe toujours (sinon
   adapter le healthcheck).
2. Creer une stack `bugsink` avec `compose.yml` et deux variables :
   - `BUGSINK_SECRET_KEY` : `openssl rand -base64 50` ;
   - `BUGSINK_CREATE_SUPERUSER` : `adresse@exemple.fr:motdepasse` (le compte
     n'est cree que si la base est vide ; changer le mot de passe ensuite).
3. DNS : `bugsink.matthias-bouloc.fr` vers Traefik (comme les autres hotes).
4. Se connecter, creer deux projets : `forestmanager-preprod` et
   `forestmanager-prod`. Copier le DSN de chacun.
5. Secrets GitHub du depot : `DEV_SENTRY_DSN` (preprod) et `SENTRY_DSN` (prod).
   Facultatifs : sans DSN, le suivi est coupe et l'application tourne normalement.
6. Apres le deploy suivant : admin, Reglages (A13), "Envoyer un evenement de
   test" ; l'evenement doit apparaitre dans le projet de l'environnement.

## Fonctionnement

- L'API envoie ses erreurs 5xx et ses rejets non geres directement au DSN.
- Le navigateur envoie au tunnel de l'API (`POST /api/v1/monitoring`), qui
  remplace un DSN factice par le vrai : le front ne connait pas le DSN.
- Aucune donnee personnelle : ni corps de requete, ni cookies, ni IP ;
  l'utilisateur n'est qu'un UUID.
- L'API joint Bugsink par son adresse publique (HTTPS par Traefik). Si le
  serveur ne sait pas se joindre lui-meme par son adresse publique, mettre le
  backend sur le reseau `proxy` et utiliser un DSN en `http://<cle>@bugsink:8000/<projet>`.

## Sauvegarde

La base SQLite est dans le volume `bugsink_data`. La perdre ne fait perdre que
l'historique des erreurs.
