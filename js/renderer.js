// Schema -> DOM. Shared by Editor and Show mode: what you see is what gets published.
import { ASPECTS } from './model.js';
import { themeVars, applyTheme } from './themes.js';
import { firstFamily } from './fonts.js';
import * as text from './elements/text.js';
import * as shape from './elements/shape.js';
import * as image from './elements/image.js';
import * as clock from './elements/clock.js';
import * as timer from './elements/timer.js';
import * as banner from './elements/banner.js';
import * as ticker from './elements/ticker.js';
import * as qr from './elements/qr.js';
import * as scoreboard from './elements/scoreboard.js';
import { subscribe, addController } from './live.js';
import { animateElement, playExit as playExitAnim, runTransition, reduceMotion } from './animator.js';
import { animatedBackground } from './backgrounds.js';

const ELEMENTS = { text, shape, image, clock, timer, banner, ticker, qr, scoreboard };

export const canvasSize = (aspect) => ASPECTS[aspect] || ASPECTS['16:9'];

function renderBackground(bg, ctx = {}) {
  const frag = document.createDocumentFragment();
  const layer = bg && bg.type === 'animated'
    ? animatedBackground(bg, ctx.seed || '', !!ctx.animate && !reduceMotion(), ctx.size || [1920, 1080])
    : document.createElement('div');
  layer.className = 'screen-bg';
  if (bg && bg.type === 'image' && bg.value) {
    layer.style.backgroundImage = `url("${bg.value}")`;
    layer.style.backgroundSize = bg.fit === 'contain' ? 'contain' : 'cover';
    layer.style.backgroundRepeat = 'no-repeat';
    if (bg.blur > 0) { layer.style.filter = `blur(${bg.blur}px)`; layer.style.transform = 'scale(1.1)'; }
  } else if (bg && bg.value && bg.type !== 'animated') {
    layer.style.background = bg.value; // color or gradient
  }
  frag.append(layer);
  if (bg && bg.overlay && bg.overlay.opacity > 0) {
    const o = document.createElement('div');
    o.className = 'screen-overlay';
    o.style.background = bg.overlay.color;
    o.style.opacity = bg.overlay.opacity;
    frag.append(o);
  }
  return frag;
}

// ctx: { mode, live, animate, persist, deckId, cleanups, order, stagger }. Live elements return { update, start, stop, controller }.
export function renderElement(el, ctx = { live: false, cleanups: [] }) {
  const mod = ELEMENTS[el.type];
  const node = document.createElement('div');
  node.className = `el el-${el.type}`;
  node.dataset.id = el.id;
  node._el = el; // read by playExit
  node.style.left = el.x + 'px';
  node.style.top = el.y + 'px';
  node.style.width = el.w + 'px';
  node.style.height = el.h + 'px';
  node.style.zIndex = el.z;
  if (el.rotation) node.style.transform = `rotate(${el.rotation}deg)`;
  const r = mod && mod.render(el, node, ctx);
  if (r) {
    if (r.update) r.update(Date.now());
    if (ctx.live) {
      if (r.update) ctx.cleanups.push(subscribe(r.update));
      if (r.start) r.start();
      if (r.stop) ctx.cleanups.push(r.stop);
      if (r.controller) ctx.cleanups.push(addController(r.controller));
    }
  }
  if (ctx.animate && ctx.live) ctx.cleanups.push(animateElement(node, el, ctx));
  return node;
}

export function renderScreen(screen, deck, base = { live: false }) {
  const node = document.createElement('div');
  node.className = 'screen';
  if (screen.theme) applyTheme(node, themeVars(screen.theme, deck));
  node.dataset.id = screen.id;
  const cleanups = [];
  const ctx = { ...base, deckId: deck && deck.id, persist: base.mode === 'show', cleanups, stagger: screen.stagger || 0 };
  node.append(renderBackground(screen.background, { ...ctx, seed: screen.id, size: canvasSize(deck && deck.aspect) }));
  [...screen.elements]
    .filter((el) => !el.hidden)
    .sort((a, b) => a.z - b.z)
    .forEach((el, order) => node.append(renderElement(el, { ...ctx, order })));
  node._cleanup = () => cleanups.splice(0).forEach((fn) => fn());
  return node;
}

// Stops timers/tickers of a screen that is no longer displayed.
export function destroyScreen(node) { if (node && node._cleanup) node._cleanup(); }

