# RunPlanner v0.6.2 — d'après votre journal diagnostic le plus récent

Fichiers modifiés (par-dessus votre v0.6.1) :
- service-worker.js
- js/config.js (RP_VERSION → 0.6.2)
- js/loops.js
- js/routing.js

## 1. Appels ORS redondants (optimisation, pas un bug bloquant)

Votre journal montrait, pour une seule génération : 1 échec ORS pour le round-trip, PUIS 5 échecs ORS supplémentaires (un par tentative polygonale), soit 6 appels ratés vers un service déjà identifié en panne. Cause : `tryPolygon()` appelait la fonction générique `RPRouting.route()`, qui retente toujours ORS en premier, indépendamment de ce que `bestOfAttempts()` savait déjà (ORS indisponible pour cette génération). Corrigé : une fois qu'ORS a échoué une fois, les tentatives polygonales suivantes sautent directement à BRouter — moins de latence, moins de requêtes inutiles.

## 2. Convergence redevenue erratique (34% → 52% → 51% → 39% → 21%)

C'est un vrai effet de bord du correctif de la version précédente. Diversifier la forme dès le premier chevauchement détecté avait du sens contre une impasse ponctuelle, mais ici le réseau routier local semble avoir du chevauchement dans presque toutes les directions — donc on jetait la correction de rayon en cours à CHAQUE tentative, repartant à chaque fois d'une estimation neuve, sans jamais laisser la convergence agir. D'où des écarts qui rebondissent au lieu de se rapprocher.

Corrigé : une forme a maintenant droit à 2 tentatives de correction de rayon avant d'être abandonnée pour une nouvelle forme (au lieu d'être abandonnée dès le premier chevauchement). Ça donne à la convergence une vraie chance d'agir, tout en gardant la diversification comme filet de sécurité si une forme s'avère structurellement mauvaise.

## Sur la "NetworkError" ORS elle-même — je n'ai pas de correctif à proposer

Je n'ai pas trouvé d'erreur dans notre code d'appel à ORS (URL, en-têtes, format de requête — tout est conforme à leur documentation). Une "NetworkError" survient au niveau réseau/CORS, avant même de recevoir une réponse HTTP — ce n'est ni un problème de clé invalide, ni de quota dépassé (ces cas-là remontent une vraie réponse HTTP 401/403/429, pas une NetworkError). Ça correspond à ce que vous aviez déjà documenté pour RoadPlanner : une instabilité côté infrastructure d'ORS, indépendante de la clé ou du réseau, confirmée à l'époque via `curl`. Si vous voulez vérifier si c'est bien le cas ici aussi, un test `curl` direct vers l'URL ORS avec votre clé (comme vous l'aviez fait pour RoadPlanner) confirmera si le problème est serveur ou client — je ne peux pas le tester moi-même depuis cet environnement (accès réseau restreint aux domaines de développement).

Dans tous les cas, la bascule automatique vers BRouter fonctionne exactement comme prévu — c'est elle qui a produit votre résultat à 0% d'écart parfait lors du premier test.

## À vérifier après déploiement
Badge de version → **v0.6.2**. Refaites le même test : le journal devrait montrer moins d'échecs ORS répétés par génération, et une distance qui se rapproche plus régulièrement d'une tentative à l'autre.
