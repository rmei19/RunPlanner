# RunPlanner v0.3.1 — la correction de distance ne convergeait pas du tout

Fichiers modifiés (par-dessus votre v0.3.0) :
- service-worker.js
- js/config.js (RP_VERSION → 0.3.1)
- js/loops.js

## Le bug (confirmé par vos captures)

Deux tentatives sur la même cible (12 km, mode Chemins, source BRouter — pas de clé ORS configurée) ont donné **3,23 km (-73%)** puis **24,62 km (+105%)**. Deux résultats aussi éloignés l'un de l'autre sur la même cible montraient que la "correction itérative" ajoutée en v0.3.0 ne convergeait en réalité jamais.

**Cause réelle** : à chaque tentative de correction, `theoreticalLoopPoints()` tirait de nouveaux angles ET une nouvelle irrégularité aléatoires — donc chaque tentative dessinait une forme de boucle complètement différente. Ajuster le rayon d'une forme, puis l'appliquer à une forme totalement différente à la tentative suivante, n'a aucun effet réel : ce n'était pas une correction, c'était un nouveau tirage aléatoire à chaque fois.

## Le correctif

La forme de la boucle (angles relatifs + irrégularité de chaque sommet) est maintenant tirée **une seule fois** par génération, puis conservée à l'identique d'une tentative à l'autre — seul le **rayon** est réajusté, au prorata de l'écart mesuré (avec un amortissement pour éviter les oscillations en terrain irrégulier). Cette fois, corriger le rayon a un effet réel et mesurable sur la distance obtenue.

En bonus : chaque tentative journalise maintenant dans le panneau 🩺 Diagnostic le rayon testé et l'écart obtenu, pour que vous puissiez suivre la convergence en direct si besoin. Le nombre maximal de tentatives passe aussi de 3 à 4 pour laisser un peu plus de marge de convergence sur les terrains difficiles.

## Limite à connaître

Sans clé ORS configurée, seul le repli polygone+correction s'applique (BRouter). Sur un relief très irrégulier, la relation rayon→distance réelle n'est jamais parfaitement linéaire : 4 tentatives amorties devraient rapprocher nettement le résultat de la cible, mais un écart résiduel de quelques % reste possible. Avec une clé ORS configurée, l'option `round_trip` native (déjà en place depuis v0.3.0) reste la voie la plus fiable quand elle est disponible.

## À vérifier après déploiement
Badge de version → **v0.3.1**. Reproduisez le même test (boucle Chemins, 12 km) et comparez : les tentatives successives dans le journal diagnostic devraient maintenant se rapprocher progressivement de la cible au lieu de sauter dans tous les sens.
