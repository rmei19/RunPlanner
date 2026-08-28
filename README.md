# RunPlanner

Générateur de parcours de course à pied — Route / Chemins / Exercices structurés (fractionné, côtes, tempo). PWA installable, sans framework (HTML/CSS/JS ES6 purs), Leaflet + OpenStreetMap + OpenTopoMap, routage OpenRouteService avec bascule automatique vers BRouter.

## ⚠️ Déploiement — à faire AVANT tout test (leçon apprise avec RoadPlanner)

**Ne jamais ouvrir `index.html` en double-clic (`file://`)** : les tuiles de carte et les appels API sont bloqués par le navigateur sans serveur HTTP(S). Déployez sur GitHub Pages dès maintenant :

1. Créez un dépôt GitHub (public ou privé avec Pages activé selon votre offre) et poussez-y tout le contenu de ce dossier.
2. Dans le dépôt : **Settings → Pages → Source : Deploy from a branch**, branche `main`, dossier `/ (root)`.
3. Attendez 1-2 minutes, l'app est servie à `https://<votre-utilisateur>.github.io/<nom-du-repo>/`.

```bash
cd runplanner
git init
git add .
git commit -m "RunPlanner v0.1.0 — première version"
git branch -M main
git remote add origin https://github.com/<votre-utilisateur>/<nom-du-repo>.git
git push -u origin main
```

## Clé OpenRouteService

L'app route en priorité via OpenRouteService, puis bascule automatiquement sur BRouter (gratuit, sans clé) en cas d'échec. Pour activer ORS :

- Créez une clé gratuite sur [openrouteservice.org](https://openrouteservice.org/dev/#/signup).
- Actuellement il n'y a **pas de champ de saisie de clé dans l'interface encore branché à l'écran** (voir "Prochaines étapes" ci-dessous) — en attendant, ouvrez la console du navigateur et exécutez :
  ```js
  localStorage.setItem('rp_ors_key', 'VOTRE_CLE_ICI')
  ```
- Sans clé ORS, l'app fonctionne quand même intégralement via BRouter (bascule automatique).

## Structure du projet

```
runplanner/
├── index.html
├── manifest.json
├── service-worker.js
├── css/style.css
├── icons/icon-192.png, icon-512.png
└── js/
    ├── config.js       — constantes, clés, réglages
    ├── diagnostics.js  — panneau de diagnostic à l'écran
    ├── theme.js        — bascule clair/sombre
    ├── map.js          — Leaflet, fonds de carte, calques
    ├── geocoder.js      — Nominatim
    ├── routing.js       — ORS + BRouter, bascule auto
    ├── loops.js         — boucle, boucle aléatoire, aller-retour, A→B, points de passage
    ├── exercises.js      — fractionné, côtes, tempo/sortie longue/récupération
    ├── citytour.js      — POI via Wikipedia (+ Overpass en secours)
    ├── export.js        — GPX / TCX / FIT
    ├── ui.js            — câblage interface, étiquettes "bib" sur la carte
    └── app.js           — init défensive (try/catch par étape)
```

## Identité visuelle

Thème "piste d'athlétisme la nuit" : fond anthracite-vert profond, accent corail pour l'effort, menthe pour la récupération, jaune "balise de sentier" pour le mode Chemins et la visite citadine. Élément signature : les étiquettes de distance et de segment reprennent l'esthétique d'un **dossard de course** (bib tag), légèrement inclinées, réutilisées aussi bien pour les repères kilométriques que pour marquer "Effort 1 / Récup 1" en mode fractionné.

## État de cette V1 et prochaines étapes

Cette première livraison est fonctionnelle et testable (pas un prototype), mais certains points méritent un tour d'ajustement une fois en usage réel :

- **Champ de saisie de clé ORS** dans l'interface (réglages) — à ajouter à l'écran, la mécanique de stockage (`rp_ors_key`) existe déjà côté `config.js`.
- **Facteur de circuité** pour les boucles fixé empiriquement à 1.45 (voir `RP_CONFIG.routing.circuityFactor`) — à affiner avec des mesures réelles sur vos parcours, comme cela avait été fait pour le vélo (1.8).
- **Mode Côtes** : la détection de pente sonde 8 directions autour du départ ; sur terrain très plat, le résultat peut rester approximatif — un retour terrain aidera à caler le rayon de recherche.
- **Export FIT** : encodeur binaire minimal mais conforme au protocole (fichier "course" avec points de trace et laps) — testé sur la structure, à valider par un import réel sur une montre/appli compagnon.
- **Sélection des POI en visite citadine** : la liste est affichée et cliquable visuellement sur la carte, mais la sélection fine (cocher/décocher avant génération) n'est pas encore branchée — actuellement les 5 POI les plus proches sont pris automatiquement.

Pour les livraisons suivantes : ne fournir que les fichiers modifiés (sauf demande contraire), en gardant `RP_VERSION` (js/config.js) et `RP_SW_VERSION` (service-worker.js) synchronisés.
