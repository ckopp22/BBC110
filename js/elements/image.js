export function render(el, node) {
  const s = el.style || {};
  const img = document.createElement('img');
  img.src = (el.content && el.content.src) || '';
  img.alt = (el.content && el.content.alt) || '';
  img.draggable = false;
  img.style.objectFit = s.fit || 'cover';
  node.style.borderRadius = (s.radius || 0) + 'px';
  if (s.borderWidth > 0) node.style.border = `${s.borderWidth}px solid ${s.borderColor || 'var(--accent)'}`;
  if (s.shadow > 0) node.style.boxShadow = `0 ${Math.round(s.shadow / 2)}px ${s.shadow}px rgba(0,0,0,.45)`;
  node.append(img);
}
