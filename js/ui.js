/**
 * ui.js — Câblage de l'interface : onglets de mode, formulaires, résultats,
 * étiquettes "bib" sur la carte (km, effort/récup), panneau mobile coulissant.
 */

const RPUi = (() => {
  let currentMode = 'route'; // route | chemins | exercices
  let startPoint = null;
  let endPoint = null;
  let waypoints = [];
  let lastResult = null;
  let lastSegments = null;
  let placingFor = null; // 'start' | 'end' | 'waypoint' | null

  function init() {
    initModeTabs();
    initPanelToggle();
    initSearchBox();
    initMapClickHandling();
    initGenerateButton();
    initExportButtons();
    initExerciseSubforms();
    RPTheme.init();
    RPDiag.log('info', 'Interface initialisée.');
  }

  // ---------- Onglets de mode ----------
  function initModeTabs() {
    document.querySelectorAll('.rp-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.rp-tab').forEach(t => t.classList.remove('rp-tab-active'));
        tab.classList.add('rp-tab-active');
        currentMode = tab.dataset.mode;
        document.querySelectorAll('.rp-mode-panel').forEach(p => {
          p.hidden = p.dataset.forMode !== currentMode;
        });
        RPDiag.log('info', `Mode sélectionné : ${currentMode}`);
      });
    });
  }

  // ---------- Panneau mobile coulissant ----------
  function initPanelToggle() {
    const handle = document.getElementById('panel-handle');
    const sheet = document.getElementById('rp-sheet');
    if (!handle || !sheet) return;
    handle.addEventListener('click', () => {
      sheet.classList.toggle('rp-sheet-expanded');
    });
  }

  // ---------- Recherche d'adresse ----------
  function initSearchBox() {
    const input = document.getElementById('address-search');
    const results = document.getElementById('address-results');
    if (!input || !results) return;

    let debounce = null;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      const q = input.value;
      debounce = setTimeout(async () => {
        const matches = await RPGeocoder.search(q);
        results.innerHTML = '';
        matches.forEach(m => {
          const li = document.createElement('li');
          li.textContent = m.label;
          li.addEventListener('click', () => {
            setPoint({ lat: m.lat, lon: m.lon }, placingFor || 'start');
            input.value = m.label;
            results.innerHTML = '';
          });
          results.appendChild(li);
        });
      }, 400);
    });
  }

  // ---------- Placement de points sur la carte ----------
  function initMapClickHandling() {
    const map = RPMap.getMap();
    map.on('click', (e) => {
      const target = placingFor || (startPoint ? 'waypoint' : 'start');
      setPoint({ lat: e.latlng.lat, lon: e.latlng.lng }, target);
    });

    document.getElementById('set-start-btn')?.addEventListener('click', () => placingFor = 'start');
    document.getElementById('set-end-btn')?.addEventListener('click', () => placingFor = 'end');
    document.getElementById('add-waypoint-btn')?.addEventListener('click', () => placingFor = 'waypoint');
  }

  function setPoint(point, target) {
    const markers = RPMap.getMarkersLayer();
    if (target === 'start') {
      startPoint = point;
      addOrMoveMarker('start', point, '🏁 Départ', '#35D4A7');
    } else if (target === 'end') {
      endPoint = point;
      addOrMoveMarker('end', point, '🏁 Arrivée', '#FF5A3C');
    } else {
      waypoints.push(point);
      L.circleMarker([point.lat, point.lon], { radius: 6, color: '#E8C15A', fillOpacity: 1 })
        .addTo(markers).bindTooltip(`Point ${waypoints.length}`);
    }
    placingFor = null;
  }

  const markerRefs = {};
  function addOrMoveMarker(key, point, label, color) {
    const markers = RPMap.getMarkersLayer();
    if (markerRefs[key]) markers.removeLayer(markerRefs[key]);
    markerRefs[key] = L.circleMarker([point.lat, point.lon], { radius: 8, color, fillOpacity: 1 })
      .addTo(markers).bindTooltip(label, { permanent: false });
  }

  // ---------- Génération ----------
  function initGenerateButton() {
    document.getElementById('generate-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('generate-btn');
      btn.disabled = true;
      btn.textContent = 'Génération…';
      try {
        await generateForCurrentMode();
      } catch (e) {
        RPDiag.log('error', 'Génération échouée: ' + e.message);
        showError(e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Générer le parcours';
      }
    });
  }

  async function generateForCurrentMode() {
    if (!startPoint) throw new Error('Placez un point de départ (recherche ou clic carte).');
    RPMap.clearRoute(currentMode);
    clearSegmentLabels();

    const subMode = document.querySelector(`.rp-mode-panel[data-for-mode="${currentMode}"] .rp-submode.rp-active`)?.dataset.submode || 'boucle';
    const distanceKm = parseFloat(document.getElementById(`${currentMode}-distance`)?.value || '5');
    const targetM = distanceKm * 1000;

    let result;
    if (currentMode === 'exercices') {
      result = await generateExercise();
    } else if (subMode === 'boucle') {
      result = await RPLoops.generateLoop(startPoint, targetM, currentMode);
    } else if (subMode === 'boucle-aleatoire') {
      result = await RPLoops.generateRandomLoop(startPoint, targetM, currentMode);
    } else if (subMode === 'aller-retour') {
      result = await RPLoops.generateOutAndBack(startPoint, targetM, currentMode);
    } else if (subMode === 'a-vers-b') {
      if (!endPoint) throw new Error('Placez un point d\'arrivée pour le mode Aller A→B.');
      result = await RPLoops.generatePointToPoint(startPoint, endPoint, targetM, currentMode);
    } else if (subMode === 'points-de-passage') {
      if (waypoints.length < 1) throw new Error('Ajoutez au moins un point de passage.');
      result = await RPLoops.generateWaypointLoop([startPoint, ...waypoints], currentMode);
    } else if (subMode === 'visite-citadine') {
      const pois = await RPCityTour.findPois(startPoint.lat, startPoint.lon, 2000);
      renderPoiList(pois);
      const selected = pois.slice(0, 5); // sélection par défaut, l'utilisateur peut ajuster via la liste
      result = await RPCityTour.buildCityTour(startPoint, selected, 'route');
    }

    if (!result) return;
    lastResult = result;
    lastSegments = result.segments || null;
    drawResult(result);
    renderSummary(result);
  }

  async function generateExercise() {
    const type = document.querySelector('#exercices-panel .rp-submode.rp-active')?.dataset.submode || 'fractionne';
    const paceMinKm = parseFloat(document.getElementById('exo-pace')?.value || '5.5');
    const paceMps = 1000 / (paceMinKm * 60);

    if (type === 'fractionne') {
      const reps = parseInt(document.getElementById('exo-reps')?.value || '6', 10);
      const effortValue = parseFloat(document.getElementById('exo-effort-value')?.value || '400');
      const effortUnit = document.getElementById('exo-effort-unit')?.value || 'm';
      const recoveryValue = parseFloat(document.getElementById('exo-recovery-value')?.value || '200');
      const recoveryUnit = document.getElementById('exo-recovery-unit')?.value || 'm';
      const shape = document.getElementById('exo-shape')?.value || 'aller-retour';
      return await RPExercises.buildFractionne({ start: startPoint, reps, effortValue, effortUnit, recoveryValue, recoveryUnit, shape, paceMps });
    }
    if (type === 'cotes') {
      const reps = parseInt(document.getElementById('cote-reps')?.value || '6', 10);
      return await RPExercises.buildCotes({ start: startPoint, reps });
    }
    // sortie-longue | tempo | recuperation
    const distanceKm = parseFloat(document.getElementById('variant-distance')?.value || '10');
    const terrain = document.getElementById('variant-terrain')?.value || 'route';
    return await RPExercises.buildVariant({ start: startPoint, targetDistanceM: distanceKm * 1000, terrain, variant: type });
  }

  function initExerciseSubforms() {
    document.querySelectorAll('.rp-submode').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = btn.closest('.rp-mode-panel');
        group.querySelectorAll('.rp-submode').forEach(b => b.classList.remove('rp-active'));
        btn.classList.add('rp-active');
        group.querySelectorAll('.rp-subform').forEach(f => {
          f.hidden = f.dataset.submode !== btn.dataset.submode;
        });
      });
    });
  }

  // ---------- Rendu carte ----------
  function drawResult(result) {
    const layer = RPMap.getRouteLayer(currentMode);
    const latlngs = result.coords.map(c => [c[0], c[1]]);

    if (result.segments && result.segments.length) {
      result.segments.forEach(seg => {
        const color = seg.type === 'effort' ? '#FF5A3C' : seg.type === 'recovery' ? '#35D4A7' : '#E8C15A';
        const segLatLngs = seg.coords.map(c => [c[0], c[1]]);
        if (segLatLngs.length > 1) {
          L.polyline(segLatLngs, { color, weight: 5, opacity: 0.9 }).addTo(layer);
        }
        renderSplitLabel(seg.coords[Math.floor(seg.coords.length / 2)], seg.label, color);
      });
    } else {
      const color = currentMode === 'chemins' ? '#E8C15A' : currentMode === 'exercices' ? '#FF5A3C' : '#35D4A7';
      L.polyline(latlngs, { color, weight: 5, opacity: 0.9 }).addTo(layer);
      renderKmLabels(result.coords, layer);
    }

    if (result.hasSignificantOverlap) {
      L.popup().setLatLng(latlngs[0]).setContent(
        '⚠️ Cet itinéraire contient une portion en aller-retour non désiré. Essayez de régénérer.'
      ).openOn(RPMap.getMap());
    }

    RPMap.fitToLayer(currentMode);
  }

  /** Étiquettes km, style "bib" (marqueur de dossard), tous les kilomètres. */
  function renderKmLabels(coords, layer) {
    let cum = 0, nextKm = 1;
    for (let i = 1; i < coords.length; i++) {
      cum += RPRouting.haversine({ lat: coords[i - 1][0], lon: coords[i - 1][1] }, { lat: coords[i][0], lon: coords[i][1] });
      if (cum >= nextKm * 1000) {
        renderSplitLabel(coords[i], `${nextKm} km`, '#F4F1E8', true);
        nextKm++;
      }
    }
  }

  function renderSplitLabel(coord, text, color, isKm = false) {
    if (!coord) return;
    const icon = L.divIcon({
      className: 'rp-bib-label' + (isKm ? ' rp-bib-km' : ''),
      html: `<span style="--rp-bib-color:${color}">${text}</span>`,
      iconSize: null
    });
    L.marker([coord[0], coord[1]], { icon }).addTo(RPMap.getRouteLayer(currentMode));
  }

  function clearSegmentLabels() {
    // Les étiquettes sont dans le featureGroup du mode ; clearRoute() les retire déjà.
  }

  function renderPoiList(pois) {
    const container = document.getElementById('poi-list');
    if (!container) return;
    container.innerHTML = '';
    const poiLayer = RPMap.getPoiLayer();
    poiLayer.clearLayers();
    pois.forEach(p => {
      L.circleMarker([p.lat, p.lon], { radius: 5, color: '#E8C15A' })
        .addTo(poiLayer).bindTooltip(`${p.name} (${p.category})`);
      const li = document.createElement('li');
      li.textContent = `${p.name} — ${p.category} (${Math.round(p.distanceM)} m)`;
      container.appendChild(li);
    });
  }

  function renderSummary(result) {
    const el = document.getElementById('result-summary');
    if (!el) return;
    const km = (result.distanceM / 1000).toFixed(2);
    const dur = result.durationS ? formatDuration(result.durationS) : '—';
    el.innerHTML = `
      <div class="rp-summary-card">
        <span class="rp-summary-figure">${km} <small>km</small></span>
        <span class="rp-summary-sub">${dur} · source : ${result.source || 'segments composés'}</span>
        ${result.deltaPct != null ? `<span class="rp-summary-delta">${result.deltaPct > 0 ? '+' : ''}${result.deltaPct}% vs cible</span>` : ''}
      </div>`;
    el.hidden = false;
  }

  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  }

  function showError(message) {
    const el = document.getElementById('result-summary');
    if (!el) { alert(message); return; }
    el.innerHTML = `<div class="rp-error">⚠️ ${message}</div>`;
    el.hidden = false;
  }

  // ---------- Export ----------
  function initExportButtons() {
    document.getElementById('export-gpx')?.addEventListener('click', () => exportCurrent('gpx'));
    document.getElementById('export-tcx')?.addEventListener('click', () => exportCurrent('tcx'));
    document.getElementById('export-fit')?.addEventListener('click', () => exportCurrent('fit'));
  }

  function exportCurrent(format) {
    if (!lastResult) return showError('Générez un parcours avant d\'exporter.');
    const name = `RunPlanner_${currentMode}_${new Date().toISOString().slice(0, 10)}`;
    if (format === 'gpx') RPExport.exportGpx(lastResult.coords, name, lastSegments);
    if (format === 'tcx') RPExport.exportTcx(lastResult.coords, name, lastSegments);
    if (format === 'fit') RPExport.exportFit(lastResult.coords, name, lastSegments);
    RPDiag.log('info', `Export ${format.toUpperCase()} déclenché.`);
  }

  return { init };
})();
