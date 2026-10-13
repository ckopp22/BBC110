// Scrolling message bar. Static in thumbnails; animated (CSS transform) when live.
import { styleBar } from './bar.js';

export function render(el, node, ctx = {}) {
  const c = el.content || {}, s = el.style || {};
  styleBar(node, { ...s, align: 'left' });
  node.style.padding = '0';

  const sep = ` ${c.separator || '•'} `;
  const segText = (c.messages || []).filter(Boolean).join(sep) + sep;
  const seg = () => { const n = document.createElement('span'); n.textContent = segText; n.style.padding = '0 0.4em'; return n; };

  const track = document.createElement('div');
  track.className = 'tk-track';
  track.style.cssText = 'display:flex;white-space:nowrap;will-change:transform;';
  node.append(track);

  if (!ctx.live) { track.append(seg()); return null; }

  let ro = null;
  function layout() {
    // Repeat the message until half the track is wider than the bar, then scroll exactly half for a seamless loop.
    const probe = seg();
    probe.style.cssText += ';position:absolute;visibility:hidden';
    node.append(probe);
    const w = probe.offsetWidth;
    probe.remove();
    if (!w) return;
    const reps = Math.max(1, Math.ceil(node.clientWidth / w));
    const half = reps * w;
    track.replaceChildren();
    for (let i = 0; i < reps * 2; i++) track.append(seg());
    const speed = Math.max(10, c.speed || 140);
    const dir = c.direction === 'right' ? 'reverse' : 'normal';
    track.style.animation = `bbc-marquee ${(half / speed).toFixed(2)}s linear infinite ${dir}`;
  }
  return {
    start() {
      ro = new ResizeObserver(layout);
      ro.observe(node);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    },
    stop() { if (ro) ro.disconnect(); },
  };
}
