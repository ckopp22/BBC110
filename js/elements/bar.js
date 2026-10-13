// Shared look for banner and ticker bars: solid, gradient, glass, or alert (pulsing/flashing).
import { applyFont } from './textstyle.js';

export function styleBar(node, s) {
  const variant = s.variant || 'solid';
  const justify = { left: 'flex-start', center: 'center', right: 'flex-end' };
  node.style.display = 'flex';
  node.style.alignItems = 'center';
  node.style.padding = '0 40px';
  node.style.borderRadius = (s.radius || 0) + 'px';
  node.style.overflow = 'hidden';
  let color = 'var(--bg)';
  if (variant === 'gradient') {
    node.style.background = `linear-gradient(90deg, ${s.bg || 'var(--accent)'}, ${s.bg2 || 'var(--muted)'})`;
  } else if (variant === 'glass') {
    node.style.background = 'rgba(255,255,255,.16)';
    node.style.backdropFilter = node.style.webkitBackdropFilter = 'blur(20px)';
    node.style.border = '2px solid rgba(255,255,255,.35)';
    color = 'var(--fg)';
  } else if (variant === 'alert') {
    node.style.background = s.bg || '#dc2626';
    color = '#ffffff';
    const a = s.alert || 'pulse';
    if (a !== 'none') node.classList.add(`anim-${a}`);
  } else {
    node.style.background = s.bg || 'var(--accent)';
  }
  applyFont(node, { ...s, align: undefined, valign: undefined }, { size: 56, weight: 700, color });
  node.style.justifyContent = justify[s.align] || 'flex-start'; // after applyFont, which also sets justification
  node.style.whiteSpace = 'nowrap';
}
