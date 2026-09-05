# RunPlanner v0.6.3

Fichiers modifiés (par-dessus votre v0.6.2) :
- index.html
- service-worker.js
- css/style.css
- js/config.js (RP_VERSION → 0.6.3)
- js/ui.js
- js/map.js

## 1. Géolocalisation qui échoue sans rien demander

Votre journal montre "User denied Geolocation" dès le tout premier essai, sans jamais afficher de fenêtre de permission. C'est un comportement **normal du navigateur**, pas un bug de l'application : une fois qu'une autorisation de localisation a été refusée pour un site, le navigateur mémorise ce choix et ne réaffiche plus JAMAIS la demande de son propre chef — aucun code JavaScript ne peut forcer un nouveau prompt. Il faut réautoriser manuellement dans les réglages du site (icône 🔒 ou ⓘ à côté de l'adresse dans Brave, puis "Autorisations" → Localisation → Autoriser).

Le vrai problème corrigé ici : cette explication n'apparaissait auparavant que dans le journal diagnostic, peu visible. Un message clair apparaît maintenant directement sous le bouton "📡 Me localiser" quand ce cas précis est détecté, avec la marche à suivre.

## 2. Poignée du volet transparente sur fond satellite

Cause probable : `position: sticky` combiné à `overflow` + coins arrondis sur l'élément parent est un cas connu où certains moteurs mobiles ne "clippent" pas parfaitement l'élément collant à la forme arrondie une fois qu'il se fixe en haut — ses coins peuvent légèrement déborder et laisser voir la carte derrière. Invisible sur les fonds OSM plats, mais très visible sur le fond satellite (image très texturée) ajouté en v0.6.0 — ce qui explique que vous ne l'ayez remarqué que maintenant.

Corrigé en donnant à la poignée elle-même les mêmes coins arrondis que le volet (ses coins restent opaques quoi qu'il arrive), et en rendant la petite barre de la poignée plus contrastée (elle utilisait une couleur à 10% d'opacité, pensée pour de fins séparateurs, pas pour un élément qui doit rester bien visible).

## À vérifier après déploiement
Badge de version → **v0.6.3**. Pour la géolocalisation : réautorisez-la dans les réglages du site puis rechargez pour confirmer que le message disparaît et que le prompt refonctionne. Pour la poignée : vérifiez sur le fond satellite qu'elle reste bien opaque.
