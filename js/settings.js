/**
 * settings.js — Panneau de réglages (nouveau en v0.4.0).
 * Pour l'instant : uniquement la clé OpenRouteService, qui ne pouvait
 * jusqu'ici être configurée que via la console du navigateur.
 */

const RPSettings = (() => {
  function init() {
    const openBtn = document.getElementById('settings-btn');
    const modal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('settings-close');
    const keyInput = document.getElementById('settings-ors-key');
    const saveBtn = document.getElementById('settings-save');
    const clearBtn = document.getElementById('settings-clear');
    const status = document.getElementById('settings-status');
    if (!openBtn || !modal) return;

    function refreshStatus() {
      const stored = localStorage.getItem(RP_CONFIG.storageKeys.orsKey);
      if (status) {
        status.textContent = stored
          ? '✅ Votre clé ORS personnelle est configurée : boucles natives ORS activées.'
          : '✅ Clé ORS partagée active (par défaut, intégrée à l\'application) : boucles natives ORS activées. Vous pouvez la remplacer par la vôtre ci-dessous si besoin.';
      }
      if (keyInput) keyInput.value = stored || '';
    }

    function close() { modal.hidden = true; }
    function open() { modal.hidden = false; refreshStatus(); keyInput?.focus(); }

    openBtn.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });

    saveBtn?.addEventListener('click', () => {
      const val = (keyInput?.value || '').trim();
      if (!val) { alert('Entrez une clé avant d\'enregistrer, ou utilisez "Effacer la clé".'); return; }
      if (!rpIsPrintableAscii(val)) { alert('Cette clé contient des caractères invalides (espace insécable, retour à la ligne…).'); return; }
      localStorage.setItem(RP_CONFIG.storageKeys.orsKey, val);
      RPDiag.log('info', 'Clé ORS enregistrée.');
      refreshStatus();
    });

    clearBtn?.addEventListener('click', () => {
      localStorage.removeItem(RP_CONFIG.storageKeys.orsKey);
      RPDiag.log('info', 'Clé ORS effacée.');
      refreshStatus();
    });
  }

  return { init };
})();
