# RunPlanner v0.6.6

Fichiers modifiés (par-dessus votre v0.6.5) :
- index.html
- service-worker.js
- css/style.css
- js/config.js (RP_VERSION → 0.6.6)
- js/ui.js
- js/loops.js

## 1. Points de passage ignorés en mode A → B

Vrai bug de code trouvé : `generatePointToPoint()` ne prenait en paramètres que le départ et l'arrivée — les points de passage n'étaient tout simplement jamais transmis à la fonction, quels que soient ceux placés sur la carte. Corrigé : si des points de passage ont été ajoutés, le trajet A→B passe maintenant par eux dans l'ordre (départ → passages → arrivée) au lieu du détour automatique synthétique, qui ne s'applique désormais que si aucun point de passage n'a été placé.

## 2. Suppression facile du départ/arrivée sur mobile

Il n'existait auparavant aucun moyen dédié pour "défaire" un départ ou une arrivée déjà placé — il fallait viser précisément le marqueur sur la carte avec un appui long, peu pratique sur petit écran tactile. Un bouton ✕ apparaît maintenant à côté de chaque champ "Adresse de départ" / "Adresse d'arrivée" : il efface le point (marqueur + champ), sans avoir à retrouver son emplacement exact sur la carte.

## À vérifier après déploiement
Badge de version → **v0.6.6**. Testez un trajet A→B avec un point de passage ajouté entre les deux, et le bouton ✕ à côté des champs départ/arrivée.
