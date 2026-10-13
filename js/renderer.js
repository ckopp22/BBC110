// Schema -> DOM. Shared by Editor and Show mode: what you see is what gets published.
import { ASPECTS } from './model.js';
import * as text from './elements/text.js';
import * as shape from './elements/shape.js';
import * as image from './elements/image.js';

const ELEMENTS = { text, shape, image };

export const canvasSize = (aspect) => ASPECTS[aspect] || ASPECTS['16:9'];

function renderBackground(bg) {
  const frag = document.createDocumentFragment();
  const layer = document.createElement('div');
  layer.className = 'screen-bg';
  if (bg && bg.value) {
    if (bg.type === 'image') layer.style.backgroundImage = `url("${bg.value}")`;
    else layer.style.background = bg.value; // color or gradient
  }
  frag.append(layer);
  if (bg && bg.overlay) {
    const o = document.createElement('div');
    o.className = 'screen-overlay';
    o.style.background = bg.overlay.color;
    o.style.opacity = bg.overlay.opacity;
    frag.append(o);
  }
  return frag;
}

export function renderElement(el) {
  const mod = ELEMENTS[el.type];
  const node = document.createElement('div');
  node.className = `el el-${el.type}`;
  node.dataset.id = el.id;
  node.style.left = el.x + 'px';
  node.style.top = el.y + 'px';
  node.style.width = el.w + 'px';
  node.style.height = el.h + 'px';
  node.style.zIndex = el.z;
  if (el.rotation) node.style.transform = `rotate(${el.rotation}deg)`;
  if (mod) mod.render(el, node);
  return node;
}

export function renderScreen(screen) {
  const node = document.createElement('div');
  node.className = 'screen';
  node.dataset.id = screen.id;
  node.append(renderBackground(screen.background));
  [...screen.elements]
    .filter((el) => !el.hidden)
    .sort((a, b) => a.z - b.z)
    .forEach((el) => node.append(renderElement(el)));
  return node;
}

// Mounts a scaled logical canvas inside `host` and keeps it fitted as the host resizes.
// fit: 'contain' (letterbox/pillarbox) or 'cover' (fill/crop).
export function createStage(host, initialDeck, { fit = 'contain' } = {}) {
  let deck = initialDeck;
  let onLayout = null;
  const metrics = { s: 1, ox: 0, oy: 0, W: 1920, H: 1080 };
  host.classList.add('stage-host');
  const stage = document.createElement('div');
  stage.className = `stage theme-${deck.theme}`;
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
    stage.className = `stage theme-${deck.theme}`;
    layout();
  }

  const ro = new ResizeObserver(layout);
  ro.observe(host);
  size();

  // Shows screen `i`. With transitionMs > 0 the new screen fades in over the old one.
  function setScreen(i, { transitionMs = 0 } = {}) {
    const screen = deck.screens[i];
    if (!screen) return;
    index = i;
    const next = renderScreen(screen);
    const prev = current;
    current = next;
    if (prev && transitionMs > 0) {
      next.style.animation = `bbc-fade-in ${transitionMs}ms ease both`;
      stage.append(next);
      setTimeout(() => prev.remove(), transitionMs + 50);
    } else {
      stage.replaceChildren(next);
    }
  }

  return {
    stage,
    metrics,
    set onLayout(fn) { onLayout = fn; },
    setDeck(d) { deck = d; },
    get index() { return index; },
    setScreen,
    rerender() { size(); if (index >= 0) setScreen(index); },
    destroy() { ro.disconnect(); stage.remove(); },
  };
}

// Resolves once every image in the deck is decoded (or a timeout passes), so the first frame has no pop-in.
export function preloadDeck(deck, timeoutMs = 4000) {
  const srcs = new Set();
  for (const s of deck.screens) {
    if (s.background && s.background.type === 'image' && s.background.value) srcs.add(s.background.value);
    for (const el of s.elements) if (el.type === 'image' && el.content && el.content.src) srcs.add(el.content.src);
  }
  const jobs = [...srcs].map((src) => {
    const img = new Image();
    img.src = src;
    return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  });
  return Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, timeoutMs))]);
}
