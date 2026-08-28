/**
 * exercises.js — Séances structurées (la vraie nouveauté vs RoadPlanner).
 * Construit un parcours "support" via RPLoops/RPRouting, puis découpe la
 * géométrie résultante en segments Effort / Récupération étiquetés,
 * en réutilisant l'esthétique "étiquette bib" (voir css + ui.js renderSplitLabel).
 */

const RPExercises = (() => {

  /**
   * Fractionné : reps × (effort + récup), sur aller-retour ou boucle plate/calme.
   * params: { start, reps, effortValue, effortUnit('m'|'min'), recoveryValue, recoveryUnit('m'|'min'),
   *           shape: 'aller-retour'|'boucle', paceMps (allure estimée m/s pour convertir temps<->distance) }
   */
  async function buildFractionne(params) {
    const { start, reps, effortValue, effortUnit, recoveryValue, recoveryUnit, shape, paceMps } = params;

    const effortM = effortUnit === 'min' ? effortValue * 60 * paceMps : effortValue;
    const recoveryM = recoveryUnit === 'min' ? recoveryValue * 60 * paceMps : recoveryValue;
    const totalOneWay = (effortM + recoveryM) * Math.ceil(reps / 2); // aller-retour: on parcourt le tronçon plusieurs fois

    let base;
    if (shape === 'boucle') {
      base = await RPLoops.generateLoop(start, (effortM + recoveryM) * reps, 'exercices');
    } else {
      // aller-retour sur un tronçon plat : on route un aller simple de longueur (effort+récup),
      // puis on répète virtuellement ce tronçon `reps` fois en alternant le sens.
      const bearing = Math.random() * 360;
      const turnaround = RPLoops.destinationPoint(start.lat, start.lon, bearing, effortM + recoveryM);
      base = await RPRouting.route([start, turnaround], 'exercices');
    }

    const segments = sliceIntoIntervalSegments(base.coords, effortM, recoveryM, reps);
    return {
      type: 'fractionne',
      distanceM: segments.reduce((s, seg) => s + seg.distanceM, 0),
      segments,
      raw: base
    };
  }

  /**
   * Côtes : cherche une pente à proximité via l'altitude déjà récupérée (elevation:true),
   * propose un aller-retour répété dessus.
   */
  async function buildCotes(params) {
    const { start, reps, searchRadiusM = 1500, minGradePct = 4 } = params;

    // Sonde plusieurs directions pour trouver un tronçon avec dénivelé suffisant.
    const candidates = [];
    for (let b = 0; b < 360; b += 45) {
      const probe = RPLoops.destinationPoint(start.lat, start.lon, b, searchRadiusM);
      try {
        const r = await RPRouting.route([start, probe], 'exercices');
        const grade = estimateAverageGrade(r.coords);
        candidates.push({ bearing: b, route: r, grade });
      } catch (e) {
        RPDiag.log('warn', `Sonde côte ${b}° échouée: ${e.message}`);
      }
    }

    candidates.sort((a, b) => Math.abs(b.grade) - Math.abs(a.grade));
    const best = candidates[0];
    if (!best || Math.abs(best.grade) < minGradePct * 0.4) {
      RPDiag.log('warn', 'Aucune pente marquée trouvée à proximité, résultat approximatif.');
    }

    const segments = [];
    for (let i = 0; i < reps; i++) {
      segments.push({ label: `Côte ${i + 1}`, type: 'effort', coords: best ? best.route.coords : [], distanceM: best ? best.route.distanceM : 0 });
      segments.push({ label: `Récup ${i + 1}`, type: 'recovery', coords: best ? [...best.route.coords].reverse() : [], distanceM: best ? best.route.distanceM : 0 });
    }

    return {
      type: 'cotes',
      distanceM: segments.reduce((s, seg) => s + seg.distanceM, 0),
      grade: best?.grade ?? null,
      segments,
      raw: best?.route ?? null
    };
  }

  /** Sortie longue / Tempo / Récupération : variantes d'habillage du mode Route ou Chemins. */
  async function buildVariant(params) {
    const { start, targetDistanceM, terrain, variant } = params; // terrain: 'route'|'chemins'
    const result = await RPLoops.generateLoop(start, targetDistanceM, terrain === 'chemins' ? 'chemins' : 'route');
    return {
      type: variant, // 'sortie-longue' | 'tempo' | 'recuperation'
      distanceM: result.distanceM,
      segments: [{ label: labelForVariant(variant), type: 'variant', coords: result.coords, distanceM: result.distanceM }],
      raw: result
    };
  }

  function labelForVariant(variant) {
    return { 'sortie-longue': 'Sortie longue', tempo: 'Tempo', recuperation: 'Récupération' }[variant] || variant;
  }

  /** Découpe une polyligne en segments effort/récup alternés, cumul de distance. */
  function sliceIntoIntervalSegments(coords, effortM, recoveryM, reps) {
    const segments = [];
    let cursor = 0; // index dans coords
    let cursorDist = 0;
    let effortCount = 0, recoveryCount = 0;

    const pattern = [];
    for (let i = 0; i < reps; i++) pattern.push({ len: effortM, type: 'effort', label: `Effort ${++effortCount}` });
    // insère les récups entre les efforts (pas après le dernier)
    const withRecovery = [];
    pattern.forEach((seg, i) => {
      withRecovery.push(seg);
      if (i < pattern.length - 1) withRecovery.push({ len: recoveryM, type: 'recovery', label: `Récup ${++recoveryCount}` });
    });

    for (const spec of withRecovery) {
      const segCoords = [coords[cursor]];
      let segDist = 0;
      while (cursor < coords.length - 1 && segDist < spec.len) {
        const a = coords[cursor], b = coords[cursor + 1];
        segDist += RPRouting.haversine({ lat: a[0], lon: a[1] }, { lat: b[0], lon: b[1] });
        cursor++;
        segCoords.push(b);
        if (cursor >= coords.length - 1) cursor = 0; // boucle sur le tronçon si trop court (aller-retour répété)
      }
      segments.push({ label: spec.label, type: spec.type, coords: segCoords, distanceM: segDist });
      cursorDist += segDist;
    }
    return segments;
  }

  /** Estime la pente moyenne (%) d'une trace [lat,lon,ele][]. */
  function estimateAverageGrade(coords) {
    if (coords.length < 2) return 0;
    const eleStart = coords[0][2] || 0;
    const eleEnd = coords[coords.length - 1][2] || 0;
    const dist = RPRouting.polylineLength(coords);
    if (dist === 0) return 0;
    return ((eleEnd - eleStart) / dist) * 100;
  }

  return { buildFractionne, buildCotes, buildVariant };
})();
