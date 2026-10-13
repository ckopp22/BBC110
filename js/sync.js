// Transports that carry the same small JSON protocol between a presenter (the Editor) and Show:
//   - localTransport: BroadcastChannel, for a second window on this device (Window Management or a plain popup).
//   - castTransport / receiverTransport: the Presentation API, for a real cast target (e.g. Chromecast).
// Both expose { send(msg), onMessage(fn), close() }, so show.js and the editor's presenter bar
// don't need to know which one they're talking over.
//
// Protocol (presenter -> show): hello | deck {deck} | goto {index} | pause | play | black {on} | timerToggle | timerReset | close
// Protocol (show -> presenter): hello | state {index,count,name,mode,paused,blanked,hasTimer,timerRunning,hasScore} | bye

export function localTransport(deckId) {
  const bc = new BroadcastChannel(`bbc110-live-${deckId}`);
  let onMsg = null;
  bc.onmessage = (e) => { if (onMsg) onMsg(e.data); };
  return {
    kind: 'window',
    send(msg) { bc.postMessage(msg); },
    onMessage(fn) { onMsg = fn; },
    close() { bc.close(); },
  };
}

function connectionTransport(connection, kind) {
  let onMsg = null;
  connection.onmessage = (e) => { try { if (onMsg) onMsg(JSON.parse(e.data)); } catch { /* malformed */ } };
  return {
    kind,
    connection,
    send(msg) { try { connection.send(JSON.stringify(msg)); } catch { /* connection gone */ } },
    onMessage(fn) { onMsg = fn; },
    close() { try { connection.close(); } catch { /* already closed */ } },
  };
}

export const castSupported = () => typeof PresentationRequest === 'function' && isSecureContext;

// Starts a cast session (must be called directly from a user gesture handler). Throws if the user
// cancels the device picker or no device is available.
export async function startCast(url) {
  const request = new PresentationRequest([url]);
  const connection = await request.start();
  return connectionTransport(connection, 'cast');
}

// For show.html loaded as a Presentation API receiver (no ?id=): resolves with a transport once a
// controller connects, or null if this page wasn't actually launched as a receiver.
export async function receiverTransport(timeoutMs = 15000) {
  if (!(navigator.presentation && navigator.presentation.receiver)) return null;
  const list = await navigator.presentation.receiver.connectionList;
  const first = list.connections.find((c) => c.state === 'connected');
  if (first) return connectionTransport(first, 'cast');
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), timeoutMs);
    list.onconnectionavailable = (e) => { clearTimeout(t); resolve(connectionTransport(e.connection, 'cast')); };
  });
}
