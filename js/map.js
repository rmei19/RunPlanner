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
    // "Hybride" = satellite + OpenTopoMap semi-transparent par-dessus.
    // Le premier essai (satellite + repères Esri "Boundaries and Places")
    // n'affichait que des noms de lieux/frontières, pas le réseau
    // routes/chemins lui-même. OpenTopoMap distingue déjà nativement les
    // routes (traits pleins) des sentiers/chemins (tirets) — en l'affichant
    // à 55% d'opacité par-dessus le satellite, on obtient le rendu "satellite
    // + tracé clair routes vs chemins" (cf. l'exemple Komoot fourni).
    const hybridOverlay = L.tileLayer(RP_CONFIG.tileLayers.topo.url, {
      ...RP_CONFIG.tileLayers.topo.options,
      // v0.8.1 — 0.7 semble avoir été trop élevé (retour : "n'est plus
      // hybride", ce qui peut vouloir dire soit "on ne voit plus que le
      // satellite" soit "on ne voit plus que le calque routes/chemins" —
      // je n'ai pas pu confirmer lequel sans accès à un test en direct).
      // Réglage plus modéré en attendant un retour terrain.
      opacity: 0.6
    });
    const hybrid = L.layerGroup([satellite, hybridOverlay]);
    // Si les tuiles OpenTopoMap échouent à charger (limite de leur service
    // public, gratuit et à quota restreint), le calque redevient de fait un
    // satellite pur sans qu'aucune erreur ne soit visible à l'écran — ce
    // journal permettra de vérifier si c'est bien la cause la prochaine fois.
    hybridOverlay.on('tileerror', () => {
      RPDiag.log('warn', 'Tuile OpenTopoMap (fond Hybride) en échec de chargement.');
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
