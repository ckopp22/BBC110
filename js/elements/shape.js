export function render(el, node) {
  const s = el.style || {};
  node.style.background = s.fill || 'var(--accent)';
  node.style.borderRadius = s.shape === 'circle' ? '50%' : (s.radius || 0) + 'px';
  if (s.borderWidth > 0) node.style.border = `${s.borderWidth}px solid ${s.borderColor || 'var(--accent)'}`;
  if (s.shadow > 0) node.style.boxShadow = `0 ${Math.round(s.shadow / 2)}px ${s.shadow}px rgba(0,0,0,.45)`;
  if (s.blur > 0) node.style.backdropFilter = node.style.webkitBackdropFilter = `blur(${s.blur}px)`;
  if (s.opacity != null) node.style.opacity = s.opacity;
}
