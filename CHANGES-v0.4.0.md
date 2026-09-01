# RunPlanner v0.4.0 — 5 correctifs + panneau de réglages

Fichiers modifiés (par-dessus votre v0.3.1) :
- index.html
- service-worker.js
- css/style.css
- js/config.js (RP_VERSION → 0.4.0)
- js/ui.js
- js/app.js
- **js/settings.js (NOUVEAU fichier)**

## 1. Bouton "−" de zoom caché derrière le diagnostic
La barre de diagnostic (fixe, pleine largeur, en bas de l'écran) recouvrait le coin bas-droit où Leaflet place ses boutons de zoom. Les contrôles Leaflet sont maintenant remontés de la hauteur de la barre repliée.

## 2. Poignée du volet du bas qui ne reste pas fixe
Elle faisait partie du contenu défilant du volet, donc elle disparaissait en scrollant. Elle est maintenant "collante" (`position: sticky`) en haut du volet, visible et tappable en permanence.

## 3 et 4. Points de passage : disparition à l'ajout + pas de clic long pour ajouter/retirer

**Cause du "disparaît"** : après avoir choisi une adresse dans le champ "Point de passage", le champ se vidait immédiatement sans aucune autre confirmation visuelle — le point était bien pris en compte, mais rien ne le montrait, d'où l'impression qu'il avait disparu.

Corrigé avec une refonte plus complète :
- Une **liste persistante** apparaît désormais sous le champ de recherche, avec chaque point de passage nommé et un bouton ✕ pour le retirer individuellement.
- **Clic long sur la carte** (ou clic droit sur desktop) pour ajouter un point de passage à tout moment, sans devoir d'abord presser le bouton — et **refaire un clic long sur un point existant le retire**. C'est le geste qui manquait complètement.
- Le bouton "➕ Point de passage" + clic simple reste disponible aussi, avec la même logique ajout/retrait si vous cliquez près d'un point déjà placé.

Sur le "calcul étrange" : je n'ai pas pu isoler de bug distinct dans le calcul de boucle par points de passage lui-même (`generateWaypointLoop`) — il route simplement à travers les points fournis dans l'ordre. Il est possible que ce que vous avez observé venait justement du point "disparu" qui était en réalité toujours pris en compte à un endroit inattendu. Si le calcul reste étrange une fois les points bien visibles et confirmés, dites-moi précisément quel résultat vous obtenez (capture + points placés) et je creuserai plus loin.

## 5. Pas d'interface de réglages
Ajout d'un bouton ⚙️ dans la barre du haut, ouvrant un panneau où configurer la clé API OpenRouteService (jusqu'ici modifiable uniquement via la console du navigateur). Le panneau indique clairement si une clé est active ou non, avec un lien direct pour en obtenir une gratuitement.

## À vérifier après déploiement
Badge de version → **v0.4.0**. Testez : clic long sur la carte pour ajouter un point de passage, puis à nouveau dessus pour le retirer ; ouvrez ⚙️ Réglages pour configurer votre clé ORS si vous en avez une.
