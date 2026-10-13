// Bootstrap and hash routing: #/ (library), #/edit/<id> (editor).
import { renderLibrary } from './library.js';
import { renderEditor } from './editor/editor.js';
import { renderPicker } from './picker.js';
import { renderTrash } from './trash.js';
import { renderAbout } from './about.js';
import { initPWA } from './pwa.js';
import { requestPersistence, purgeOldTrash } from './db.js';
import { initMotion } from './animator.js';
import * as store from './store.js';

const app = document.getElementById('app');
const actions = document.getElementById('topbarActions');

async function route() {
  await store.flush();
  const m = location.hash.match(/^#\/edit\/(.+)$/);
  document.body.classList.toggle('in-editor', !!m);
  try {
    if (m) await renderEditor(app, actions, decodeURIComponent(m[1]));
    else if (location.hash === '#/new') await renderPicker(app, actions);
    else if (location.hash === '#/trash') await renderTrash(app, actions);
    else if (location.hash === '#/about') await renderAbout(app, actions);
    else await renderLibrary(app, actions);
  } catch (err) {
    app.innerHTML = '<section class="library"><h1>Something went wrong</h1><p class="sub">Storage may be blocked in this browser mode.</p></section>';
    console.error(err);
  }
}

addEventListener('hashchange', route);
route();
initPWA();
initMotion();
requestPersistence();
purgeOldTrash();
