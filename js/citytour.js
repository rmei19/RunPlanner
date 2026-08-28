/**
 * citytour.js — Mode "Visite citadine" : cherche des POI autour d'un point/parcours.
 * Source principale : API de recherche géographique de Wikipédia (infra Wikimedia robuste).
 * Overpass API gardée uniquement en secours (leçon #6 : peu fiable en solo).
 */

const RPCityTour = (() => {

  const CATEGORY_KEYWORDS = {
    'Monument': ['monument', 'mémorial', 'statue', 'obélisque'],
    'Musée': ['musée', 'galerie'],
    'Édifice religieux': ['église', 'cathédrale', 'basilique', 'chapelle', 'temple', 'synagogue', 'mosquée'],
    'Parc / Nature': ['parc', 'jardin', 'square', 'bois'],
    'Architecture': ['architecture', 'palais', 'château', 'pont', 'tour'],
    'Histoire': ['histoire', 'siège', 'bataille', 'ancien'],
  };

  function deriveCategory(wikiCategories = []) {
    const joined = wikiCategories.join(' ').toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some(k => joined.includes(k))) return cat;
    }
    return 'Point d\'intérêt';
  }

  async function searchWikipedia(lat, lon, radiusM = 2000, limit = 20) {
    const url = new URL(RP_CONFIG.poi.wikipediaGeosearchUrl);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'geosearch');
    url.searchParams.set('gscoord', `${lat}|${lon}`);
    url.searchParams.set('gsradius', String(Math.min(radiusM, 10000)));
    url.searchParams.set('gslimit', String(limit));
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Wikipedia geosearch HTTP ${res.status}`);
    const data = await res.json();
    const pages = data.query?.geosearch || [];

    // Récupère les catégories par lot pour dériver un type de lieu.
    const titles = pages.map(p => p.title).join('|');
    let categoriesByTitle = {};
    if (titles) {
      try {
        const catUrl = new URL(RP_CONFIG.poi.wikipediaGeosearchUrl);
        catUrl.searchParams.set('action', 'query');
        catUrl.searchParams.set('prop', 'categories');
        catUrl.searchParams.set('titles', titles);
        catUrl.searchParams.set('cllimit', '10');
        catUrl.searchParams.set('format', 'json');
        catUrl.searchParams.set('origin', '*');
        const catRes = await fetch(catUrl.toString());
        const catData = await catRes.json();
        const catPages = catData.query?.pages || {};
        Object.values(catPages).forEach(p => {
          categoriesByTitle[p.title] = (p.categories || []).map(c => c.title);
        });
      } catch (e) {
        RPDiag.log('warn', 'Récupération des catégories Wikipédia échouée: ' + e.message);
      }
    }

    return pages.map(p => ({
      name: p.title,
      lat: p.lat,
      lon: p.lon,
      distanceM: p.dist,
      category: deriveCategory(categoriesByTitle[p.title] || []),
      source: 'wikipedia',
      url: `https://fr.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`
    }));
  }

  async function searchOverpass(lat, lon, radiusM = 2000) {
    const query = `
      [out:json][timeout:15];
      (
        node["tourism"="attraction"](around:${radiusM},${lat},${lon});
        node["historic"](around:${radiusM},${lat},${lon});
        node["tourism"="museum"](around:${radiusM},${lat},${lon});
      );
      out body 30;
    `;
    let lastErr;
    for (const base of RP_CONFIG.poi.overpassUrls) {
      try {
        const res = await fetch(base, { method: 'POST', body: query });
        if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
        const data = await res.json();
        return (data.elements || []).map(el => ({
          name: el.tags?.name || 'Lieu sans nom',
          lat: el.lat, lon: el.lon,
          distanceM: RPRouting.haversine({ lat, lon }, { lat: el.lat, lon: el.lon }),
          category: el.tags?.tourism || el.tags?.historic || 'Point d\'intérêt',
          source: 'overpass'
        }));
      } catch (e) {
        lastErr = e;
        RPDiag.log('warn', `Overpass (${base}) échoué: ${e.message}`);
      }
    }
    throw lastErr || new Error('Tous les miroirs Overpass ont échoué');
  }

  /** Point d'entrée : Wikipedia en principal, Overpass en secours si échec ou résultat pauvre. */
  async function findPois(lat, lon, radiusM = 2000) {
    try {
      const wiki = await searchWikipedia(lat, lon, radiusM);
      if (wiki.length >= 3) return wiki;
      RPDiag.log('info', 'Peu de résultats Wikipédia, complément via Overpass.');
      const overpass = await searchOverpass(lat, lon, radiusM).catch(() => []);
      return [...wiki, ...overpass];
    } catch (e) {
      RPDiag.log('warn', 'Wikipedia geosearch échoué, bascule Overpass: ' + e.message);
      return await searchOverpass(lat, lon, radiusM);
    }
  }

  /** Construit un parcours de visite reliant une sélection de POI en boucle. */
  async function buildCityTour(start, pois, mode = 'route') {
    const waypoints = [start, ...pois.map(p => ({ lat: p.lat, lon: p.lon })), start];
    const result = await RPRouting.route(waypoints, mode);
    return { ...result, pois };
  }

  return { findPois, buildCityTour };
})();
