# RunPlanner v0.6.0 — 6 demandes traitées

Fichiers modifiés (par-dessus votre v0.5.0) :
- index.html
- service-worker.js
- css/style.css
- js/config.js (RP_VERSION → 0.6.0 + fonds de carte satellite/hybride)
- js/ui.js
- js/map.js

## 1. Clic long / clic droit → menu Départ / Passage / Arrivée
Avant, le clic long ajoutait ou retirait directement un point de passage. Il ouvre maintenant un petit menu (popup carte) proposant "📍 Départ", "🏁 Arrivée", "➕ Point de passage", et "✕ Retirer ce point de passage" si vous cliquez long sur un point déjà placé.

## 2. Trace du mode précédent qui reste affichée
Chaque mode (Route/Chemins/Exercices) a son propre calque, jamais nettoyé par les autres — en changeant d'onglet, l'ancien tracé restait donc affiché en même temps que le nouveau, créant l'empilement confus visible sur votre capture. La carte est maintenant nettoyée à chaque changement d'onglet (résumé et profil de dénivelé aussi réinitialisés : il faut régénérer après un changement d'onglet).

## 3. Profil de dénivelé
Un petit graphique (D+ / D- / altitude min-max) apparaît sous le résumé de distance après chaque génération, à partir des données d'altitude déjà fournies par ORS/BRouter. S'affiche seulement si le routeur a bien renvoyé une altitude (le cas normalement pour ORS et BRouter avec ce projet).

## 4. Message "aller-retour" retiré
Le popup d'avertissement ne s'affiche plus à l'écran. La détection reste active en interne (elle sert à choisir la meilleure tentative de boucle) et reste tracée dans le panneau 🩺 Diagnostic si besoin.

## 5. Transparence dérangeante dans le volet — vrai bug trouvé
Leaflet donne à ses propres contrôles (bouton de zoom, attribution) un z-index de 1000. Le volet du bas n'avait qu'un z-index de 900 : le contrôle d'attribution (qui a un fond semi-transparent par défaut chez Leaflet) passait donc *au-dessus* du volet et laissait transparaître la carte à travers — exactement ce qui se voyait sur votre capture. Le z-index du volet est monté à 1200.

## 6. Fond satellite / hybride
Deux nouvelles entrées dans le sélecteur de fonds de carte (icône calques, en haut à droite) : **Satellite** (imagerie Esri) et **Hybride** (satellite + routes/noms de lieux superposés). Gratuit, sans clé API.

## À vérifier après déploiement
Badge de version → **v0.6.0**. Testez le clic long sur la carte, changez d'onglet Route↔Chemins pour vérifier que l'ancien tracé disparaît bien, et jetez un œil au nouveau fond satellite.
