export function render(el, node) {
  const s = el.style || {};
  node.style.background = s.fill || 'var(--accent)';
  node.style.borderRadius = s.shape === 'circle' ? '50%' : (s.radius || 0) + 'px';
  if (s.border) node.style.border = s.border;
  if (s.opacity != null) node.style.opacity = s.opacity;
}
