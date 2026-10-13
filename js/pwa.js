// Service worker registration, update prompt, and install button.
const $ = (id) => document.getElementById(id);

export function initPWA() {
  setupInstall();
  if (!('serviceWorker' in navigator)) return;

  const hadController = !!navigator.serviceWorker.controller;
  const promptUpdate = (worker) => {
    $('updateBar').hidden = false;
    $('updateBtn').onclick = () => worker.postMessage({ type: 'SKIP_WAITING' });
  };

  navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
    if (reg.waiting && hadController) promptUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(w);
      });
    });
  }).catch(() => { /* offline support unavailable; app still works online */ });

  // Reload once when a new worker takes over, but not on the very first install.
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
}

function setupInstall() {
  const btn = $('installBtn');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return;

  let deferred = null;
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });
  addEventListener('appinstalled', () => { deferred = null; btn.hidden = true; });

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) btn.hidden = false;

  btn.onclick = async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      btn.hidden = true;
    } else if (ios) {
      $('iosHelp').showModal();
    }
  };
}
