// Color field: swatch + hex input, with a palette popover (theme colors, recent, saved).
import * as store from '../store.js';
import { themeVars, resolveColor } from '../themes.js';
import { getSetting, setSetting } from '../db.js';

const TOKENS = [['--bg', 'Background'], ['--fg', 'Text'], ['--accent', 'Accent'], ['--muted', 'Muted']];
const MAX_RECENT = 8, MAX_SAVED = 16;

const h = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
};

// Theme values in effect for the current screen, so var(--accent) previews correctly outside the stage.
function activeVars() {
  const st = store.getState();
  const sc = st.deck.screens[st.screenIndex];
  return themeVars((sc && sc.theme) || st.deck.theme, st.deck);
}

// "#abc", "abc", "#aabbcc", "rgb(...)" -> "#rrggbb" for the native picker; fallback if not convertible.
export function toHex(v, fallback = '#ffffff') {
  if (typeof v !== 'string') return fallback;
  const s = v.trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + [...s.slice(1)].map((c) => c + c).join('').toLowerCase();
  const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(s);
  if (m) return '#' + [m[1], m[2], m[3]].map((n) => Math.min(255, +n).toString(16).padStart(2, '0')).join('');
  return fallback;
}

function remember(key, color, max) {
  const list = getSetting(key, []).filter((c) => c !== color);
  list.unshift(color);
  setSetting(key, list.slice(0, max));
}

function parseColor(text) {
  let v = text.trim();
  if (/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v)) v = '#' + v;
  return CSS.supports('color', v) ? v : null;
}

// get/set read and write the stored color string (hex, rgba(), or var(--token)).
// register(fn) is called with a sync function so the inspector can refresh the field in place.
export function colorField(parent, label, get, set, { fallback = '#ffffff', register, tokens = true } = {}) {
  const field = h('div', { className: 'field color-field' });
  const swatch = h('button', { type: 'button', className: 'swatch', title: 'Choose color' });
  swatch.setAttribute('aria-label', `${label} color`);
  const hex = h('input', { type: 'text', className: 'hex', spellcheck: false });
  hex.setAttribute('aria-label', `${label} hex`);
  const pop = h('div', { className: 'palette', hidden: true });
  field.append(h('span', { textContent: label }), h('div', { className: 'cf' }, swatch, hex), pop);
  parent.append(field);

  const current = () => get() || fallback;
  const tokenOf = (v) => TOKENS.find(([t]) => v === `var(${t})`);

  function sync() {
    const v = current();
    swatch.style.background = resolveColor(v, activeVars());
    if (document.activeElement !== hex) { const t = tokenOf(v); hex.value = t ? t[1] : v; }
  }
  const apply = (v, rec) => { set(v); if (rec && !String(v).startsWith('var(')) remember('colors.recent', v, MAX_RECENT); sync(); };

  hex.onchange = () => {
    const v = parseColor(hex.value);
    if (v) apply(v, true); else { hex.value = ''; sync(); }
  };
  hex.onblur = sync;

  function buildPalette() {
    pop.replaceChildren();
    const native = h('input', { type: 'color', className: 'native', value: toHex(resolveColor(current(), activeVars()), toHex(fallback)) });
    native.oninput = () => apply(native.value, false);
    native.onchange = () => apply(native.value, true);
    const dot = (color, title, onclick) => {
      const b = h('button', { type: 'button', className: 'dot', title: title || color, onclick });
      b.style.background = resolveColor(color, activeVars());
      b.setAttribute('aria-label', title || color);
      return b;
    };
    const rowOf = (title, dots) => (dots.length ? h('div', { className: 'pal-row' }, h('small', { textContent: title }), ...dots) : '');
    const saved = getSetting('colors.saved', []);
    pop.append(
      h('div', { className: 'pal-row' }, native, h('button', {
        type: 'button', className: 'btn small', textContent: '★ Save',
        onclick: () => { remember('colors.saved', toHex(resolveColor(current(), activeVars()), toHex(fallback)), MAX_SAVED); buildPalette(); },
      })),
      tokens ? rowOf('Theme', TOKENS.map(([t, name]) => dot(`var(${t})`, name, () => { apply(`var(${t})`, false); buildPalette(); }))) : '',
      rowOf('Recent', getSetting('colors.recent', []).map((c) => dot(c, c, () => { apply(c, false); buildPalette(); }))),
      rowOf('Saved', saved.map((c) => dot(c, c, () => { apply(c, false); buildPalette(); }))),
    );
    if (saved.length) {
      pop.append(h('button', {
        type: 'button', className: 'link', textContent: 'Clear saved',
        onclick: () => { setSetting('colors.saved', []); buildPalette(); },
      }));
    }
  }
  swatch.onclick = () => { pop.hidden = !pop.hidden; if (!pop.hidden) buildPalette(); };

  sync();
  if (register) register(() => { sync(); if (!pop.hidden && !pop.contains(document.activeElement)) { const n = pop.querySelector('.native'); if (n) n.value = toHex(resolveColor(current(), activeVars()), toHex(fallback)); } });
  return field;
}
