// Context-sensitive inspector (deck/screen settings or selected element) plus the layers list.
import * as store from '../store.js';
import { pickImage } from './images.js';
import { colorField } from './colorpicker.js';
import { THEMES, resolveTheme } from '../themes.js';
import { FONT_GROUPS, fontStack } from '../fonts.js';
import { ASPECTS } from '../model.js';
import { ENTRANCES, LOOPS, EXITS, TRANSITIONS, EASINGS, getMotionSetting, setMotionSetting } from '../animator.js';
import { BACKGROUND_KINDS } from '../backgrounds.js';

const h = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
};

const bgMode = (bg) => (bg.type === 'animated' ? 'animated' : bg.type === 'image' && bg.value ? 'image' : bg.type === 'gradient' ? 'gradient' : bg.value ? 'solid' : 'theme');
const gradientCss = (g) => (g.kind === 'radial' ? `radial-gradient(circle at center, ${g.c1}, ${g.c2})` : `linear-gradient(${g.angle}deg, ${g.c1}, ${g.c2})`);

// Style effect defaults (text). Missing keys fall back to these.
const EFFECT_DEFAULTS = { shadow: { blur: 0, color: 'rgba(0,0,0,.6)' }, glow: { blur: 0, color: 'var(--accent)' }, stroke: { width: 0, color: 'var(--bg)' } };

// Shape style presets. Each sets every styling key so presets replace each other cleanly.
const PRESETS = {
  Card: { fill: 'var(--card)', radius: 32, borderWidth: 0, shadow: 0, blur: 0, opacity: 1 },
  Glass: { fill: 'rgba(255,255,255,.14)', radius: 36, borderWidth: 2, borderColor: 'rgba(255,255,255,.4)', shadow: 30, blur: 24, opacity: 1 },
  Outlined: { fill: 'transparent', radius: 28, borderWidth: 6, borderColor: 'var(--accent)', shadow: 0, blur: 0, opacity: 1 },
  Solid: { fill: 'var(--accent)', radius: 28, borderWidth: 0, shadow: 0, blur: 0, opacity: 1 },
  Shadowed: { fill: '#ffffff', radius: 28, borderWidth: 0, shadow: 60, blur: 0, opacity: 1 },
};

