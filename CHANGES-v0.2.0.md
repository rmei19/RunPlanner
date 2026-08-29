# RunPlanner v0.2.0 — correctifs

Fichiers modifiés dans ce zip (à copier par-dessus votre v0.1.0, structure identique) :
- index.html
- service-worker.js
- css/style.css
- js/config.js (juste RP_VERSION → 0.2.0)
- js/theme.js
- js/map.js
- js/ui.js

## Corrections

**1. Thème sombre/clair système non fonctionnel**
Cause réelle : `RPTheme.init()` était appelé deux fois (dans `app.js` ET dans `ui.js`), donc deux écouteurs de clic étaient attachés au bouton — chaque clic basculait le thème deux fois de suite, ce qui annulait le changement visuellement. Corrigé : un seul appel (dans `app.js`). En bonus, l'app suit maintenant automatiquement le thème système tant que vous n'avez pas cliqué vous-même sur le bouton ; dès que vous cliquez, votre choix devient permanent et n'est plus écrasé par le système.

**2. Impossible de définir un point en cliquant sur la carte**
Cause probable : dans `ui.js`, `initMapClickHandling()` faisait `RPMap.getMap().on(...)` sans vérifier que la carte existait. Si une étape précédente de l'initialisation échouait pour une raison quelconque, toute la suite de `RPUi.init()` s'arrêtait net — y compris le clic carte, le bouton Générer et les exports. `RPUi.init()` exécute maintenant chaque étape dans son propre bloc try/catch : une panne isolée n'empêche plus le reste de fonctionner, et le panneau de diagnostic (🩺 en bas) journalise précisément quelle étape a échoué le cas échéant.
Le comportement du clic est aussi clarifié : par défaut chaque clic sur la carte déplace le point de **départ**. Pour placer l'arrivée ou un point de passage, cliquez d'abord sur le bouton correspondant (🏁 Placer l'arrivée / ➕ Point de passage) — un texte d'aide au-dessus de la carte indique le mode actif.

**3. Pas de positionnement géographique automatique**
Ajouté : géolocalisation automatique au chargement (GPS si disponible, sinon réseau/Wi-Fi — c'est le navigateur qui choisit la meilleure source disponible), avec un cercle de précision affiché sur la carte. Le point de départ est placé automatiquement sur votre position tant que vous n'avez rien choisi vous-même. Un bouton **📡 Me localiser** permet de relancer la détection à tout moment (utile si vous avez refusé la permission au premier chargement, ou si vous avez bougé).
Note : la géolocalisation nécessite HTTPS — fonctionne sur GitHub Pages, pas en ouverture locale `file://`.

**4. Pas de champ d'arrivée ou de point de passage**
Ajouté : deux nouveaux champs de recherche d'adresse dédiés ("Adresse d'arrivée", "Point de passage"), avec autocomplétion Nominatim, en plus du champ de départ existant. Le champ "Point de passage" reste utilisable plusieurs fois de suite pour ajouter plusieurs points.

## Après déploiement
Videz le cache / forcez le rafraîchissement (ou attendez que le service worker se mette à jour tout seul) pour être sûr de charger la v0.2.0 — vérifiez le badge de version dans le panneau 🩺 Diagnostic en bas de l'écran.
