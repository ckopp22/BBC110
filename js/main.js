// Bootstrap and hash routing: #/ (library), #/edit/<id> (editor).
import { renderLibrary } from './library.js';
import { renderEditor } from './editor/editor.js';
import { initPWA } from './pwa.js';
import { requestPersistence } from './db.js';
import * as store from './store.js';

const app = document.getElementById('app');
const actions = document.getElementById('topbarActions');

async function route() {
  await store.flush();
  const m = location.hash.match(/^#\/edit\/(.+)$/);
  try {
    if (m) await renderEditor(app, actions, decodeURIComponent(m[1]));
    else await renderLibrary(app, actions);
  } catch (err) {
    app.innerHTML = '<section class="library"><h1>Something went wrong</h1><p class="sub">Storage may be blocked in this browser mode.</p></section>';
    console.error(err);
  }
}

addEventListener('hashchange', route);
route();
initPWA();
requestPersistence();
