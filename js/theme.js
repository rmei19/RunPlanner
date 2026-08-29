/**
 * theme.js — Bascule thème clair / sombre + suivi du thème système.
 * v0.2.0 — correction : ce module ne doit être initialisé QU'UNE SEULE FOIS
 * (auparavant appelé à la fois depuis app.js et ui.js : deux écouteurs de
 * clic étaient attachés au bouton, donc chaque clic basculait deux fois de
 * suite et le thème ne changeait jamais visuellement). Seul app.js
 * l'initialise désormais.
 *
 * Comportement :
 * - Si l'utilisateur n'a jamais choisi de thème manuellement, l'app suit le
 *   thème système (clair/sombre) et se met à jour automatiquement si celui-ci
 *   change (ex: bascule automatique du soir au matin sur le téléphone).
 * - Dès que l'utilisateur clique sur le bouton, son choix devient explicite
 *   et n'est plus jamais écrasé par un changement système.
 */

const RPTheme = (() => {
  const MANUAL_KEY = 'rp_theme_manual';

  function systemPrefersLight() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = theme === 'dark' ? '🌙' : '☀️';
      btn.setAttribute('aria-label', theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre');
    }
  }

  function current() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }

  function isManual() {
    return localStorage.getItem(MANUAL_KEY) === '1';
  }

  function init() {
    // Applique l'état déjà posé par le script anti-flash du <head>, et met
    // à jour l'icône du bouton en conséquence.
    apply(current());

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const next = current() === 'dark' ? 'light' : 'dark';
        localStorage.setItem(RP_CONFIG.storageKeys.theme, next);
        localStorage.setItem(MANUAL_KEY, '1'); // choix explicite : ne plus suivre le système
        apply(next);
        try { RPDiag.log('info', `Thème changé manuellement : ${next}.`); } catch (_) {}
      });
    }

    // Suivi du thème système tant que l'utilisateur n'a rien choisi lui-même.
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      const handler = (e) => {
        if (isManual()) return; // l'utilisateur a fait un choix explicite : on ne le contredit pas
        apply(e.matches ? 'light' : 'dark');
      };
      // Compat anciens navigateurs (addListener) et récents (addEventListener)
      if (mq.addEventListener) mq.addEventListener('change', handler);
      else if (mq.addListener) mq.addListener(handler);
    }
  }

  return { init, apply, current };
})();
