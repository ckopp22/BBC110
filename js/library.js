// Home / My Screens view.
import { createStage } from './renderer.js';
import * as store from './store.js';
import { wireImport, wireLaunchQueue } from './import.js';
import { exportLibraryBackup } from './export.js';

const h = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };

export async function renderLibrary(root, actions) {
  actions.replaceChildren();
  root.replaceChildren();
  await Promise.all([store.loadLibrary(), store.loadTrash()]);
  const { library, trash } = store.getState();

  const wrap = document.createElement('section');
  wrap.className = 'library';
  wrap.innerHTML = `
    <h1>My Screens</h1>
    <p class="sub">Build a screen, then Publish it to a TV or projector.</p>
    <div class="actions">
      <a class="btn btn-primary" href="#/new" data-new="template">New from template</a>
      <button class="btn" data-new="blank">Blank screen</button>
      <button class="btn" data-new="sample">Try the sample</button>
      <button class="btn" id="importBtn">Import…</button>
      <input type="file" id="importInput" accept=".json,.bbc110.json" hidden>
    </div>
    <p class="lib-links">
      <a href="#/trash">Trash${trash.length ? ` (${trash.length})` : ''}</a>
      <button type="button" class="link" id="backupBtn">Back up my library</button>
    </p>`;

  wrap.querySelectorAll('button[data-new]').forEach((b) => {
    b.onclick = async () => {
      const id = await store.createDeck(b.dataset.new);
      location.hash = `#/edit/${id}`;
    };
  });

  const status = h('p', { className: 'import-status', hidden: true });
  wrap.querySelector('.actions').after(status);
  const setStatus = (msg, isError) => { status.textContent = msg; status.hidden = !msg; status.classList.toggle('error', !!isError); };

  const onImported = async (result) => {
    if (result.kind === 'deck') { location.hash = `#/edit/${result.id}`; return; }
    await renderLibrary(root, actions);
    const again = root.querySelector('.import-status');
    if (again) { again.textContent = `Imported ${result.count} screen${result.count === 1 ? '' : 's'}.`; again.hidden = false; }
  };
  wireImport({
    dropZone: wrap, fileInput: wrap.querySelector('#importInput'),
    onStart: () => setStatus('Importing…'),
    onDone: onImported,
    onError: (msg) => setStatus(msg, true),
  });
  wrap.querySelector('#importBtn').onclick = () => wrap.querySelector('#importInput').click();
  wireLaunchQueue(onImported, (msg) => setStatus(msg, true));

  wrap.querySelector('#backupBtn').onclick = () => {
    if (!library.length) { setStatus('Nothing to back up yet.', true); return; }
    const { blob, filename } = exportLibraryBackup(library);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };

  if (!library.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Nothing here yet. Pick a template to get a good-looking screen in a minute, or drop a .bbc110.json file here to import one.';
    wrap.append(empty);
  } else {
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const deck of library) grid.append(card(deck, () => renderLibrary(root, actions)));
    wrap.append(grid);
  }
  root.append(wrap);
}

function card(deck, onChange) {
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
  const row1 = document.createElement('div');
  row1.className = 'card-actions';
  row1.innerHTML = `<a class="btn btn-primary" href="show.html?id=${encodeURIComponent(deck.id)}">Publish</a><button class="btn" data-open>Edit</button>`;
  const row2 = document.createElement('div');
  row2.className = 'card-actions';
  row2.innerHTML = `<button class="btn small" data-dup>Duplicate</button><button class="btn small" data-export>Export</button><button class="btn small btn-danger" data-del aria-label="Delete ${deck.name.replace(/"/g, '')}">Delete</button>`;
  row1.querySelector('[data-open]').onclick = thumb.onclick;
  row2.querySelector('[data-dup]').onclick = async () => { await store.duplicateDeck(deck.id); onChange(); };
  row2.querySelector('[data-export]').onclick = async () => {
    const { openExportDialog } = await import('./editor/exportdialog.js');
    openExportDialog(deck);
  };
  row2.querySelector('[data-del]').onclick = async () => {
    await store.removeDeck(deck.id);
    onChange();
  };
  body.append(name, meta, row1, row2);
  el.append(body);

  const stage = createStage(thumb, deck, { live: false });
  stage.setScreen(0);
  return el;
}
