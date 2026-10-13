// Clock element: digital time, date, or analog face. Updated by the shared tick engine.
import { applyFont, textBlock, fitToWidth } from './textstyle.js';

const SVG = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

// Intl rejects unknown zones; fall back to the device zone rather than breaking the screen.
function formatter(opts, tz) {
  try { return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: tz || undefined }); }
  catch { return new Intl.DateTimeFormat(undefined, opts); }
}

const DATE_FORMATS = {
  full: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
  long: { month: 'long', day: 'numeric', year: 'numeric' },
  short: { month: 'short', day: 'numeric' },
  weekday: { weekday: 'long' },
};

export function render(el, node) {
  const c = el.content || {}, s = el.style || {};
  const kind = c.kind || 'digital';
  if (kind === 'analog') return analog(node, c, s);

  applyFont(node, s, { size: 160, weight: 700 });
  node.style.fontVariantNumeric = 'tabular-nums';
  const inner = textBlock(node, s);

  let fmt;
  if (kind === 'date') {
    const f = formatter(DATE_FORMATS[c.dateFormat] || DATE_FORMATS.full, c.timeZone);
    fmt = (now) => f.format(now);
  } else {
    const f = formatter({ hour: 'numeric', minute: '2-digit', second: c.seconds ? '2-digit' : undefined, hourCycle: c.hour12 === false ? 'h23' : 'h12' }, c.timeZone);
    fmt = (now) => f.formatToParts(now).filter((p) => !(p.type === 'dayPeriod' && c.showAmPm === false)).map((p) => p.value).join('').trim();
  }
  return { update(now) { const t = fmt(now); if (inner.textContent !== t) inner.textContent = t; fitToWidth(node, inner, s); } };
}

function analog(node, c, s) {
  node.style.color = s.color || 'var(--fg)';
  node.style.display = 'flex';
  const face = c.face || 'classic';
  const root = svg('svg', { viewBox: '-100 -100 200 200', width: '100%', height: '100%' });
  root.append(svg('circle', { r: 96, fill: 'none', stroke: 'currentColor', 'stroke-width': face === 'modern' ? 5 : 3 }));
  for (let i = 0; i < 60; i++) {
    const hour = i % 5 === 0;
    if (face === 'minimal' && i % 15 !== 0) continue;
    if (face === 'modern' && !hour) continue;
    const a = (i * 6 * Math.PI) / 180, r1 = hour ? 80 : 88, r2 = 92;
    root.append(svg('line', {
      x1: Math.sin(a) * r1, y1: -Math.cos(a) * r1, x2: Math.sin(a) * r2, y2: -Math.cos(a) * r2,
      stroke: 'currentColor', 'stroke-width': face === 'modern' ? 5 : hour ? 3.5 : 1.5, 'stroke-linecap': 'round',
    }));
  }
  if (face === 'classic') {
    for (let n = 1; n <= 12; n++) {
      const a = (n * 30 * Math.PI) / 180;
      const t = svg('text', { x: Math.sin(a) * 66, y: -Math.cos(a) * 66, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: 'currentColor', 'font-size': 18, 'font-weight': 600 });
      t.textContent = n;
      root.append(t);
    }
  }
  const hand = (len, w, color) => {
    const g = svg('g');
    g.append(svg('line', { x1: 0, y1: len * 0.12, x2: 0, y2: -len, stroke: color, 'stroke-width': w, 'stroke-linecap': 'round' }));
    root.append(g);
    return g;
  };
  const hh = hand(50, 6, 'currentColor'), mh = hand(76, 4, 'currentColor');
  const sh = c.secondHand === false ? null : hand(84, 2, 'var(--accent)');
  root.append(svg('circle', { r: 5, fill: sh ? 'var(--accent)' : 'currentColor' }));
  node.append(root);

  const f = formatter({ hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }, c.timeZone);
  return {
    update(now) {
      const p = {};
      f.formatToParts(now).forEach((x) => { p[x.type] = parseInt(x.value, 10); });
      const sec = p.second || 0, min = p.minute || 0, hr = (p.hour || 0) % 12;
      hh.setAttribute('transform', `rotate(${hr * 30 + min * 0.5})`);
      mh.setAttribute('transform', `rotate(${min * 6 + sec * 0.1})`);
      if (sh) sh.setAttribute('transform', `rotate(${sec * 6})`);
    },
  };
}
