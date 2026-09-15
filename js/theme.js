/** Thème commun Suite Tempo : système par défaut, clair ou sombre. */
const RPTheme = (() => {
  const STORAGE_KEY = 'tempo-suite-theme';
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function normalize(mode) {
    return ['system', 'light', 'dark'].includes(mode) ? mode : 'system';
  }

  function apply(mode) {
    const selected = normalize(mode);
    const resolved = selected === 'system' ? (media.matches ? 'dark' : 'light') : selected;
    document.documentElement.dataset.themeMode = selected;
    document.documentElement.dataset.theme = resolved;
    const select = document.getElementById('theme-select');
    if (select) select.value = selected;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = resolved === 'dark' ? '#071824' : '#F4F7F9';
  }

  function current() {
    return normalize(localStorage.getItem(STORAGE_KEY) || 'system');
  }

  function init() {
    apply(current());
    const select = document.getElementById('theme-select');
    if (select) select.addEventListener('change', () => {
      localStorage.setItem(STORAGE_KEY, select.value);
      apply(select.value);
      try { RPDiag.log('info', `Thème choisi : ${select.value}.`); } catch (_) {}
    });
    const followSystem = () => { if (current() === 'system') apply('system'); };
    if (media.addEventListener) media.addEventListener('change', followSystem);
    else media.addListener(followSystem);
  }

  return { init, apply, current };
})();
