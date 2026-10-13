// Timer element: countdown to a date/time (optionally daily/weekly), countdown from a duration, or stopwatch.
// All values are derived from Date.now(), so they stay correct through tab throttling and device sleep.
import { applyFont, textBlock, fitToWidth } from './textstyle.js';

const pad = (n) => String(n).padStart(2, '0');

// ms -> text. Countdowns round up (so 0.4s still shows 1s and the display hits 0 exactly at zero); stopwatches round down.
export function formatMs(ms, format = 'auto', countUp = false) {
  const total = Math.max(0, countUp ? Math.floor(ms / 1000) : Math.ceil(ms / 1000));
  const d = Math.floor(total / 86400), h = Math.floor((total % 86400) / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  if (format === 'hms') return `${pad(d * 24 + h)}:${pad(m)}:${pad(s)}`;
  if (format === 'ms') return `${pad(Math.floor(total / 60))}:${pad(s)}`;
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

// State of a "count down to date/time" timer at `now` (epoch ms).
// Repeating timers show zero for holdSec after each occurrence, then count to the next one.
export function untilState(c, now) {
  const base = new Date(c.target);
  if (Number.isNaN(base.getTime())) return { invalid: true, ms: 0, zero: false };
  const rep = c.repeat || 'none';
  if (base.getTime() > now) return { ms: base.getTime() - now, zero: false };
  if (rep === 'none') return { ms: 0, zero: true };
  const step = rep === 'weekly' ? 7 : 1;
  const cand = new Date(now);
  cand.setHours(base.getHours(), base.getMinutes(), 0, 0);
  if (rep === 'weekly') cand.setDate(cand.getDate() + (base.getDay() - cand.getDay()));
  while (cand.getTime() > now) cand.setDate(cand.getDate() - step);
  let next = new Date(cand);
  next.setDate(next.getDate() + step);
  while (next.getTime() <= now) { cand.setDate(cand.getDate() + step); next = new Date(cand); next.setDate(next.getDate() + step); }
  if (now - cand.getTime() < (c.holdSec ?? 30) * 1000) return { ms: 0, zero: true };
  return { ms: next.getTime() - now, zero: false };
}

function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 880; g.gain.value = 0.2;
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.6);
    setTimeout(() => ac.close(), 1000);
  } catch { /* audio blocked until the user interacts */ }
}

export function render(el, node, ctx = {}) {
  const c = el.content || {}, s = el.style || {};
  const mode = c.mode || 'until';
  applyFont(node, s, { size: 200, weight: 700 });
  node.style.fontVariantNumeric = 'tabular-nums';
  const inner = textBlock(node, s);

  // Run state for duration/stopwatch. Persisted in Show mode so a reload resumes the same timer.
  const key = ctx.persist && ctx.deckId ? `bbc110.timer.${ctx.deckId}.${el.id}` : null;
  let st = { running: false, startedAt: 0, accMs: 0 };
  if (key) { try { st = { ...st, ...JSON.parse(localStorage.getItem(key)) }; } catch { /* no saved state */ } }
  const save = () => { if (key) { try { localStorage.setItem(key, JSON.stringify(st)); } catch { /* storage blocked */ } } };
  const elapsed = (now) => st.accMs + (st.running ? Math.max(0, now - st.startedAt) : 0);
  const durMs = Math.max(0, (c.durationSec || 0) * 1000);

  let prevZero = null;
  function update(now) {
    let ms = 0, zero = false, text;
    if (mode === 'until') {
      const u = untilState(c, now);
      ms = u.ms; zero = u.zero;
      if (u.invalid) text = '--:--';
    } else if (mode === 'duration') {
      ms = Math.max(0, durMs - elapsed(now));
      zero = ms <= 0;
      if (zero && st.running) { st.running = false; st.accMs = durMs; save(); }
    } else {
      ms = elapsed(now);
    }
    if (text === undefined) text = zero && c.onZero === 'message' ? (c.message || '') : formatMs(ms, c.format, mode === 'stopwatch');
    if (inner.textContent !== text) inner.textContent = text;
    fitToWidth(node, inner, s);
    node.style.visibility = zero && c.onZero === 'hide' ? 'hidden' : '';
    node.classList.toggle('anim-flash', zero && c.onZero === 'flash');
    // Fire zero actions only on a live transition, never when a screen loads already at zero.
    if (zero && prevZero === false) {
      if (c.beep) beep();
      if (c.onZero === 'next') document.dispatchEvent(new CustomEvent('bbc110:timer-zero', { detail: { id: el.id } }));
    }
    prevZero = zero;
  }

  const ctl = {
    type: 'timer',
    mode,
    get running() { return st.running; },
    toggle() {
      if (mode === 'until') return;
      const now = Date.now();
      if (st.running) { st.accMs = elapsed(now); st.running = false; }
      else { if (mode === 'duration' && elapsed(now) >= durMs) st.accMs = 0; st.running = true; st.startedAt = now; }
      save(); update(now);
    },
    reset() { st = { running: false, startedAt: 0, accMs: 0 }; save(); update(Date.now()); },
  };
  return { update, controller: mode === 'until' ? null : ctl };
}
