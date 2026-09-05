/**
 * loops.js — Génération géométrique des parcours (avant routage réel).
 *
 * v0.3.0 — refonte de la génération de boucle suite à un vrai défaut de
 * conception (retour terrain : 7 km demandés → 15,28 km générés, avec
 * aller-retours détectés). Cause : construire un polygone de points
 * théoriques puis forcer le routeur à les relier fonctionne mal en zone
 * rurale/montagneuse, où le réseau routier ne passe pas où l'on veut — le
 * routeur est alors contraint de faire des allers-retours pour atteindre un
 * point mal desservi.
 *
 * Corrections :
 *  1. Priorité à l'option "round_trip" native d'OpenRouteService, qui laisse
 *     ORS choisir lui-même un itinéraire circulaire réaliste sur le réseau
 *     routier réel (bien plus fiable que des points choisis à l'aveugle).
 *  2. En repli (pas de clé ORS, ou round_trip indisponible) : l'ancienne
 *     construction par polygone est conservée, mais avec CORRECTION
 *     ITÉRATIVE — si la distance obtenue s'écarte trop de la cible, le rayon
 *     est automatiquement recalculé au prorata pour la tentative suivante,
 *     au lieu de dépendre d'un facteur de circuité fixe forcément approximatif.
 *  3. Jusqu'à 3 tentatives sont générées et la MEILLEURE est retenue (le
 *     moins de chevauchement, puis l'écart de distance le plus faible),
 *     au lieu de renvoyer telle quelle la première tentative même mauvaise.
 */

