# RunPlanner v0.8.4 — fond Hybride, retour sur OpenTopoMap avec le vrai correctif cette fois

Fichiers modifiés (par-dessus votre v0.8.3) :
- service-worker.js
- js/config.js (RP_VERSION → 0.8.4)
- js/map.js

## Ce que j'ai découvert en vérifiant (pas en devinant, cette fois)

J'ai cherché la documentation officielle du service Esri utilisé en v0.8.3 avant de recommencer à deviner. Résultat : **`server.arcgisonline.com/.../Reference/World_Transportation` est un service "legacy" qu'Esri a explicitement déclaré déprécié depuis 2022** — "in mature support, no longer updated", et leur propre documentation dit qu'il "pourrait être désactivé sans préavis". Le remplacement officiel exige un compte développeur ArcGIS + une clé API, disproportionné pour un simple calque décoratif. Ce n'était pas le bon choix, je fais marche arrière.

## Le vrai probable coupable pour OpenTopoMap (mon tout premier essai, v0.6.0)

En reconfigurant le retour à OpenTopoMap, j'ai remarqué un vrai défaut de configuration : son option était réglée sur `maxZoom: 17`. **Leaflet cesse purement et simplement d'afficher un calque dès que la carte est zoomée plus près que son `maxZoom`** — il ne redimensionne rien, il n'affiche rien du tout. Vos deux captures montraient des zooms assez rapprochés sur des villages, exactement le genre de niveau de zoom où ce problème se déclenche. C'est très probablement pour ça que "rien ne s'affichait" dès le tout premier essai, bien avant l'épisode Esri.

Corrigé avec `maxNativeZoom: 17` (résolution réelle des tuiles) + `maxZoom: 20` (les tuiles de zoom 17 sont agrandies au-delà, plutôt que de disparaître).

## Traçabilité renforcée
Le journal diagnostic confirme maintenant la première tuile chargée avec succès (pas seulement les échecs comme avant) — en sélectionnant "Hybride", vous devriez voir apparaître "Calque routes (fond Hybride) : première tuile chargée avec succès." si tout va bien, ou le message d'échec dans le cas contraire. Ce signal sera sans ambiguïté cette fois.

## À vérifier après déploiement
Badge de version → **v0.8.4**. Sélectionnez "Hybride" à un niveau de zoom rapproché (comme sur vos captures) et vérifiez si les routes/chemins apparaissent enfin par-dessus le satellite. Si ce n'est toujours pas le cas, un coup d'œil au journal 🩺 Diagnostic après avoir sélectionné Hybride me donnera cette fois une réponse certaine plutôt qu'une nouvelle hypothèse.
