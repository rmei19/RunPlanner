/**
 * map.js — Initialisation Leaflet, fonds de carte, groupes de calques.
 * Responsabilité unique : la carte et ses couches (pas de logique de routage ici).
 */

const RPMap = (() => {
  let map = null;
  // IMPORTANT (leçon #5) : L.featureGroup, jamais L.layerGroup, pour tout groupe
  // destiné à être imbriqué (getBounds() fiable une fois imbriqué).
  let routeLayers = {
    route: L.featureGroup(),
    chemins: L.featureGroup(),
    exercices: L.featureGroup()
  };
  let markersLayer = L.featureGroup();
  let poiLayer = L.featureGroup();
  let userLocationMarker = null;
  let userAccuracyCircle = null;
  let locationCallbacks = [];
  let locationErrorCallbacks = [];

  function init(containerId) {
    map = L.map(containerId, {
      center: [48.8566, 2.3522],
      zoom: 13,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const osm = L.tileLayer(RP_CONFIG.tileLayers.osm.url, RP_CONFIG.tileLayers.osm.options);
    const topo = L.tileLayer(RP_CONFIG.tileLayers.topo.url, RP_CONFIG.tileLayers.topo.options);
    const satellite = L.tileLayer(RP_CONFIG.tileLayers.satellite.url, RP_CONFIG.tileLayers.satellite.options);
    // "Hybride" = satellite + calque routes Esri semi-transparent par-dessus.
    // v0.8.3 — remplace OpenTopoMap (retour terrain : le calque
    // n'apparaissait pas du tout, satellite pur affiché — probable échec de
    // chargement silencieux, cf. journal ci-dessous). Ce calque Esri est
    // spécifiquement conçu pour ce cas d'usage (fond transparent, routes
    // uniquement) et partage l'infrastructure du satellite, réduisant le
    // risque qu'un des deux services tombe pendant que l'autre fonctionne.
    const hybridOverlay = L.tileLayer(RP_CONFIG.tileLayers.roadsOverlay.url, {
      ...RP_CONFIG.tileLayers.roadsOverlay.options,
      opacity: 0.85 // calque déjà transparent par nature (juste les routes) : peut se permettre plus d'opacité qu'un fond topo complet
    });
    const hybrid = L.layerGroup([satellite, hybridOverlay]);
    // Traçabilité complète (succès ET échec) pour trancher définitivement la
    // prochaine fois si le calque se charge ou non — avant, seul l'échec
    // était tracé, impossible de distinguer "aucune requête n'a été faite"
    // de "toutes les requêtes ont échoué".
    let hybridTileOk = 0, hybridTileFail = 0;
    hybridOverlay.on('tileload', () => { hybridTileOk++; });
    hybridOverlay.on('tileerror', () => {
      hybridTileFail++;
      RPDiag.log('warn', `Tuile routes (fond Hybride) en échec de chargement (${hybridTileFail} échec(s), ${hybridTileOk} succès).`);
    });
    osm.addTo(map);

    L.control.layers(
      { 'Hybride (satellite + routes/chemins)': hybrid, 'Rues (OSM)': osm, 'Relief (OpenTopoMap)': topo, 'Satellite': satellite },
      {
        'Itinéraire Route': routeLayers.route,
        'Itinéraire Chemins': routeLayers.chemins,
        'Itinéraire Exercices': routeLayers.exercices,
        'Points d\'intérêt': poiLayer
      },
      { position: 'topright', collapsed: true }
    ).addTo(map);

    Object.values(routeLayers).forEach(g => g.addTo(map));
    markersLayer.addTo(map);
    poiLayer.addTo(map);

    // Géolocalisation best-effort au démarrage, jamais bloquante (réseau/GPS
    // selon ce que le navigateur choisit — enableHighAccuracy demande le GPS
    // quand disponible plutôt que la seule position réseau/Wi-Fi).
    map.on('locationfound', (e) => {
      showUserLocationMarker(e.latlng, e.accuracy);
      map.setView(e.latlng, 15);
      locationCallbacks.forEach(cb => {
        try { cb(e.latlng, e.accuracy); } catch (err) { console.error(err); }
      });
    });
    map.on('locationerror', (e) => {
      try { RPDiag.log('warn', 'Géolocalisation indisponible: ' + e.message); } catch (_) {}
      locationErrorCallbacks.forEach(cb => {
        try { cb(e); } catch (err) { console.error(err); }
      });
    });
    locateMe();

    return map;
  }

  /** (Re)déclenche une localisation. Utilisable au démarrage et depuis un bouton "Me localiser". */
  function locateMe() {
    if (!map) return;
    map.locate({ setView: false, timeout: 8000, enableHighAccuracy: true, maximumAge: 30000 });
  }

  /** Enregistre un callback appelé à chaque localisation réussie: cb(latlng, accuracyM). */
  function onLocationFound(cb) {
    locationCallbacks.push(cb);
  }

  /** Enregistre un callback appelé à chaque échec de localisation: cb(errorEvent). */
  function onLocationError(cb) {
    locationErrorCallbacks.push(cb);
  }

  function showUserLocationMarker(latlng, accuracyM) {
    if (userLocationMarker) markersLayer.removeLayer(userLocationMarker);
    if (userAccuracyCircle) markersLayer.removeLayer(userAccuracyCircle);
    userAccuracyCircle = L.circle(latlng, { radius: accuracyM, color: '#35D4A7', weight: 1, fillOpacity: 0.08 }).addTo(markersLayer);
    userLocationMarker = L.circleMarker(latlng, { radius: 7, color: '#35D4A7', fillColor: '#35D4A7', fillOpacity: 1, weight: 2 })
      .addTo(markersLayer).bindTooltip('Votre position');
  }

  function clearRoute(mode) {
    if (routeLayers[mode]) routeLayers[mode].clearLayers();
  }

  function clearAllRoutes() {
    Object.values(routeLayers).forEach(g => g.clearLayers());
  }

  function getMap() { return map; }
  function getRouteLayer(mode) { return routeLayers[mode]; }
  function getMarkersLayer() { return markersLayer; }
  function getPoiLayer() { return poiLayer; }

  function fitToLayer(mode) {
    const layer = routeLayers[mode];
    if (layer && layer.getLayers().length > 0) {
      map.fitBounds(layer.getBounds(), { padding: [40, 40] });
    }
  }

  return {
    init, clearRoute, clearAllRoutes, getMap,
    getRouteLayer, getMarkersLayer, getPoiLayer, fitToLayer,
    locateMe, onLocationFound, onLocationError
  };
})();
