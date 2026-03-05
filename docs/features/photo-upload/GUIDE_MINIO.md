# Guide MinIO - Installation et configuration

## Qu'est-ce que MinIO ?

MinIO est un serveur de stockage objet open-source, **100% compatible avec l'API S3 d'Amazon**.
Il permet de stocker des fichiers (images, documents...) et d'y acceder via HTTP.

### Concepts cles

| Concept | Equivalent simple | Exemple |
|---------|-------------------|---------|
| **Bucket** | Un dossier racine | `forestmanager-images-prod` |
| **Object** | Un fichier dans le bucket | `recipes/abc-123/cover.webp` |
| **Policy** | Regles d'acces (qui peut lire/ecrire) | Public read, private write |
| **Presigned URL** | URL temporaire avec autorisation integree | Upload direct depuis le navigateur |
| **Access Key / Secret Key** | Login / mot de passe pour l'API | Utilise par le backend |
| **Console** | Interface web d'administration | Gestion des buckets, users, policies |

### Pourquoi MinIO et pas S3/R2 ?

- **0 EUR** : tourne sur ton serveur existant
- **Pas de carte bancaire** : rien a souscrire
- **Meme API que S3** : si tu migres vers AWS S3 ou Cloudflare R2 plus tard, le code ne change quasiment pas (juste l'endpoint)
- **Leger** : ~128 MB de RAM
- **Pro** : utilise en production par des entreprises (RedHat, Nvidia, etc.)

---

## Architecture des environnements

```
LOCAL (ton PC)
  docker-compose.yml (ForestManager)
    ├── frontend
    ├── backend
    ├── postgres
    └── minio  <-- inclus dans la stack dev pour simplifier

VPS (preprod + prod)
  Stack "minio" (infra, comme Traefik)
    └── minio
          ├── bucket: forestmanager-images-preprod
          ├── bucket: forestmanager-images-prod
          └── (futurs projets)

  Stack "forestmanager-preprod"
    ├── frontend
    ├── backend  ── se connecte a MinIO via minio-net
    └── postgres

  Stack "forestmanager-prod"
    ├── frontend
    ├── backend  ── se connecte a MinIO via minio-net
    └── postgres
```

### Pourquoi cette separation ?

| | Local | VPS |
|--|-------|-----|
| MinIO | Dans la stack app (simplicite) | Stack separee (partage entre preprod/prod/futurs projets) |
| Raison | Un seul `docker compose up` pour tout demarrer | Meme instance, buckets separes, 1 seul process |

---

## 1. Installation locale (dev)

### Ajout au docker-compose.yml existant

```yaml
services:
  # ... services existants (frontend, backend, postgres) ...

  minio:
    image: minio/minio:latest
    container_name: forestmanager-minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"   # API S3
      - "9001:9001"   # Console web
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio-data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  # ... volumes existants ...
  minio-data:
```

### Acces local

| Service | URL |
|---------|-----|
| API S3 | `http://localhost:9000` |
| Console admin | `http://localhost:9001` |
| Login console | `minioadmin` / `minioadmin` |

### Configuration initiale (a faire une fois)

Apres le premier `docker compose up`, il faut creer le bucket et configurer la policy.
On utilise **`mc`** (MinIO Client), integre dans le container :

```bash
# Se connecter au container minio
docker exec -it forestmanager-minio sh

# Configurer l'alias local
mc alias set local http://localhost:9000 minioadmin minioadmin

# Creer le bucket dev
mc mb local/forestmanager-images-dev

# Rendre le bucket public en lecture (les images sont accessibles sans auth)
mc anonymous set download local/forestmanager-images-dev

# Verifier
mc ls local/
```

> **Alternative** : on peut automatiser ca avec un script d'init ou un container d'init
> dans le docker-compose (voir section "Automatisation" plus bas).

### Variables d'environnement backend (.env.development)

```env
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=forestmanager-images-dev
MINIO_PUBLIC_URL=http://localhost:9000
MINIO_USE_SSL=false
```

---

## 2. Installation VPS (preprod + prod)

### Stack MinIO (docker-compose.minio.yml)

A deployer via Portainer comme stack separee.

```yaml
version: "3.8"

services:
  minio:
    image: minio/minio:latest
    container_name: minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio-data:/data
    networks:
      - minio-net
      - traefik-net
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5
    labels:
      # API S3 (upload/lecture des images)
      - "traefik.enable=true"
      - "traefik.http.routers.minio-api.rule=Host(`s3.matthias-bouloc.fr`)"
      - "traefik.http.routers.minio-api.entrypoints=websecure"
      - "traefik.http.routers.minio-api.tls.certresolver=letsencrypt"
      - "traefik.http.routers.minio-api.service=minio-api"
      - "traefik.http.services.minio-api.loadbalancer.server.port=9000"
      # Console admin
      - "traefik.http.routers.minio-console.rule=Host(`minio.matthias-bouloc.fr`)"
      - "traefik.http.routers.minio-console.entrypoints=websecure"
      - "traefik.http.routers.minio-console.tls.certresolver=letsencrypt"
      - "traefik.http.routers.minio-console.service=minio-console"
      - "traefik.http.services.minio-console.loadbalancer.server.port=9001"

volumes:
  minio-data:

networks:
  minio-net:
    name: minio-net
  traefik-net:
    external: true
    name: traefik-net   # adapter au nom de ton reseau Traefik existant
```

### Variables d'environnement (dans Portainer)

```env
MINIO_ROOT_USER=<generer un identifiant fort>
MINIO_ROOT_PASSWORD=<generer un mot de passe fort, 32+ chars>
```

> **Important** : ces credentials sont le compte **root** de MinIO.
> On va creer des credentials limites par projet ensuite.

### Acces VPS

| Service | URL |
|---------|-----|
| API S3 | `https://s3.matthias-bouloc.fr` |
| Console admin | `https://minio.matthias-bouloc.fr` |

### Configuration initiale (via la console ou mc)

#### Option A : via la console web (`minio.matthias-bouloc.fr`)

1. Se connecter avec les credentials root
2. **Buckets** > Create Bucket :
   - `forestmanager-images-preprod`
   - `forestmanager-images-prod`
3. Pour chaque bucket > **Access** > Set to `public` (lecture seule)
4. **Identity** > Users > Create User :
   - Username : `forestmanager`
   - Password : `<generer un mot de passe fort>`
5. **Identity** > Policies > Create Policy : `forestmanager-policy`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::forestmanager-images-*",
        "arn:aws:s3:::forestmanager-images-*/*"
      ]
    }
  ]
}
```

6. Attacher la policy `forestmanager-policy` a l'utilisateur `forestmanager`

#### Option B : via mc (ligne de commande)

```bash
# Depuis ton PC ou le container minio
mc alias set vps https://s3.matthias-bouloc.fr <ROOT_USER> <ROOT_PASSWORD>

