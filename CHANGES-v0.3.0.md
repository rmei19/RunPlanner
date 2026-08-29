# RunPlanner v0.3.0 — 4 correctifs suite au test terrain (Laguiole)

Fichiers modifiés (par-dessus votre v0.2.1) :
- service-worker.js
- css/style.css
- js/config.js (RP_VERSION → 0.3.0)
- js/routing.js
- js/loops.js
- js/ui.js
- js/diagnostics.js

## 1. Boucles bien plus longues que demandé + aller-retours (7 km → 15,28 km, +118%)

C'est un vrai défaut de conception, pas juste un réglage à affiner. L'ancien algorithme plaçait des points au hasard sur un cercle théorique autour du départ et demandait au routeur de les relier. En zone rurale/vallonnée comme autour de Laguiole, le réseau routier ne va pas où l'on veut : le routeur est alors forcé de faire des allers-retours pour atteindre un point mal desservi, d'où le message "chevauchement" et la distance qui explose.

Deux changements :
- **Boucle native OpenRouteService** (option `round_trip`) utilisée en priorité si une clé ORS est configurée : c'est ORS lui-même qui choisit un itinéraire circulaire réaliste sur le réseau routier, beaucoup plus fiable que des points choisis à l'aveugle.
- **Correction itérative** en repli (BRouter, ou pas de clé ORS) : si la distance obtenue s'écarte de plus de 12% de la cible, le rayon est automatiquement recalculé au prorata pour la tentative suivante — jusqu'à 3 tentatives, et c'est la meilleure (le moins de chevauchement, puis l'écart le plus faible) qui est gardée, au lieu de renvoyer telle quelle la première tentative même mauvaise.

Sans clé ORS configurée, seul le repli polygone+correction s'applique (pas de round_trip) — le résultat devrait déjà être bien meilleur qu'avant, mais reste plus fiable avec une clé ORS. Pour en configurer une : voir le README du projet (`localStorage.setItem('rp_ors_key', 'VOTRE_CLE')` dans la console du navigateur).

## 2. Étiquettes de kilomètres illisibles

Bug réel et simple : la couleur du texte des étiquettes "3 km" était une couleur presque blanche fixe (`#F4F1E8`), qui devenait invisible sur le fond clair du thème clair (texte quasi-blanc sur étiquette quasi-blanche). Corrigé : la couleur s'adapte maintenant automatiquement au thème actif (sombre ou clair).

## 3. Panneau diagnostic qui ne s'ouvre pas

Le clic n'était détecté que sur le petit texte "🩺 Diagnostic", pas sur le badge de version à côté (qui ressemble pourtant à un bouton, et sur lequel on tape naturellement). Corrigé : tout le bandeau réagit désormais au tap, avec une hauteur minimale de 44 px (cible tactile recommandée).

## 4. Bas du panneau de sélection caché derrière le diagnostic

Le volet du bas n'avait aucune marge réservée pour la barre de diagnostic fixée en bas d'écran, qui venait donc recouvrir ses derniers éléments. Une marge basse est maintenant réservée dans le volet pour que tout reste accessible même quand le diagnostic est affiché.

## À vérifier après déploiement
Badge de version dans 🩺 Diagnostic → doit afficher **v0.3.0**. Testez une boucle sur le même point de départ qu'avant (Laguiole) pour comparer l'écart de distance.
