# RunPlanner v0.6.4

Fichiers modifiés (par-dessus votre v0.6.3) :
- index.html
- service-worker.js
- js/config.js (RP_VERSION → 0.6.4 + fond hybride)
- js/ui.js
- js/map.js

## 1. Clic sur la carte : plus rien ne se passe (sauf clic long / clic droit)

C'était explicitement demandé : avant, un simple clic déplaçait le départ par défaut, ce qui devenait chaotique dès qu'on cliquait sur la carte juste pour l'explorer. Les boutons "Placer le départ / l'arrivée / Point de passage" et tout le mécanisme associé ont été retirés. Le placement se fait maintenant uniquement via :
- la recherche d'adresse (départ / arrivée / point de passage), ou
- l'appui long (mobile) / clic droit (desktop), qui ouvre le menu Départ / Arrivée / Point de passage / Retirer.

Un simple clic sur la carte ne fait plus rien.

## 2. Fond de carte Hybride amélioré (d'après votre exemple Komoot)

Le premier essai (satellite + repères Esri "Boundaries and Places") n'affichait que des noms de lieux et frontières administratives — pas le réseau routes/chemins lui-même. Remplacé par satellite + OpenTopoMap superposé à 55% d'opacité : OpenTopoMap distingue déjà nativement les routes (traits pleins) des sentiers/chemins (tirets), ce qui donne un rendu "satellite + tracé clair routes vs chemins" proche de votre exemple.

## Sur "Route prend des chemins" — confirmation qu'il n'y a pas de correctif possible côté paramétrage

J'ai vérifié dans la documentation technique d'OpenRouteService : l'option qui aurait permis de dire explicitement "évite les routes non goudronnées" (`avoid_features: unpavedroads`) existait autrefois sur leur API, mais **a été retirée côté serveur** par l'équipe d'ORS elle-même (ils l'ont documenté publiquement : la donnée OSM sous-jacente était jugée trop incomplète pour ce filtre). Ce n'est donc pas un réglage que j'ai simplement oublié d'activer — il n'existe plus sur l'API publique, quel que soit le profil utilisé. Je préfère vous le confirmer clairement plutôt que de laisser la question ouverte.

## À vérifier après déploiement
Badge de version → **v0.6.4**. Testez que le clic simple sur la carte est bien neutre, et jetez un œil au nouveau rendu du fond Hybride.
