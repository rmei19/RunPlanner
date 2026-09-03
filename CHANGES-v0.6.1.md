# RunPlanner v0.6.1 — d'après votre test terrain à Annoisin (journal diagnostic)

Fichiers modifiés (par-dessus votre v0.6.0) :
- service-worker.js
- css/style.css
- js/config.js (RP_VERSION → 0.6.1)
- js/loops.js
- js/ui.js

## Ce que le journal a révélé
"4 tentative(s) générée(s), la meilleure retenue (ors-round-trip, écart 106% vs cible)" + "Toutes les tentatives contiennent un chevauchement". Deux vrais bugs trouvés en creusant le code :

**1. La boucle native ORS ne corrigeait jamais sa distance demandée.**
Contrairement au repli polygone (qui réajuste son rayon après chaque tentative ratée), chaque tentative `round_trip` ORS redemandait littéralement la même distance cible, même après un échec à +100%. Corrigé : la longueur demandée à ORS se corrige maintenant d'une tentative à l'autre, comme pour le repli polygone.

**2. En cas de chevauchement persistant, on ne faisait que rescaler la même forme.**
Un chevauchement qui persiste malgré la correction suggère que CETTE géométrie précise butte sur une impasse du réseau local (ex: une seule route d'accès) — rescaler son rayon ne peut jamais résoudre un problème de topologie, seulement de distance. La prochaine tentative polygonale tire maintenant une forme différente (nouveaux angles) au lieu de s'obstiner sur la même.

**3. Message d'avertissement réintroduit, mais discrètement.**
Vous aviez demandé la semaine dernière de retirer le popup d'avertissement, ce qui reste fait. Mais le supprimer complètement privait de toute info utile en cas de problème réel comme celui-ci. Un petit texte discret apparaît maintenant dans la carte de résumé (pas de popup) quand le résultat retenu contient malgré tout un chevauchement : "⚠️ Réseau routier peu maillé ici : portion en aller-retour malgré plusieurs tentatives."

## Une limite honnête

Le journal montre que même le round-trip natif ORS (le plus au fait du réseau routier réel) a produit un chevauchement sur les 4 tentatives à cet endroit précis. Si Annoisin ne dispose vraiment que d'un seul axe d'accès dans le rayon demandé, aucun algorithme ne peut inventer une route qui n'existe pas — un aller-retour partiel peut rester la meilleure réponse honnête possible dans ce cas précis. Les correctifs ci-dessus maximisent les chances de trouver une vraie boucle quand c'est géométriquement possible, et rapprochent la distance de la cible même quand ce n'est pas le cas.

Sur "il fait prendre des chemins" en mode Route : je n'ai pas de correctif à proposer cette fois. Le profil ORS `foot-walking` utilisé est un profil piéton général — il évite les sentiers techniques/montagneux mais ne garantit pas un revêtement goudronné à 100% (aucun profil ORS ne fait cette promesse stricte pour un piéton). Je préfère vous le dire clairement plutôt que de deviner un changement de profil qui pourrait dégrader autre chose sans certitude que ça règle le problème.

## À vérifier après déploiement
Badge de version → **v0.6.1**. Refaites le même test à Annoisin si possible : le journal diagnostic devrait maintenant montrer une distance qui se rapproche à chaque tentative (au lieu de rester bloquée au même écart), et le message discret devrait apparaître dans le résumé si le chevauchement persiste malgré tout.
