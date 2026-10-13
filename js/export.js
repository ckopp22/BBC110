// Export: project file (.bbc110.json), standalone HTML, PNG image, print/PDF, and a full-library backup.
import { SCHEMA_VERSION } from './model.js';
import { themeVars, resolveTheme } from './themes.js';
import { firstFamily } from './fonts.js';
import { createStage, renderScreen, canvasSize } from './renderer.js';
import { bundleModules } from './bundle.js';

const APP = 'BBC110';
const slug = (s) => (s || 'screen').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'screen';

function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

// Shares a file via the native Share sheet when available (mainly phones), otherwise downloads it.
export async function shareOrDownload(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  download(blob, filename);
  return 'downloaded';
}
export const canShareFiles = () => !!(navigator.canShare && navigator.share);

// ---- project file (.bbc110.json) ----
export function exportJSON(deck) {
  const wrapped = { app: APP, schemaVersion: deck.schemaVersion || SCHEMA_VERSION, exportedAt: new Date().toISOString(), deck };
  return { blob: new Blob([JSON.stringify(wrapped, null, 1)], { type: 'application/json' }), filename: `${slug(deck.name)}.bbc110.json` };
}

// Whole-library backup: every deck in one JSON file (newest first), for moving to a new device.
export function exportLibraryBackup(decks) {
  const wrapped = { app: APP, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), decks };
  const date = new Date().toISOString().slice(0, 10);
  return { blob: new Blob([JSON.stringify(wrapped, null, 1)], { type: 'application/json' }), filename: `bbc110-backup-${date}.json` };
}

