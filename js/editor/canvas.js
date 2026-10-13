// Editor canvas interaction: selection box, drag-move, resize, rotate, snapping and alignment guides.
// The overlay sits above the shared stage and uses the same scale, so it never touches rendered output.
import * as store from '../store.js';

const MIN_SIZE = 20;
const GRID = 10;
const DRAG_THRESHOLD = 3; // screen px before a click becomes a drag
const HANDLES = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
const rad = (deg) => (deg * Math.PI) / 180;

// Rotates vector (x, y) by deg.
function rot(x, y, deg) {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return { x: x * c - y * s, y: x * s + y * c };
}

export function createCanvasEditor(host, stage) {
  const overlay = document.createElement('div');
  overlay.className = 'sel-layer';
  host.append(overlay);

  const api = { snap: true, onEdit: null };
  let drag = null;
  let guides = [];

  function layout() {
    const m = stage.metrics;
    overlay.style.width = m.W + 'px';
    overlay.style.height = m.H + 'px';
    overlay.style.transform = `translate(${m.ox}px, ${m.oy}px) scale(${m.s})`;
    overlay.style.setProperty('--inv', String(1 / m.s));
  }
  stage.onLayout = layout;
  layout();

  const toLogical = (e) => {
    const r = host.getBoundingClientRect(), m = stage.metrics;
    return { x: (e.clientX - r.left - m.ox) / m.s, y: (e.clientY - r.top - m.oy) / m.s };
  };

  function elements() {
    const s = store.getState().deck.screens[store.getState().screenIndex];
    return s ? s.elements : [];
  }

  function hitTest(p) {
    const list = elements().filter((e) => !e.hidden && !e.locked).sort((a, b) => b.z - a.z);
    for (const el of list) {
      const l = rot(p.x - (el.x + el.w / 2), p.y - (el.y + el.h / 2), -el.rotation);
      if (Math.abs(l.x) <= el.w / 2 && Math.abs(l.y) <= el.h / 2) return el;
    }
    return null;
  }

  // ---- drawing ----
  api.refresh = function refresh() {
    overlay.replaceChildren();
    const el = store.getSelected();
    if (el) {
      const box = document.createElement('div');
      box.className = 'sel-box' + (el.locked ? ' locked' : '') + (el.hidden ? ' hidden-el' : '');
      Object.assign(box.style, {
        left: el.x + 'px', top: el.y + 'px', width: el.w + 'px', height: el.h + 'px',
        transform: `rotate(${el.rotation}deg)`,
      });
      if (!el.locked) {
        for (const [hx, hy] of HANDLES) {
          const h = document.createElement('div');
          h.className = 'handle';
          h.dataset.hx = hx; h.dataset.hy = hy;
          h.style.left = (hx + 1) * 50 + '%';
          h.style.top = (hy + 1) * 50 + '%';
          box.append(h);
        }
        const r = document.createElement('div');
        r.className = 'handle rotate';
        r.dataset.rotate = '1';
        box.append(r);
      }
      overlay.append(box);
    }
    for (const g of guides) {
      const line = document.createElement('div');
      line.className = 'guide ' + g.axis;
      line.style[g.axis === 'v' ? 'left' : 'top'] = g.at + 'px';
      overlay.append(line);
    }
  };

  // ---- snapping (move) ----
  function snapMove(x, y, w, h, selfId) {
    const m = stage.metrics, thr = 8 / m.s;
    const xs = [0, m.W / 2, m.W], ys = [0, m.H / 2, m.H];
    for (const o of elements()) {
      if (o.id === selfId || o.hidden) continue;
      xs.push(o.x, o.x + o.w / 2, o.x + o.w);
      ys.push(o.y, o.y + o.h / 2, o.y + o.h);
    }
    const found = [];
    const fit = (pos, size, targets, axis) => {
      let best = null;
      for (const off of [0, size / 2, size]) {
        for (const t of targets) {
          const d = t - (pos + off);
          if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: t };
        }
      }
      if (best) { found.push({ axis, at: best.at }); return pos + best.d; }
      return Math.round(pos / GRID) * GRID;
    };
    const nx = fit(x, w, xs, 'v');
    const ny = fit(y, h, ys, 'h');
    return { x: nx, y: ny, guides: found };
  }

  // ---- pointer handling ----
  overlay.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const p = toLogical(e);
    const sel = store.getSelected();
    const t = e.target;
    if (sel && !sel.locked && t.classList && t.classList.contains('handle')) {
      overlay.setPointerCapture(e.pointerId);
      drag = { mode: t.dataset.rotate ? 'rotate' : 'resize', id: sel.id, hx: +t.dataset.hx, hy: +t.dataset.hy, start: p, orig: { ...sel }, started: true };
      e.preventDefault();
      return;
    }
    const hit = hitTest(p);
    store.select(hit ? hit.id : null);
    if (hit) {
      overlay.setPointerCapture(e.pointerId);
      drag = { mode: 'move', id: hit.id, start: p, sx: e.clientX, sy: e.clientY, orig: { ...hit }, started: false };
    }
    e.preventDefault();
  });

  overlay.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toLogical(e);
    const o = drag.orig, key = `drag:${drag.id}`;
    if (drag.mode === 'move') {
      if (!drag.started) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < DRAG_THRESHOLD) return;
        drag.started = true;
      }
      let x = o.x + (p.x - drag.start.x), y = o.y + (p.y - drag.start.y);
      guides = [];
      if (api.snap && !e.altKey) {
        const s = snapMove(x, y, o.w, o.h, o.id);
        x = s.x; y = s.y; guides = s.guides;
      }
      store.updateElement(drag.id, { x: Math.round(x), y: Math.round(y) }, key);
    } else if (drag.mode === 'rotate') {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      let a = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      a = ((a + 180) % 360 + 360) % 360 - 180;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      else for (const t of [-180, -90, 0, 90, 180]) if (Math.abs(a - t) < 3) a = t;
      store.updateElement(drag.id, { rotation: Math.round(a) }, key);
    } else {
      resize(p, e.shiftKey, key);
    }
  });

  // Resize keeps the opposite handle fixed in world space, so it works for rotated elements.
  function resize(p, keepAspect, key) {
    const o = drag.orig, { hx, hy } = drag;
    const c = { x: o.x + o.w / 2, y: o.y + o.h / 2 };
    const aLocal = rot(-hx * o.w / 2, -hy * o.h / 2, o.rotation);
    const anchor = { x: c.x + aLocal.x, y: c.y + aLocal.y };
    const v = rot(p.x - anchor.x, p.y - anchor.y, -o.rotation);
    let w = hx ? Math.max(MIN_SIZE, hx * v.x) : o.w;
    let h = hy ? Math.max(MIN_SIZE, hy * v.y) : o.h;
    if (keepAspect && hx && hy) {
      const k = Math.max(w / o.w, h / o.h);
      w = Math.max(MIN_SIZE, o.w * k); h = Math.max(MIN_SIZE, o.h * k);
    }
    const off = rot(hx * w / 2, hy * h / 2, o.rotation);
    const cx = anchor.x + off.x, cy = anchor.y + off.y;
    store.updateElement(drag.id, {
      x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w: Math.round(w), h: Math.round(h),
    }, key);
  }

  function end() {
    if (!drag) return;
    drag = null;
    guides = [];
    store.endGroup();
    api.refresh();
  }
  overlay.addEventListener('pointerup', end);
  overlay.addEventListener('pointercancel', end);
  overlay.addEventListener('dblclick', () => { const s = store.getSelected(); if (s && api.onEdit) api.onEdit(s); });

  api.destroy = () => overlay.remove();
  return api;
}
