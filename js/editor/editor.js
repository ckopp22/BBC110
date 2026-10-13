// Editor view: wires the shared renderer to the canvas overlay, panels, inspector, history and shortcuts.
import { createStage } from '../renderer.js';
import * as store from '../store.js';
import { createCanvasEditor } from './canvas.js';
import { createInspector } from './inspector.js';
import { createPanels } from './panels.js';
import { entranceEndMs, reduceMotion } from '../animator.js';

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
          <button class="btn small" id="previewBtn" type="button">\u25B6 Preview</button>
          <span class="hint" id="barHint">Drag to move. Shift-drag a corner keeps proportions.</span>
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
  const inspector = createInspector($('#inspector'), $('#layers'), { preview: startPreview, motion: updateMotionNote });
  const panels = createPanels($('#addRoot'), $('#screensRoot'));
  canvas.onEdit = (el) => { setTab('edit'); if (el.type === 'text') inspector.focusText(); };
  $('#snap').onchange = (e) => { canvas.snap = e.target.checked; };

  function setTab(t) {
    editor.dataset.tab = t;
    root.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.go === t)));
  }
  root.querySelectorAll('.tabs button').forEach((b) => { b.onclick = () => setTab(b.dataset.go); });
  setTab('edit');

  // ---- animation preview: transition in, entrances/loops, hold, exit, then back to editing ----
  let previewing = false, previewTimers = [], previewAt = null;
  const previewBtn = $('#previewBtn');
  function updateMotionNote() {
    $('#barHint').textContent = reduceMotion() ? 'Reduce motion is on, so animations and transitions are skipped.' : 'Drag to move. Shift-drag a corner keeps proportions.';
  }
  function stopPreview() {
    if (!previewing) return;
    previewing = false;
    previewTimers.forEach(clearTimeout);
    previewTimers = [];
    canvas.setHidden(false);
    previewBtn.textContent = '\u25B6 Preview';
    schedule();
  }
  function startPreview() {
    if (previewing) { stopPreview(); return; }
    const st = store.getState();
    const i = st.screenIndex, dk = st.deck, sc = dk.screens[i];
    previewing = true;
    previewAt = { rev: st.rev, sel: st.selectedId, screen: st.screenIndex };
    previewBtn.textContent = '\u25A0 Stop';
    canvas.setHidden(true);
    stage.setDeck(dk);
    updateMotionNote();
    const later = (fn, ms) => previewTimers.push(setTimeout(fn, ms));
    const type = (sc.transition && sc.transition.type) || (dk.transition && dk.transition.type) || 'fade';
    const tms = type === 'none' ? 0 : (dk.transition && dk.transition.durationMs) ?? 600;
    let t = 0;
    if (i > 0) {
      stage.setScreen(i - 1, { animate: false });
      t = 350;
      later(() => stage.setScreen(i, { animate: true, transitionMs: tms, type, dir: 1 }), t);
      t += tms;
    } else {
      stage.setScreen(i, { animate: true });
    }
    t += Math.max(entranceEndMs(sc), 1500) + 1500;
    later(() => { const ms = stage.playExit(); later(stopPreview, ms + 400); }, t);
  }
  previewBtn.onclick = startPreview;
  $('#canvas').addEventListener('pointerdown', () => { if (previewing) stopPreview(); });

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
  const schedule = () => {
    if (previewing) {
      // Edits or selection changes end the preview; the autosave notification (no change) must not.
      const st = store.getState();
      if (st.rev !== previewAt.rev || st.selectedId !== previewAt.sel || st.screenIndex !== previewAt.screen) stopPreview();
      return;
    }
    if (!raf) raf = requestAnimationFrame(draw);
  };
  const unsubscribe = store.subscribe(schedule);
  draw();
  updateMotionNote();

  // ---- keyboard shortcuts ----
  function onKey(e) {
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (k === 'escape' && previewing) { stopPreview(); return; }
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
    previewTimers.forEach(clearTimeout);
    document.removeEventListener('keydown', onKey);
    panels.destroy();
    canvas.destroy();
    stage.destroy();
  };
}
