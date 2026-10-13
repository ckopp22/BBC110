// A slim control strip shown in the Editor while a deck is being presented in a second window or cast
// target: current/next screen, prev/next, play/pause, black, timer controls, and stop presenting.
// Lets edits made here reach the live Show over the same transport (debounced, like autosave).
import * as store from '../store.js';
import { localTransport } from '../sync.js';
import { getSession, setSession, clearSession, isReconnectable, clearReconnectable } from '../presence.js';

const h = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };

// Resolves a transport for this deck if one is (or can be) active: an in-memory session from this
// page load, or a reconnect over BroadcastChannel if the Editor was reloaded while a window is open.
function resolveTransport(deckId) {
  let t = getSession(deckId);
  if (!t && isReconnectable(deckId)) { t = localTransport(deckId); setSession(deckId, t); }
  return t;
}

export function createPresentBar(root, deckId) {
  const transport = resolveTransport(deckId);
  if (!transport) { root.replaceChildren(); return { destroy() {}, active: false }; }

  let state = null, connected = false, lostTimer = null, unsubStore = null, broadcastTimer = null;
  root.innerHTML = '';
  const dot = h('span', { className: 'present-dot' });
  const label = h('span', { className: 'present-label', textContent: 'Connecting…' });
  const prev = h('button', { type: 'button', className: 'btn icon small', textContent: '◀', title: 'Previous screen' });
  const play = h('button', { type: 'button', className: 'btn small', hidden: true });
  const next = h('button', { type: 'button', className: 'btn icon small', textContent: '▶', title: 'Next screen' });
  const black = h('button', { type: 'button', className: 'btn small', textContent: 'Black' });
  const tTimer = h('button', { type: 'button', className: 'btn small', hidden: true });
  const tReset = h('button', { type: 'button', className: 'btn small', hidden: true, textContent: 'Reset' });
  const stop = h('button', { type: 'button', className: 'btn small danger', textContent: 'Stop presenting' });
  const bar = h('div', { className: 'present-bar' }, dot, label, prev, play, next, black, tTimer, tReset, h('span', { className: 'spacer' }), stop);
  root.append(bar);

  function draw() {
    bar.classList.toggle('connected', connected);
    label.textContent = !connected ? 'Reconnecting…' : state ? `Live — ${state.index + 1}/${state.count} ${state.name}` : 'Connecting…';
    play.hidden = !state || state.mode === 'manual';
    if (state) { play.textContent = state.paused ? '▶ Play' : '❙❙ Pause'; }
    black.classList.toggle('on', !!(state && state.blanked));
    tTimer.hidden = !(state && state.hasTimer);
    tReset.hidden = !(state && (state.hasTimer || state.hasScore));
    if (state) tTimer.textContent = state.timerRunning ? 'Pause timer' : 'Start timer';
  }
  draw();

  transport.onMessage((msg) => {
    if (msg.t === 'state') { connected = true; state = msg; clearTimeout(lostTimer); draw(); }
    else if (msg.t === 'bye') { connected = false; state = null; draw(); }
    else if (msg.t === 'hello') { connected = true; clearTimeout(lostTimer); draw(); }
  });
  transport.send({ t: 'hello' });
  // No reply yet after a bit: the show window probably closed since we last knew.
  lostTimer = setTimeout(() => { if (!connected) draw(); }, 1200);

  prev.onclick = () => transport.send({ t: 'goto', index: Math.max(0, (state ? state.index : 0) - 1) });
  next.onclick = () => transport.send({ t: 'goto', index: (state ? state.index : 0) + 1 });
  play.onclick = () => transport.send({ t: state && state.paused ? 'play' : 'pause' });
  black.onclick = () => transport.send({ t: 'black', on: !(state && state.blanked) });
  tTimer.onclick = () => transport.send({ t: 'timerToggle' });
  tReset.onclick = () => transport.send({ t: 'timerReset' });
  stop.onclick = () => {
    transport.send({ t: 'close' });
    transport.close();
    clearSession(deckId);
    clearReconnectable(deckId);
    root.replaceChildren();
  };

  // Live edits: push the deck to Show a short moment after each change, same cadence as autosave.
  unsubStore = store.subscribe(() => {
    clearTimeout(broadcastTimer);
    broadcastTimer = setTimeout(() => {
      const st = store.getState();
      if (st.deck && st.deck.id === deckId) transport.send({ t: 'deck', deck: st.deck });
    }, 500);
  });

  return {
    active: true,
    destroy() { clearTimeout(lostTimer); clearTimeout(broadcastTimer); if (unsubStore) unsubStore(); },
  };
}
