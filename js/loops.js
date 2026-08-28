/**
 * loops.js — Génération géométrique des parcours (avant routage réel).
 * Construit des polygones/points théoriques, applique la correction de circuité,
 * puis délègue le routage réel à RPRouting. Détecte les allers-retours indésirables.
 */

const RPLoops = (() => {
  const CIRCUITY = RP_CONFIG.routing.circuityFactor;

  /** Déplace un point de `distanceM` mètres dans la direction `bearingDeg` (0=Nord). */
  function destinationPoint(lat, lon, bearingDeg, distanceM) {
    const R = 6371000;
    const δ = distanceM / R;
    const θ = bearingDeg * Math.PI / 180;
    const φ1 = lat * Math.PI / 180, λ1 = lon * Math.PI / 180;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );
    return { lat: φ2 * 180 / Math.PI, lon: λ2 * 180 / Math.PI };
  }

  /**
   * Génère une boucle théorique polygonale autour d'un point de départ,
   * dont le périmètre à vol d'oiseau vise targetDistanceM / CIRCUITY.
   */
  function theoreticalLoopPoints(start, targetDistanceM, vertices = 6, seedBearing = 0) {
    const perimeterTarget = targetDistanceM / CIRCUITY;
    const radius = perimeterTarget / (2 * Math.PI); // approx cercle -> rayon
    const pts = [];
    for (let i = 0; i < vertices; i++) {
      const bearing = seedBearing + (360 / vertices) * i + (Math.random() * 20 - 10);
      const r = radius * (0.85 + Math.random() * 0.3); // irrégularité naturelle
      pts.push(destinationPoint(start.lat, start.lon, bearing, r));
    }
    pts.push({ ...start });
    return [start, ...pts];
  }

  /** Boucle simple (polygone régulier) à partir d'un point et d'une distance cible. */
  async function generateLoop(start, targetDistanceM, mode) {
    const pts = theoreticalLoopPoints(start, targetDistanceM, 6, 0);
    return finalizeAndValidate(pts, mode, targetDistanceM);
  }

  /** Boucle aléatoire : bearing de départ et irrégularité randomisés à chaque appel. */
  async function generateRandomLoop(start, targetDistanceM, mode) {
    const vertices = 5 + Math.floor(Math.random() * 4); // 5 à 8
    const pts = theoreticalLoopPoints(start, targetDistanceM, vertices, Math.random() * 360);
    return finalizeAndValidate(pts, mode, targetDistanceM);
  }

  /** Aller-retour simple sur un cap donné (ou aléatoire). */
  async function generateOutAndBack(start, targetDistanceM, mode, bearingDeg = null) {
    const bearing = bearingDeg ?? Math.random() * 360;
    const turnaround = destinationPoint(start.lat, start.lon, bearing, targetDistanceM / 2);
    const result = await RPRouting.route([start, turnaround, start], mode);
    return { ...result, kind: 'aller-retour', isIntentionalOutAndBack: true };
  }

  /** A → B direct, ou avec détours pour allonger jusqu'à une distance cible. */
  async function generatePointToPoint(start, end, targetDistanceM, mode) {
    const direct = await RPRouting.route([start, end], mode);
    if (!targetDistanceM || direct.distanceM >= targetDistanceM * 0.95) {
      return { ...direct, kind: 'a-vers-b' };
    }
    // Insère un détour : point excentré à mi-chemin, perpendiculaire à l'axe direct.
    const mid = { lat: (start.lat + end.lat) / 2, lon: (start.lon + end.lon) / 2 };
    const bearingDirect = bearingBetween(start, end);
    const remainingM = targetDistanceM - direct.distanceM;
    const detourOffset = destinationPoint(mid.lat, mid.lon, bearingDirect + 90, remainingM / (2 * CIRCUITY));
    const withDetour = await RPRouting.route([start, detourOffset, end], mode);
    return { ...withDetour, kind: 'a-vers-b-detour' };
  }

  /** Boucle par points de passage explicites (déjà géocodés), fermée sur le départ. */
  async function generateWaypointLoop(waypoints, mode) {
    if (waypoints.length < 2) throw new Error('Il faut au moins 2 points de passage.');
    const closed = [...waypoints, waypoints[0]];
    const result = await RPRouting.route(closed, mode);
    return validateAndFlag(result);
  }

  function bearingBetween(a, b) {
    const φ1 = a.lat * Math.PI / 180, φ2 = b.lat * Math.PI / 180;
    const Δλ = (b.lon - a.lon) * Math.PI / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  async function finalizeAndValidate(theoreticalPts, mode, targetDistanceM) {
    const result = await RPRouting.route(theoreticalPts, mode);
    const validated = validateAndFlag(result);
    validated.targetDistanceM = targetDistanceM;
    validated.deltaPct = targetDistanceM
      ? Math.round(((validated.distanceM - targetDistanceM) / targetDistanceM) * 100)
      : null;
    return validated;
  }

  /**
   * Détecte les allers-retours (leçon #4) : à la fois le taux de chevauchement
   * global de l'itinéraire ET les portions localisées (quelques centaines de mètres
   * qui repassent sur elles-mêmes) qui passeraient inaperçues dans une moyenne globale.
   */
  function validateAndFlag(result) {
    const coords = result.coords;
    const segLen = 25; // résolution d'échantillonnage en mètres, pour détecter le local
    const visited = [];
    let overlapM = 0;
    let localOverlapFlags = 0;

    for (let i = 1; i < coords.length; i++) {
      const a = { lat: coords[i - 1][0], lon: coords[i - 1][1] };
      const b = { lat: coords[i][0], lon: coords[i][1] };
      const segDist = RPRouting.haversine(a, b);

      let overlappedHere = false;
      for (const v of visited) {
        const d = RPRouting.haversine(a, v);
        if (d < 15) { overlappedHere = true; break; }
      }
      if (overlappedHere) {
        overlapM += segDist;
        localOverlapFlags++;
      }
      visited.push(a);
    }

    const overlapRatio = result.distanceM > 0 ? overlapM / result.distanceM : 0;
    result.overlapRatio = overlapRatio;
    result.hasSignificantOverlap = overlapRatio > 0.15 || localOverlapFlags > 3;
    if (result.hasSignificantOverlap) {
      RPDiag.log('warn', `Chevauchement détecté sur l'itinéraire (${Math.round(overlapRatio * 100)}%).`);
    }
    return result;
  }

  return {
    generateLoop, generateRandomLoop, generateOutAndBack,
    generatePointToPoint, generateWaypointLoop, destinationPoint, bearingBetween
  };
})();
