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

  function init(containerId) {
    map = L.map(containerId, {
      center: [48.8566, 2.3522],
      zoom: 13,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const osm = L.tileLayer(RP_CONFIG.tileLayers.osm.url, RP_CONFIG.tileLayers.osm.options);
    const topo = L.tileLayer(RP_CONFIG.tileLayers.topo.url, RP_CONFIG.tileLayers.topo.options);
    osm.addTo(map);

    L.control.layers(
      { 'Rues (OSM)': osm, 'Relief (OpenTopoMap)': topo },
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

    // Géolocalisation best-effort au démarrage, jamais bloquante.
    map.locate({ setView: false, timeout: 4000 });
    map.on('locationfound', (e) => {
      map.setView(e.latlng, 14);
    });

    return map;
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
    getRouteLayer, getMarkersLayer, getPoiLayer, fitToLayer
  };
})();
