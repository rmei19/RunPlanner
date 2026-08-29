/**
 * routing.js — Routage point-à-point via ORS puis BRouter en secours.
 * Responsabilité unique : obtenir une géométrie routée + altitude entre des points,
 * pour un "mode" donné (route / chemins / exercices). Ne connaît rien aux boucles
 * ni aux séances (voir loops.js / exercises.js).
 */

const RPRouting = (() => {

  function getOrsKey() {
    const stored = localStorage.getItem(RP_CONFIG.storageKeys.orsKey);
    if (stored && rpIsPrintableAscii(stored)) return stored;
    const fallback = rpDecodeObfuscatedKey(RP_CONFIG.routing.ors.obfuscatedDefaultKey);
    return rpIsPrintableAscii(fallback) ? fallback : '';
  }

  /**
   * Route entre une liste de points [{lat,lon}, ...] pour un mode donné.
   * Retourne { coords: [[lat,lon,ele], ...], distanceM, durationS, source: 'ors'|'brouter' }
   * ou lance une erreur si les deux moteurs échouent.
   */
  async function route(points, mode) {
    try {
      return await routeWithOrs(points, mode);
    } catch (e) {
      RPDiag.log('warn', `ORS a échoué (${e.message}), bascule vers BRouter.`);
      try {
        return await routeWithBrouter(points, mode);
      } catch (e2) {
        RPDiag.log('error', `BRouter a échoué aussi (${e2.message}).`);
        throw new Error('Les deux moteurs de routage ont échoué.');
      }
    }
  }

  async function routeWithOrs(points, mode) {
    const key = getOrsKey();
    if (!key) throw new Error('Aucune clé ORS disponible');
    const profile = RP_CONFIG.routing.ors.profiles[mode] || 'foot-walking';
    const url = `${RP_CONFIG.routing.ors.baseUrl}${profile}/geojson`;

    const body = {
      coordinates: points.map(p => [p.lon, p.lat]),
      elevation: true
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': key,
        'Content-Type': 'application/json',
        'Accept': 'application/geo+json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`ORS HTTP ${res.status}`);
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) throw new Error('ORS: réponse sans itinéraire');

    const coords = feature.geometry.coordinates.map(c => [c[1], c[0], c[2] ?? 0]);
    const summary = feature.properties?.summary || {};
    return {
      coords,
      distanceM: summary.distance ?? rpPolylineLength(coords),
      durationS: summary.duration ?? null,
      source: 'ors'
    };
  }

  /**
   * Boucle "native" via l'option round_trip d'OpenRouteService : ORS choisit
   * lui-même un itinéraire circulaire réaliste sur le réseau routier réel
   * autour d'un point unique, au lieu de forcer un passage par des points
   * théoriques choisis à l'aveugle (ce qui, en zone rurale/montagneuse,
   * provoquait des allers-retours et des distances très supérieures à la
   * cible — cf. retour terrain). Seul ORS supporte cette fonctionnalité ;
   * sans clé ORS, on retombe sur la construction par polygone (voir loops.js).
   */
  async function routeRoundTrip(start, targetDistanceM, mode, seed) {
    const key = getOrsKey();
    if (!key) throw new Error('Aucune clé ORS disponible');
    const profile = RP_CONFIG.routing.ors.profiles[mode] || 'foot-walking';
    const url = `${RP_CONFIG.routing.ors.baseUrl}${profile}/geojson`;

    const body = {
      coordinates: [[start.lon, start.lat]],
      elevation: true,
      options: {
        round_trip: {
          length: targetDistanceM,
          points: 3 + Math.floor(Math.random() * 3), // 3 à 5 : plus de points = tracé plus sinueux
          seed: seed ?? Math.floor(Math.random() * 100000)
        }
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': key,
        'Content-Type': 'application/json',
        'Accept': 'application/geo+json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`ORS round_trip HTTP ${res.status}`);
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) throw new Error('ORS round_trip: réponse sans itinéraire');

    const coords = feature.geometry.coordinates.map(c => [c[1], c[0], c[2] ?? 0]);
    const summary = feature.properties?.summary || {};
    return {
      coords,
      distanceM: summary.distance ?? rpPolylineLength(coords),
      durationS: summary.duration ?? null,
      source: 'ors-round-trip'
    };
  }

  async function routeWithBrouter(points, mode) {
    const profile = RP_CONFIG.routing.brouter.profiles[mode] || 'trekking';
    const lonlats = points.map(p => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join('|');
    const url = `${RP_CONFIG.routing.brouter.baseUrl}?lonlats=${lonlats}&profile=${profile}&alternativeidx=0&format=geojson`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`BRouter HTTP ${res.status}`);
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) throw new Error('BRouter: réponse sans itinéraire');

    const coords = feature.geometry.coordinates.map(c => [c[1], c[0], c[2] ?? 0]);
    const props = feature.properties || {};
    return {
      coords,
      distanceM: props['track-length'] ? parseFloat(props['track-length']) : rpPolylineLength(coords),
      durationS: props['total-time'] ? parseFloat(props['total-time']) : null,
      source: 'brouter'
    };
  }

  /** Distance à vol d'oiseau (Haversine), en mètres. */
  function haversine(a, b) {
    const R = 6371000;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /** Longueur totale d'une polyligne [lat,lon,ele][]. */
  function rpPolylineLength(coords) {
    let d = 0;
    for (let i = 1; i < coords.length; i++) {
      d += haversine(
        { lat: coords[i - 1][0], lon: coords[i - 1][1] },
        { lat: coords[i][0], lon: coords[i][1] }
      );
    }
    return d;
  }

  return { route, routeRoundTrip, haversine, polylineLength: rpPolylineLength };
})();
