# RunPlanner v0.6.5 — mode Route via profil vélo de route (test convenu)

Fichiers modifiés (par-dessus votre v0.6.4) :
- service-worker.js
- js/config.js (RP_VERSION → 0.6.5 + profil ORS du mode Route)
- js/ui.js

## Le changement principal
Le mode Route utilise maintenant le profil ORS `cycling-road` (vélo de route) au lieu de `foot-walking`. Comme discuté : ORS n'offre plus aucun moyen de dire à un profil piéton d'éviter les surfaces non goudronnées, alors qu'un vélo de route évite déjà naturellement les chemins/graviers puisqu'il ne peut pas y rouler confortablement. Compromis accepté : le tracé peut occasionnellement emprunter une piste cyclable, ce qui reste praticable à pied.

Le mode Chemins n'a pas changé (`foot-hiking`, déjà adapté).

## Effet de bord corrigé au passage
Router via un profil vélo change aussi la **durée estimée** renvoyée par ORS (une durée à vélo, bien plus rapide qu'à pied) — ça aurait affiché des temps trompeurs du genre "12 min" pour une boucle de 5 km. Corrigé : la durée affichée est maintenant **toujours calculée par RunPlanner lui-même**, à une allure de course (5:30/km par défaut, ou l'allure que vous avez saisie si vous êtes en mode Exercices), et clairement annoncée comme une estimation — plus aucune dépendance à la durée renvoyée par le moteur de routage, quel que soit son profil.

## Limite honnête
Ce n'est pas une garantie à 100% "que du goudron" — un vélo de route reste un compromis, pas un filtre strict par revêtement (qui n'existe simplement plus sur l'API ORS publique, comme confirmé précédemment). À tester sur le terrain pour voir si le résultat vous convient mieux que l'ancien profil piéton.

## À vérifier après déploiement
Badge de version → **v0.6.5**. Générez une boucle en mode Route et comparez au comportement précédent — la durée affichée devrait maintenant être cohérente avec une allure de course, pas de vélo.

## Prochaine étape
Vous avez signalé ne pas être arrivé à faire fonctionner le mode Exercices — on s'y penche au prochain message, avec le détail de ce qui bloque (capture + journal diagnostic si possible).
