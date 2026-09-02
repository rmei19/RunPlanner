# RunPlanner v0.5.0

Fichiers modifiés (par-dessus votre v0.4.0) :
- service-worker.js
- js/config.js (RP_VERSION → 0.5.0 + profil BRouter du mode Route)
- js/ui.js
- js/export.js

## 1. Trace peu visible
Ajouté un liseré sombre semi-transparent sous chaque tracé (technique cartographique standard) : le tracé reste lisible quel que soit le fond de carte, là où une simple ligne fine pouvait s'y fondre (notamment en vert sur les zones forestières). Au passage, la couleur du mode Route est passée du vert menthe (qui se confondait avec les zones vertes OSM) à un bleu vif, beaucoup plus contrasté.

## 2. Chemins/Route pas respecté — vrai bug trouvé

Le mode Route utilisait le profil BRouter `'shortest'`. Ce n'est **pas un profil piéton** : c'est le profil voiture "trajet le plus court" de BRouter (orienté distance minimale pour un véhicule, pas confort de course sur route). Cela explique le comportement incohérent : le mode Route n'appliquait pas de préférence fiable pour la voirie goudronnée adaptée à la course.

Remplacé par `'foot-fastest'`, le profil piéton de BRouter orienté voies rapides/goudronnées — cohérent avec l'intention du mode Route. Le mode Chemins (`'trekking'`) était déjà correct et n'a pas changé.

Limite à connaître : même avec le bon profil, en zone très rurale avec un réseau clairsemé, le routeur peut ne pas avoir d'autre choix que de mélanger route et chemin par endroits — ce n'est plus un bug de configuration à ce stade, juste la réalité du terrain disponible.

## 3. Export GPX (et TCX/FIT) non disponible

Deux améliorations, faute d'avoir pu reproduire une panne précise :
- **Retour visuel** sur le bouton lui-même (✓ Téléchargé / ⚠️ Échec pendant 2 secondes) — le téléchargement est souvent silencieux sur mobile (pas de fenêtre visible), ce qui peut donner l'impression qu'il ne se passe rien même quand ça fonctionne.
- **Repli automatique** : si le téléchargement direct échoue ou n'est pas supporté par le navigateur, le fichier s'ouvre dans un nouvel onglet à défaut, et toute erreur réelle est maintenant journalisée dans le panneau 🩺 Diagnostic avec le détail technique.

Si l'export échoue encore après ce correctif, dites-moi ce qu'affiche le bouton (✓ ou ⚠️) et le journal diagnostic au moment du clic — ça me donnera un vrai signal pour la suite.

## À vérifier après déploiement
Badge de version → **v0.5.0**. Testez une boucle Route vs Chemins au même endroit pour comparer, et un export GPX en observant le bouton.
