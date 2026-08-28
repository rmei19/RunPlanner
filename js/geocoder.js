/**
 * geocoder.js — Recherche d'adresse via Nominatim (OpenStreetMap).
 */

const RPGeocoder = (() => {
  async function search(query, limit = 5) {
    if (!query || query.trim().length < 2) return [];
    const url = new URL(RP_CONFIG.nominatim.searchUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('addressdetails', '1');

    try {
      const res = await fetch(url.toString(), {
        headers: { 'Accept-Language': 'fr' }
      });
      if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
      const data = await res.json();
      return data.map(item => ({
        label: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon)
      }));
    } catch (e) {
      RPDiag.log('error', 'Geocoder.search: ' + e.message);
      return [];
    }
  }

  async function reverse(lat, lon) {
    const url = new URL(RP_CONFIG.nominatim.reverseUrl);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('format', 'jsonv2');

    try {
      const res = await fetch(url.toString(), { headers: { 'Accept-Language': 'fr' } });
      if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
      const data = await res.json();
      return data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    } catch (e) {
      RPDiag.log('warn', 'Geocoder.reverse: ' + e.message);
      return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    }
  }

  return { search, reverse };
})();
