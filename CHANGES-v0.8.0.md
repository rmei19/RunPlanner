# RunPlanner v0.8.0 — sélection et troncature des portions en aller-retour

Fichiers modifiés (par-dessus votre v0.7.1) :
- service-worker.js
- js/config.js (RP_VERSION → 0.8.0)
- js/ui.js
- js/loops.js

## La nouvelle fonctionnalité demandée

Jusqu'ici, RunPlanner détectait les portions en aller-retour indésirables mais se contentait d'un avertissement global ("il y a un chevauchement quelque part"). Impossible d'agir dessus précisément.

**Maintenant :**
- La détection identifie les bornes exactes de chaque portion en aller-retour (pas juste "il y en a"), et le nombre de mètres qu'elle représente.
- Chaque portion détectée s'affiche sur la carte en **violet à tirets**, avec une info-bulle au survol.
- **Appuyez dessus** : un petit menu propose "✂️ Tronquer ce tronçon" avec le nombre de mètres qui seraient économisés.
- En confirmant, le tronçon est retiré du tracé, la distance recalculée, et l'affichage (carte, résumé, étiquettes km, profil de dénivelé) se met à jour immédiatement. Si d'autres portions en aller-retour subsistent après troncature, elles restent affichées et tapables — vous pouvez répéter l'opération.

Le message dans le résumé a été mis à jour en conséquence : "⚠️ Portion(s) en aller-retour détectée(s) — appuyez sur le tracé en tirets violets pour les tronquer."

Cette détection/troncature ne s'applique pas au mode **Aller-retour volontaire** (Départ → Arrivée → Départ) — puisque là, le "chevauchement" est le principe même du mode, pas un défaut.

## Détail technique (pour votre information)
La détection identifie les paires de points du tracé qui repassent à moins de 15 m l'un de l'autre (avec au moins 3 points d'écart entre les deux, pour ne pas confondre un point normal avec lui-même) : tout ce qui se trouve entre les deux est proposé à la troncature. Sur un tracé anormalement long (plus de 2000 points), cette recherche précise est désactivée par précaution de performance et seul l'avertissement global reste actif.

## À vérifier après déploiement
Badge de version → **v0.8.0**. Générez une boucle qui produit un aller-retour (comme celle du test à Annoisin), et essayez de tronquer la portion en violet.