const TIME_ZONES = [['', 'Device time zone'], ['UTC', 'UTC'], ['America/New_York', 'Eastern'], ['America/Chicago', 'Central'], ['America/Denver', 'Mountain'], ['America/Phoenix', 'Arizona'], ['America/Los_Angeles', 'Pacific'], ['America/Anchorage', 'Alaska'], ['Pacific/Honolulu', 'Hawaii'], ['Europe/London', 'London'], ['Europe/Paris', 'Paris'], ['Asia/Tokyo', 'Tokyo'], ['Australia/Sydney', 'Sydney']];
const WEIGHTS = [[400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extra bold']];
const LAYER_NAMES = { clock: 'Clock', timer: 'Timer', ticker: 'Ticker', qr: 'QR code', scoreboard: 'Scoreboard' };

export function createInspector(root, layersRoot, hooks = {}) {
  let controls = [];
  let lastKey = '';
  let textArea = null;

  const st = () => store.getState();
  const deck = () => st().deck;
  const cur = () => deck().screens[st().screenIndex];

  const group = (title, { details = false } = {}) => {
    const g = details
      ? h('details', { className: 'group' }, h('summary', { textContent: title }))
      : h('section', { className: 'group' }, h('h3', { textContent: title }));
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
  const check = (parent, label, get, set) => {
    const i = h('input', { type: 'checkbox' });
    i.onchange = () => set(i.checked);
    return row(parent, label, i, (n) => { n.checked = !!get(); });
  };
  const color = (parent, label, get, set, fallback, tokens = true) =>
    colorField(parent, label, get, set, { fallback, tokens, register: (fn) => controls.push(fn) });
  const button = (parent, text, onclick, cls = '') => {
    const b = h('button', { className: 'btn small ' + cls, textContent: text, type: 'button' });
    b.onclick = onclick;
    parent.append(b);
    return b;
  };
  // byName: option value is the font name (theme builder); otherwise the CSS stack (text elements).
  const fontSelect = (parent, label, get, set, { byName = false, theme = false } = {}) => {
    const s = h('select');
    if (theme) { s.add(new Option('Theme heading', 'var(--font-display)')); s.add(new Option('Theme body', 'var(--font-body)')); }
    FONT_GROUPS.forEach(([cat, list]) => {
      const og = h('optgroup', { label: cat });
      list.forEach((f) => { const o = new Option(f.name, byName ? f.name : f.stack); o.style.fontFamily = f.stack; og.append(o); });
      s.append(og);
    });
    s.onchange = () => set(s.value);
    return row(parent, label, s, (n) => { n.value = get(); });
  };

  // ---------- deck / screen (nothing selected) ----------
  function buildDeck() {
    const g = group('Theme');
    const grid = h('div', { className: 'theme-grid' });
    g.append(grid);
    [...THEMES, { id: 'custom', name: 'Custom' }].forEach((th) => {
      const b = h('button', { type: 'button', className: 'theme-chip' + (th.id === 'custom' ? ' custom' : '') });
      if (th.id === 'custom') b.textContent = 'Custom…';
      else {
        b.style.background = th.bg; b.style.color = th.fg; b.style.fontFamily = fontStack(th.display);
        const dot = h('span', { className: 'tc-dot' });
        dot.style.background = th.accent;
        b.append(h('span', { textContent: th.name }), dot);
      }
      b.onclick = () => store.updateDeck((d) => {
        if (th.id === 'custom' && !d.customTheme) { const { id, name, ...base } = resolveTheme(d.theme, d); d.customTheme = base; }
        d.theme = th.id;
      });
      controls.push(() => b.setAttribute('aria-pressed', String(deck().theme === th.id)));
      grid.append(b);
    });

    if (deck().theme === 'custom') {
      const c = group('Custom theme');
      const ct = (k) => () => deck().customTheme[k];
      const setCt = (k) => (v) => store.updateDeck((d) => { d.customTheme[k] = v; }, `ct-${k}`);
      [['bg', 'Background'], ['fg', 'Text'], ['accent', 'Accent'], ['muted', 'Muted']].forEach(([k, label]) => color(c, label, ct(k), setCt(k), '#ffffff', false));
      fontSelect(c, 'Heading font', ct('display'), setCt('display'), { byName: true });
      fontSelect(c, 'Body font', ct('body'), setCt('body'), { byName: true });
    }

    const s = group('Screen');
    const name = h('input', { type: 'text' });
    name.oninput = () => store.setScreenProps({ name: name.value || 'Screen' }, 'screen-name');
    row(s, 'Name', name, (n) => { n.value = cur().name; });
    num(s, 'Seconds', () => cur().durationSec, (v) => store.setScreenProps({ durationSec: Math.max(1, v) }, 'screen-dur'), { min: 1 });
    const opts = [['', 'Same as deck'], ...THEMES.map((t) => [t.id, t.name])];
    if (deck().customTheme) opts.push(['custom', 'Custom']);
    select(s, 'Theme', opts, () => cur().theme || '', (v) => store.setScreenProps({ theme: v }));
    s.append(h('p', { className: 'hint', textContent: 'Tap an element on the canvas to edit it, or add one from the Add tab.' }));

    const an = group('Transitions and motion');
    select(an, 'Screen transition', TRANSITIONS, () => (deck().transition && deck().transition.type) || 'fade', (v) => store.updateDeck((d) => { d.transition = { ...d.transition, type: v }; }));
    num(an, 'Duration (ms)', () => (deck().transition && deck().transition.durationMs) ?? 600, (v) => store.updateDeck((d) => { d.transition = { ...d.transition, durationMs: Math.round(v) }; }, 'trans-ms'), { min: 100, max: 3000, step: 50 });
    select(an, 'This screen', [['', 'Same as deck'], ...TRANSITIONS], () => (cur().transition && cur().transition.type) || '', (v) => store.setScreenProps({ transition: v ? { type: v } : null }));
    num(an, 'Stagger (ms)', () => cur().stagger || 0, (v) => store.setScreenProps({ stagger: Math.max(0, Math.round(v)) }, 'stagger'), { min: 0, max: 2000, step: 50 });
    select(an, 'Playback', [['manual', 'Manual (keys or taps)'], ['loop', 'Loop on a timer'], ['timed', 'Play once on a timer']], () => deck().mode || 'manual', (v) => store.updateDeck((d) => { d.mode = v; }));
    num(an, 'Default seconds', () => deck().defaultDurationSec || 10, (v) => store.updateDeck((d) => { d.defaultDurationSec = Math.max(1, Math.round(v)); }, 'def-sec'), { min: 1, max: 3600 });
    select(an, 'Reduce motion', [['system', 'Follow device'], ['on', 'Always'], ['off', 'Never']], getMotionSetting, (v) => { setMotionSetting(v); if (hooks.motion) hooks.motion(); });
    button(an, '\u25B6 Preview screen', () => hooks.preview && hooks.preview());
    an.append(h('p', { className: 'hint', textContent: 'Stagger adds a delay to each element\u2019s entrance, in stacking order.' }));

    buildBackground();
  }

  function buildBackground() {
    const g = group('Background');
    const bg = () => cur().background;
    const setBg = (patch, key) => store.setScreenProps({ background: { ...bg(), ...patch } }, key);
    const grad = () => bg().gradient || { kind: 'linear', angle: 135, c1: 'var(--bg)', c2: 'var(--accent)' };
    const setGrad = (p, key) => { const gr = { ...grad(), ...p }; setBg({ gradient: gr, value: gradientCss(gr) }, key); };
    const ov = () => bg().overlay || { color: '#000000', opacity: 0 };

    const typeSel = select(g, 'Type', [['theme', 'Theme'], ['solid', 'Solid color'], ['gradient', 'Gradient'], ['image', 'Image'], ['animated', 'Animated']], () => bgMode(bg()), async (v) => {
      if (v === 'theme') setBg({ type: 'color', value: '' });
      else if (v === 'solid') setBg({ type: 'color', value: bg().type === 'color' && bg().value ? bg().value : 'var(--bg)' });
      else if (v === 'gradient') setBg({ type: 'gradient', gradient: grad(), value: gradientCss(grad()) });
      else if (v === 'animated') setBg({ type: 'animated', value: '', kind: bg().kind || 'aurora' });
      else {
        const img = await pickImage();
        if (img) setBg({ type: 'image', value: img.src, fit: 'cover', blur: 0 });
        else typeSel.value = bgMode(bg());
      }
    });

    const mode = bgMode(bg());
    if (mode === 'solid') color(g, 'Color', () => bg().value, (v) => setBg({ type: 'color', value: v }, 'bg-color'), '#0b1020');
    if (mode === 'gradient') {
      select(g, 'Style', [['linear', 'Linear'], ['radial', 'Radial']], () => grad().kind, (v) => setGrad({ kind: v }));
      num(g, 'Angle', () => grad().angle, (v) => setGrad({ angle: Math.round(v) }, 'bg-angle'), { min: 0, max: 360 });
      color(g, 'Color 1', () => grad().c1, (v) => setGrad({ c1: v }, 'bg-c1'), '#0b1020');
      color(g, 'Color 2', () => grad().c2, (v) => setGrad({ c2: v }, 'bg-c2'), '#1e3a8a');
    }
    if (mode === 'animated') {
      select(g, 'Style', BACKGROUND_KINDS, () => bg().kind || 'aurora', (v) => setBg({ kind: v }));
      color(g, 'Base color', () => bg().base, (v) => setBg({ base: v }, 'bg-base'), '#0b1020');
      color(g, 'Color 1', () => bg().accent, (v) => setBg({ accent: v }, 'bg-a1'), '#facc15');
      color(g, 'Color 2', () => bg().accent2, (v) => setBg({ accent2: v }, 'bg-a2'), '#94a3b8');
      select(g, 'Speed', [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']], () => bg().speed || 'normal', (v) => setBg({ speed: v }));
      g.append(h('p', { className: 'hint', textContent: 'Motion plays in Show mode and in Preview.' }));
    }
    if (mode === 'image') {
      button(g, 'Replace image', async () => { const img = await pickImage(); if (img) setBg({ value: img.src }); });
      select(g, 'Fit', [['cover', 'Fill (crop)'], ['contain', 'Fit (no crop)']], () => bg().fit || 'cover', (v) => setBg({ fit: v }));
      num(g, 'Blur', () => bg().blur || 0, (v) => setBg({ blur: Math.max(0, v) }, 'bg-blur'), { min: 0, max: 60 });
    }
    color(g, 'Tint', () => ov().color, (v) => setBg({ overlay: { ...ov(), color: v } }, 'bg-tint'), '#000000');
    num(g, 'Tint strength', () => ov().opacity, (v) => setBg({ overlay: { ...ov(), opacity: Math.min(1, Math.max(0, v)) } }, 'bg-tint-a'), { min: 0, max: 1, step: 0.05 });
    button(g, 'Apply to all screens', () => store.updateDeck((d) => {
      const copy = JSON.stringify(cur().background);
      d.screens.forEach((s) => { s.background = JSON.parse(copy); });
    }));
  }

  // ---------- selected element ----------
  function buildElement(el) {
    const id = el.id;
    const g = () => store.getSelected() || el;
    const upd = (patch, key) => store.updateElement(id, patch, key && `${key}:${id}`);
    const sty = (k) => (v) => upd({ style: { [k]: v } }, k);
    const eff = (k) => ({ ...EFFECT_DEFAULTS[k], ...(g().style[k] || {}) });
    const setEff = (k, p) => upd({ style: { [k]: { ...eff(k), ...p } } }, k + Object.keys(p)[0]);

    const c = () => g().content;
    const setC = (k, key) => (v) => upd({ content: { [k]: v } }, key || k);
    const lines = (v) => v.split('\n');

    const alignSeg = (t) => {
      const al = h('div', { className: 'seg' });
      [['left', 'Left'], ['center', 'Center'], ['right', 'Right']].forEach(([v, label]) => {
        const b = h('button', { type: 'button', textContent: label });
        b.onclick = () => upd({ style: { align: v } }, 'align');
        al.append(b);
        controls.push(() => b.setAttribute('aria-pressed', String((g().style.align || 'left') === v)));
      });
      t.append(h('div', { className: 'field' }, h('span', { textContent: 'Align' }), al));
    };
    // o.full adds line height, letter spacing, case and italic; o.noVertical hides vertical alignment.
    const fontControls = (t, o = {}) => {
      fontSelect(t, 'Font', () => g().style.fontFamily || 'var(--font-display)', sty('fontFamily'), { theme: true });
      num(t, 'Size', () => g().style.fontSize || o.size || 64, sty('fontSize'), { min: 8, max: 600 });
      select(t, 'Weight', WEIGHTS, () => g().style.fontWeight || o.weight || 400, (v) => upd({ style: { fontWeight: +v } }, 'weight'));
      color(t, 'Color', () => g().style.color, sty('color'), '#ffffff');
      alignSeg(t);
      if (!o.noVertical) select(t, 'Vertical', [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']], () => g().style.valign || 'top', sty('valign'));
      if (o.full) {
        num(t, 'Line height', () => g().style.lineHeight || 1.15, sty('lineHeight'), { min: 0.5, max: 3, step: 0.05 });
        num(t, 'Letter space', () => g().style.letterSpacing || 0, sty('letterSpacing'), { min: -20, max: 100 });
        select(t, 'Case', [['', 'Normal'], ['uppercase', 'UPPER'], ['lowercase', 'lower'], ['capitalize', 'Title']], () => g().style.textTransform || '', sty('textTransform'));
        check(t, 'Italic', () => g().style.italic, sty('italic'));
      }
    };
    const effectControls = () => {
      const e = group('Text effects', { details: true });
      num(e, 'Shadow', () => eff('shadow').blur, (v) => setEff('shadow', { blur: Math.max(0, v) }), { min: 0, max: 100 });
      color(e, 'Shadow color', () => eff('shadow').color, (v) => setEff('shadow', { color: v }), '#000000');
      num(e, 'Glow', () => eff('glow').blur, (v) => setEff('glow', { blur: Math.max(0, v) }), { min: 0, max: 100 });
      color(e, 'Glow color', () => eff('glow').color, (v) => setEff('glow', { color: v }), '#facc15');
      num(e, 'Outline', () => eff('stroke').width, (v) => setEff('stroke', { width: Math.max(0, v) }), { min: 0, max: 40 });
      color(e, 'Outline color', () => eff('stroke').color, (v) => setEff('stroke', { color: v }), '#000000');
      const gr = () => g().style.gradient || { c1: 'var(--fg)', c2: 'var(--accent)', angle: 90 };
      check(e, 'Gradient fill', () => g().style.gradient, (on) => upd({ style: { gradient: on ? gr() : null } }));
      color(e, 'Gradient 1', () => gr().c1, (v) => upd({ style: { gradient: { ...gr(), c1: v } } }, 'gc1'), '#ffffff');
      color(e, 'Gradient 2', () => gr().c2, (v) => upd({ style: { gradient: { ...gr(), c2: v } } }, 'gc2'), '#facc15');
      num(e, 'Gradient angle', () => gr().angle, (v) => upd({ style: { gradient: { ...gr(), angle: Math.round(v) } } }, 'ga'), { min: 0, max: 360 });
      if (g().type === 'text') {
        check(e, 'Highlight', () => g().style.highlight, (on) => upd({ style: { highlight: on ? { color: 'var(--accent)' } : null } }));
        color(e, 'Highlight color', () => (g().style.highlight || {}).color, (v) => upd({ style: { highlight: { color: v } } }, 'hl'), '#facc15');
      }
    };
    // Banner and ticker bars: placement, look, and text style.
    const barControls = (t) => {
      const [W, H] = ASPECTS[deck().aspect] || ASPECTS['16:9'];
      const place = h('div', { className: 'btn-row' });
      const put = (patch, radius) => store.updateElement(id, { ...patch, style: { radius } });
      button(place, 'Top', () => put({ x: 0, y: 0, w: W }, 0));
      button(place, 'Bottom', () => put({ x: 0, y: H - g().h, w: W }, 0));
      button(place, 'Floating', () => put({ x: 60, y: H - g().h - 60, w: W - 120 }, Math.round(g().h / 2)));
      t.append(h('div', { className: 'field col' }, h('span', { textContent: 'Placement' }), place));
      select(t, 'Look', [['solid', 'Solid'], ['gradient', 'Gradient'], ['glass', 'Glass'], ['alert', 'Alert']], () => g().style.variant || 'solid', sty('variant'));
      const v = g().style.variant || 'solid';
      if (v === 'alert') select(t, 'Alert style', [['pulse', 'Pulse'], ['flash', 'Flash'], ['none', 'Steady']], () => g().style.alert || 'pulse', sty('alert'));
      if (v === 'solid' || v === 'gradient' || v === 'alert') color(t, 'Background', () => g().style.bg, sty('bg'), v === 'alert' ? '#dc2626' : '#facc15');
      if (v === 'gradient') color(t, 'Gradient end', () => g().style.bg2, sty('bg2'), '#94a3b8');
      num(t, 'Corner radius', () => g().style.radius || 0, sty('radius'), { min: 0, max: 400 });
      fontControls(t, { noVertical: true, size: 56, weight: 700 });
    };

    if (el.type === 'text') {
      const t = group('Text');
      textArea = h('textarea', { rows: 3 });
      textArea.oninput = () => upd({ content: { text: textArea.value } }, 'text');
      row(t, 'Text', textArea, (n) => { n.value = g().content.text || ''; });
      fontControls(t, { full: true });
      effectControls();
    } else if (el.type === 'clock') {
      const t = group('Clock');
      select(t, 'Type', [['digital', 'Digital time'], ['analog', 'Analog'], ['date', 'Date']], () => c().kind || 'digital', setC('kind'));
      select(t, 'Time zone', TIME_ZONES, () => c().timeZone || '', setC('timeZone'));
      const kind = c().kind || 'digital';
      if (kind === 'digital') {
        check(t, '24-hour', () => c().hour12 === false, (on) => upd({ content: { hour12: !on } }));
        check(t, 'Seconds', () => c().seconds, setC('seconds'));
        check(t, 'Show AM/PM', () => c().showAmPm !== false, setC('showAmPm'));
      } else if (kind === 'date') {
        select(t, 'Format', [['full', 'Monday, October 12, 2026'], ['long', 'October 12, 2026'], ['short', 'Oct 12'], ['weekday', 'Monday']], () => c().dateFormat || 'full', setC('dateFormat'));
      } else {
        select(t, 'Face', [['classic', 'Classic'], ['modern', 'Modern'], ['minimal', 'Minimal']], () => c().face || 'classic', setC('face'));
        check(t, 'Second hand', () => c().secondHand !== false, setC('secondHand'));
        color(t, 'Color', () => g().style.color, sty('color'), '#ffffff');
      }
      if (kind !== 'analog') { fontControls(group('Text'), { size: 160, weight: 700 }); effectControls(); }
    } else if (el.type === 'timer') {
      const t = group('Timer');
      const mode = c().mode || 'until';
      select(t, 'Type', [['until', 'Count down to a time'], ['duration', 'Count down from a length'], ['stopwatch', 'Stopwatch (count up)']], () => c().mode || 'until', setC('mode'));
      if (mode === 'until') {
        const when = h('input', { type: 'datetime-local' });
        when.oninput = () => upd({ content: { target: when.value } }, 'target');
        row(t, 'Date and time', when, (n) => { n.value = c().target || ''; });
        select(t, 'Repeat', [['none', 'Once'], ['daily', 'Every day'], ['weekly', 'Every week']], () => c().repeat || 'none', setC('repeat'));
        num(t, 'Show zero for (sec)', () => c().holdSec ?? 30, setC('holdSec', 'hold'), { min: 0, max: 86400 });
      } else if (mode === 'duration') {
        const setDur = (m, sec) => upd({ content: { durationSec: Math.max(0, m * 60 + sec) } }, 'dur');
        num(t, 'Minutes', () => Math.floor((c().durationSec || 0) / 60), (v) => setDur(Math.max(0, Math.floor(v)), (c().durationSec || 0) % 60), { min: 0 });
        num(t, 'Seconds', () => (c().durationSec || 0) % 60, (v) => setDur(Math.floor((c().durationSec || 0) / 60), Math.min(59, Math.max(0, Math.floor(v)))), { min: 0, max: 59 });
      }
      select(t, 'Format', [['auto', 'Automatic'], ['hms', 'HH:MM:SS'], ['ms', 'MM:SS']], () => c().format || 'auto', setC('format'));
      if (mode !== 'stopwatch') {
        select(t, 'At zero', [['hold', 'Stay at zero'], ['message', 'Show a message'], ['hide', 'Hide timer'], ['flash', 'Flash'], ['next', 'Go to next screen']], () => c().onZero || 'hold', setC('onZero'));
        const msg = h('input', { type: 'text' });
        msg.oninput = () => upd({ content: { message: msg.value } }, 'message');
        row(t, 'Message', msg, (n) => { n.value = c().message || ''; });
        check(t, 'Beep at zero', () => c().beep, setC('beep'));
      }
      t.append(h('p', { className: 'hint', textContent: mode === 'until' ? 'Counts down on its own.' : 'In Show mode press T to start or pause, R to reset.' }));
      fontControls(group('Text'), { size: 200, weight: 800 });
      effectControls();
    } else if (el.type === 'banner') {
      const t = group('Banner');
      const text = h('input', { type: 'text' });
      text.oninput = () => upd({ content: { text: text.value } }, 'btext');
      row(t, 'Text', text, (n) => { n.value = c().text || ''; });
      const icon = h('input', { type: 'text', maxLength: 4 });
      icon.oninput = () => upd({ content: { icon: icon.value } }, 'icon');
      row(t, 'Icon / emoji', icon, (n) => { n.value = c().icon || ''; });
      barControls(t);
    } else if (el.type === 'ticker') {
      const t = group('Ticker');
      const msgs = h('textarea', { rows: 4 });
      msgs.oninput = () => upd({ content: { messages: lines(msgs.value) } }, 'msgs');
      row(t, 'Messages (one per line)', msgs, (n) => { n.value = (c().messages || []).join('\n'); });
      num(t, 'Speed (px/sec)', () => c().speed || 140, setC('speed'), { min: 10, max: 1000 });
      select(t, 'Direction', [['left', 'Right to left'], ['right', 'Left to right']], () => c().direction || 'left', setC('direction'));
      const sep = h('input', { type: 'text', maxLength: 3 });
      sep.oninput = () => upd({ content: { separator: sep.value } }, 'sep');
      row(t, 'Separator', sep, (n) => { n.value = c().separator ?? '•'; });
      barControls(t);
    } else if (el.type === 'qr') {
      const t = group('QR code');
      const txt = h('textarea', { rows: 3 });
      txt.oninput = () => upd({ content: { text: txt.value } }, 'qrtext');
      row(t, 'Link or text', txt, (n) => { n.value = c().text || ''; });
      select(t, 'Error correction', [['L', 'Low (7%)'], ['M', 'Medium (15%)'], ['Q', 'Quartile (25%)'], ['H', 'High (30%)']], () => c().ecl || 'M', setC('ecl'));
      color(t, 'Code color', () => g().style.fg, sty('fg'), '#000000', false);
      color(t, 'Background', () => g().style.bg, sty('bg'), '#ffffff', false);
      check(t, 'White border', () => g().style.margin !== false, sty('margin'));
      num(t, 'Corner radius', () => g().style.radius || 0, sty('radius'), { min: 0, max: 400 });
      t.append(h('p', { className: 'hint', textContent: 'Keep strong contrast (dark code on a light background) so phones can scan it.' }));
    } else if (el.type === 'shape') {
      const t = group('Shape');
      const pr = h('div', { className: 'btn-row preset-row' });
      Object.entries(PRESETS).forEach(([name, style]) => button(pr, name, () => upd({ style: { ...style } })));
      t.append(h('div', { className: 'field col' }, h('span', { textContent: 'Style preset' }), pr));
      color(t, 'Fill', () => g().style.fill, sty('fill'), '#facc15');
      select(t, 'Shape', [['rect', 'Rectangle'], ['circle', 'Circle']], () => g().style.shape || 'rect', sty('shape'));
      num(t, 'Corner radius', () => g().style.radius || 0, sty('radius'), { min: 0, max: 1000 });
      num(t, 'Opacity', () => g().style.opacity ?? 1, sty('opacity'), { min: 0, max: 1, step: 0.05 });
      num(t, 'Border', () => g().style.borderWidth || 0, sty('borderWidth'), { min: 0, max: 100 });
      color(t, 'Border color', () => g().style.borderColor, sty('borderColor'), '#facc15');
      num(t, 'Shadow', () => g().style.shadow || 0, sty('shadow'), { min: 0, max: 200 });
      num(t, 'Blur behind', () => g().style.blur || 0, sty('blur'), { min: 0, max: 80 });
    } else if (el.type === 'image') {
      const t = group('Image');
      button(t, 'Replace image', async () => {
        const img = await pickImage();
        if (img) store.updateElement(id, { content: { src: img.src } });
      });
      select(t, 'Fit', [['cover', 'Fill (crop)'], ['contain', 'Fit (no crop)']], () => g().style.fit || 'cover', sty('fit'));
      num(t, 'Corner radius', () => g().style.radius || 0, sty('radius'), { min: 0, max: 1000 });
      num(t, 'Border', () => g().style.borderWidth || 0, sty('borderWidth'), { min: 0, max: 100 });
      color(t, 'Border color', () => g().style.borderColor, sty('borderColor'), '#ffffff');
      num(t, 'Shadow', () => g().style.shadow || 0, sty('shadow'), { min: 0, max: 200 });
      const alt = h('input', { type: 'text' });
      alt.oninput = () => upd({ content: { alt: alt.value } }, 'alt');
      row(t, 'Alt text', alt, (n) => { n.value = g().content.alt || ''; });
    }

    else if (el.type === 'scoreboard') {
      const t = group('Scoreboard');
      const teams = h('textarea', { rows: 4 });
      teams.oninput = () => upd({ content: { teams: lines(teams.value) } }, 'teams');
      row(t, 'Teams (one per line, max 6)', teams, (n) => { n.value = (c().teams || []).join('\n'); });
      num(t, 'Score size', () => g().style.fontSize || 220, sty('fontSize'), { min: 40, max: 600 });
      color(t, 'Number color', () => g().style.color, sty('color'), '#ffffff');
      color(t, 'Name color', () => g().style.nameColor, sty('nameColor'), '#94a3b8');
      color(t, 'Card color', () => g().style.cardFill, sty('cardFill'), '#ffffff');
      num(t, 'Corner radius', () => g().style.radius ?? 28, sty('radius'), { min: 0, max: 200 });
      t.append(h('p', { className: 'hint', textContent: 'In Show mode: keys 1–6 add a point, Shift+1–6 subtract, R resets. Tap the +/− buttons on a touch screen.' }));
    }

    const an = group('Animation');
    const A = () => g().animation || {};
    const setA = (k) => (v) => upd({ animation: { [k]: v } }, `an-${k}`);
    select(an, 'Entrance', el.type === 'text' ? ENTRANCES : ENTRANCES.filter(([v]) => v !== 'typewriter'), () => A().in || 'none', setA('in'));
    select(an, 'Loop', LOOPS, () => A().loop || 'none', setA('loop'));
    select(an, 'Exit', EXITS, () => A().out || 'none', setA('out'));
    num(an, 'Duration (ms)', () => A().durationMs ?? 600, (v) => setA('durationMs')(Math.round(v)), { min: 50, max: 10000, step: 50 });
    num(an, 'Delay (ms)', () => A().delayMs || 0, (v) => setA('delayMs')(Math.max(0, Math.round(v))), { min: 0, max: 20000, step: 50 });
    select(an, 'Easing', EASINGS, () => A().easing || 'smooth', setA('easing'));
    button(an, '\u25B6 Preview animation', () => hooks.preview && hooks.preview());

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
    const { selectedId } = st();
    const list = [...s.elements].sort((a, b) => b.z - a.z);
    const screenBtn = h('button', { type: 'button', className: 'btn small wide', textContent: 'Screen & theme settings', onclick: () => store.select(null) });
    const items = list.length ? list.map((el) => {
      const label = el.type === 'text' ? (el.content.text || 'Text').split('\n')[0].slice(0, 28)
        : el.type === 'shape' ? (el.style.shape === 'circle' ? 'Circle' : 'Rectangle')
          : el.type === 'banner' ? (el.content.text || 'Banner').slice(0, 28) : LAYER_NAMES[el.type] || 'Image';
      const item = h('div', { className: 'layer' + (el.id === selectedId ? ' on' : '') + (el.hidden ? ' dim' : '') });
      const name = h('button', { type: 'button', className: 'layer-name', textContent: `${el.locked ? '\u{1F512} ' : ''}${label}` });
      name.onclick = () => store.select(el.id);
      const eye = h('button', { type: 'button', className: 'layer-eye', textContent: el.hidden ? 'Show' : 'Hide' });
      eye.onclick = () => store.updateElement(el.id, { hidden: !el.hidden });
      item.append(name, eye);
      return item;
    }) : [h('p', { className: 'hint', textContent: 'No elements yet.' })];
    layersRoot.replaceChildren(screenBtn, ...items);
  }

  return {
    // Rebuild the form only when the selection, structure, theme or background type changes; otherwise sync values in place.
    refresh() {
      const el = store.getSelected();
      const s = st();
      const sub = el && el.content ? `${el.content.mode || ''}${el.content.kind || ''}${(el.style && el.style.variant) || ''}` : '';
      const key = `${s.screenIndex}|${s.selectedId}|${el ? el.type : ''}|${sub}|${s.structRev}|${s.deck.theme}|${el ? '' : bgMode(cur().background)}`;
      if (key !== lastKey) {
        lastKey = key;
        root.replaceChildren();
        controls = [];
        textArea = null;
        if (el) buildElement(el); else buildDeck();
      }
      controls.forEach((fn) => fn());
      drawLayers();
    },
    focusText() { if (textArea) { textArea.focus(); textArea.select(); } },
  };
}
