/**
 * ui.js — Câblage de l'interface : onglets de mode, formulaires, résultats,
 * étiquettes "bib" sur la carte, panneau mobile coulissant.
 *
 * v0.2.0 — correctifs :
 *  - RPTheme.init() n'est plus appelé ici (il ne l'est que depuis app.js) :
 *    l'appeler deux fois attachait deux écouteurs de clic sur le bouton de
 *    thème, qui basculait donc deux fois de suite = aucun changement visible.
 *  - Chaque étape d'initialisation ci-dessous est isolée en try/catch :
 *    avant, une erreur dans une seule étape (ex: un champ manquant) stoppait
 *    net l'exécution de RPUi.init(), ce qui désactivait AUSSI tous les
 *    écouteurs suivants (clic carte, bouton générer, exports...). C'est la
 *    cause la plus probable du "clic sur la carte ne fait rien".
 *  - Ajout : géolocalisation automatique + bouton "Me localiser".
 *  - Ajout : champs d'adresse séparés pour départ / arrivée / point de passage.
 *  - Clic carte : le mode "départ" reste actif par défaut après chaque clic
 *    (avant, un 2e clic sans bouton pressé ajoutait silencieusement un point
 *    de passage au lieu de déplacer le départ, ce qui semblait ne "rien faire"
 *    de prévisible).
 */