// Mounts a scaled logical canvas inside `host` and keeps it fitted as the host resizes.
// fit: 'contain' (letterbox/pillarbox) or 'cover' (fill/crop).
// mode: 'edit' | 'show' (show persists timers and scores). live: false renders a static snapshot (thumbnails).
export function createStage(host, initialDeck, { fit = 'contain', mode = 'edit', live = true, animate = mode === 'show' } = {}) {
  let deck = initialDeck;
  let onLayout = null;
  const metrics = { s: 1, ox: 0, oy: 0, W: 1920, H: 1080 };
  host.classList.add('stage-host');
  const stage = document.createElement('div');
  stage.className = 'stage';
  host.append(stage);

  let current = null;
  let index = -1;
  let [W, H] = canvasSize(deck.aspect);

  function layout() {
    const hw = host.clientWidth, hh = host.clientHeight;
    if (!hw || !hh) return;
    const s = (fit === 'cover' ? Math.max : Math.min)(hw / W, hh / H);
    metrics.s = s; metrics.ox = (hw - W * s) / 2; metrics.oy = (hh - H * s) / 2; metrics.W = W; metrics.H = H;
    stage.style.transform = `translate(${metrics.ox}px, ${metrics.oy}px) scale(${s})`;
    if (onLayout) onLayout();
  }

  function size() {
    [W, H] = canvasSize(deck.aspect);
    stage.style.width = W + 'px';
    stage.style.height = H + 'px';
    applyTheme(stage, themeVars(deck.theme, deck));
    layout();
  }

  const ro = new ResizeObserver(layout);
  ro.observe(host);
  size();

  // Shows screen `i`. With a previous screen and transitionMs > 0 the new screen transitions in over the old one
  // (type: fade | dissolve | slide | push | zoom | none; dir: 1 forward, -1 backward).
  // opts.animate overrides whether element entrances/loops and animated backgrounds play.
  function setScreen(i, { transitionMs = 0, type = 'fade', dir = 1, animate: anim = animate } = {}) {
    const screen = deck.screens[i];
    if (!screen) return;
    index = i;
    const next = renderScreen(screen, deck, { mode, live, animate: anim });
    const prev = current;
    current = next;
    if (prev && transitionMs > 0 && type !== 'none' && !reduceMotion()) {
      stage.append(next);
      let removed = false;
      const done = () => { if (removed) return; removed = true; prev.remove(); destroyScreen(prev); };
      runTransition(next, prev, type, transitionMs, dir).then(done);
      setTimeout(done, transitionMs + 150); // safety net if the animation clock is paused (hidden tab)
    } else {
      stage.replaceChildren(next);
      destroyScreen(prev);
    }
  }

  return {
    stage,
    metrics,
    set onLayout(fn) { onLayout = fn; },
    setDeck(d) { deck = d; size(); },
    get index() { return index; },
    setScreen,
    playExit() { return playExitAnim(current); },
    rerender() { size(); if (index >= 0) setScreen(index); },
    destroy() { ro.disconnect(); destroyScreen(current); stage.remove(); },
  };
}

// Resolves once every image and font in the deck is ready (or a timeout passes), so the first frame has no pop-in.
export function preloadDeck(deck, timeoutMs = 4000) {
  const srcs = new Set();
  const fonts = new Set();
  const addTheme = (id) => {
    const v = themeVars(id, deck);
    for (const k of ['--font-display', '--font-body']) for (const w of [400, 700]) fonts.add(`${w}|${firstFamily(v[k])}`);
  };
  addTheme(deck.theme);
  for (const s of deck.screens) {
    if (s.theme) addTheme(s.theme);
    if (s.background && s.background.type === 'image' && s.background.value) srcs.add(s.background.value);
    for (const el of s.elements) {
      if (el.type === 'image' && el.content && el.content.src) srcs.add(el.content.src);
      const fam = el.style && firstFamily(el.style.fontFamily);
      if (fam) fonts.add(`${el.style.fontWeight || 400}|${fam}`);
    }
  }
  const jobs = [...srcs].map((src) => {
    const img = new Image();
    img.src = src;
    return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  });
  if (document.fonts && document.fonts.load) {
    for (const f of fonts) {
      const [w, fam] = f.split('|');
      if (fam) jobs.push(document.fonts.load(`${w} 1em "${fam}"`).catch(() => {}));
    }
  }
  return Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, timeoutMs))]);
}
