// Editor view: wires the shared renderer to the canvas overlay, panels, inspector, history and shortcuts.
import { createStage } from '../renderer.js';
import * as store from '../store.js';
import { createCanvasEditor } from './canvas.js';
import { createInspector } from './inspector.js';
import { createPanels } from './panels.js';

let cleanup = null;
const mobile = matchMedia('(max-width: 900px)');

export async function renderEditor(root, actions, id) {
  if (cleanup) cleanup();
  cleanup = null;
  root.replaceChildren();
  actions.replaceChildren();

  const found = await store.openDeck(id);
  if (!found) {
    root.innerHTML = '<section class="library"><h1>Screen not found</h1><p class="sub">It may have been deleted.</p><a class="btn btn-primary" href="#/">Back to My Screens</a></section>';
    return;
  }
  const deck = store.getState().deck;

  // ---- top bar ----
  const mk = (tag, props, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
  const back = mk('a', { className: 'btn', href: '#/', title: 'My Screens' }, mk('span', { textContent: '←' }), mk('span', { className: 'lbl', textContent: ' My Screens' }));
  const name = mk('input', { className: 'name-input', value: deck.name });
  name.setAttribute('aria-label', 'Deck name');
  name.oninput = () => store.updateDeck((d) => { d.name = name.value.trim() || 'Untitled'; }, 'deck-name');
  const undoBtn = mk('button', { className: 'btn icon', textContent: '↶', title: 'Undo (Ctrl/Cmd+Z)', onclick: () => store.undo() });
  const redoBtn = mk('button', { className: 'btn icon', textContent: '↷', title: 'Redo (Ctrl/Cmd+Shift+Z)', onclick: () => store.redo() });
  undoBtn.setAttribute('aria-label', 'Undo');
  redoBtn.setAttribute('aria-label', 'Redo');
  const status = mk('span', { className: 'status', textContent: 'Saved' });
  const publish = mk('a', { className: 'btn btn-primary', textContent: 'Publish', href: `show.html?id=${encodeURIComponent(deck.id)}` });
  publish.onclick = () => { store.flush(); };
  actions.append(back, name, undoBtn, redoBtn, status, publish);

  // ---- layout ----
  root.innerHTML = `
    <div class="editor" data-tab="edit">
      <aside class="panel left">
        <section data-tab="add"><h2>Add</h2><div id="addRoot"></div></section>
        <section data-tab="screens"><h2>Screens</h2><div id="screensRoot"></div></section>
      </aside>
      <div class="canvas-wrap">
        <div id="canvas"></div>
        <div class="canvas-bar">
          <label class="check"><input type="checkbox" id="snap" checked> Snap</label>
          <span class="hint">Drag to move. Shift-drag a corner keeps proportions.</span>
        </div>
      </div>
      <aside class="panel right">
        <section data-tab="edit"><h2>Layers</h2><div id="layers"></div></section>
        <section data-tab="edit"><h2>Inspector</h2><div id="inspector"></div></section>
      </aside>
      <nav class="tabs" aria-label="Editor panels">
        <button data-go="add">Add</button><button data-go="screens">Screens</button><button data-go="edit">Edit</button>
      </nav>
    </div>`;
  const $ = (sel) => root.querySelector(sel);
  const editor = $('.editor');

  const stage = createStage($('#canvas'), deck);
  const canvas = createCanvasEditor($('#canvas'), stage);
  const inspector = createInspector($('#inspector'), $('#layers'));
  const panels = createPanels($('#addRoot'), $('#screensRoot'));
  canvas.onEdit = (el) => { setTab('edit'); if (el.type === 'text') inspector.focusText(); };
  $('#snap').onchange = (e) => { canvas.snap = e.target.checked; };

  function setTab(t) {
    editor.dataset.tab = t;
    root.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.go === t)));
  }
  root.querySelectorAll('.tabs button').forEach((b) => { b.onclick = () => setTab(b.dataset.go); });
  setTab('edit');

  // ---- render loop (batched per frame) ----
  let raf = 0, lastSelected = null;
  function draw() {
    raf = 0;
    const st = store.getState();
    if (!st.deck) return;
    stage.setDeck(st.deck);
    stage.setScreen(st.screenIndex);
    canvas.refresh();
    inspector.refresh();
    panels.refresh();
    undoBtn.disabled = !store.canUndo();
    redoBtn.disabled = !store.canRedo();
    status.textContent = st.dirty ? 'Saving…' : 'Saved';
    if (st.selectedId !== lastSelected) {
      lastSelected = st.selectedId;
      if (st.selectedId && mobile.matches && editor.dataset.tab !== 'edit') setTab('edit');
    }
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
  const unsubscribe = store.subscribe(schedule);
  draw();

  // ---- keyboard shortcuts ----
  function onKey(e) {
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (mod && k === 's') { e.preventDefault(); store.flush(); return; }
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    const sel = store.getSelected();
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); }
    else if (mod && k === 'y') { e.preventDefault(); store.redo(); }
    else if (mod && k === 'd') { e.preventDefault(); if (sel) store.duplicateElement(sel.id); }
    else if (k === 'delete' || k === 'backspace') { e.preventDefault(); if (sel && !sel.locked) store.removeElement(sel.id); }
    else if (k === 'escape') store.select(null);
    else if (k.startsWith('arrow') && sel && !sel.locked) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const patch = { arrowleft: { x: sel.x - step }, arrowright: { x: sel.x + step }, arrowup: { y: sel.y - step }, arrowdown: { y: sel.y + step } }[k];
      store.updateElement(sel.id, patch, `nudge:${sel.id}`);
    }
  }
  document.addEventListener('keydown', onKey);

  cleanup = () => {
    unsubscribe();
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey);
    panels.destroy();
    canvas.destroy();
    stage.destroy();
  };
}