# Creer les buckets
mc mb vps/forestmanager-images-preprod
mc mb vps/forestmanager-images-prod

# Public read
mc anonymous set download vps/forestmanager-images-preprod
mc anonymous set download vps/forestmanager-images-prod

# Creer la policy (sauvegarder le JSON ci-dessus dans un fichier)
mc admin policy create vps forestmanager-policy policy.json

# Creer l'utilisateur projet
mc admin user add vps forestmanager <MOT_DE_PASSE_FORT>

# Attacher la policy
mc admin policy attach vps forestmanager-policy --user forestmanager
```

### Connexion depuis les stacks ForestManager

Dans chaque stack ForestManager (preprod/prod), ajouter le reseau externe :

```yaml
# docker-compose de ForestManager (preprod ou prod)
services:
  backend:
    # ... config existante ...
    networks:
      - default
      - minio-net

networks:
  minio-net:
    external: true
    name: minio-net
```

### Variables d'environnement backend

**Preprod :**
```env
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=forestmanager
MINIO_SECRET_KEY=<mot de passe du user forestmanager>
MINIO_BUCKET=forestmanager-images-preprod
MINIO_PUBLIC_URL=https://s3.matthias-bouloc.fr
MINIO_USE_SSL=false
```

**Prod :**
```env
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=forestmanager
MINIO_SECRET_KEY=<mot de passe du user forestmanager>
MINIO_BUCKET=forestmanager-images-prod
MINIO_PUBLIC_URL=https://s3.matthias-bouloc.fr
MINIO_USE_SSL=false
```

> **Note** : `MINIO_ENDPOINT=minio` car le backend communique via le reseau Docker interne.
> `MINIO_USE_SSL=false` car le TLS est termine par Traefik, pas par MinIO.
> `MINIO_PUBLIC_URL` utilise le domaine public car c'est l'URL que le frontend/navigateur utilise.

---

## 3. Automatisation de l'init locale

Pour eviter la config manuelle a chaque `docker compose up` en dev, on peut ajouter un container d'init :

```yaml
  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 minioadmin minioadmin &&
      mc mb --ignore-existing local/forestmanager-images-dev &&
      mc anonymous set download local/forestmanager-images-dev &&
      echo 'MinIO init done'
      "
    networks:
      - default
