# RunPlanner v0.2.1 — le volet ne s'ouvrait plus

Fichiers modifiés (par-dessus votre v0.2.0) :
- index.html
- service-worker.js
- css/style.css
- js/config.js (RP_VERSION → 0.2.1)
- js/ui.js
- js/app.js

## Honnêtement

Je n'ai pas pu reproduire le bug en direct (pas d'accès à votre navigateur), donc voici ce que j'ai corrigé/durci, du plus probable au moins probable :

**1. Cible tactile trop petite (le plus probable)**
La poignée du volet ne faisait que 40×4 px — largement sous les 44 px recommandés par Apple/Google pour un tap fiable. Elle est remplacée par un vrai `<button>` sur toute la largeur du volet, avec libellé "Options du parcours" visible, beaucoup plus facile à toucher précisément.

**2. Cache obsolète après mise à jour**
Si votre navigateur a gardé l'ancien Service Worker actif après le déploiement de la v0.2.0, la page peut continuer à tourner avec l'ancien JavaScript déjà chargé en mémoire — même si les nouveaux fichiers sont bien sur GitHub Pages. Ajouté : un rechargement automatique et unique dès qu'une nouvelle version du Service Worker prend le contrôle, pour éliminer ce doute une fois pour toutes.

**3. Traçabilité**
Chaque ouverture/fermeture du volet est maintenant journalisée dans le panneau 🩺 Diagnostic (bas de l'écran). Si le souci persiste après ce correctif, ouvrez ce panneau, tapez sur la zone du volet, et dites-moi ce qui s'affiche (ou ne s'affiche pas) dans le journal — ça me donnera un vrai signal pour la suite.

## À vérifier après déploiement
- Badge de version dans 🩺 Diagnostic → doit afficher **v0.2.1**.
- Si ça affiche encore v0.2.0 ou v0.1.0 après un rechargement, fermez complètement l'onglet/l'app (pas juste rafraîchir) et rouvrez-la — certains navigateurs mobiles ne changent de Service Worker qu'à la réouverture complète.
