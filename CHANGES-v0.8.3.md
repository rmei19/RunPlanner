# RunPlanner v0.8.3 — fond Hybride, nouvelle source

Fichiers modifiés (par-dessus votre v0.8.2) :
- service-worker.js
- js/config.js (RP_VERSION → 0.8.3 + nouvelle source de calque routes)
- js/map.js

## Ce que montrait votre capture
Le mode "Hybride" était bien sélectionné (bouton radio actif), mais l'affichage était du satellite pur, sans aucune trace de routes/chemins par-dessus. J'ai vérifié le code de construction du calque : il est correct, ce qui pointe vers un échec de chargement des tuiles OpenTopoMap côté serveur — silencieux, sans erreur visible à l'écran, exactement le scénario que je soupçonnais sans pouvoir le confirmer la dernière fois.

## Le changement
Plutôt que de continuer à dépendre d'OpenTopoMap (service gratuit, tiers, quota restreint) pour cette superposition, le fond Hybride utilise maintenant un calque Esri "routes uniquement" — conçu spécifiquement pour être superposé à de l'imagerie satellite, et hébergé sur la **même infrastructure** que notre calque satellite. Servir les deux calques depuis le même fournisseur réduit le risque qu'un des deux tombe pendant que l'autre fonctionne.

**Compromis à connaître** : ce calque Esri montre bien le réseau routier, mais il est possible qu'il distingue moins nettement les sentiers/chemins non carrossables que ne le faisait OpenTopoMap (qui a un style spécifiquement pensé "randonnée"). Si après ce test vous trouvez que les chemins ne ressortent plus assez, dites-le-moi — je pourrai proposer de réintégrer OpenTopoMap comme calque optionnel séparé (activable/désactivable), plutôt que de l'imposer par défaut dans le combo Hybride.

## Traçabilité renforcée
Le journal diagnostic trace maintenant les succès ET les échecs de chargement de ce calque (avant, seuls les échecs étaient tracés) — si le souci persiste, le journal permettra de savoir avec certitude si c'est encore un problème de chargement ou autre chose.

## À vérifier après déploiement
Badge de version → **v0.8.3**. Sélectionnez à nouveau "Hybride" et vérifiez si les routes apparaissent bien cette fois par-dessus le satellite.
