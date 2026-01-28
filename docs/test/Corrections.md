Je veux une Home page (pour l'instant vide, un placeholder / message suffira), pas de redirection de cette dernière vers le signin

je veux changer le logo de la page actuellement c'est celui de vite. Je préfère rien qu'un logo qui n'a rien à voir.

Page sign up,

- centrer le formulaire sur la page
- en production lorsque je remplie le formulaire j'ai cette erreur : - Cannot read properties of undefined (reading 'status') - et en console : Failed to load resource: net::ERR_TOO_MANY_REDIRECTS - led to load resource: net::ERR_TOO_MANY_REDIRECTS
  index-DXdYoww4.js:72
  Se
  code
  :
  "ERR_NETWORK"
  config
  :
  {transitional: {…}, adapter: Array(3), transformRequest: Array(1), transformResponse: Array(1), timeout: 0, …}
  event
  :
  ProgressEvent {isTrusted: true, lengthComputable: false, loaded: 0, total: 0, type: 'error', …}
  message
  :
  "Network Error"
  name
  :
  "AxiosError"
  request
  :
  XMLHttpRequest {onreadystatechange: null, readyState: 4, timeout: 0, withCredentials: true, upload: XMLHttpRequestUpload, …}
  stack
  :
  "AxiosError: Network Error\n at N.onerror (https://forestmanager.matthias-bouloc.fr/assets/index-DXdYoww4.js:69:6204)\n at ar.request (https://forestmanager.matthias-bouloc.fr/assets/index-DXdYoww4.js:71:2094)\n at async ot.signUp (https://forestmanager.matthias-bouloc.fr/assets/index-DXdYoww4.js:72:8671)\n at async https://forestmanager.matthias-bouloc.fr/assets/index-DXdYoww4.js:72:11695\n at async T (https://forestmanager.matthias-bouloc.fr/assets/index-DXdYoww4.js:76:36599)\n at async https://forestmanager.matthias-bouloc.fr/assets/index-DXdYoww4.js:40:77158"
  [[Prototype]]
  :
  Error

En local, lorsque je me connecte, j'arrive sur une page qui semble charger à l'infini et qui prends de plus en plus de ressources.

le menu sur la gauche est intéressant, il faudrait un bouton type burger permettant de faire passer ce menu d'une version complète et étendue (comme il est maintenant) à une version compacte et réduite, avec seulements quelques pictos.