```

Ce container :
- Attend que MinIO soit healthy
- Cree le bucket s'il n'existe pas
- Configure la policy public read
- S'arrete automatiquement apres execution

---

## 4. Securite

### Console admin

La console (`minio.matthias-bouloc.fr`) donne acces a toute l'administration.
Pour la proteger davantage, options possibles :

- **IP whitelist** via Traefik middleware (uniquement ton IP)
- **Basic auth** Traefik en plus du login MinIO
- **Desactiver l'exposition** et n'y acceder que via tunnel SSH (`ssh -L 9001:localhost:9001 vps`)

Recommandation minimale : credentials root forts (32+ chars) + HTTPS via Traefik.

### Credentials

| Niveau | Usage | Scope |
|--------|-------|-------|
| Root (`MINIO_ROOT_USER`) | Administration MinIO | Tout (ne jamais utiliser dans l'app) |
| Projet (`forestmanager`) | Backend ForestManager | Buckets `forestmanager-images-*` uniquement |

### Pas de donnees sensibles dans les images

Les images sont en public read. Ne jamais stocker de donnees sensibles comme "images" dans MinIO.

---

## 5. Backups

### Strategie minimale (actuelle)

Les snapshots VPS couvrent les volumes Docker, donc les donnees MinIO sont incluses.

### Amelioration future (optionnelle)

```bash
# Exporter tout le bucket vers un dossier local
mc mirror vps/forestmanager-images-prod ./backup/minio-prod/

# Ou vers un autre MinIO / S3
mc mirror vps/forestmanager-images-prod backup/forestmanager-images-prod
```

Peut etre automatise via un cron sur le VPS.

---

## 6. Depannage

### Le backend ne se connecte pas a MinIO

```bash
# Verifier que le container minio tourne
docker ps | grep minio

# Verifier le reseau
docker network inspect minio-net

# Tester la connexion depuis le container backend
docker exec -it forestmanager-backend sh
wget -qO- http://minio:9000/minio/health/live
```

### Les images ne s'affichent pas (404)

1. Verifier que le bucket existe : console MinIO ou `mc ls local/`
2. Verifier la policy public read : `mc anonymous get local/forestmanager-images-dev`
3. Verifier que l'objet existe : `mc ls local/forestmanager-images-dev/recipes/`
4. Verifier `MINIO_PUBLIC_URL` dans les variables d'env

### Reset complet en dev

```bash
# Supprimer le volume et recommencer
docker compose down -v  # attention : supprime aussi postgres !
# Ou juste le volume minio :
docker volume rm forestmanager_minio-data
docker compose up -d minio
```

---

## Resume des URLs par environnement

| Env | API S3 (backend) | API S3 (public) | Console |
|-----|-------------------|-----------------|---------|
| Local | `http://minio:9000` | `http://localhost:9000` | `http://localhost:9001` |
| VPS | `http://minio:9000` | `https://s3.matthias-bouloc.fr` | `https://minio.matthias-bouloc.fr` |
