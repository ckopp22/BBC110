// In-memory registry of active presenting sessions (deckId -> transport), shared by the Publish dialog
// and the editor's presenting bar. Cast sessions live only as long as this tab (the Presentation
// connection can't be recreated after a reload); local window sessions can reconnect via sessionStorage
// since the BroadcastChannel is still there to talk to.
const sessions = new Map();

export function setSession(deckId, transport) { sessions.set(deckId, transport); }
export function getSession(deckId) { return sessions.get(deckId) || null; }
export function clearSession(deckId) { sessions.delete(deckId); }

const KEY = (id) => `bbc110.present.${id}`;
export function markReconnectable(deckId) { try { sessionStorage.setItem(KEY(deckId), '1'); } catch { /* storage blocked */ } }
export function clearReconnectable(deckId) { try { sessionStorage.removeItem(KEY(deckId)); } catch { /* storage blocked */ } }
export function isReconnectable(deckId) { try { return sessionStorage.getItem(KEY(deckId)) === '1'; } catch { return false; } }