const RPLoops = (() => {
  const CIRCUITY = RP_CONFIG.routing.circuityFactor;
  const MAX_ATTEMPTS = 5;

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
   * Construit une "forme" de boucle fixe (angles relatifs + irrégularité par
   * sommet), tirée UNE SEULE FOIS. C'est essentiel pour que la correction
   * itérative fonctionne : avant, chaque tentative de correction régénérait
   * une forme totalement aléatoire différente (nouveaux angles ET nouvelle
   * irrégularité à chaque appel), donc ajuster le rayon n'avait aucune prise
   * réelle sur la distance obtenue — d'où des écarts erratiques et non
   * convergents (-73% puis +105% sur la même cible, par exemple).
   */
  function makeShape(vertices, seedBearing) {
    const shape = [];
    for (let i = 0; i < vertices; i++) {
      shape.push({
        bearing: seedBearing + (360 / vertices) * i + (Math.random() * 20 - 10),
        factor: 0.85 + Math.random() * 0.3
      });
    }
    return shape;
  }

  /** Projette la forme fixe à un rayon donné (mètres) autour du départ. */
  function pointsFromShape(start, shape, radius) {
    const pts = shape.map(s => destinationPoint(start.lat, start.lon, s.bearing, radius * s.factor));
    return [start, ...pts, { ...start }];
  }

  /** Score de qualité d'une tentative : plus bas = meilleur. Le chevauchement pèse le plus lourd. */
  function scoreAttempt(r) {
    return (r.overlapRatio || 0) * 200 + Math.abs(r.deltaPct || 0);
  }

  function annotate(result, targetDistanceM) {
    result.targetDistanceM = targetDistanceM;
    result.deltaPct = targetDistanceM
      ? Math.round(((result.distanceM - targetDistanceM) / targetDistanceM) * 100)
      : null;
    return result;
  }

  async function tryRoundTrip(start, targetDistanceM, mode, seed, orsState) {
    // orsState.length est corrigé d'une tentative à l'autre, exactement comme
    // state.radius pour le repli polygone (voir tryPolygon ci-dessous) — ce
    // correctif manquait : avant, chaque tentative round-trip redemandait
    // littéralement la distance cible, même si la précédente avait débordé
    // de +100%, d'où des écarts qui ne s'amélioraient jamais d'un essai à
    // l'autre.
    const requestLength = orsState ? orsState.length : targetDistanceM;
    const result = await RPRouting.routeRoundTrip(start, requestLength, mode, seed);
    const validated = annotate(validateAndFlag(result), targetDistanceM);
    if (orsState && targetDistanceM > 0 && validated.distanceM > 0 && Math.abs(validated.deltaPct) > 10) {
      const ratio = targetDistanceM / validated.distanceM;
      orsState.length *= Math.pow(ratio, 0.7);
    }
    return validated;
  }

  /**
   * state.radius est corrigé d'une tentative à l'autre en fonction de l'écart
   * mesuré, TOUJOURS sur la même forme (voir makeShape) — c'est ce qui rend
   * la convergence possible. La correction est amortie (exposant 0.7 plutôt
   * que 1) pour éviter les oscillations en terrain irrégulier, où la relation
   * rayon → distance réelle n'est jamais parfaitement linéaire.
   */
  async function tryPolygon(start, targetDistanceM, mode, shape, state, skipOrs) {
    const pts = pointsFromShape(start, shape, state.radius);
    const result = await RPRouting.route(pts, mode, skipOrs);
    const validated = annotate(validateAndFlag(result), targetDistanceM);
    RPDiag.log('info', `Tentative boucle : rayon ${Math.round(state.radius)} m → ${(validated.distanceM / 1000).toFixed(2)} km (écart ${validated.deltaPct}%).`);
    if (targetDistanceM > 0 && validated.distanceM > 0 && Math.abs(validated.deltaPct) > 10) {
      const ratio = targetDistanceM / validated.distanceM;
      state.radius *= Math.pow(ratio, 0.7); // correction amortie, converge sans osciller
    }
    return validated;
  }

  /** Génère plusieurs tentatives (ORS round-trip puis repli polygone) et garde la meilleure. */
  async function bestOfAttempts(start, targetDistanceM, mode, fixedVertices, randomizeBearing) {
    const attempts = [];
    const vertices = fixedVertices || (5 + Math.floor(Math.random() * 4)); // fixé une fois pour tout l'appel
    let seedBearing = randomizeBearing ? Math.random() * 360 : 0;
    let shape = makeShape(vertices, seedBearing);
    const initialRadius = (targetDistanceM / CIRCUITY) / (2 * Math.PI);
    const polygonState = { radius: initialRadius };
    const orsState = { length: targetDistanceM };
    let orsAvailable = true;
    let overlapStreak = 0; // nombre de tentatives consécutives avec chevauchement, SUR LA MÊME forme

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      let attempt = null;
      if (orsAvailable) {
        try {
          attempt = await tryRoundTrip(start, targetDistanceM, mode, Date.now() % 100000 + i, orsState);
        } catch (e) {
          orsAvailable = false; // inutile de retenter ORS aux tours suivants (pas de clé / échec net)
          RPDiag.log('info', `Boucle native ORS indisponible (${e.message}), repli sur construction polygonale.`);
        }
      }
      if (!attempt) {
        try {
          // skipOrs = true dès qu'on sait qu'ORS est indisponible pour cette
          // génération : évite de le retenter à chaque tentative polygonale.
          attempt = await tryPolygon(start, targetDistanceM, mode, shape, polygonState, !orsAvailable);
        } catch (e) {
          RPDiag.log('warn', `Tentative de boucle ${i + 1} échouée: ${e.message}`);
        }
      }
      if (attempt) {
        attempts.push(attempt);
        if (!attempt.hasSignificantOverlap && Math.abs(attempt.deltaPct) <= 15) break; // assez bon, on arrête
        // Un chevauchement persistant suggère une impasse du réseau local —
        // mais un SEUL chevauchement peut aussi n'être qu'un rayon encore mal
        // calé (la correction n'a pas eu le temps de converger). On laisse
        // donc 2 tentatives à la MÊME forme avant de conclure qu'elle est
        // structurellement mauvaise et d'en tirer une nouvelle — avant, on
        // changeait de forme dès le premier chevauchement, ce qui jetait la
        // correction de rayon en cours et produisait des écarts erratiques
        // au lieu de converger (34% → 52% → 51%… observé en test terrain).
        if (attempt.hasSignificantOverlap && !orsAvailable) {
          overlapStreak++;
          if (overlapStreak >= 2) {
            seedBearing = randomizeBearing ? Math.random() * 360 : seedBearing + 53;
            shape = makeShape(vertices, seedBearing);
            polygonState.radius = initialRadius;
            overlapStreak = 0;
          }
        } else {
          overlapStreak = 0;
        }
      }
    }

    if (attempts.length === 0) throw new Error('Impossible de générer une boucle : aucun itinéraire obtenu après plusieurs tentatives.');
    attempts.sort((a, b) => scoreAttempt(a) - scoreAttempt(b));
    const best = attempts[0];
    if (attempts.length > 1) {
      RPDiag.log('info', `${attempts.length} tentative(s) générée(s), la meilleure retenue (${best.source}, écart ${best.deltaPct}% vs cible).`);
    }
    if (best.hasSignificantOverlap) {
      RPDiag.log('warn', 'Toutes les tentatives contiennent un chevauchement ; le réseau routier local est probablement peu maillé ici.');
    }
    return best;
  }

  /** Boucle simple. */
  async function generateLoop(start, targetDistanceM, mode) {
    return bestOfAttempts(start, targetDistanceM, mode, 6, false);
  }

  /** Boucle aléatoire : bearing de départ et nombre de sommets randomisés. */
  async function generateRandomLoop(start, targetDistanceM, mode) {
    return bestOfAttempts(start, targetDistanceM, mode, null, true);
  }

  /** Aller-retour simple sur un cap donné (ou aléatoire) — l'aller-retour est ICI volontaire. */
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

  /**
   * Détecte les allers-retours (leçon #4) : chevauchement global ET local.
   */
  function validateAndFlag(result) {
    const coords = result.coords;
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
    return result;
  }

  return {
    generateLoop, generateRandomLoop, generateOutAndBack,
    generatePointToPoint, generateWaypointLoop, destinationPoint, bearingBetween
  };
})();
