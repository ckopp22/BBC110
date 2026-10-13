// Template picker view (#/new): pick a starting point, get a fully editable copy.
import { createStage } from './renderer.js';
import { loadTemplates, instantiate, blankDeck } from './templates.js';
import * as store from './store.js';

const h = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
};

export async function renderPicker(root, actions) {
  root.replaceChildren();
  actions.replaceChildren(h('a', { className: 'btn', href: '#/', textContent: '← My Screens' }));
  const wrap = h('section', { className: 'library picker' }, h('h1', { textContent: 'Choose a template' }), h('p', { className: 'sub', textContent: 'Pick a starting point. Everything in it is editable.' }));
  root.append(wrap);

  let templates = [];
  try { templates = await loadTemplates(); } catch {
    wrap.append(h('p', { className: 'sub', textContent: 'Templates could not be loaded right now. You can still start from a blank screen.' }));
  }

  const create = async (deck) => { location.hash = `#/edit/${await store.saveNewDeck(deck)}`; };
  const cats = ['All', ...new Set(templates.map((t) => t.category))];
  let active = 'All';

  const chips = h('div', { className: 'chips', role: 'group' });
  chips.setAttribute('aria-label', 'Template categories');
  const grid = h('div', { className: 'grid' });
  wrap.append(chips, grid);

  function card(title, description, meta, deckForThumb, onUse, cls = '') {
    const thumb = h('button', { type: 'button', className: 'card-thumb', onclick: onUse });
    thumb.setAttribute('aria-label', `Use ${title}`);
    const body = h('div', { className: 'card-body' },
      h('div', { className: 'card-name', textContent: title }),
      h('div', { className: 'card-meta', textContent: meta }),
      h('p', { className: 'card-desc', textContent: description }),
      h('div', { className: 'card-actions' }, h('button', { type: 'button', className: 'btn btn-primary', textContent: 'Use this', onclick: onUse })));
    const el = h('article', { className: 'card ' + cls }, thumb, body);
    createStage(thumb, deckForThumb, { live: false }).setScreen(0);
    return el;
  }

  function draw() {
    chips.replaceChildren(...cats.map((c) => {
      const b = h('button', { type: 'button', className: 'chip', textContent: c, onclick: () => { active = c; draw(); } });
      b.setAttribute('aria-pressed', String(c === active));
      return b;
    }));
    const cards = [];
    if (active === 'All') cards.push(card('Blank', 'An empty screen. Add anything you like.', '1 screen', blankDeck(), () => create(blankDeck())));
    templates.filter((t) => active === 'All' || t.category === active).forEach((t) => {
      const n = t.deck.screens.length;
      cards.push(card(t.name, t.description, `${t.category} · ${n} screen${n === 1 ? '' : 's'}`, instantiate(t), () => create(instantiate(t))));
    });
    grid.replaceChildren(...cards);
  }
  draw();
}
