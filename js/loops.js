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
  /**
   * Aller-retour : si une arrivée a été placée, va jusque-là puis revient
   * (l'arrivée définit le point de retournement) — avant, l'arrivée était
   * totalement ignorée et un point de retournement aléatoire était choisi à
   * chaque fois, ce qui rendait le mode difficile à comprendre ("pourquoi ça
   * part dans cette direction ?"). Sans arrivée placée, comportement
   * inchangé : direction aléatoire (ou imposée), sur la moitié de la
   * distance cible.
   */
  async function generateOutAndBack(start, targetDistanceM, mode, end = null, bearingDeg = null) {
    const usedEndPoint = !!end;
    const turnaround = usedEndPoint
      ? end
      : destinationPoint(start.lat, start.lon, bearingDeg ?? Math.random() * 360, targetDistanceM / 2);

    const result = await RPRouting.route([start, turnaround, start], mode);
    // Pas de comparaison "% vs cible" quand l'arrivée pilote le point de
    // retournement : la distance obtenue dépend alors de là où elle a été
    // placée, pas de la distance cible saisie — l'écart n'aurait pas de sens.
    const finalResult = usedEndPoint ? result : annotate(result, targetDistanceM);
    return { ...finalResult, kind: 'aller-retour', isIntentionalOutAndBack: true, usedEndPoint };
  }

  /**
   * A → B direct, ou avec détours pour allonger jusqu'à une distance cible.
   * Si des points de passage explicites ont été placés par l'utilisateur, ils
   * sont respectés en priorité (route ordonnée start → passages → end) — le
   * détour synthétique automatique ne s'applique que si aucun point de
   * passage n'a été placé (avant, les points de passage étaient purement et
   * simplement ignorés en mode A→B, alors que l'interface permet pourtant
   * d'en ajouter quel que soit le sous-mode actif).
   */
  /**
   * A → B direct, ou avec détours pour allonger jusqu'à une distance cible.
   * closeLoop=true ajoute un retour au départ après l'arrivée (nouvelle
   * option "Fermer la boucle").
   */
  async function generatePointToPoint(start, end, targetDistanceM, mode, waypoints = [], closeLoop = false) {
    if (waypoints.length > 0) {
      const points = closeLoop ? [start, ...waypoints, end, start] : [start, ...waypoints, end];
      const result = await RPRouting.route(points, mode);
      return { ...validateAndFlag(result), kind: closeLoop ? 'a-vers-b-points-de-passage-boucle' : 'a-vers-b-points-de-passage' };
    }

    const directPoints = closeLoop ? [start, end, start] : [start, end];
    const direct = await RPRouting.route(directPoints, mode);
    if (!targetDistanceM || direct.distanceM >= targetDistanceM * 0.95) {
      return { ...direct, kind: closeLoop ? 'a-vers-b-boucle' : 'a-vers-b' };
    }
    const mid = { lat: (start.lat + end.lat) / 2, lon: (start.lon + end.lon) / 2 };
    const bearingDirect = bearingBetween(start, end);
    const remainingM = targetDistanceM - direct.distanceM;
    const detourOffset = destinationPoint(mid.lat, mid.lon, bearingDirect + 90, remainingM / (2 * CIRCUITY));
    const detourPoints = closeLoop ? [start, detourOffset, end, start] : [start, detourOffset, end];
    const withDetour = await RPRouting.route(detourPoints, mode);
    return { ...withDetour, kind: closeLoop ? 'a-vers-b-detour-boucle' : 'a-vers-b-detour' };
  }

  /** Boucle par points de passage explicites (déjà géocodés), fermée sur le départ. */
  /**
   * Boucle par points de passage explicites (déjà géocodés), fermée sur le
   * départ. Avec un SEUL point de passage utilisateur (donc waypoints =
   * [départ, point]), un aller-retour pur est presque inévitable
   * géométriquement : rien ne force le routeur à emprunter un chemin de
   * retour différent de l'aller. On insère alors un point de déviation
   * synthétique (perpendiculaire à l'axe départ→point) pour donner une
   * vraie forme de boucle plutôt qu'un simple aller-retour — avec 2 points
   * de passage ou plus, la forme existe déjà naturellement, pas besoin.
   */
  async function generateWaypointLoop(waypoints, mode) {
    if (waypoints.length < 2) throw new Error('Il faut au moins 2 points de passage.');

    let routePoints;
    if (waypoints.length === 2) {
      const [start, wp] = waypoints;
      const bearing = bearingBetween(start, wp);
      const distToWp = RPRouting.haversine(start, wp);
      const mid = { lat: (start.lat + wp.lat) / 2, lon: (start.lon + wp.lon) / 2 };
      const detour = destinationPoint(mid.lat, mid.lon, bearing + 90, distToWp * 0.35);
      routePoints = [start, wp, detour, start];
    } else {
      routePoints = [...waypoints, waypoints[0]];
    }

    const result = await RPRouting.route(routePoints, mode);
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
  /**
   * Détecte les portions en aller-retour ET retourne leurs bornes précises
   * (index de début/fin dans `coords`), pas seulement un ratio global —
   * indispensable pour permettre à l'utilisateur de sélectionner et tronquer
   * une portion précise plutôt que de simplement être averti qu'il y en a
   * quelque part sur le tracé.
   *
   * v0.8.1 — correction d'un bug de conception important : la version
   * précédente considérait que deux points proches l'un de l'autre
   * signifiaient un aller-retour, quel que soit le chemin entre les deux.
   * Or TOUTE boucle fermée revient forcément près de son propre point de
   * départ — ce simple critère de proximité capturait donc systématiquement
   * la totalité du tracé comme un unique "chevauchement" géant (visible à
   * l'écran : tout le trajet en violet, y compris sans aucun vrai
   * aller-retour). Un vrai aller-retour n'est pas juste "deux points
   * proches" : c'est un trajet qui revient sur SES PROPRES PAS, c'est-à-dire
   * que la portion i→milieu et la portion milieu→j (parcourue à l'envers)
   * se superposent presque point pour point. C'est ce qu'on vérifie
   * maintenant avant de retenir un candidat.
   */
  function findOverlapSegments(coords, thresholdM = 15, minGapPoints = 6) {
    const segments = [];
    let i = 0;
    while (i < coords.length - minGapPoints) {
      let matchJ = -1;
      for (let j = i + minGapPoints; j < coords.length; j++) {
        const d = RPRouting.haversine(
          { lat: coords[i][0], lon: coords[i][1] },
          { lat: coords[j][0], lon: coords[j][1] }
        );
        if (d < thresholdM && isGenuineOutAndBack(coords, i, j, thresholdM)) { matchJ = j; break; }
      }
      if (matchJ !== -1) {
        const removedDistanceM = RPRouting.polylineLength(coords.slice(i, matchJ + 1));
        segments.push({ startIndex: i, endIndex: matchJ, removedDistanceM });
        i = matchJ + 1; // reprend après ce tronçon, évite les chevauchements de détection
      } else {
        i++;
      }
    }
    return segments;
  }

  /** Vérifie que la portion i→j est un aller-retour réel : la première
   *  moitié (i→milieu) et la seconde moitié parcourue à l'envers (j→milieu)
   *  doivent se superposer sur la majorité des points échantillonnés —
   *  faute de quoi ce n'est qu'une simple boucle qui repasse près d'un
   *  ancien point sans revenir sur ses pas. */
  function isGenuineOutAndBack(coords, i, j, thresholdM) {
    const half = Math.floor((j - i) / 2);
    if (half < 2) return false;
    const step = Math.max(1, Math.floor(half / 8)); // ~8 points échantillonnés
    let matches = 0, total = 0;
    for (let k = step; k < half; k += step) {
      const a = coords[i + k];
      const b = coords[j - k];
      const d = RPRouting.haversine({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] });
      total++;
      if (d < thresholdM * 2) matches++; // tolérance un peu plus large que le seuil de base
    }
    return total > 0 && (matches / total) > 0.6;
  }

  function validateAndFlag(result) {
    const coords = result.coords;
    // Coût en O(n²) : sur un tracé anormalement long (plusieurs milliers de
    // points), on se contente du signal global sans chercher les bornes
    // précises, pour rester réactif.
    const segments = coords.length <= 2000 ? findOverlapSegments(coords) : [];
    const overlapM = segments.reduce((sum, s) => sum + s.removedDistanceM, 0);

    result.overlapSegments = segments;
    const overlapRatio = result.distanceM > 0 ? overlapM / result.distanceM : 0;
    result.overlapRatio = overlapRatio;
    result.hasSignificantOverlap = overlapRatio > 0.15 || segments.length > 3;
    return result;
  }

  /** Ré-exécute la détection de chevauchement après une troncature manuelle
   *  (voir ui.js), et met à jour l'écart vs cible si une cible existait. */
  function revalidate(result) {
    const validated = validateAndFlag(result);
    if (result.targetDistanceM) {
      validated.deltaPct = Math.round(((validated.distanceM - result.targetDistanceM) / result.targetDistanceM) * 100);
    }
    return validated;
  }

  return {
    generateLoop, generateRandomLoop, generateOutAndBack,
    generatePointToPoint, generateWaypointLoop, destinationPoint, bearingBetween,
    revalidate
  };
})();
