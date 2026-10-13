// Trash view (#/trash): decks deleted from My Screens stay here for 30 days before being purged.
import { createStage } from './renderer.js';
import * as store from './store.js';
import { TRASH_RETENTION_DAYS } from './db.js';

const h = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
const daysLeft = (trashedAt) => Math.max(0, TRASH_RETENTION_DAYS - Math.floor((Date.now() - trashedAt) / 86400000));

export async function renderTrash(root, actions) {
  actions.replaceChildren();
  root.replaceChildren();
  await store.loadTrash();
  const { trash } = store.getState();

  const wrap = h('section', { className: 'library' },
    h('a', { className: 'btn', href: '#/', textContent: '← My Screens' }),
    h('h1', { textContent: 'Trash' }),
    h('p', { className: 'sub', textContent: `Deleted screens stay here for ${TRASH_RETENTION_DAYS} days, then they're removed for good.` }));

  if (!trash.length) {
    wrap.append(h('div', { className: 'empty', textContent: 'Trash is empty.' }));
  } else {
    const grid = h('div', { className: 'grid' });
    trash.forEach((deck) => grid.append(card(deck, () => renderTrash(root, actions))));
    wrap.append(grid);
  }
  root.append(wrap);
}

function card(deck, onChange) {
  const thumb = h('div', { className: 'card-thumb' });
  const left = daysLeft(deck.trashedAt);
  const body = h('div', { className: 'card-body' },
    h('div', { className: 'card-name', textContent: deck.name }),
    h('div', { className: 'card-meta', textContent: `${deck.screens.length} screen${deck.screens.length === 1 ? '' : 's'} · ${left === 0 ? 'removed soon' : `${left} day${left === 1 ? '' : 's'} left`}` }),
    h('div', { className: 'card-actions' },
      h('button', { type: 'button', className: 'btn btn-primary', textContent: 'Restore', onclick: async () => { await store.restoreFromTrash(deck.id); onChange(); } }),
      h('button', {
        type: 'button', className: 'btn btn-danger', textContent: 'Delete forever',
        onclick: async () => { if (confirm(`Permanently delete "${deck.name}"? This cannot be undone.`)) { await store.purgeForever(deck.id); onChange(); } },
      })));
  const el = h('article', { className: 'card' }, thumb, body);
  createStage(thumb, deck, { live: false }).setScreen(0);
  return el;
}
