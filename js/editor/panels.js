// Left panels: Add (element buttons) and Screens (thumbnails + screen actions).
import * as store from '../store.js';
import { createStage } from '../renderer.js';
import { pickImage } from './images.js';
import { openScreenTemplateDialog } from './screentemplates.js';

const h = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
};

export function createPanels(addRoot, screensRoot) {
  const btn = (text, onclick, props = {}) => h('button', { type: 'button', className: 'btn', textContent: text, onclick, ...props });

  addRoot.className = 'add-grid';
  addRoot.append(
    btn('Text', () => store.addElement('text')),
    btn('Rectangle', () => store.addElement('rect')),
    btn('Circle', () => store.addElement('circle')),
    btn('Image', async () => {
      const img = await pickImage();
      if (!img) return;
      const k = Math.min(1, 1400 / img.w, 800 / img.h);
      store.addElement('image', { w: Math.round(img.w * k), h: Math.round(img.h * k), content: { src: img.src, alt: img.name } });
    }),
    h('h3', { className: 'add-sub', textContent: 'Live' }),
    btn('Clock', () => store.addElement('clock')),
    btn('Timer', () => store.addElement('timer')),
    btn('Banner', () => store.addElement('banner')),
    btn('Ticker', () => store.addElement('ticker')),
    btn('QR code', () => store.addElement('qr')),
    btn('Scoreboard', () => store.addElement('scoreboard')),
  );

  const listEl = h('div', { className: 'screen-list' });
  const bar = h('div', { className: 'btn-row' });
  const bAdd = btn('+ New', () => openScreenTemplateDialog());
  const bDup = btn('Duplicate', () => store.duplicateScreen());
  const bUp = btn('↑', () => store.moveScreen(-1), { ariaLabel: 'Move screen earlier' });
  const bDown = btn('↓', () => store.moveScreen(1), { ariaLabel: 'Move screen later' });
  const bDel = btn('Delete', () => { if (confirm('Delete this screen?')) store.removeScreen(); }, { className: 'btn danger' });
  [bAdd, bDup, bUp, bDown, bDel].forEach((b) => b.classList.add('small'));
  bar.append(bAdd, bDup, bUp, bDown, bDel);
  screensRoot.append(bar, listEl);

  let stages = [];
  let lastKey = '';
  let timer = null;

  function rebuild() {
    const { deck, screenIndex } = store.getState();
    stages.forEach((s) => s.destroy());
    stages = [];
    listEl.replaceChildren(...deck.screens.map((s, i) => {
      const thumb = h('div');
      const item = h('button', { type: 'button', className: 'screen-item', onclick: () => store.setScreenIndex(i) }, thumb, h('span', { textContent: `${i + 1}. ${s.name}` }));
      item.setAttribute('aria-current', String(i === screenIndex));
      const st = createStage(thumb, deck, { live: false });
      st.setScreen(i);
      stages.push(st);
      return item;
    }));
    const cur = listEl.children[screenIndex];
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    bUp.disabled = screenIndex === 0;
    bDown.disabled = screenIndex === deck.screens.length - 1;
    bDel.disabled = deck.screens.length < 2;
  }

  return {
    // Selection or structure changes rebuild immediately; content edits are debounced (thumbnails are costly).
    refresh() {
      const { screenIndex, structRev, deck } = store.getState();
      const key = `${screenIndex}|${structRev}|${deck.screens.length}`;
      if (key !== lastKey) { lastKey = key; clearTimeout(timer); timer = null; rebuild(); return; }
      clearTimeout(timer);
      timer = setTimeout(rebuild, 400);
    },
    destroy() { clearTimeout(timer); stages.forEach((s) => s.destroy()); stages = []; },
  };
}
