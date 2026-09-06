# RunPlanner v0.6.7

Fichiers modifiés (par-dessus votre v0.6.6) :
- index.html
- service-worker.js
- css/style.css
- js/config.js (RP_VERSION → 0.6.7)
- js/ui.js
- js/loops.js

Content que le mode Route fonctionne bien mieux !

## 1. Marqueurs départ/arrivée/passage plus visibles
Ajout d'un halo blanc (contour épais) autour de chaque marqueur, quel que soit le fond de carte (satellite compris) — un simple remplissage fin se fondait trop facilement dans certains arrière-plans.

## 2. Adresse de l'arrivée affichée automatiquement
Quand vous placez l'arrivée via le menu d'appui long (ou via la géolocalisation pour le départ), l'adresse est maintenant retrouvée automatiquement et affichée dans le champ correspondant — même logique que ce qui existait déjà pour les points de passage.

## 3. Bouton "🔄 Inverser départ / arrivée"
Nouveau bouton sous les champs d'adresse : échange départ et arrivée (points, marqueurs, champs), et inverse aussi l'ordre des points de passage pour que le sens du parcours suive.

## 4. Fond encore visible à travers la poignée — changement d'approche complet
Le correctif ciblé de la v0.6.3 (coins arrondis sur l'élément sticky) n'a pas suffi. Plutôt que de continuer à corriger un rendu `position: sticky` + `overflow` + `border-radius` connu pour être capricieux selon les moteurs mobiles, la poignée est maintenant structurellement séparée de la zone qui défile (elle n'est plus "collante", juste un élément fixe au-dessus d'une zone de défilement distincte). Il n'y a donc plus aucune superposition à gérer, quel que soit le navigateur.

## 5. Comment fonctionne "Aller-retour" — vrai bug trouvé, pas juste un manque d'explication

En creusant votre remarque, j'ai trouvé la cause réelle de la confusion : **l'arrivée était totalement ignorée en mode Aller-retour**, même si vous en aviez placé une. Le point de retournement était toujours choisi au hasard, dans une direction complètement indépendante de l'arrivée que vous aviez pourtant définie — d'où l'impression que ça ne suivait aucune logique compréhensible.

Corrigé : si une arrivée est placée, l'aller-retour va maintenant jusque-là puis revient par le même chemin (l'arrivée devient le point de retournement). Sans arrivée placée, comportement inchangé : direction aléatoire sur la moitié de la distance cible. Une note explicative apparaît aussi désormais directement sous les boutons de sous-mode dans les panneaux Route et Chemins.

## À vérifier après déploiement
Badge de version → **v0.6.7**. Testez : placer une arrivée puis choisir "Aller-retour" (devrait maintenant y aller et revenir), le bouton Inverser, et la poignée sur fond satellite.
