// Animated backgrounds built from DOM + compositor-only animations (transform/opacity).
// Layout is seeded by the screen id, so the editor, thumbnails and Show mode always look identical.
export const BACKGROUND_KINDS = [['aurora', 'Aurora glow'], ['shapes', 'Floating shapes'], ['particles', 'Particles'], ['waves', 'Waves']];
const SPEED = { slow: 1.7, normal: 1, fast: 0.6 }; // duration multipliers

function rng(seedText) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) { h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const div = (css) => { const n = document.createElement('div'); n.style.cssText = css; return n; };

// bg: { kind, base, accent, accent2, speed }. animate=false renders a still frame.
export function animatedBackground(bg, seed, animate, [W, H]) {
  const root = div('position:absolute;inset:0;overflow:hidden;');
  root.className = 'screen-bg';
  const base = bg.base || 'var(--bg)', c1 = bg.accent || 'var(--accent)', c2 = bg.accent2 || 'var(--muted)';
  const k = SPEED[bg.speed] || 1;
  const rand = rng(`${seed}|${bg.kind}`);
  root.style.background = base;
  const go = (node, frames, ms, delay = 0, extra = {}) => {
    if (animate) node.animate(frames, { duration: ms * k, delay: delay * k, iterations: Infinity, easing: 'ease-in-out', fill: 'both', ...extra });
  };

  if (bg.kind === 'aurora') {
    [[c1, 0.55, 5, 8, 22], [c2, 0.4, 50, 40, 28], [c1, 0.35, 12, 55, 34]].forEach(([color, op, x, y, ms], i) => {
      const blob = div(`position:absolute;left:${x}%;top:${y}%;width:75%;height:85%;border-radius:50%;opacity:${op};background:radial-gradient(circle at center,${color} 0%,transparent 68%);`);
      go(blob, [{ translate: '0 0', scale: '1' }, { translate: `${(i % 2 ? -1 : 1) * (18 + rand() * 14)}% ${(i ? -1 : 1) * (10 + rand() * 12)}%`, scale: `${1.15 + rand() * 0.25}` }], ms, 0, { direction: 'alternate' });
      root.append(blob);
    });
  } else if (bg.kind === 'shapes') {
    for (let i = 0; i < 12; i++) {
      const s = 90 + rand() * 230, x = rand() * (W - s), round = rand() > 0.4;
      const shape = div(`position:absolute;left:${x}px;top:0;width:${s}px;height:${s}px;border-radius:${round ? '50%' : '22%'};background:${i % 3 ? c1 : c2};opacity:${0.1 + rand() * 0.16};`);
      const ms = 26000 + rand() * 24000, sway = (rand() - 0.5) * 220;
      if (animate) go(shape, [{ translate: `0 ${H + 40}px`, rotate: '0deg' }, { translate: `${sway}px ${-s - 40}px`, rotate: `${(rand() - 0.5) * 120}deg` }], ms, -rand() * ms / k, { easing: 'linear' });
      else shape.style.top = `${rand() * (H - s)}px`;
      root.append(shape);
    }
  } else if (bg.kind === 'particles') {
    for (let i = 0; i < 46; i++) {
      const s = 3 + rand() * 7;
      const p = div(`position:absolute;left:${rand() * 100}%;top:${rand() * 100}%;width:${s}px;height:${s}px;border-radius:50%;background:${i % 4 ? c1 : c2};opacity:${0.25 + rand() * 0.5};`);
      const ms = 7000 + rand() * 9000;
      go(p, [{ translate: '0 0', opacity: 0.15 }, { translate: `${(rand() - 0.5) * 120}px ${-60 - rand() * 120}px`, opacity: 0.85 }], ms, -rand() * ms / k, { direction: 'alternate' });
      root.append(p);
    }
  } else {
    // Three wave layers. Each path spans 2 canvas widths with a period of W/2, so scrolling by -50% loops seamlessly.
    [[0.5, 44, 30000, c1, 0.2, 1], [0.58, 32, 21000, c2, 0.16, -1], [0.66, 24, 14000, c1, 0.13, 1]].forEach(([top, amp, ms, color, op, dir], i) => {
      const hh = Math.round(H * (1 - top) + amp), w2 = W * 2, period = W / 2, phase = i * 1.7;
      let d = `M0 ${hh}`;
      for (let x = 0; x <= w2; x += 24) d += `L${x} ${(amp + amp * Math.sin((x / period) * Math.PI * 2 + phase)).toFixed(1)}`;
      d += `L${w2} ${hh}Z`;
      const holder = div(`position:absolute;left:0;top:${top * 100}%;width:200%;height:${hh}px;opacity:${op};`);
      holder.innerHTML = `<svg viewBox="0 0 ${w2} ${hh}" width="100%" height="100%" preserveAspectRatio="none"><path d="${d}" fill="${color}"/></svg>`;
      go(holder, dir > 0 ? [{ translate: '0 0' }, { translate: '-50% 0' }] : [{ translate: '-50% 0' }, { translate: '0 0' }], ms, 0, { easing: 'linear' });
      root.append(holder);
    });
  }
  return root;
}
