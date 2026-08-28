/**
 * app.js — Point d'entrée. Chaque étape d'initialisation est isolée (leçon #9) :
 * un élément HTML manquant après un déploiement partiel ne doit jamais faire
 * planter toute l'app, en particulier l'affichage de la carte.
 */

(function bootstrap() {
  const steps = [
    { name: 'diagnostics', run: () => RPDiag.init() },
    { name: 'thème (bascule interactive)', run: () => RPTheme.init() },
    { name: 'carte', run: () => RPMap.init('map') },
    { name: 'interface', run: () => RPUi.init() },
    { name: 'service worker', run: () => registerServiceWorker() },
  ];

  for (const step of steps) {
    try {
      step.run();
    } catch (e) {
      console.error(`Échec de l'initialisation : ${step.name}`, e);
      try { RPDiag.log('error', `Échec init "${step.name}": ${e.message}`); } catch (_) { /* diag pas dispo */ }
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // chemin relatif : fonctionne aussi bien à la racine que sur un sous-chemin GitHub Pages
    navigator.serviceWorker.register('service-worker.js').then(reg => {
      RPDiag.log('info', 'Service worker enregistré.');
      reg.addEventListener('updatefound', () => {
        RPDiag.log('info', 'Nouvelle version du service worker détectée.');
      });
    }).catch(e => {
      RPDiag.log('warn', 'Enregistrement du service worker échoué: ' + e.message);
    });
  }
})();