const RPUi = (() => {
  let currentMode = 'route'; // route | chemins | exercices
  let startPoint = null;
  let endPoint = null;
  let waypoints = []; // [{ point:{lat,lon}, marker, label }]
  let lastResult = null;
  let lastSegments = null;
  // (placingFor supprimé en v0.6.4 : le placement se fait via recherche
  // d'adresse ou appui long / clic droit, plus par simple clic sur la carte.)
  let startSetAutomatically = false;

  function init() {
    const steps = [
      ['onglets de mode', initModeTabs],
      ['panneau mobile', initPanelToggle],
      ['recherche d\'adresses', initAddressFields],
      ['géolocalisation', initGeolocation],
      ['clic sur la carte', initMapClickHandling],
      ['inversion départ/arrivée', initReverseButton],
      ['synchronisation distance route/chemins', initSharedDistance],
      ['bouton générer', initGenerateButton],
      ['boutons d\'export', initExportButtons],
      ['sous-formulaires exercices', initExerciseSubforms],
    ];
    for (const [name, fn] of steps) {
      try {
        fn();
      } catch (e) {
        console.error(`RPUi.init: échec de l'étape "${name}"`, e);
        try { RPDiag.log('error', `Échec init UI "${name}": ${e.message}`); } catch (_) {}
      }
    }
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
        // Les tracés des autres modes restaient affichés en même temps sur
        // la carte (chaque mode a son propre calque, jamais nettoyé par les
        // autres), créant un empilement confus de tracés et d'étiquettes.
        // On repart d'une carte propre à chaque changement d'onglet.
        RPMap.clearAllRoutes();
        resetResultDisplay();
        RPDiag.log('info', `Mode sélectionné : ${currentMode}`);
      });
    });
  }

  function resetResultDisplay() {
    lastResult = null;
    lastSegments = null;
    const summary = document.getElementById('result-summary');
    if (summary) summary.hidden = true;
    const elevation = document.getElementById('elevation-profile');
    if (elevation) elevation.hidden = true;
  }

  // ---------- Panneau mobile coulissant ----------
  function initPanelToggle() {
    const handle = document.getElementById('panel-handle');
    const sheet = document.getElementById('rp-sheet');
    if (!handle || !sheet) return;
    handle.addEventListener('click', () => {
      const expanded = sheet.classList.toggle('rp-sheet-expanded');
      handle.setAttribute('aria-expanded', String(expanded));
      try { RPDiag.log('info', `Volet ${expanded ? 'ouvert' : 'fermé'}.`); } catch (_) {}
    });
  }

  // ---------- Recherche d'adresse (3 champs indépendants : départ / arrivée / passage) ----------
  function initAddressFields() {
    wireAddressField('address-search', 'address-results', 'start');
    wireAddressField('address-search-end', 'address-results-end', 'end');
    wireAddressField('address-search-waypoint', 'address-results-waypoint', 'waypoint');

    // Suppression facile du départ/arrivée sur mobile : avant, la seule
    // façon de "défaire" un point placé était le menu d'appui long, peu
    // pratique à viser précisément à l'endroit exact du marqueur sur un
    // petit écran tactile.
    document.getElementById('clear-start-btn')?.addEventListener('click', () => clearPoint('start'));
    document.getElementById('clear-end-btn')?.addEventListener('click', () => clearPoint('end'));
  }

  function clearPoint(target) {
    const markers = RPMap.getMarkersLayer();
    if (markerRefs[target]) {
      markers.removeLayer(markerRefs[target]);
      delete markerRefs[target];
    }
    if (target === 'start') {
      startPoint = null;
      startSetAutomatically = false;
      const input = document.getElementById('address-search');
      if (input) input.value = '';
    } else if (target === 'end') {
      endPoint = null;
      const input = document.getElementById('address-search-end');
      if (input) input.value = '';
    }
    RPDiag.log('info', `${target === 'start' ? 'Départ' : 'Arrivée'} effacé(e).`);
  }

  /** Échange départ et arrivée (points, marqueurs, champs d'adresse), et
   *  inverse l'ordre des points de passage pour que le sens global du
   *  parcours suive. */
  function initReverseButton() {
    document.getElementById('reverse-btn')?.addEventListener('click', () => {
      if (!startPoint && !endPoint) {
        showError('Placez au moins un départ ou une arrivée avant d\'inverser.');
        return;
      }

      [startPoint, endPoint] = [endPoint, startPoint];

      const startInput = document.getElementById('address-search');
      const endInput = document.getElementById('address-search-end');
      if (startInput && endInput) {
        [startInput.value, endInput.value] = [endInput.value, startInput.value];
      }

      if (startPoint) addOrMoveMarker('start', startPoint, '🏁 Départ', '#35D4A7'); else clearMarkerOnly('start');
      if (endPoint) addOrMoveMarker('end', endPoint, '🏁 Arrivée', '#FF5A3C'); else clearMarkerOnly('end');
      startSetAutomatically = false;

      waypoints.reverse();
      renumberWaypoints();
      renderWaypointChips();

      RPDiag.log('info', 'Départ et arrivée inversés.');
    });
  }

  function clearMarkerOnly(key) {
    const markers = RPMap.getMarkersLayer();
    if (markerRefs[key]) {
      markers.removeLayer(markerRefs[key]);
      delete markerRefs[key];
    }
  }

  /** Les champs "Distance cible" de Route et Chemins restent synchronisés :
   *  avant, changer d'onglet remettait la valeur par défaut du mode visé au
   *  lieu de garder la distance déjà saisie. */
  function initSharedDistance() {
    const routeInput = document.getElementById('route-distance');
    const cheminsInput = document.getElementById('chemins-distance');
    if (!routeInput || !cheminsInput) return;
    routeInput.addEventListener('input', () => { cheminsInput.value = routeInput.value; });
    cheminsInput.addEventListener('input', () => { routeInput.value = cheminsInput.value; });
  }

  function wireAddressField(inputId, resultsId, target) {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    if (!input || !results) return; // champ pas présent dans ce build : on ignore proprement

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
            if (target === 'waypoint') {
              addWaypoint({ lat: m.lat, lon: m.lon }, m.label);
              input.value = ''; // champ réutilisable pour ajouter plusieurs points ; la liste
                                 // ci-dessous (rendered par renderWaypointChips) confirme l'ajout
                                 // — avant, vider le champ sans autre confirmation donnait
                                 // l'impression que le point de passage avait disparu.
            } else {
              setPoint({ lat: m.lat, lon: m.lon }, target, m.label);
            }
            results.innerHTML = '';
          });
          results.appendChild(li);
        });
      }, 400);
    });
  }

  // ---------- Géolocalisation ----------
  function initGeolocation() {
    RPMap.onLocationFound((latlng, accuracyM) => {
      // Ne positionne AUTOMATIQUEMENT le départ que si l'utilisateur n'a pas
      // déjà choisi un point lui-même (recherche ou clic manuel).
      if (!startPoint || startSetAutomatically) {
        startSetAutomatically = true;
        setPoint({ lat: latlng.lat, lon: latlng.lng }, 'start'); // géocodage inverse automatique (voir setPoint)
        RPDiag.log('info', `Position détectée automatiquement (précision ~${Math.round(accuracyM)} m).`);
      }
      clearLocationHint();
    });

    RPMap.onLocationError((e) => {
      // code 1 = PERMISSION_DENIED : une fois l'autorisation refusée, le
      // navigateur ne réaffiche plus JAMAIS la demande de son propre chef —
      // relancer la géolocalisation depuis le code ne peut rien y faire.
      // Avant, cet échec ne remontait que dans le journal diagnostic
      // (peu visible) et donnait l'impression que le bouton ne faisait rien.
      if (e.code === 1) {
        showLocationHint('Localisation bloquée pour ce site. Ouvrez les réglages du site (icône 🔒 ou ⓘ à côté de l\'adresse) pour réautoriser la localisation, puis réessayez.');
      } else {
        showLocationHint('Position introuvable pour le moment (GPS/réseau indisponible). Réessayez, ou saisissez une adresse.');
      }
    });

    document.getElementById('locate-me-btn')?.addEventListener('click', () => {
      RPDiag.log('info', 'Nouvelle tentative de géolocalisation demandée.');
      RPMap.locateMe();
    });

    // Icône d'accès rapide dans la barre du haut, à côté des réglages —
    // même action que le bouton "Me localiser" du volet, mais accessible
    // sans avoir à ouvrir/faire défiler le volet.
    document.getElementById('locate-topbar-btn')?.addEventListener('click', () => {
      RPDiag.log('info', 'Nouvelle tentative de géolocalisation demandée (icône barre du haut).');
      RPMap.locateMe();
    });
  }

  function showLocationHint(message) {
    const hint = document.getElementById('locate-hint');
    if (!hint) return;
    hint.textContent = message;
    hint.hidden = false;
  }

  function clearLocationHint() {
    const hint = document.getElementById('locate-hint');
    if (hint) hint.hidden = true;
  }

  // ---------- Placement de points sur la carte ----------
  // v0.6.4 — simplifié à la demande : un simple clic sur la carte ne fait
  // plus rien (avant, il déplaçait le départ par défaut, ce qui devenait
  // chaotique dès qu'on cliquait sur la carte pour l'explorer plutôt que
  // pour placer un point). Le placement se fait désormais uniquement via :
  // la recherche d'adresse, ou l'appui long / clic droit (menu Départ /
  // Arrivée / Point de passage / Retirer).
  function initMapClickHandling() {
    const map = RPMap.getMap();
    if (!map) throw new Error('Carte non initialisée : impossible de gérer les clics.');

    map.on('contextmenu', (e) => {
      const point = { lat: e.latlng.lat, lon: e.latlng.lng };
      showContextMenu(point, e.latlng);
    });
  }

  /** Petit menu contextuel (popup Leaflet) proposant Départ / Arrivée / Point de passage. */
  function showContextMenu(point, latlng) {
    const map = RPMap.getMap();
    const existingIdx = findWaypointIndexNear(point);

    const wrap = document.createElement('div');
    wrap.className = 'rp-context-menu';

    const options = [
      { label: '📍 Départ', action: () => setPoint(point, 'start') },
      { label: '🏁 Arrivée', action: () => setPoint(point, 'end') },
      { label: '➕ Point de passage', action: () => addWaypoint(point, null) }
    ];
    if (existingIdx !== -1) {
      options.push({ label: '✕ Retirer ce point de passage', action: () => removeWaypointAt(existingIdx) });
    }

    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        opt.action();
        map.closePopup();
      });
      wrap.appendChild(btn);
    });

    L.popup({ closeButton: true, className: 'rp-context-popup', minWidth: 180 })
      .setLatLng(latlng)
      .setContent(wrap)
      .openOn(map);
  }

  /**
   * label optionnel : si fourni (sélection via un champ de recherche),
   * remplit directement le champ d'adresse correspondant. Sinon (clic long /
   * menu contextuel / géolocalisation), l'adresse est retrouvée en
   * arrière-plan par géocodage inverse et affichée dès qu'elle arrive — même
   * logique que pour les points de passage, qui l'avaient déjà.
   */
  function setPoint(point, target, label) {
    if (target === 'start') {
      startPoint = point;
      startSetAutomatically = false; // un point choisi explicitement n'est plus "automatique"
      addOrMoveMarker('start', point, '🏁 Départ', '#35D4A7');
      updateAddressField('address-search', point, label);
    } else if (target === 'end') {
      endPoint = point;
      addOrMoveMarker('end', point, '🏁 Arrivée', '#FF5A3C');
      updateAddressField('address-search-end', point, label);
    } else {
      addWaypoint(point, label);
    }
  }

  function updateAddressField(inputId, point, label) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (label) { input.value = label; return; }
    RPGeocoder.reverse(point.lat, point.lon).then(addr => { input.value = addr; });
  }

  // ---------- Points de passage : ajout, retrait, affichage persistant ----------
  const WAYPOINT_REMOVE_RADIUS_M = 35;

  function addWaypoint(point, label) {
    const markers = RPMap.getMarkersLayer();
    // Halo blanc (contour) pour rester bien visible sur n'importe quel fond
    // de carte (satellite compris), en plus d'une couleur plus franche.
    const marker = L.circleMarker([point.lat, point.lon], { radius: 8, color: '#FFFFFF', weight: 3, fillColor: '#F2B705', fillOpacity: 1 })
      .addTo(markers).bindTooltip(`Point ${waypoints.length + 1}`);
    const entry = { point, marker, label: label || '…' };
    waypoints.push(entry);
    renderWaypointChips();
    RPDiag.log('info', `Point de passage ajouté (total : ${waypoints.length}).`);

    if (!label) {
      // Pas d'adresse connue (ajout via carte / clic long) : on la retrouve
      // en arrière-plan pour un affichage plus lisible dans la liste.
      RPGeocoder.reverse(point.lat, point.lon).then(addr => {
        entry.label = addr;
        renderWaypointChips();
      });
    }
  }

  function findWaypointIndexNear(point) {
    for (let i = 0; i < waypoints.length; i++) {
      if (RPRouting.haversine(point, waypoints[i].point) <= WAYPOINT_REMOVE_RADIUS_M) return i;
    }
    return -1;
  }

  function tryRemoveWaypointNear(point) {
    const i = findWaypointIndexNear(point);
    if (i === -1) return false;
    RPMap.getMarkersLayer().removeLayer(waypoints[i].marker);
    waypoints.splice(i, 1);
    renumberWaypoints();
    renderWaypointChips();
    return true;
  }

  function removeWaypointAt(index) {
    const entry = waypoints[index];
    if (!entry) return;
    RPMap.getMarkersLayer().removeLayer(entry.marker);
    waypoints.splice(index, 1);
    renumberWaypoints();
    renderWaypointChips();
    RPDiag.log('info', 'Point de passage retiré.');
  }

  function renumberWaypoints() {
    waypoints.forEach((w, idx) => w.marker.setTooltipContent(`Point ${idx + 1}`));
  }

  /** Liste persistante des points de passage sous le champ de recherche —
   *  donne une confirmation visuelle claire (le champ de recherche, lui,
   *  se vide après chaque ajout pour permettre d'en saisir un autre). */
  function renderWaypointChips() {
    const list = document.getElementById('waypoint-chips');
    if (!list) return;
    list.innerHTML = '';
    waypoints.forEach((w, idx) => {
      const li = document.createElement('li');
      li.className = 'rp-chip';
      const text = document.createElement('span');
      text.textContent = `${idx + 1}. ${w.label}`;
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'rp-chip-remove';
      removeBtn.setAttribute('aria-label', `Retirer le point ${idx + 1}`);
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => removeWaypointAt(idx));
      li.appendChild(text);
      li.appendChild(removeBtn);
      list.appendChild(li);
    });
  }

  const markerRefs = {};
  function addOrMoveMarker(key, point, label, color) {
    const markers = RPMap.getMarkersLayer();
    if (markerRefs[key]) markers.removeLayer(markerRefs[key]);
    // Halo blanc (contour épais) pour rester bien visible sur tout fond de
    // carte, y compris satellite — un simple remplissage fin se fondait
    // trop facilement dans certains arrière-plans.
    markerRefs[key] = L.circleMarker([point.lat, point.lon], { radius: 9, color: '#FFFFFF', weight: 3, fillColor: color, fillOpacity: 1 })
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
    if (!startPoint) throw new Error('Placez un point de départ (recherche, géolocalisation ou clic carte).');
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
      result = await RPLoops.generateOutAndBack(startPoint, targetM, currentMode, endPoint);
    } else if (subMode === 'a-vers-b') {
      if (!endPoint) throw new Error('Placez un point d\'arrivée pour le mode Aller A→B.');
      result = await RPLoops.generatePointToPoint(startPoint, endPoint, targetM, currentMode, waypoints.map(w => w.point));
    } else if (subMode === 'points-de-passage') {
      if (waypoints.length < 1) throw new Error('Ajoutez au moins un point de passage.');
      result = await RPLoops.generateWaypointLoop([startPoint, ...waypoints.map(w => w.point)], currentMode);
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
          drawLineWithCasing(segLatLngs, color, layer);
        }
        renderSplitLabel(seg.coords[Math.floor(seg.coords.length / 2)], seg.label, color);
      });
    } else {
      // Le mode Route utilisait un vert menthe qui se fondait dans les zones
      // vertes (forêts/parcs) des fonds de carte OSM — remplacé par un bleu
      // vif, plus contrasté sur la quasi-totalité des fonds de carte.
      const color = currentMode === 'chemins' ? '#E8C15A' : currentMode === 'exercices' ? '#FF5A3C' : '#2F7DFF';
      drawLineWithCasing(latlngs, color, layer);
      renderKmLabels(result.coords, layer);
    }

    if (result.hasSignificantOverlap) {
      // Le message n'est plus affiché à l'écran (gênant à l'usage) ; la
      // détection reste active en arrière-plan pour choisir la meilleure
      // tentative (voir loops.js) et reste tracée dans le diagnostic.
      RPDiag.log('warn', 'Chevauchement résiduel sur le tracé retenu.');
    }

    RPMap.fitToLayer(currentMode);
  }

  /**
   * Trace le tracé avec un liseré sombre semi-transparent dessous (technique
   * cartographique standard) : garde le tracé lisible quel que soit le fond
   * de carte (routes claires, zones vertes, relief OpenTopoMap...), là où une
   * simple ligne colorée fine pouvait s'y fondre et devenir peu visible.
   */
  function drawLineWithCasing(latlngs, color, layer, weight = 6) {
    L.polyline(latlngs, { color: '#000000', weight: weight + 4, opacity: 0.35, lineCap: 'round', lineJoin: 'round' }).addTo(layer);
    L.polyline(latlngs, { color, weight, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(layer);
  }

  /** Étiquettes km, style "bib" (marqueur de dossard), tous les kilomètres. */
  function renderKmLabels(coords, layer) {
    let cum = 0, nextKm = 1;
    for (let i = 1; i < coords.length; i++) {
      cum += RPRouting.haversine({ lat: coords[i - 1][0], lon: coords[i - 1][1] }, { lat: coords[i][0], lon: coords[i][1] });
      if (cum >= nextKm * 1000) {
        // 'var(--rp-text)' plutôt qu'une couleur fixe : sans ça, en thème clair,
        // le texte quasi-blanc devenait illisible sur le fond clair de l'étiquette
        // (bug observé : étiquettes "3 km" quasiment invisibles).
        renderSplitLabel(coords[i], `${nextKm} km`, 'var(--rp-text)', true);
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
    // Ne PAS utiliser result.durationS ici : depuis que le mode Route peut
    // router via un profil vélo (voir config.js), cette durée serait une
    // estimation vélo (bien plus rapide qu'à pied) — trompeuse pour une app
    // de course à pied, quel que soit le profil réellement utilisé en
    // coulisses. On calcule systématiquement notre propre estimation à une
    // allure de course par défaut, clairement annoncée comme telle.
    const dur = formatDuration(estimateRunDurationS(result.distanceM, currentPaceMinPerKm()));
    el.innerHTML = `
      <div class="rp-summary-card">
        <span class="rp-summary-figure">${km} <small>km</small></span>
        <span class="rp-summary-sub">≈ ${dur} à ${currentPaceMinPerKm()}/km (estimation) · source : ${result.source || 'segments composés'}</span>
        ${result.deltaPct != null ? `<span class="rp-summary-delta">${result.deltaPct > 0 ? '+' : ''}${result.deltaPct}% vs cible</span>` : ''}
        ${result.hasSignificantOverlap ? `<span class="rp-summary-warn">⚠️ Réseau routier peu maillé ici : portion en aller-retour malgré plusieurs tentatives.</span>` : ''}
      </div>`;
    el.hidden = false;
    renderElevationProfile(result.coords);
  }

  /** Allure (min/km) : celle du mode Exercices si configurée, sinon 5:30/km par défaut. */
  function currentPaceMinPerKm() {
    if (currentMode === 'exercices') {
      const v = parseFloat(document.getElementById('exo-pace')?.value);
      if (!isNaN(v) && v > 0) return v;
    }
    return 5.5;
  }

  /** Durée estimée (secondes) à une allure de course donnée (min/km). */
  function estimateRunDurationS(distanceM, paceMinPerKm) {
    return (distanceM / 1000) * paceMinPerKm * 60;
  }

  // ---------- Profil de dénivelé ----------
  /** Élévation lissée (m) au fil de la distance (km), + dénivelé positif/négatif cumulé. */
  function computeElevationProfile(coords) {
    if (!coords || coords.length < 2) return null;
    const points = [];
    let cumM = 0;
    points.push({ d: 0, ele: coords[0][2] || 0 });
    for (let i = 1; i < coords.length; i++) {
      cumM += RPRouting.haversine({ lat: coords[i - 1][0], lon: coords[i - 1][1] }, { lat: coords[i][0], lon: coords[i][1] });
      points.push({ d: cumM / 1000, ele: coords[i][2] || 0 });
    }
    const allZero = points.every(p => p.ele === 0);
    if (allZero) return null; // pas de données d'altitude fournies par le routeur

    // Dénivelé cumulé avec seuil anti-bruit (évite de compter chaque micro-
    // variation GPS comme une montée/descente).
    const THRESHOLD_M = 2;
    let gain = 0, loss = 0, last = points[0].ele;
    for (const p of points) {
      const diff = p.ele - last;
      if (Math.abs(diff) >= THRESHOLD_M) {
        if (diff > 0) gain += diff; else loss += -diff;
        last = p.ele;
      }
    }
    return { points, gain: Math.round(gain), loss: Math.round(loss) };
  }

  function renderElevationProfile(coords) {
    const container = document.getElementById('elevation-profile');
    const svgHost = document.getElementById('elevation-svg-container');
    const stats = document.getElementById('elevation-stats');
    if (!container || !svgHost) return;

    const profile = computeElevationProfile(coords);
    if (!profile) { container.hidden = true; return; }

    const { points, gain, loss } = profile;
    const W = 300, H = 90, PAD = 4;
    const maxD = points[points.length - 1].d || 1;
    const eles = points.map(p => p.ele);
    let minE = Math.min(...eles), maxE = Math.max(...eles);
    if (maxE - minE < 10) { const mid = (maxE + minE) / 2; minE = mid - 5; maxE = mid + 5; } // évite un graphe plat écrasé

    const x = d => PAD + (d / maxD) * (W - 2 * PAD);
    const y = ele => H - PAD - ((ele - minE) / (maxE - minE)) * (H - 2 * PAD);

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.d).toFixed(1)},${y(p.ele).toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L${x(points[points.length - 1].d).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;

    svgHost.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" role="img" aria-label="Profil de dénivelé">
        <path d="${areaPath}" fill="var(--rp-recovery)" opacity="0.18"></path>
        <path d="${linePath}" fill="none" stroke="var(--rp-recovery)" stroke-width="2" vector-effect="non-scaling-stroke"></path>
      </svg>`;
    if (stats) stats.textContent = `D+ ${gain} m · D- ${loss} m · alt. ${Math.round(minE)}–${Math.round(maxE)} m`;
    container.hidden = false;
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
    let ok = false;
    try {
      if (format === 'gpx') ok = RPExport.exportGpx(lastResult.coords, name, lastSegments);
      if (format === 'tcx') ok = RPExport.exportTcx(lastResult.coords, name, lastSegments);
      if (format === 'fit') ok = RPExport.exportFit(lastResult.coords, name, lastSegments);
    } catch (e) {
      RPDiag.log('error', `Export ${format.toUpperCase()} a levé une exception: ${e.message}`);
    }

    // Retour visuel explicite sur le bouton lui-même : le téléchargement est
    // souvent silencieux sur mobile (pas de fenêtre visible), donnant
    // l'impression qu'il ne s'est rien passé même quand ça a fonctionné.
    const btn = document.getElementById(`export-${format}`);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = ok ? '✓ Téléchargé' : '⚠️ Échec';
      btn.disabled = true;
      setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2200);
    }
    if (!ok) showError(`L'export ${format.toUpperCase()} a échoué. Vérifiez le panneau 🩺 Diagnostic pour le détail, ou réessayez.`);
    RPDiag.log(ok ? 'info' : 'error', `Export ${format.toUpperCase()} ${ok ? 'réussi' : 'échoué'}.`);
  }

  return { init };
})();
