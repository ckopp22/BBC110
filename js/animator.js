// Animation engine: element entrance/loop/exit, screen transitions, and the reduce-motion preference.
// Uses the Web Animations API with individual transform properties (translate/scale/rotate), which compose
// with an element's own rotation instead of replacing it, and only touch compositor-friendly properties.
import { getSetting, setSetting } from './db.js';

export const ENTRANCES = [['none', 'None'], ['fade', 'Fade'], ['slide-up', 'Slide up'], ['slide-down', 'Slide down'], ['slide-left', 'Slide left'], ['slide-right', 'Slide right'], ['zoom', 'Zoom'], ['bounce', 'Bounce'], ['flip', 'Flip'], ['blur-in', 'Blur in'], ['typewriter', 'Typewriter (text)']];
export const LOOPS = [['none', 'None'], ['pulse', 'Pulse'], ['float', 'Float'], ['shimmer', 'Shimmer']];
export const EXITS = [['none', 'None'], ['fade', 'Fade'], ['slide-up', 'Slide up'], ['slide-down', 'Slide down'], ['slide-left', 'Slide left'], ['slide-right', 'Slide right'], ['zoom', 'Zoom']];
export const TRANSITIONS = [['fade', 'Fade'], ['dissolve', 'Dissolve'], ['slide', 'Slide'], ['push', 'Push'], ['zoom', 'Zoom'], ['none', 'None']];
export const EASINGS = [['smooth', 'Smooth'], ['ease-in-out', 'Ease in-out'], ['linear', 'Linear'], ['spring', 'Springy']];
const EASING = { smooth: 'cubic-bezier(.2,.8,.2,1)', 'ease-in-out': 'ease-in-out', linear: 'linear', spring: 'cubic-bezier(.34,1.56,.64,1)' };

const IN = {
  fade: [{ opacity: 0 }, { opacity: 1 }],
  'slide-up': [{ opacity: 0, translate: '0 90px' }, { opacity: 1, translate: '0 0' }],
  'slide-down': [{ opacity: 0, translate: '0 -90px' }, { opacity: 1, translate: '0 0' }],
  'slide-left': [{ opacity: 0, translate: '140px 0' }, { opacity: 1, translate: '0 0' }],
  'slide-right': [{ opacity: 0, translate: '-140px 0' }, { opacity: 1, translate: '0 0' }],
  zoom: [{ opacity: 0, scale: '0.6' }, { opacity: 1, scale: '1' }],
  flip: [{ opacity: 0, rotate: 'x 90deg' }, { opacity: 1, rotate: 'x 0deg' }],
  'blur-in': [{ opacity: 0, filter: 'blur(24px)' }, { opacity: 1, filter: 'blur(0px)' }],
  bounce: [
    { offset: 0, opacity: 0, translate: '0 -280px', easing: 'ease-in' },
    { offset: 0.5, opacity: 1, translate: '0 0', easing: 'ease-out' },
    { offset: 0.7, translate: '0 -50px', easing: 'ease-in' },
    { offset: 0.85, translate: '0 0', easing: 'ease-out' },
    { offset: 0.93, translate: '0 -16px', easing: 'ease-in' },
    { offset: 1, translate: '0 0' },
  ],
};
const OUT = {
  fade: [{ opacity: 1 }, { opacity: 0 }],
  'slide-up': [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 -90px' }],
  'slide-down': [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 90px' }],
  'slide-left': [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '-140px 0' }],
  'slide-right': [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '140px 0' }],
  zoom: [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '0.6' }],
};
const LOOP = {
  pulse: { ms: 1600, frames: [{ scale: '1' }, { scale: '1.07' }, { scale: '1' }] },
  float: { ms: 3600, frames: [{ translate: '0 0' }, { translate: '0 -18px' }, { translate: '0 0' }] },
  shimmer: { ms: 2600, frames: [{ filter: 'brightness(1)' }, { filter: 'brightness(1.5)' }, { filter: 'brightness(1)' }] },
};

// ---- reduce motion: 'system' (follow the device), 'on', or 'off' ----
export const getMotionSetting = () => getSetting('reduceMotion', 'system');
export function reduceMotion() {
  const s = getMotionSetting();
  if (s === 'on') return true;
  if (s === 'off') return false;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
// Marks <html> so CSS (ticker, flashing) can honor the app-level choice too.
export function applyMotionPreference() { document.documentElement.classList.toggle('reduce-motion', reduceMotion()); }
export function setMotionSetting(v) { setSetting('reduceMotion', v); applyMotionPreference(); }
// Call once per page: applies the preference now and whenever the OS preference changes.
export function initMotion() {
  applyMotionPreference();
  if (typeof matchMedia === 'function') matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyMotionPreference);
}

