# RunPlanner v0.8.8 — boucle avec un seul point de passage

Fichiers modifiés (par-dessus votre v0.8.7) :
- service-worker.js
- js/config.js (RP_VERSION → 0.8.8)
- js/loops.js

Content que la poignée fonctionne bien !

## Le problème
Avec un seul point de passage ajouté, "Boucle" générait quasi systématiquement un aller-retour pur (départ → point → retour par le même chemin), sans aucune autre option possible. Cause : avec exactement un point entre le départ et le retour, rien ne force géométriquement le routeur à emprunter un chemin différent à l'aller et au retour — un aller-retour est la solution la plus courte et la plus naturelle dans ce cas précis.

## Le correctif
Avec un seul point de passage (et uniquement dans ce cas — à partir de 2 points, une vraie forme de boucle existe déjà naturellement), un point de déviation synthétique est maintenant inséré automatiquement, perpendiculairement à l'axe départ→point, pour donner au routeur une raison de tracer un chemin de retour différent plutôt que de revenir sur ses pas.

## Filet de sécurité déjà en place
Si le réseau routier local est vraiment trop clairsemé pour permettre une vraie boucle même avec ce point de déviation (comme observé sur le test à Annoisin), la fonctionnalité de troncature (v0.8.0) reste disponible : toute portion résiduelle en aller-retour s'affichera en violet sur la carte et pourra être coupée d'un tap.

## À vérifier après déploiement
Badge de version → **v0.8.8**. Testez à nouveau une boucle avec un seul point de passage.
