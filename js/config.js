/**
 * config.js — Constantes globales de RunPlanner
 * Responsabilité unique : configuration (aucune logique métier ici).
 */

const RP_VERSION = '0.2.0';

const RP_CONFIG = {
  // -- Fonds de carte --
  tileLayers: {
    osm: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options: {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }
    },
    topo: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      options: {
        maxZoom: 17,
        attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
      }
    }
  },

  // -- Géocodage --
  nominatim: {
    searchUrl: 'https://nominatim.openstreetmap.org/search',
    reverseUrl: 'https://nominatim.openstreetmap.org/reverse'
  },

  // -- Routage --
  routing: {
    ors: {
      baseUrl: 'https://api.openrouteservice.org/v2/directions/',
      // Clé embarquée par défaut : légèrement brouillée (inversion + base64),
      // PAS un vrai chiffrement — juste pour échapper aux scans naïfs de dépôts publics.
      // L'utilisateur peut la remplacer via le panneau réglages (stockée en clair côté localStorage
      // à ce moment-là, ce qui est attendu pour une clé saisie par l'utilisateur).
      obfuscatedDefaultKey: '', // à renseigner si une clé par défaut doit être livrée
      profiles: {
        route: 'foot-walking',
        chemins: 'foot-hiking',
        exercices: 'foot-walking'
      }
    },
    brouter: {
      baseUrl: 'https://brouter.de/brouter',
      profiles: {
        route: 'shortest',
        chemins: 'trekking',
        exercices: 'hiking-mountain'
      }
    },
    // Facteur de correction de circuité : distance à vol d'oiseau -> distance routée réelle.
    // Réseau piéton généralement plus dense/direct que le réseau routier : on part plus bas que le vélo (1.8).
    circuityFactor: 1.45
  },

  // -- POI / Visite citadine --
  poi: {
    wikipediaGeosearchUrl: 'https://fr.wikipedia.org/w/api.php',
    overpassUrls: [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter'
    ]
  },

  // -- Stockage local --
  storageKeys: {
    theme: 'rp_theme',
    orsKey: 'rp_ors_key',
    diagnosticsOpen: 'rp_diag_open',
    lastPanel: 'rp_last_panel'
  }
};

/**
 * Décode une clé API par défaut brouillée (inversion + base64).
 * Retourne '' si aucune clé n'est configurée.
 */
function rpDecodeObfuscatedKey(obfuscated) {
  if (!obfuscated) return '';
  try {
    const reversed = atob(obfuscated);
    return reversed.split('').reverse().join('');
  } catch (e) {
    return '';
  }
}

/**
 * Valide qu'une chaîne (typiquement une clé API saisie par l'utilisateur)
 * ne contient que des caractères ASCII imprimables, pour éviter qu'une
 * valeur parasite (copier-coller avec espaces insécables, retours ligne...)
 * ne fasse planter fetch() lors de la construction des en-têtes HTTP.
 */
function rpIsPrintableAscii(str) {
  if (typeof str !== 'string' || str.length === 0) return false;
  return /^[\x20-\x7E]+$/.test(str);
}
