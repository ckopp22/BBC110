// Show mode: lean playback engine. Imports only the renderer and db (no store, no editor).
import { getDeck } from '../db.js';
import { createStage, preloadDeck } from '../renderer.js';
import { sampleDeck } from '../model.js';
import { getControllers } from '../live.js';
import { exitMs, initMotion } from '../animator.js';
import { localTransport, receiverTransport } from '../sync.js';

const $ = (id) => document.getElementById(id);
const body = document.body;
const params = new URLSearchParams(location.search);
const id = params.get('id');
const presentMode = params.get('present') === '1'; // opened from the Editor's Publish dialog: wire remote control
const homeUrl = id && id !== 'demo' ? `index.html#/edit/${encodeURIComponent(id)}` : 'index.html';

function fail(message) {
  const m = $('msg');
  m.style.display = 'flex';
  m.innerHTML = `<div>${message}</div><a href="${homeUrl}">Back to BBC110</a>`;
}

async function loadDeck() {
  if (!id || id === 'demo') return sampleDeck();
  try { return await getDeck(id); } catch { return null; }
}

async function start() {
  let deck, castTransport = null;
  if (!id) {
    // No id: either a cast receiver (launched by a device via the Presentation API) or a stray open.
    const t = await receiverTransport();
    if (!t) return fail('Open BBC110 and tap Publish to show a screen here.');
    deck = await new Promise((resolve) => {
      t.onMessage((msg) => { if (msg.t === 'deck') resolve(msg.deck); });
      t.send({ t: 'hello' });
    });
    castTransport = t;
  } else {
    deck = await loadDeck();
  }
  if (!deck || !deck.screens || !deck.screens.length) return fail('This screen could not be found.');

  initMotion();
  document.title = `${deck.name} – BBC110 Show`;
  await preloadDeck(deck);
  const stage = createStage($('host'), deck, { mode: 'show' });
  let count = deck.screens.length;
  const resumeKey = `bbc110.resume.${deck.id}`;
  const mode = deck.mode || 'manual';

  let index = 0;
  let paused = mode === 'manual';
  let timer = null;
  let deadline = 0;
  let remaining = 0;
  let exitTimer = null; // set while exit animations play before the next screen
  let pending = 0;

  try { const saved = parseInt(localStorage.getItem(resumeKey), 10); if (saved >= 0 && saved < count) index = saved; } catch { /* storage blocked */ }

  const jump = $('jump');
  const rebuildJump = () => { jump.replaceChildren(); deck.screens.forEach((s, i) => jump.add(new Option(`${i + 1}. ${s.name}`, i))); };
  rebuildJump();

  // Remote control: a local window (opened via Publish) or a real cast connection (castTransport, set above).
  const transport = castTransport || (presentMode && id ? localTransport(id) : null);
  function sendState() {
    if (!transport) return;
    const timers = getControllers('timer'), scores = getControllers('score');
    transport.send({
      t: 'state', index, count, name: deck.screens[index].name, mode, paused,
      blanked: body.classList.contains('blank'), hasTimer: !!timers.length, timerRunning: timers.some((x) => x.running), hasScore: !!scores.length,
    });
  }
  if (transport) {
    transport.onMessage((msg) => {
      if (msg.t === 'hello') { transport.send({ t: 'hello' }); sendState(); }
      else if (msg.t === 'deck') { Object.assign(deck, msg.deck); count = deck.screens.length; rebuildJump(); stage.setDeck(deck); index = Math.min(index, count - 1); stage.setScreen(index); sendState(); }
      else if (msg.t === 'goto') go(msg.index);
      else if (msg.t === 'pause') setPaused(true);
      else if (msg.t === 'play') setPaused(false);
      else if (msg.t === 'black') { body.classList.toggle('blank', msg.on); $('bBlack').classList.toggle('on', msg.on); sendState(); }
      else if (msg.t === 'timerToggle') toggleTimers();
      else if (msg.t === 'timerReset') resetLive();
      else if (msg.t === 'close') (castTransport ? () => { fail('The presentation ended.'); } : exit)();
    });
    transport.send({ t: 'hello' });
    addEventListener('pagehide', () => transport.send({ t: 'bye' }));
  }

  function durationMs(i) { return (deck.screens[i].durationSec || deck.defaultDurationSec || 10) * 1000; }

  function schedule(ms) {
    clearTimeout(timer);
    timer = null;
    if (mode === 'manual' || paused) return;
    if (mode === 'timed' && index === count - 1) return;
    remaining = ms;
    deadline = Date.now() + ms;
    timer = setTimeout(() => go(index + 1), ms);
  }

  // Moves to screen i. If the current screen has exit animations they play first (and a second call just retargets).
  function go(i) {
    if (i >= count) i = mode === 'loop' ? 0 : count - 1;
    if (i < 0) i = mode === 'loop' ? count - 1 : 0;
    if (exitTimer) { pending = i; return; }
    clearTimeout(timer);
    timer = null;
    const ms = stage.index >= 0 && i !== index ? stage.playExit() : 0;
    if (ms > 0) {
      pending = i;
      exitTimer = setTimeout(() => { exitTimer = null; commit(pending); }, ms);
    } else {
      commit(i);
    }
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
    try { localStorage.setItem(resumeKey, String(index)); } catch { /* storage blocked */ }
    $('count').textContent = `${index + 1} / ${count}`;
    jump.value = index;
    // Start the exit animation early enough that the screen still lasts its full duration.
    schedule(Math.max(0, durationMs(index) - exitMs(sc)));
    refreshLive();
    // The old screen's timers are torn down after the transition, so re-check which controls apply.
    if (changed && ms) setTimeout(() => { refreshLive(); sendState(); }, ms + 200);
    sendState();
  }

  // Timer and scoreboard controls only appear when the current screen has them.
  function refreshLive() {
    const timers = getControllers('timer'), scores = getControllers('score');
    $('bTimer').hidden = !timers.length;
    $('bReset').hidden = !(timers.length || scores.length);
    $('bTimer').textContent = timers.some((t) => t.running) ? 'Pause' : 'Start';
  }
  const toggleTimers = () => { getControllers('timer').forEach((t) => t.toggle()); refreshLive(); sendState(); };
  const resetLive = () => { getControllers('timer').forEach((t) => t.reset()); getControllers('score').forEach((c) => c.reset()); refreshLive(); sendState(); };

  function setPaused(p) {
    if (mode === 'manual') return;
    if (p === paused) return;
    if (p) { remaining = Math.max(0, deadline - Date.now()); clearTimeout(timer); timer = null; paused = true; }
    else { paused = false; schedule(remaining || durationMs(index)); }
    $('bPlay').innerHTML = paused ? '&#9654;' : '&#10074;&#10074;';
    $('bPlay').classList.toggle('on', paused);
    sendState();
  }

  // Wake lock: keep the display awake; re-acquire when the tab becomes visible again.
  let lock = null;
  async function wake() {
    try {
      if (lock || !navigator.wakeLock || document.visibilityState !== 'visible') return;
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch { /* not allowed or unsupported */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); });

  // Fullscreen
  const de = document.documentElement;
  const canFull = !!(de.requestFullscreen || de.webkitRequestFullscreen);
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function toggleFull() {
    if (!canFull) return;
    try {
      if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (de.requestFullscreen || de.webkitRequestFullscreen).call(de);
    } catch { /* needs a user gesture */ }
  }
  if (!canFull) $('bFull').hidden = true;

  // Controls overlay and cursor hiding
  let ctlTimer = null, cursorTimer = null;
  function activity() {
    body.classList.add('ctl');
    body.classList.remove('idle');
    refreshLive();
    clearTimeout(ctlTimer); clearTimeout(cursorTimer);
    ctlTimer = setTimeout(() => body.classList.remove('ctl'), 3000);
    cursorTimer = setTimeout(() => body.classList.add('idle'), 2000);
  }

  function exit() {
    if (window.opener && !window.opener.closed) { window.close(); return; }
    location.href = homeUrl;
  }

  $('bPrev').onclick = () => go(index - 1);
  $('bNext').onclick = () => go(index + 1);
  $('bPlay').onclick = () => setPaused(!paused);
  $('bBlack').onclick = () => { body.classList.toggle('blank'); $('bBlack').classList.toggle('on', body.classList.contains('blank')); sendState(); };
  $('bTimer').onclick = toggleTimers;
  $('bReset').onclick = resetLive;
  $('bFull').onclick = toggleFull;
  document.addEventListener('bbc110:timer-zero', () => go(index + 1));
  $('bExit').onclick = exit;
  jump.onchange = () => go(parseInt(jump.value, 10));
  $('bPlay').hidden = mode === 'manual';

  document.addEventListener('keydown', (e) => {
    if (e.target === jump || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || k === 'Enter' || (k === ' ' && mode === 'manual')) go(index + 1);
    else if (k === 'ArrowLeft' || k === 'PageUp') go(index - 1);
    else if (k === ' ') setPaused(!paused);
    else if (k === 'Home') go(0);
    else if (k === 'End') go(count - 1);
    else if (k === 'f' || k === 'F') toggleFull();
    else if (k === 'b' || k === 'B' || k === '.') $('bBlack').click();
    else if (k === 'p' || k === 'P') setPaused(!paused);
    else if (k === 't' || k === 'T') toggleTimers();
    else if (k === 'r' || k === 'R') resetLive();
    else if (/^Digit[1-6]$/.test(e.code)) getControllers('score').forEach((c) => c.adjust(+e.code.slice(5) - 1, e.shiftKey ? -1 : 1));
    else if (k === 'Escape' && !isFull()) exit();
    else return;
    e.preventDefault();
    activity();
  });

  // Click/tap advances in manual mode. On touch, the first tap only reveals the controls.
  $('host').addEventListener('pointerup', (e) => {
    const touchHidden = e.pointerType === 'touch' && !body.classList.contains('ctl');
    activity();
    wake();
    if (e.target.closest && e.target.closest('.sb-btn')) return;
    if (touchHidden || mode !== 'manual') return;
    go(e.clientX < innerWidth * 0.25 ? index - 1 : index + 1);
  });
  document.addEventListener('pointermove', activity);

  go(index);
  wake();
  activity();
  if (canFull && !isFull()) {
    $('hint').classList.add('on');
    setTimeout(() => $('hint').classList.remove('on'), 5000);
  }
}

start().catch(() => fail('Something went wrong starting the show.'));
