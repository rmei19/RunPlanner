# RunPlanner v0.8.2

Fichiers modifiés (par-dessus votre v0.8.0 — la v0.8.1 n'avait pas pu être livrée suite à une erreur de mon côté, ce patch regroupe donc les deux) :
- index.html
- service-worker.js
- js/config.js (RP_VERSION → 0.8.2)
- js/ui.js
- js/loops.js
- js/map.js

## Le bug des exercices ("Cannot read properties of undefined (reading 'map')")

Trouvé. Dans `drawResult()`, la ligne `result.coords.map(...)` était appelée **inconditionnellement en tout début de fonction**, avant même de vérifier si le résultat contenait des segments. Or les résultats d'exercices (Fractionné, Côtes, Sortie longue, Tempo, Récupération) n'ont jamais de `coords` au niveau racine — seulement des `segments`, chacun avec son propre `coords`. Ce `.map()` plantait donc systématiquement, pour tous les types d'exercices sans exception, dès la première ligne du rendu.

Corrigé : ce calcul est déplacé dans la branche qui en a réellement besoin (les modes Route/Chemins sans segments).

## Tout le reste depuis la v0.8.0 (récapitulatif, déjà expliqué précédemment mais jamais livré)

1. **Tout le tracé en violet, même sans aller-retour** — la détection confondait n'importe quelle boucle fermée avec un aller-retour (toute boucle revient forcément près de son départ). Corrigée avec une vraie détection : un aller-retour doit revenir sur ses propres pas (la moitié du tronçon doit se superposer à l'autre moitié parcourue à l'envers), pas juste passer près d'un point déjà visité.
2. **Clic sans effet sur le tracé** — zone de clic invisible élargie (28px) sous le trait visible pour un tap plus fiable.
3. **Distances de base différentes (5 vs 8)** — les deux valeurs par défaut sont maintenant identiques (5 km).
4. **Échelle ajoutée au profil de dénivelé** — repères d'altitude (axe gauche) et de distance (axe bas).
5. **Fond Hybride** — opacité redescendue de 70% à 60% (70% semblait trop élevé), et un journal diagnostic a été ajouté en cas d'échec de chargement des tuiles OpenTopoMap, pour confirmer la cause si le souci persiste.

## À vérifier après déploiement
Badge de version → **v0.8.2**. Testez en priorité le mode Exercices (tous les types) — c'est le plus important de ce lot.
