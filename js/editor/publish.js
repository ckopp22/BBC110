// Publish dialog: pre-flight warnings, then a choice of where the screen goes.
import { runPreflight } from '../preflight.js';
import { localTransport, castSupported, startCast } from '../sync.js';
import { setSession, markReconnectable } from '../presence.js';
import * as store from '../store.js';

const h = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
const showUrl = (id, present) => `show.html?id=${encodeURIComponent(id)}${present ? '&present=1' : ''}`;
const CAST_URL = 'show.html';

export function openPublishDialog(deck, { onPresenting } = {}) {
  const dlg = h('dialog', { className: 'dialog publish-dialog' });
  const title = h('h2', { textContent: 'Publish' });
  const issues = runPreflight(deck);
  const pre = h('div', { className: 'preflight' });
  if (issues.length) {
    pre.append(h('p', { className: 'pf-title', textContent: `${issues.length} thing${issues.length === 1 ? '' : 's'} worth a look:` }),
      h('ul', {}, ...issues.map((it) => h('li', { textContent: it.message }))));
  } else {
    pre.append(h('p', { className: 'pf-ok', textContent: '✓ Looks good — no issues found.' }));
  }

  const targets = h('div', { className: 'targets' });
  const status = h('p', { className: 'publish-status', hidden: true });
  const setStatus = (msg) => { status.textContent = msg; status.hidden = !msg; };

  function target(title2, desc, onclick) {
    const btn = h('button', { type: 'button', className: 'btn btn-primary target-btn' }, h('b', { textContent: title2 }), h('span', { textContent: desc }));
    btn.onclick = async () => { btn.disabled = true; setStatus(''); try { await onclick(); } catch (err) { setStatus(err && err.message ? err.message : 'That didn’t work.'); } btn.disabled = false; };
    targets.append(btn);
  }

  const finishLocal = (win) => {
    markReconnectable(deck.id);
    setSession(deck.id, localTransport(deck.id));
    if (onPresenting) onPresenting();
    dlg.close();
  };

  target('This screen', 'Go fullscreen right here — use this when you’re mirroring or casting from the OS.', async () => {
    await store.flush();
    location.href = showUrl(deck.id, false);
  });

  if (typeof window.getScreenDetails === 'function') {
    target('Second display', 'Open Show full-size on a connected TV or monitor, and keep editing here.', async () => {
      await store.flush();
      const details = await window.getScreenDetails();
      const others = details.screens.filter((s) => s !== details.currentScreen);
      if (!others.length) { setStatus('No second display detected. Connect a TV or monitor, or use "Open Show window" instead.'); return; }
      const s = others[0];
      const win = window.open(showUrl(deck.id, true), 'bbc110-show', `left=${s.left},top=${s.top},width=${s.width},height=${s.height},popup=1`);
      if (!win) { setStatus('The popup was blocked. Allow popups for this site and try again.'); return; }
      finishLocal(win);
    });
  }

  target('Open Show window', 'Opens in a new window — drag it to your TV, then press F for fullscreen.', async () => {
    await store.flush();
    const win = window.open(showUrl(deck.id, true), 'bbc110-show', 'width=1280,height=720,popup=1');
    if (!win) { setStatus('The popup was blocked. Allow popups for this site and try again.'); return; }
    finishLocal(win);
  });

  if (castSupported()) {
    target('Cast to display', 'Send it to a Chromecast or other cast-ready display on your network.', async () => {
      await store.flush();
      const transport = await startCast(CAST_URL);
      transport.send({ t: 'deck', deck: store.getState().deck });
      setSession(deck.id, transport);
      if (onPresenting) onPresenting();
      dlg.close();
    });
  }

  const cancel = h('button', { type: 'button', className: 'btn', textContent: 'Cancel' });
  cancel.onclick = () => dlg.close();

  dlg.append(title, pre, h('h3', { className: 'targets-h', textContent: 'Show it on' }), targets, status, h('div', { className: 'dialog-actions' }, cancel));
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
}
