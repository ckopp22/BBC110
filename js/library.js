// Home / My Screens view.
import { createStage } from './renderer.js';
import * as store from './store.js';

export async function renderLibrary(root, actions) {
  actions.replaceChildren();
  root.replaceChildren();
  await store.loadLibrary();
  const { library } = store.getState();

  const wrap = document.createElement('section');
  wrap.className = 'library';
  wrap.innerHTML = `
    <h1>My Screens</h1>
    <p class="sub">Build a screen, then Publish it to a TV or projector.</p>
    <div class="actions">
      <a class="btn btn-primary" href="#/new" data-new="template">New from template</a>
      <button class="btn" data-new="blank">Blank screen</button>
      <button class="btn" data-new="sample">Try the sample</button>
    </div>`;

  wrap.querySelectorAll('button[data-new]').forEach((b) => {
    b.onclick = async () => {
      const id = await store.createDeck(b.dataset.new);
      location.hash = `#/edit/${id}`;
    };
  });

  if (!library.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Nothing here yet. Pick a template to get a good-looking screen in a minute.';
    wrap.append(empty);
  } else {
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const deck of library) grid.append(card(deck));
    wrap.append(grid);
  }
  root.append(wrap);
}

function card(deck) {
  const el = document.createElement('article');
  el.className = 'card';
  const thumb = document.createElement('button');
  thumb.className = 'card-thumb';
  thumb.setAttribute('aria-label', `Open ${deck.name}`);
  thumb.onclick = () => { location.hash = `#/edit/${deck.id}`; };
  el.append(thumb);

  const body = document.createElement('div');
  body.className = 'card-body';
  const name = document.createElement('div');
  name.className = 'card-name';
  name.textContent = deck.name;
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.textContent = `${deck.screens.length} screen${deck.screens.length === 1 ? '' : 's'} · ${new Date(deck.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
  const row = document.createElement('div');
  row.className = 'card-actions';
  row.innerHTML = `<a class="btn btn-primary" href="show.html?id=${encodeURIComponent(deck.id)}">Publish</a><button class="btn" data-open>Edit</button><button class="btn btn-danger" data-del aria-label="Delete ${deck.name.replace(/"/g, '')}">Delete</button>`;
  row.querySelector('[data-open]').onclick = thumb.onclick;
  row.querySelector('[data-del]').onclick = async () => {
    if (confirm(`Delete "${deck.name}"? This cannot be undone.`)) {
      await store.removeDeck(deck.id);
      el.remove();
    }
  };
  body.append(name, meta, row);
  el.append(body);

  const stage = createStage(thumb, deck, { live: false });
  stage.setScreen(0);
  return el;
}
