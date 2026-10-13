const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

export function render(el, node) {
  const s = el.style || {};
  node.textContent = (el.content && el.content.text) || '';
  node.style.fontSize = (s.fontSize || 64) + 'px';
  node.style.fontWeight = s.fontWeight || 400;
  node.style.color = s.color || 'var(--fg)';
  node.style.textAlign = s.align || 'left';
  node.style.lineHeight = s.lineHeight || 1.15;
  node.style.justifyContent = JUSTIFY[s.valign] || 'flex-start';
  if (s.fontFamily) node.style.fontFamily = s.fontFamily;
  if (s.italic) node.style.fontStyle = 'italic';
  if (s.letterSpacing) node.style.letterSpacing = s.letterSpacing + 'px';
  if (s.textTransform) node.style.textTransform = s.textTransform;
}