// ---- shared: embed only the fonts a deck actually uses, as base64 @font-face rules ----
async function collectFontFaceCSS(deck) {
  const families = new Set();
  const addStack = (stack) => { const f = firstFamily(stack); if (f) families.add(f); };
  const addTheme = (id) => { const v = themeVars(id, deck); addStack(v['--font-display']); addStack(v['--font-body']); };
  addTheme(deck.theme);
  for (const s of deck.screens) {
    if (s.theme) addTheme(s.theme);
    for (const el of s.elements) if (el.style && el.style.fontFamily) addStack(el.style.fontFamily);
  }
  const res = await fetch(new URL('../css/fonts.css', import.meta.url));
  const css = await res.text();
  const rules = [...css.matchAll(/@font-face\s*{[^}]*font-family:\s*"([^"]+)"[^}]*url\("([^"]+)"\)[^}]*}/g)]
    .filter((m) => families.has(m[1]));
  const out = [];
  for (const [rule, , url] of rules) {
    try {
      const buf = await (await fetch(new URL(`../css/${url}`, import.meta.url))).arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      out.push(rule.replace(/url\("[^"]+"\)/, `url("data:font/woff2;base64,${b64}")`));
    } catch { /* font unavailable; the fallback stack in the rule still applies */ }
  }
  return out.join('\n');
}

async function fetchText(path) { return (await fetch(new URL(path, import.meta.url))).text(); }

// ---- standalone HTML export: bundles the renderer + a trimmed playback engine into one file ----
export async function exportStandaloneHTML(deck, onProgress) {
  onProgress?.('Bundling the player…');
  const root = new URL('./', import.meta.url);
  const { code, entryVar } = await bundleModules(root, ['renderer.js']);
  const rendererVar = entryVar('renderer.js');
  const liveVar = entryVar('live.js');

  onProgress?.('Embedding fonts…');
  const fontCss = await collectFontFaceCSS(deck);
  const [canvasCss, animCss, themeCss] = await Promise.all(['../css/canvas.css', '../css/animations.css', '../css/themes.css'].map(fetchText));
  const showHtml = await fetchText('../show.html');
  const inlineStyle = (showHtml.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
  const controlsBody = (showHtml.match(/<body>([\s\S]*?)<script/) || [, ''])[1].replace(/<script[\s\S]*$/, '');

  onProgress?.('Writing the file…');
  const deckJson = JSON.stringify(deck).replace(/</g, '\\u003c');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(deck.name)} – BBC110</title>
<style>${fontCss}\n${themeCss}\n${canvasCss}\n${animCss}\n${inlineStyle}</style>
</head>
<body>
${controlsBody}
<script>
window.BBC110_DECK = ${deckJson};
${code}
(${standaloneEntry.toString()})(${rendererVar}, ${liveVar});
<\/script>
</body>
</html>`;
  return { blob: new Blob([html], { type: 'text/html' }), filename: `${slug(deck.name)}.html` };
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Playback engine for the standalone file: a trimmed copy of show/show.js with no IndexedDB, no
// remote-control sync (nothing to connect to) — the deck is already in memory. Stringified and
// inlined into the exported HTML, so it must not reference anything outside its own closure/arguments.
function standaloneEntry(renderer, live) {
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const deck = window.BBC110_DECK;
  const resumeKey = `bbc110.resume.${deck.id}`;
  const mode = deck.mode || 'manual';
  const count = deck.screens.length;
  let index = 0, paused = mode === 'manual', timer = null, deadline = 0, remaining = 0, exitTimer = null, pending = 0;
  try { const saved = parseInt(localStorage.getItem(resumeKey), 10); if (saved >= 0 && saved < count) index = saved; } catch (e) {}
  const jump = $('jump');
  deck.screens.forEach((s, i) => jump.add(new Option((i + 1) + '. ' + s.name, i)));
  const durationMs = (i) => (deck.screens[i].durationSec || deck.defaultDurationSec || 10) * 1000;
  function schedule(ms) {
    clearTimeout(timer); timer = null;
    if (mode === 'manual' || paused) return;
    if (mode === 'timed' && index === count - 1) return;
    remaining = ms; deadline = Date.now() + ms;
    timer = setTimeout(() => go(index + 1), ms);
  }
  function go(i) {
    if (i >= count) i = mode === 'loop' ? 0 : count - 1;
    if (i < 0) i = mode === 'loop' ? count - 1 : 0;
    if (exitTimer) { pending = i; return; }
    clearTimeout(timer); timer = null;
    const ms = stage.index >= 0 && i !== index ? stage.playExit() : 0;
    if (ms > 0) { pending = i; exitTimer = setTimeout(() => { exitTimer = null; commit(pending); }, ms); } else commit(i);
  }
  function commit(i) {
    const changed = i !== index || stage.index < 0;
    let dir = i >= index ? 1 : -1;
    if (mode === 'loop' && index === count - 1 && i === 0) dir = 1;
    index = i;
    const sc = deck.screens[i];
    const type = (sc.transition && sc.transition.type) || (deck.transition && deck.transition.type) || 'fade';
    const ms = type === 'none' ? 0 : (deck.transition && deck.transition.durationMs) ?? 600;
    if (changed) stage.setScreen(index, { transitionMs: stage.index < 0 ? 0 : ms, type, dir });
    try { localStorage.setItem(resumeKey, String(index)); } catch (e) {}
    $('count').textContent = (index + 1) + ' / ' + count;
    jump.value = index;
    schedule(Math.max(0, durationMs(index)));
    refreshLive();
  }
  function refreshLive() {
    const timers = live.getControllers('timer'), scores = live.getControllers('score');
    $('bTimer').hidden = !timers.length;
    $('bReset').hidden = !(timers.length || scores.length);
    $('bTimer').textContent = timers.some((t) => t.running) ? 'Pause' : 'Start';
  }
  const toggleTimers = () => { live.getControllers('timer').forEach((t) => t.toggle()); refreshLive(); };
  const resetLive = () => { live.getControllers('timer').forEach((t) => t.reset()); live.getControllers('score').forEach((c) => c.reset()); refreshLive(); };
  const stage = renderer.createStage($('host'), deck, { mode: 'show' });
  go(index);
  $('bTimer').onclick = toggleTimers;
  $('bReset').onclick = resetLive;
  $('bPrev').onclick = () => go(index - 1);
  $('bNext').onclick = () => go(index + 1);
  $('bExit').onclick = () => { history.back(); };
  $('bFull').onclick = () => {
    const de = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen(); else (de.requestFullscreen && de.requestFullscreen());
  };
  $('bBlack').onclick = () => { body.classList.toggle('blank'); $('bBlack').classList.toggle('on', body.classList.contains('blank')); };
  $('bPlay').hidden = mode === 'manual';
  $('bPlay').onclick = () => {
    if (mode === 'manual') return;
    paused = !paused;
    if (paused) { remaining = Math.max(0, deadline - Date.now()); clearTimeout(timer); } else schedule(remaining || durationMs(index));
    $('bPlay').innerHTML = paused ? '&#9654;' : '&#10074;&#10074;';
  };
  document.addEventListener('keydown', (e) => {
    if (e.target === jump) return;
    const k = e.key;
    if (k === 'ArrowRight' || (k === ' ' && mode === 'manual')) go(index + 1);
    else if (k === 'ArrowLeft') go(index - 1);
    else if (k === 'f' || k === 'F') $('bFull').click();
    else if (k === 'b' || k === 'B') $('bBlack').click();
    else if (k === ' ') $('bPlay').click();
    else if (k === 't' || k === 'T') toggleTimers();
    else if (k === 'r' || k === 'R') resetLive();
    else if (/^Digit[1-6]$/.test(e.code)) live.getControllers('score').forEach((c) => c.adjust(+e.code.slice(5) - 1, e.shiftKey ? -1 : 1));
    else return;
    e.preventDefault();
  });
  let ctlTimer;
  const activity = () => { body.classList.add('ctl'); body.classList.remove('idle'); clearTimeout(ctlTimer); ctlTimer = setTimeout(() => body.classList.remove('ctl'), 3000); };
  $('host').addEventListener('pointermove', activity);
  $('host').addEventListener('pointerup', (e) => { activity(); if (mode === 'manual') go(e.clientX < innerWidth * 0.25 ? index - 1 : index + 1); });
  activity();
  jump.onchange = () => go(parseInt(jump.value, 10));
  try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
}

// ---- PNG snapshot (rasterizes the current screen via an SVG <foreignObject>) ----
export async function exportPNG(deck, screenIndex, { scale = 1 } = {}) {
  const [W, H] = canvasSize(deck.aspect);
  const w = W * scale, h = H * scale;
  const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
  const [fontCss, canvasCss, animCss, themeCss] = (await Promise.all([collectFontFaceCSS(deck), fetchText('../css/canvas.css'), fetchText('../css/animations.css'), fetchText('../css/themes.css')])).map(stripComments);
  const node = renderScreen(deck.screens[screenIndex], deck, { mode: 'edit', live: false });
  const vars = themeVars(deck.screens[screenIndex].theme || deck.theme, deck);
  const varCss = `:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}`;
  const xml = new XMLSerializer().serializeToString(node);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${W} ${H}">
    <foreignObject width="${W}" height="${H}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="width:${W}px;height:${H}px">
        <style>${fontCss}\n${themeCss}\n${varCss}\n${canvasCss}\n${animCss}\n.screen{position:relative;width:100%;height:100%}</style>
        ${xml}
      </div>
    </foreignObject>
  </svg>`;
  const img = new Image(w, h);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('Could not render this screen as an image.')); img.src = svgUrl; });
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not create the image.');
  return { blob, filename: `${slug(deck.name)}-${screenIndex + 1}.png` };
}

// ---- Print / PDF: populates a hidden print-only container, then opens the browser's print dialog ----
export function printDeck(deck) {
  let root = document.getElementById('printRoot');
  if (!root) { root = document.createElement('div'); root.id = 'printRoot'; document.body.append(root); }
  root.replaceChildren();
  const [W, H] = canvasSize(deck.aspect);
  deck.screens.forEach((screen) => {
    const page = document.createElement('div');
    page.className = 'print-page';
    page.style.aspectRatio = `${W} / ${H}`;
    const stageHost = document.createElement('div');
    stageHost.className = 'stage-host';
    page.append(stageHost);
    root.append(page);
    createStage(stageHost, deck, { live: false }).setScreen(deck.screens.indexOf(screen));
  });
  requestAnimationFrame(() => requestAnimationFrame(() => { window.print(); }));
}
