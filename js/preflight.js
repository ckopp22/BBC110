// Publish pre-flight checks: warns on empty screens, low contrast, missing images, and timers already
// in the past. Never blocks — Publish always works, this just surfaces things worth a second look.
import { resolveTheme, themeVars, resolveColor } from './themes.js';

function hexToRgb(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(s);
  if (m) return [+m[1], +m[2], +m[3]];
  return null;
}
function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(hex1, hex2) {
  const a = hexToRgb(hex1), b = hexToRgb(hex2);
  if (!a || !b) return null;
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
// Flattens overlay.color at overlay.opacity over a background color.
function blend(bg, overlay) {
  const b = hexToRgb(bg), o = overlay && overlay.opacity > 0 ? hexToRgb(overlay.color) : null;
  if (!b) return bg;
  if (!o) return bg;
  const a = overlay.opacity;
  return `rgb(${b.map((c, i) => Math.round(o[i] * a + c * (1 - a))).join(',')})`;
}

const LIVE_TEXT_TYPES = ['text', 'clock', 'timer'];

export function runPreflight(deck) {
  const issues = [];
  const add = (screenIndex, message) => issues.push({ screenIndex, message });

  deck.screens.forEach((s, i) => {
    if (!s.elements.some((e) => !e.hidden)) { add(i, `"${s.name}" has no elements on it.`); return; }

    if (s.background && s.background.type === 'image' && !s.background.value) add(i, `"${s.name}"'s background image wasn't uploaded.`);

    s.elements.filter((e) => !e.hidden).forEach((e) => {
      if (e.type === 'image' && !(e.content && e.content.src)) add(i, `"${s.name}" has an image that hasn't been uploaded.`);
      if (e.type === 'qr' && !(e.content && e.content.text && e.content.text.trim())) add(i, `"${s.name}" has a QR code with nothing to encode.`);
      if (e.type === 'timer' && (e.content.mode || 'until') === 'until' && (e.content.repeat || 'none') === 'none') {
        const t = new Date(e.content.target);
        if (!Number.isNaN(t.getTime()) && t.getTime() < Date.now()) add(i, `"${s.name}" has a one-time countdown whose time has already passed.`);
      }
    });

    // Contrast: only for solid/gradient/theme backgrounds with a resolvable color (skip image/animated).
    const bg = s.background;
    if (!bg || bg.type === 'color' || bg.type === 'gradient' || !bg.value) {
      const vars = themeVars(s.theme || deck.theme, deck);
      let bgColor = bg && bg.type === 'gradient' && bg.gradient ? resolveColor(bg.gradient.c1, vars) : resolveColor((bg && bg.value) || 'var(--bg)', vars);
      bgColor = blend(bgColor, bg && bg.overlay);
      s.elements.filter((e) => !e.hidden && LIVE_TEXT_TYPES.includes(e.type) && !(e.type === 'clock' && e.content.kind === 'analog')).forEach((e) => {
        const fg = resolveColor((e.style && e.style.color) || 'var(--fg)', vars);
        const ratio = contrastRatio(fg, bgColor);
        if (ratio != null && ratio < 3) add(i, `Text on "${s.name}" may be hard to read against its background (low contrast).`);
      });
    }
  });

  return issues.slice(0, 20);
}
