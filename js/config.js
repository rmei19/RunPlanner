/**
 * config.js — Constantes globales de RunPlanner
 * Responsabilité unique : configuration (aucune logique métier ici).
 */

const RP_VERSION = '0.8.5';

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
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      options: {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
      }
    },
    // Repères (routes, noms de lieux) semi-transparents — non retenu au
    // final pour le fond "Hybride" (ne montrait que labels/frontières, pas
    // le réseau routes/chemins lui-même) ; on superpose OpenTopoMap à la
    // place (voir map.js). Gardé ici au cas où un futur calque optionnel
    // "repères" serait utile.
    satelliteLabels: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      options: {
        maxZoom: 19,
        attribution: 'Esri'
      }
    },
    // v0.8.3 — calque "routes uniquement" (fond transparent), conçu par Esri
    // spécifiquement pour être superposé à leur imagerie satellite (même
    // infrastructure que `satellite` ci-dessus). Remplace OpenTopoMap comme
    // source du fond Hybride : servir les deux calques (satellite + routes)
    // depuis le même fournisseur réduit le risque qu'un des deux échoue
    // silencieusement pendant que l'autre fonctionne.
    // v0.8.4 — retour sur OpenTopoMap : le calque Esri "routes uniquement"
    // testé en v0.8.3 s'est révélé être un service LEGACY explicitement
    // déprécié par Esri depuis 2022 ("in mature support, no longer
    // updated"), susceptible d'être désactivé sans préavis — confirmé via
    // leur propre documentation. Le remplacement officiel exige un compte
    // développeur ArcGIS + une clé API, disproportionné pour un simple
    // calque décoratif. OpenTopoMap (gratuit, sans clé, déjà utilisé avec
    // succès comme fond "Relief" autonome dans cette appli) est un choix
    // plus sûr à long terme.
    roadsOverlay: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      options: {
        // maxNativeZoom=17 (résolution réelle des tuiles OpenTopoMap) mais
        // maxZoom=20 (agrandissement des tuiles de zoom 17 au-delà) : sans
        // ce réglage, Leaflet cesse purement et simplement d'afficher le
        // calque dès qu'on zoome plus près que son maxZoom natif — c'est
        // très probablement ce qui s'est produit lors du premier essai
        // (zoom rapproché sur un village dans les deux captures reçues).
        maxNativeZoom: 17,
        maxZoom: 20,
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
        // v0.6.5 — 'route' utilise un profil VÉLO DE ROUTE plutôt qu'un
        // profil piéton. Testé et validé avec l'utilisateur : ORS n'offre
        // plus aucun moyen (avoir_features) de dire à un profil piéton
        // d'éviter les surfaces non goudronnées (l'option existait, ORS l'a
        // retirée de son API publique). Un vélo de route, lui, évite déjà
        // naturellement les chemins/graviers puisqu'il ne peut pas y rouler
        // confortablement — compromis accepté : peut occasionnellement
        // emprunter une piste cyclable, ce qui reste praticable à pied.
        route: 'cycling-road',
        chemins: 'foot-hiking',
        exercices: 'foot-walking'
      }
    },
    brouter: {
      baseUrl: 'https://brouter.de/brouter',
      // v0.5.0 — 'route' utilisait 'shortest', qui n'est PAS un profil piéton :
      // c'est le profil voiture "trajet le plus court" de BRouter. Cela
      // expliquait que le mode Route ne privilégie pas fiablement la route
      // goudronnée (poids/préférences pensés pour une voiture, pas un
      // coureur). 'foot-fastest' est le profil piéton de BRouter orienté
      // voies rapides/goudronnées, cohérent avec l'intention du mode Route.
      profiles: {
        route: 'foot-fastest',
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
