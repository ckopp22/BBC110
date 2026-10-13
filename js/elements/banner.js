import { styleBar } from './bar.js';

export function render(el, node) {
  const c = el.content || {}, s = el.style || {};
  styleBar(node, s);
  node.style.whiteSpace = 'normal';
  if (c.icon) {
    const icon = document.createElement('span');
    icon.textContent = c.icon;
    icon.style.marginRight = '0.5em';
    node.append(icon);
  }
  const text = document.createElement('span');
  text.textContent = c.text || '';
  node.append(text);
}
