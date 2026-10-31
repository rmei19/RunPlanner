# RunPlanner 0.9.6

- Suivi du profil optimisé : distances cumulées préparées une fois, recherche dichotomique pour positionner le curseur et le point carte.
- Les valeurs D+ / D- ne sont plus recalculées à chaque mouvement du doigt.
- Détection des portions en aller-retour : échantillonnage par distance parcourue plutôt que par indices de coordonnées, afin de mieux tolérer les différences de densité entre aller et retour.
- Version de l’application et cache service worker synchronisés en 0.9.6.

À tester sur téléphone et sur plusieurs parcours réels : la détection géométrique reste une heuristique, pas une preuve parfaite de réutilisation d’un chemin.
