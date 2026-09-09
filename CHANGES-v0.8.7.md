# RunPlanner v0.8.7 — volet glissable

Fichiers modifiés (par-dessus votre v0.8.6) :
- service-worker.js
- css/style.css
- js/config.js (RP_VERSION → 0.8.7)
- js/ui.js

## Ce qui change
La poignée du volet du bas peut maintenant être **glissée** avec le doigt pour faire monter/descendre le volet, en plus du tap simple qui reste inchangé (ouvre/ferme d'un coup). Pendant le glissé, le volet suit le doigt en direct ; au relâchement, il se "cale" automatiquement sur l'état ouvert ou fermé selon la position où vous l'avez lâché — pas besoin d'atteindre pile la bonne position.

## Détail technique
- Utilise les Pointer Events (unifie souris/tactile).
- Un tap simple (mouvement minime) continue de basculer ouvert/fermé comme avant.
- Un vrai glissé désactive la transition CSS pendant le mouvement (pour suivre le doigt sans latence), puis la réactive au relâchement pour l'animation de calage.
- `touch-action: none` sur la poignée évite que le navigateur interprète le geste comme un défilement de page.

## À vérifier après déploiement
Badge de version → **v0.8.7**. Essayez de glisser la poignée vers le haut et vers le bas, et vérifiez que le tap simple fonctionne toujours normalement.
