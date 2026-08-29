/**
 * diagnostics.js — Panneau de diagnostic visible à l'écran.
 * Journal texte + badge de version + copie en un clic.
 * Indispensable pour déboguer à distance (leçon apprise #10).
 */

const RPDiag = (() => {
  let logEl = null;
  let entries = [];

  function init() {
    try {
      logEl = document.getElementById('diag-log');
      const versionBadge = document.getElementById('diag-version');
      if (versionBadge) versionBadge.textContent = 'v' + RP_VERSION;

      const toggleBtn = document.getElementById('diag-toggle');
      const header = document.getElementById('diag-header');
      const panel = document.getElementById('diag-panel');
      const copyBtn = document.getElementById('diag-copy');
      const clearBtn = document.getElementById('diag-clear');

      const isOpen = localStorage.getItem(RP_CONFIG.storageKeys.diagnosticsOpen) === '1';
      if (panel) panel.classList.toggle('rp-diag-collapsed', !isOpen);

      // Écoute sur TOUT le bandeau d'en-tête (pas seulement le petit texte
      // "🩺 Diagnostic") : le badge de version à côté ressemble à un bouton
      // et les utilisateurs tapent naturellement dessus aussi — avant, ce tap
      // ne faisait rien, donnant l'impression que le panneau ne s'ouvrait pas.
      if (header && panel) {
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => {
          const collapsed = panel.classList.toggle('rp-diag-collapsed');
          localStorage.setItem(RP_CONFIG.storageKeys.diagnosticsOpen, collapsed ? '0' : '1');
        });
      }
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const text = entries.join('\n');
          navigator.clipboard?.writeText(text).then(() => {
            log('info', 'Journal copié dans le presse-papiers.');
          }).catch(() => {
            log('warn', 'Copie impossible (clipboard indisponible).');
          });
        });
      }
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          entries = [];
          if (logEl) logEl.textContent = '';
        });
      }

      // Capture globale des erreurs non gérées
      window.addEventListener('error', (e) => {
        log('error', `${e.message} (${e.filename}:${e.lineno})`);
      });
      window.addEventListener('unhandledrejection', (e) => {
        log('error', 'Promise rejetée: ' + (e.reason?.message || e.reason));
      });

      log('info', `RunPlanner v${RP_VERSION} — diagnostic initialisé.`);
    } catch (e) {
      // Le diagnostic lui-même ne doit jamais planter l'app.
      console.error('RPDiag.init a échoué', e);
    }
  }

  function log(level, message) {
    const time = new Date().toLocaleTimeString('fr-FR', { hour12: false });
    const line = `[${time}] [${level.toUpperCase()}] ${message}`;
    entries.push(line);
    if (entries.length > 300) entries.shift();
    if (logEl) {
      logEl.textContent += line + '\n';
      logEl.scrollTop = logEl.scrollHeight;
    }
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn('[RunPlanner]', message);
  }

  return { init, log };
})();