// ---- element animations ----
const dur = (a) => Math.min(10000, Math.max(50, a.durationMs ?? 600));
const hasIn = (a) => a && a.in && a.in !== 'none';
const hasOut = (a) => a && a.out && a.out !== 'none';

// Plays the entrance and starts the loop. Returns a cleanup that cancels everything.
export function animateElement(node, el, { order = 0, stagger = 0 } = {}) {
  const a = el.animation;
  if (!a || reduceMotion()) return () => {};
  const easing = EASING[a.easing] || EASING.smooth;
  const delay = (a.delayMs || 0) + order * stagger;
  const running = [];
  const cleanups = [];
  let loopAt = delay;
  if (hasIn(a)) {
    const d = dur(a);
    if (a.in === 'typewriter' && el.type === 'text') cleanups.push(typewriter(node, d, delay));
    else running.push(node.animate(IN[a.in] || IN.fade, { duration: d, delay, easing: a.in === 'bounce' ? 'linear' : easing, fill: 'backwards' }));
    loopAt = delay + d;
  }
  const L = LOOP[a.loop];
  if (L) running.push(node.animate(L.frames, { duration: L.ms, delay: loopAt, iterations: Infinity, easing: 'ease-in-out' }));
  return () => { running.forEach((x) => x.cancel()); cleanups.forEach((f) => f()); };
}

// Reveals text character by character while keeping line breaks stable (the unrevealed rest stays invisible).
function typewriter(node, ms, delay) {
  const host = node.querySelector('.hl') || node.querySelector('.txt');
  if (!host) return () => {};
  const full = host.textContent;
  const shown = document.createTextNode('');
  const rest = document.createElement('span');
  rest.style.visibility = 'hidden';
  rest.textContent = full;
  host.replaceChildren(shown, rest);
  const t0 = performance.now() + delay;
  let raf = 0;
  const step = (now) => {
    const p = Math.min(1, Math.max(0, (now - t0) / ms));
    const n = Math.floor(p * full.length);
    shown.data = full.slice(0, n);
    rest.textContent = full.slice(n);
    if (p < 1) raf = requestAnimationFrame(step); else host.textContent = full;
  };
  raf = requestAnimationFrame(step);
  return () => { cancelAnimationFrame(raf); host.textContent = full; };
}

// Plays exit animations for every element of a displayed screen. Returns how long to wait (ms).
export function playExit(screenNode) {
  if (!screenNode || reduceMotion()) return 0;
  let longest = 0;
  screenNode.querySelectorAll('.el').forEach((n) => {
    const a = n._el && n._el.animation;
    if (!hasOut(a)) return;
    const d = dur(a);
    n.animate(OUT[a.out] || OUT.fade, { duration: d, easing: EASING[a.easing] || EASING.smooth, fill: 'forwards' });
    longest = Math.max(longest, d);
  });
  return longest;
}

// Data-only helpers, used for timing without touching the DOM.
export function exitMs(screen) {
  if (reduceMotion()) return 0;
  return Math.max(0, ...screen.elements.filter((e) => !e.hidden && hasOut(e.animation)).map((e) => dur(e.animation)));
}
// When the last entrance finishes, in ms after the screen appears.
export function entranceEndMs(screen) {
  const els = [...screen.elements].filter((e) => !e.hidden).sort((a, b) => a.z - b.z);
  return Math.max(0, ...els.map((e, i) => (hasIn(e.animation) ? (e.animation.delayMs || 0) + i * (screen.stagger || 0) + dur(e.animation) : 0)));
}

// ---- screen transitions ----
// `next` is already appended above `prev`. dir: 1 = forward, -1 = backward. Resolves when finished.
export function runTransition(next, prev, type, ms, dir = 1) {
  if (!prev || !ms || type === 'none' || reduceMotion()) return Promise.resolve();
  const slide = [{ translate: `${100 * dir}% 0` }, { translate: '0 0' }];
  const into = {
    fade: [{ opacity: 0 }, { opacity: 1 }],
    dissolve: [{ opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)' }],
    slide,
    push: slide,
    zoom: [{ opacity: 0, scale: '0.85' }, { opacity: 1, scale: '1' }],
  }[type] || [{ opacity: 0 }, { opacity: 1 }];
  const out = {
    dissolve: [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(8px)' }],
    push: [{ translate: '0 0' }, { translate: `${-100 * dir}% 0` }],
  }[type];
  const opts = { duration: ms, easing: 'cubic-bezier(.4,0,.2,1)' };
  const anims = [next.animate(into, { ...opts, fill: 'backwards' })];
  if (out) anims.push(prev.animate(out, { ...opts, fill: 'forwards' }));
  return Promise.all(anims.map((x) => x.finished.catch(() => {})));
}
