// Version history dialog: browse automatic snapshots of this deck and restore one.
import { createStage } from '../renderer.js';
import * as store from '../store.js';

const h = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
const fmt = (ms) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export async function openVersionsDialog(deckId) {
  const dlg = h('dialog', { className: 'dialog versions-dialog' });
  dlg.append(h('h2', { textContent: 'Version history' }));
  const list = h('div', { className: 'version-list' });
  const hint = h('p', { className: 'hint', textContent: 'BBC110 saves a snapshot automatically as you work (up to the last 10). Restoring adds a new snapshot first, so you can always undo it.' });
  const close = h('button', { type: 'button', className: 'btn', textContent: 'Close' });
  close.onclick = () => dlg.close();
  dlg.append(hint, list, h('div', { className: 'dialog-actions' }, close));
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();

  const snaps = await store.listVersions(deckId);
  if (!snaps.length) { list.append(h('p', { className: 'hint', textContent: 'No earlier versions yet — check back after you’ve been editing a while.' })); return; }

  snaps.forEach((snap, i) => {
    const thumb = h('div', { className: 'v-thumb' });
    const item = h('div', { className: 'version-item' },
      thumb,
      h('div', { className: 'v-info' },
        h('div', { className: 'v-when', textContent: i === 0 ? `${fmt(snap.at)} (most recent)` : fmt(snap.at) }),
        h('div', { className: 'v-meta', textContent: `${snap.deck.screens.length} screen${snap.deck.screens.length === 1 ? '' : 's'}` })),
      h('button', {
        type: 'button', className: 'btn small', textContent: 'Restore',
        onclick: async () => { await store.restoreVersion(snap.deck); dlg.close(); },
      }));
    list.append(item);
    createStage(thumb, snap.deck, { live: false }).setScreen(0);
  });
}
