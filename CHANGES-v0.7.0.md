# RunPlanner v0.7.0

Fichiers modifiés (par-dessus votre v0.6.7) :
- index.html
- service-worker.js
- css/style.css
- js/config.js (RP_VERSION → 0.7.0)
- js/ui.js
- js/map.js

Content que la poignée fonctionne bien maintenant !

## 1. Icône géolocalisation dans la barre du haut
Nouveau bouton 📍 à côté de la roue crantée ⚙️ — même action que "Me localiser" dans le volet, mais accessible directement sans avoir à ouvrir/faire défiler le volet.

## 2. Points de passage affichés entre départ et arrivée
Réorganisation des champs pour refléter l'ordre réel du parcours : Adresse de départ → Point de passage (+ liste) → Adresse d'arrivée → bouton Inverser. Avant, les points de passage apparaissaient après l'arrivée, dans le désordre par rapport au trajet réel.

## 3. "A → B" déplacé tout à gauche
Dans les panneaux Route et Chemins, le sous-mode "A → B" est maintenant le premier bouton de la liste (au lieu du 4ᵉ).

## 4. Distance cible conservée entre Route et Chemins
Les deux champs "Distance cible (km)" restent maintenant synchronisés en permanence : changer la valeur dans l'un met à jour l'autre. Avant, passer de Route à Chemins (ou l'inverse) affichait la valeur par défaut du mode visé au lieu de garder ce que vous aviez saisi.

## 5. Fond Hybride en premier dans la liste + contraste renforcé
"Hybride (satellite + routes/chemins)" apparaît maintenant en tête du sélecteur de calques (icône empilement, en haut à droite). L'opacité de la couche routes/chemins superposée au satellite est montée de 55% à 70% pour une meilleure distinction entre traits pleins (routes) et tirets (chemins).

Note : le fond de carte affiché **au démarrage** reste "Rues (OSM)" par défaut — je n'ai changé que l'ordre de la liste, pas le choix par défaut à l'ouverture. Dites-moi si vous voulez aussi que Hybride devienne le fond de démarrage.

## À vérifier après déploiement
Badge de version → **v0.7.0**.
