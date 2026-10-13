// Context-sensitive inspector (screen or selected element) plus the layers list.
import * as store from '../store.js';
import { pickImage } from './images.js';

const h = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
};

function toHex(v, fallback) {
  if (typeof v === 'string') {
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + [...v.slice(1)].map((c) => c + c).join('');
  }
  return fallback;
}

export function createInspector(root, layersRoot, hooks = {}) {
  let controls = [];
  let lastKey = '';
  let textArea = null;

  const group = (title) => {
    const g = h('section', { className: 'group' }, h('h3', { textContent: title }));
    root.append(g);
    return g;
  };
  const row = (parent, label, input, sync) => {
    parent.append(h('label', { className: 'field' }, h('span', { textContent: label }), input));
    if (sync) controls.push(() => { if (document.activeElement !== input) sync(input); });
    return input;
  };
  const num = (parent, label, get, set, { min, max, step = 1 } = {}) => {
    const i = h('input', { type: 'number', step, inputMode: 'decimal' });
    if (min != null) i.min = min;
    if (max != null) i.max = max;
    i.oninput = () => { const v = parseFloat(i.value); if (!Number.isNaN(v)) set(v); };
    return row(parent, label, i, (n) => { n.value = get(); });
  };
  const select = (parent, label, options, get, set) => {
    const s = h('select');
    options.forEach(([v, t]) => s.add(new Option(t, v)));
    s.onchange = () => set(s.value);
    return row(parent, label, s, (n) => { n.value = get(); });
  };
  const color = (parent, label, get, set, fallback) => {
    const i = h('input', { type: 'color' });
    i.oninput = () => set(i.value);
    return row(parent, label, i, (n) => { n.value = toHex(get(), fallback); });
  };
  const button = (parent, text, onclick, cls = '') => {
    const b = h('button', { className: 'btn small ' + cls, textContent: text, type: 'button' });
    b.onclick = onclick;
    parent.append(b);
    return b;
  };

  function buildScreen() {
    const g = group('Screen');
    const text = h('input', { type: 'text' });
    text.oninput = () => store.setScreenProps({ name: text.value || 'Screen' }, 'screen-name');
    row(g, 'Name', text, (n) => { n.value = cur().name; });
    num(g, 'Seconds', () => cur().durationSec, (v) => store.setScreenProps({ durationSec: Math.max(1, v) }, 'screen-dur'), { min: 1 });
    g.append(h('p', { className: 'hint', textContent: 'Tap an element on the canvas to edit it, or add one from the Add tab.' }));
  }
  const cur = () => { const s = store.getState(); return s.deck.screens[s.screenIndex]; };

  function buildElement(el) {
    const id = el.id;
    const g = () => store.getSelected() || el;
    const upd = (patch, key) => store.updateElement(id, patch, `${key}:${id}`);
    const sty = (k) => (v) => upd({ style: { [k]: v } }, k);

    if (el.type === 'text') {
      const t = group('Text');
      textArea = h('textarea', { rows: 3 });
      textArea.oninput = () => upd({ content: { text: textArea.value } }, 'text');
      row(t, 'Text', textArea, (n) => { n.value = g().content.text || ''; });
      num(t, 'Size', () => g().style.fontSize || 64, sty('fontSize'), { min: 8, max: 600 });
      select(t, 'Weight', [[400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extra bold']], () => g().style.fontWeight || 400, (v) => upd({ style: { fontWeight: +v } }, 'weight'));
      color(t, 'Color', () => g().style.color, sty('color'), '#ffffff');
      const al = h('div', { className: 'seg' });
      [['left', 'Left'], ['center', 'Center'], ['right', 'Right']].forEach(([v, label]) => {
        const b = h('button', { type: 'button', textContent: label, ariaPressed: 'false' });
        b.onclick = () => upd({ style: { align: v } }, 'align');
        al.append(b);
        controls.push(() => b.setAttribute('aria-pressed', String((g().style.align || 'left') === v)));
      });
      t.append(h('div', { className: 'field' }, h('span', { textContent: 'Align' }), al));
      select(t, 'Vertical', [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']], () => g().style.valign || 'top', sty('valign'));
      num(t, 'Line height', () => g().style.lineHeight || 1.15, sty('lineHeight'), { min: 0.5, max: 3, step: 0.05 });
      num(t, 'Letter space', () => g().style.letterSpacing || 0, sty('letterSpacing'), { min: -20, max: 100 });
      select(t, 'Case', [['', 'Normal'], ['uppercase', 'UPPER'], ['lowercase', 'lower'], ['capitalize', 'Title']], () => g().style.textTransform || '', sty('textTransform'));
      const it = h('input', { type: 'checkbox' });
      it.onchange = () => upd({ style: { italic: it.checked } }, 'italic');
      row(t, 'Italic', it, (n) => { n.checked = !!g().style.italic; });
    } else if (el.type === 'shape') {
      const t = group('Shape');
      color(t, 'Fill', () => g().style.fill, sty('fill'), '#2563eb');
      select(t, 'Shape', [['rect', 'Rectangle'], ['circle', 'Circle']], () => g().style.shape || 'rect', sty('shape'));
      num(t, 'Corner radius', () => g().style.radius || 0, sty('radius'), { min: 0, max: 1000 });
      num(t, 'Opacity', () => g().style.opacity ?? 1, sty('opacity'), { min: 0, max: 1, step: 0.05 });
    } else if (el.type === 'image') {
      const t = group('Image');
      button(t, 'Replace image', async () => {
        const img = await pickImage();
        if (img) store.updateElement(id, { content: { src: img.src } });
      });
      select(t, 'Fit', [['cover', 'Fill (crop)'], ['contain', 'Fit (no crop)']], () => g().style.fit || 'cover', sty('fit'));
      num(t, 'Corner radius', () => g().style.radius || 0, sty('radius'), { min: 0, max: 1000 });
      const alt = h('input', { type: 'text' });
      alt.oninput = () => upd({ content: { alt: alt.value } }, 'alt');
      row(t, 'Alt text', alt, (n) => { n.value = g().content.alt || ''; });
    }

    const p = group('Position and size');
    const grid = h('div', { className: 'grid2' });
    p.append(grid);
    const pos = (k) => (v) => upd({ [k]: Math.round(v) }, k);
    num(grid, 'X', () => g().x, pos('x'));
    num(grid, 'Y', () => g().y, pos('y'));
    num(grid, 'W', () => g().w, (v) => upd({ w: Math.max(20, Math.round(v)) }, 'w'), { min: 20 });
    num(grid, 'H', () => g().h, (v) => upd({ h: Math.max(20, Math.round(v)) }, 'h'), { min: 20 });
    num(grid, 'Rotate', () => g().rotation, (v) => upd({ rotation: Math.round(v) }, 'rot'), { min: -180, max: 180 });

    const a = group('Arrange');
    const r1 = h('div', { className: 'btn-row' });
    const r2 = h('div', { className: 'btn-row' });
    a.append(r1, r2);
    button(r1, 'To front', () => store.reorderElement(id, 'front'));
    button(r1, 'Forward', () => store.reorderElement(id, 'up'));
    button(r1, 'Backward', () => store.reorderElement(id, 'down'));
    button(r1, 'To back', () => store.reorderElement(id, 'back'));
    const lock = button(r2, '', () => store.updateElement(id, { locked: !g().locked }));
    const hide = button(r2, '', () => store.updateElement(id, { hidden: !g().hidden }));
    controls.push(() => { lock.textContent = g().locked ? 'Unlock' : 'Lock'; hide.textContent = g().hidden ? 'Show' : 'Hide'; });
    button(r2, 'Duplicate', () => store.duplicateElement(id));
    button(r2, 'Delete', () => store.removeElement(id), 'danger');
  }

  function drawLayers() {
    const s = cur();
    const { selectedId } = store.getState();
    const list = [...s.elements].sort((a, b) => b.z - a.z);
    if (!list.length) { layersRoot.replaceChildren(h('p', { className: 'hint', textContent: 'No elements yet.' })); return; }
    layersRoot.replaceChildren(...list.map((el) => {
      const label = el.type === 'text' ? (el.content.text || 'Text').split('\n')[0].slice(0, 28)
        : el.type === 'shape' ? (el.style.shape === 'circle' ? 'Circle' : 'Rectangle') : 'Image';
      const item = h('div', { className: 'layer' + (el.id === selectedId ? ' on' : '') + (el.hidden ? ' dim' : '') });
      const name = h('button', { type: 'button', className: 'layer-name', textContent: `${el.locked ? '\u{1F512} ' : ''}${label}` });
      name.onclick = () => store.select(el.id);
      const eye = h('button', { type: 'button', className: 'layer-eye', textContent: el.hidden ? 'Show' : 'Hide' });
      eye.onclick = () => store.updateElement(el.id, { hidden: !el.hidden });
      item.append(name, eye);
      return item;
    }));
  }

  return {
    // Rebuild the form only when the selection or structure changes; otherwise just sync values in place.
    refresh() {
      const st = store.getState();
      const el = store.getSelected();
      const key = `${st.screenIndex}|${st.selectedId}|${el ? el.type : ''}|${st.structRev}`;
      if (key !== lastKey) {
        lastKey = key;
        root.replaceChildren();
        controls = [];
        textArea = null;
        if (el) buildElement(el); else buildScreen();
      }
      controls.forEach((fn) => fn());
      drawLayers();
    },
    focusText() { if (textArea) { textArea.focus(); textArea.select(); } },
  };
}
