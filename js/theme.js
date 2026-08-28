/**
 * theme.js — Bascule thème clair / sombre.
 * NOTE : l'application du thème sauvegardé AVANT le premier rendu se fait
 * via un script inline dans le <head> de index.html (voir leçon #12),
 * ce module ne gère que la bascule interactive après coup.
 */

const RPTheme = (() => {
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(RP_CONFIG.storageKeys.theme, theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.setAttribute('aria-label', theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre');
  }

  function current() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }

  function init() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      apply(current() === 'dark' ? 'light' : 'dark');
    });
  }

  return { init, apply, current };
})();
