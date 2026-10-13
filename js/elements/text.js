const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

export function render(el, node) {
  const s = el.style || {};
  const text = (el.content && el.content.text) || '';
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

  // Effects live on an inner block so they follow the text rather than the whole box.
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

  const shadows = [];
  if (s.shadow && s.shadow.blur > 0) shadows.push(`0 ${Math.round(s.shadow.blur / 3)}px ${s.shadow.blur}px ${s.shadow.color || 'rgba(0,0,0,.6)'}`);
  if (s.glow && s.glow.blur > 0) {
    const c = s.glow.color || 'var(--accent)';
    shadows.push(`0 0 ${s.glow.blur}px ${c}`, `0 0 ${s.glow.blur * 2}px ${c}`);
  }
  if (s.gradient) {
    inner.style.background = `linear-gradient(${s.gradient.angle ?? 90}deg, ${s.gradient.c1}, ${s.gradient.c2})`;
    inner.style.webkitBackgroundClip = 'text';
    inner.style.backgroundClip = 'text';
    inner.style.webkitTextFillColor = 'transparent';
    // text-shadow would paint over clipped gradient text, so use drop-shadow instead.
    if (shadows.length) inner.style.filter = shadows.map((sh) => `drop-shadow(${sh})`).join(' ');
  } else if (shadows.length) {
    inner.style.textShadow = shadows.join(', ');
  }
  if (s.stroke && s.stroke.width > 0) {
    inner.style.webkitTextStroke = `${s.stroke.width}px ${s.stroke.color || 'var(--bg)'}`;
    inner.style.paintOrder = 'stroke fill';
  }
  node.append(inner);
}
