# RunPlanner v0.7.1

Fichiers modifiés (par-dessus votre v0.7.0) :
- index.html
- service-worker.js
- css/style.css
- js/config.js (RP_VERSION → 0.7.1)
- js/ui.js
- js/loops.js

## 1. Changer l'arrivée conserve maintenant l'ancienne comme point de passage
Quand une arrivée est déjà placée et que vous en définissez une nouvelle, l'ancienne devient automatiquement le dernier point de passage au lieu d'être simplement remplacée et perdue — permet de construire un parcours à étapes en déplaçant successivement l'arrivée vers l'avant.

## 2. "Me localiser" retiré du volet
Seule l'icône 📍 de la barre du haut (ajoutée en v0.7.0) déclenche désormais la géolocalisation.

## 3. Option "🔁 Fermer la boucle" pour le mode A → B
Nouvelle case à cocher, visible uniquement quand le sous-mode "A → B" est actif (Route et Chemins) : coche-la pour que le trajet revienne au départ après l'arrivée, au lieu de s'arrêter là. Accessible aussi via le menu d'appui long sur la carte (nouvelle option "🔁 Fermer la boucle : activée/désactivée", qui bascule l'état à distance sans avoir à ouvrir le volet).

## 4. Points de passage enfin pris en compte en mode Boucle / Boucle aléatoire — vrai bug de longue date

C'était un vrai trou dans le code, pas un réglage oublié : `generateLoop()` et `generateRandomLoop()` ne recevaient tout simplement jamais les points de passage en paramètre — ils généraient toujours une forme aléatoire, quel que soit le nombre de points placés sur la carte. Seul le sous-mode "Points de passage" dédié en tenait compte.

Corrigé : dès qu'au moins un point de passage est présent, les sous-modes "Boucle" et "Boucle aléatoire" routent désormais à travers eux (départ → points → retour au départ) au lieu de générer une forme aléatoire qui les ignorait. Sans point de passage, comportement inchangé.

## À vérifier après déploiement
Badge de version → **v0.7.1**. Testez : placer 2-3 points de passage puis choisir "Boucle" (devrait maintenant passer par eux), la case "Fermer la boucle" en A→B, et l'option correspondante dans le menu d'appui long.
