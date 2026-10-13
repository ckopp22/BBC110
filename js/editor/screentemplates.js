// "Add a screen" dialog: pick a built-in screen template to insert, or start blank.
import { createStage } from '../renderer.js';
import { loadScreenTemplates, previewDeckForScreen, blankDeck } from '../templates.js';
import * as store from '../store.js';

const h = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };

export async function openScreenTemplateDialog() {
  const dlg = h('dialog', { className: 'dialog screen-template-dialog' });
  const grid = h('div', { className: 'grid' });
  const close = h('button', { type: 'button', className: 'btn', textContent: 'Cancel' });
  close.onclick = () => dlg.close();
  dlg.append(h('h2', { textContent: 'Add a screen' }), h('p', { className: 'sub', textContent: 'Pick a starting point, or start blank.' }), grid, h('div', { className: 'dialog-actions' }, close));
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());

  function card(title, meta, deckForThumb, onUse) {
    const thumb = h('button', { type: 'button', className: 'card-thumb', onclick: onUse });
    thumb.setAttribute('aria-label', `Use ${title}`);
    const body = h('div', { className: 'card-body' }, h('div', { className: 'card-name', textContent: title }), h('div', { className: 'card-meta', textContent: meta }));
    const el = h('article', { className: 'card' }, thumb, body);
    createStage(thumb, deckForThumb, { live: false }).setScreen(0);
    return el;
  }

  const use = (action) => { action(); dlg.close(); };
  grid.append(card('Blank', 'Empty screen', blankDeck(), () => use(() => store.addScreen())));

  let list = [];
  try { list = await loadScreenTemplates(); } catch { /* built-ins unavailable; blank still works */ }
  list.forEach((item) => {
    grid.append(card(item.label, item.category, previewDeckForScreen(item.tpl, item.index), () => use(() => store.addScreenFromTemplate(item.tpl, item.index))));
  });

  dlg.showModal();
}
