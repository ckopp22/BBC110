export function render(el, node) {
  const s = el.style || {};
  const img = document.createElement('img');
  img.src = (el.content && el.content.src) || '';
  img.alt = (el.content && el.content.alt) || '';
  img.draggable = false;
  img.style.objectFit = s.fit || 'cover';
  node.style.borderRadius = (s.radius || 0) + 'px';
  node.append(img);
}
