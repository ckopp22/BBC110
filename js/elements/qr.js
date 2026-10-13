// QR code element, generated locally as a single SVG path.
import { encodeQR } from './qrcode.js';

const SVG = 'http://www.w3.org/2000/svg';

export function render(el, node) {
  const c = el.content || {}, s = el.style || {};
  node.style.background = s.bg || '#ffffff';
  node.style.borderRadius = (s.radius || 0) + 'px';
  node.style.overflow = 'hidden';
  node.style.display = 'flex';
  const text = (c.text || '').trim();
  if (!text) return;

  let m;
  try { m = encodeQR(text, c.ecl || 'M'); } catch {
    node.style.color = '#b91c1c';
    node.style.alignItems = 'center';
    node.style.justifyContent = 'center';
    node.style.fontSize = '28px';
    node.textContent = 'Text is too long for a QR code';
    return;
  }
  const q = s.margin === false ? 0 : 4;
  const n = m.length;
  let d = '';
  m.forEach((row, y) => {
    for (let x = 0; x < n; x++) {
      if (!row[x]) continue;
      let len = 1;
      while (x + len < n && row[x + len]) len++;
      d += `M${x + q} ${y + q}h${len}v1h-${len}z`;
      x += len;
    }
  });
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${n + q * 2} ${n + q * 2}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.style.cssText = 'width:100%;height:100%;display:block';
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', s.fg || '#000000');
  svg.append(path);
  node.append(svg);
}
