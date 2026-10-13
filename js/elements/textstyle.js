// Shared text styling for text-like elements (text, clock, timer, banner, ticker).
const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

// Font, size, color and layout on the element box.
export function applyFont(node, s, { size = 64, color = 'var(--fg)', weight = 400 } = {}) {
  node.style.fontSize = (s.fontSize || size) + 'px';
  node.style.fontWeight = s.fontWeight || weight;
  node.style.color = s.color || color;
  node.style.textAlign = s.align || 'left';
  node.style.lineHeight = s.lineHeight || 1.15;
  node.style.justifyContent = JUSTIFY[s.valign] || 'flex-start';
  if (s.fontFamily) node.style.fontFamily = s.fontFamily;
  if (s.italic) node.style.fontStyle = 'italic';
  if (s.letterSpacing) node.style.letterSpacing = s.letterSpacing + 'px';
  if (s.textTransform) node.style.textTransform = s.textTransform;
}

// Shadow, glow, outline and gradient fill on the inner text block, so effects follow the text.
export function applyEffects(inner, s) {
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
}

// Builds the inner text block used by live text elements; returns it so callers can update textContent.
export function textBlock(node, s) {
  const inner = document.createElement('div');
  inner.className = 'txt';
  // Sized to its content and aligned inside the box, so fitToWidth can scale it from the right anchor.
  inner.style.alignSelf = { center: 'center', right: 'flex-end' }[s.align] || 'flex-start';
  applyEffects(inner, s);
  node.append(inner);
  return inner;
}

// Shrinks single-line live text (clock, timer) to fit the box width instead of wrapping or overflowing.
export function fitToWidth(node, inner, s = {}) {
  const cw = node.clientWidth;
  if (!cw) return;
  const k = Math.min(1, cw / (inner.offsetWidth || cw));
  inner.style.transform = k < 1 ? `scale(${k})` : '';
  inner.style.transformOrigin = `${s.align || 'left'} ${{ top: 'top', bottom: 'bottom' }[s.valign] || 'center'}`;
}
