on:
push:
branches: [master]
pull_request:
branches: [master]

je voudrais au final que dans la situation du push:
branches: [master], tout se passe comme écrit ici

Dans le cas de

pull_request:
branches: [master]

Je voudrais que le deploy utilise des variables env différentes sur github action pour :
STACK_ID -> DEV_STACK_ID

J'ai une seconde stack avec un docker-compose web sur portainer.
Je change le label dessus en preprod.forestmanager.matthias-bouloc.fr
j'ajoute -dev devant le nom de tous les éléments de la stack pour ne pas avoir de doublon avec la stack de prod.

Ainsi j'ai une preprod qui s'active on pull request pour faire des tests et quand je valide la pull request et que je push sur master, on actualise la prod.
