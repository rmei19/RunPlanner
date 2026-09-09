# RunPlanner v0.8.6 — clé ORS partagée intégrée par défaut

Fichiers modifiés (par-dessus votre v0.8.5) :
- index.html
- service-worker.js
- js/config.js (RP_VERSION → 0.8.6 + clé ORS encodée)
- js/settings.js

## Ce qui change
Votre clé ORS est maintenant intégrée par défaut dans le code, encodée (inversion + base64, mécanisme déjà présent mais jamais rempli jusqu'ici). Toute personne ouvrant l'app aura donc directement accès au routage ORS (boucles natives "round trip" incluses) sans avoir à saisir de clé — plus simple à partager pour faire tester.

**Rappel du compromis, tel que convenu** : le dépôt étant public, cette clé n'est pas vraiment secrète — l'encodage protège contre les scanners automatisés, pas contre un humain qui lit le fichier `config.js` (la fonction de décodage est juste à côté). C'est un choix assumé de votre part, avec régénération possible en cas d'abus.

## Note de bonne foi ajoutée à deux endroits
- Dans le code (`config.js`), à côté de la clé.
- Dans le panneau ⚙️ Réglages, visible par les personnes qui utilisent réellement l'app : *"Une clé ORS gratuite est déjà intégrée par défaut, partagée pour faciliter les tests. Merci de ne pas en abuser (usage personnel raisonnable)..."*, avec un rappel que chacun peut la remplacer par la sienne.

## Comportement
- Si quelqu'un saisit sa propre clé dans les réglages, elle prend le pas sur la clé partagée (comportement déjà existant, inchangé).
- Sans saisie, la clé partagée est utilisée automatiquement.
- Si la clé partagée venait à être invalidée/épuisée, la bascule automatique vers BRouter (déjà en place) prend le relais sans rien casser.

## Vérification effectuée avant livraison
J'ai testé l'encodage/décodage avec la logique exacte du code (inversion + base64 via `atob`) pour confirmer que la clé intégrée redonne bien la clé d'origine — pas juste vérifié en théorie.

## À vérifier après déploiement
Badge de version → **v0.8.6**. Ouvrez ⚙️ Réglages sans avoir saisi de clé : le message doit confirmer qu'une clé partagée est active. Testez une génération de boucle pour confirmer que la source "ors-round-trip" apparaît bien dans le résumé.
