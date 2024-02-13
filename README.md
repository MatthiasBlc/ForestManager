# Forest Manager

## Table of contents

- [General info](#general-info)
- [Technologies](#technologies)
- [Project management](#project-management)
- [Prerequisites](#Prerequisites)
- [How to install](#How-to-install)
- [How to use](#How-to-use)
- [Features](#features)
- [Sources](#sources)

## General info

This application allows users to come together as a community and share information (recipes etc.).

## Technologies

![Javascript](https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E)
![Typescript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![NodeJS](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![ExpressJS](https://img.shields.io/badge/Express%20js-000000?style=for-the-badge&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Github-Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)

## Project management

https://trello.com/b/hTrvLdtQ/0-workflow

Live démo in production :

https://forest-manager.matthias-bouloc.fr

## Prerequisites

You need to add a docker-compose.yml for dev env:

```
services:
  postgres:
    image: postgres:13
    restart: always
    container_name: postgres
    hostname: postgres
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    volumes:
      - ./postgresql/data:/var/lib/postgresql/data
    networks:
      - proxy
    ports:
      - '5432:5432'
  backenddev:
    extends:
      file: common.yml
      service: backend
    ports:
      - "3000:3000"
  frontenddev:
    extends:
      file: common.yml
      service: frontend
    ports:
      - "8080:8080"
networks:
  proxy:
    external: true
```

You need to add an .env file:

```
# Postgres
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=

# Backend
PORT=
DATABASE_URL=postgresql://POSTGRES_USER:POSTGRES_PASSWORD@postgres:5432/POSTGRES_DB?schema=backend
SESSION_SECRET=
CORS_ORIGIN=

# Frontend
VITE_BACKEND_URL=
```

The postgresDB must exist in Postgres.

The docker network "proxy" must exist.

## How to install

1 - Clone this repo on your machine
2 - Open it in a Terminal
3 - Run this command to initialize the project :

```
npm run docker:build
```

## How to use

1 - Just run the following commands in your Terminal (inside the project's directory):
for detached version :

```
npm run docker:upd
```

Or for non-detached version:

```
npm run docker:up
```

And for stop the docker:

```
npm run docker:down
```

2 - You can access the project on the url : [http://localhost:8000/](http://localhost:8000/)

That's it!  
You have now access to this boiler plate! You can modify it as you wish for your projects.

## Features

You can:

- Create an account
- Login
- Logout

## Sources

This app is created and made by [MatthiasBlc](https://github.com/MatthiasBlc).
