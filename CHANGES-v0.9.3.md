# RunPlanner v0.9.3

- Ajout de « Indique le chemin » et « Planifier un évènement » dans le menu Tempo.
- Distance cible par défaut passée à 9 km pour Route et Chemins.
- Une nouvelle recherche de départ remplace réellement l'ancien départ, efface le tracé calculé et recentre la carte.
- Ajout de l'orientation des boucles : aléatoire, Nord, Est, Sud, Ouest.
- Les boucles orientées utilisent une génération géométrique contrôlée afin de respecter le cap choisi.
- Détection des portions en aller-retour renforcée et pénalisation plus forte des chevauchements lors du choix de la meilleure tentative.
- Mode Chemins : BRouter/trekking est privilégié pour les trajets A→B et les boucles polygonales ; ORS reste en secours avec préférence pour des itinéraires calmes/verts.
- Service worker incrémenté en v0.9.3 pour forcer la prise en compte des nouveaux fichiers.
