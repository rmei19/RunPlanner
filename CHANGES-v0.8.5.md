# RunPlanner v0.8.5 — abandon du fond "Hybride", calque à cocher à la place

Fichiers modifiés (par-dessus votre v0.8.4) :
- service-worker.js
- js/config.js (RP_VERSION → 0.8.5)
- js/map.js

## Pourquoi ce changement d'approche

Trois tentatives de suite ont échoué (OpenTopoMap, puis Esri, puis OpenTopoMap avec correctif de zoom) — et votre dernier retour apporte un indice clé : les tuiles **apparaissent brièvement au chargement puis disparaissent** pendant un déplacement/zoom. Ça veut dire qu'elles se chargent bien, mais que quelque chose les fait disparaître juste après. Le point commun aux trois échecs : la construction en `LayerGroup` utilisée comme "fond de carte" spécial ("Hybride" = satellite + calque routes combinés en un seul choix). C'est visiblement cette construction précise qui pose problème, pas la source des tuiles.

## Le changement

Plutôt que de continuer à deviner un réglage sur ce montage, le calque routes/chemins devient un **calque à cocher** — exactement comme "Itinéraire Route", "Points d'intérêt", etc., qui fonctionnent déjà très bien dans cette appli. Fini le fond "Hybride" spécial : sélectionnez **Satellite** comme fond, puis cochez **"Routes/chemins (repères)"** dans la même liste de calques (icône empilement, en haut à droite) pour obtenir exactement le rendu recherché.

C'est un mécanisme déjà éprouvé dans le code (utilisé sans souci pour vos itinéraires), donc les chances que ça fonctionne cette fois sont bien meilleures qu'en continuant à ajuster la construction en LayerGroup.

## Traçabilité conservée
Le journal diagnostic continue de tracer la première tuile chargée avec succès, ainsi que les échecs éventuels — à vérifier après avoir coché la case.

## À vérifier après déploiement
Badge de version → **v0.8.5**. Sélectionnez Satellite, cochez "Routes/chemins (repères)", et testez au zoom proche comme sur vos dernières captures. Si ça fonctionne cette fois, tant mieux ; si le calque disparaît encore pendant zoom/déplacement, ce sera un signal clair que le souci n'est pas dans la construction du fond de carte mais ailleurs (peut-être une limite du navigateur/appareil), et on regardera dans une autre direction.
