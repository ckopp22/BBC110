import { applyFont, applyEffects } from './textstyle.js';

export function render(el, node) {
  const s = el.style || {};
  const text = (el.content && el.content.text) || '';
  applyFont(node, s);

  const inner = document.createElement('div');
  inner.className = 'txt';
  if (s.highlight) {
    const span = document.createElement('span');
    span.className = 'hl';
    span.textContent = text;
    span.style.background = s.highlight.color || 'var(--accent)';
    inner.append(span);
  } else {
    inner.textContent = text;
  }
  applyEffects(inner, s);
  node.append(inner);
}
