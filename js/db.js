// IndexedDB wrapper (decks, trash, version snapshots, assets) and localStorage settings.
const DB_NAME = 'bbc110';
const DB_VERSION = 2;
const TRASH_DAYS = 30;
const SNAPSHOT_LIMIT = 10;
let dbPromise;

function open() {
  return (dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('decks')) d.createObjectStore('decks', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('assets')) d.createObjectStore('assets', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('snapshots')) {
        d.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true }).createIndex('deckId', 'deckId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  }));
}

function run(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const getDeck = (id) => run('decks', 'readonly', (s) => s.get(id));
export const putDeck = (deck) => run('decks', 'readwrite', (s) => s.put(deck));
export const deleteDeck = (id) => run('decks', 'readwrite', (s) => s.delete(id));

export const listDecks = () =>
  run('decks', 'readonly', (s) => s.getAll()).then((a) => a.filter((d) => !d.trashedAt).sort((x, y) => y.updatedAt - x.updatedAt));
export const listTrash = () =>
  run('decks', 'readonly', (s) => s.getAll()).then((a) => a.filter((d) => d.trashedAt).sort((x, y) => y.trashedAt - x.trashedAt));

export async function trashDeck(id) {
  const d = await getDeck(id);
  if (!d) return;
  d.trashedAt = Date.now();
  await putDeck(d);
}
export async function restoreDeck(id) {
  const d = await getDeck(id);
  if (!d) return;
  delete d.trashedAt;
  await putDeck(d);
}
// Permanently removes decks that have been in the trash longer than TRASH_DAYS. Call on app start.
export async function purgeOldTrash() {
  const cutoff = Date.now() - TRASH_DAYS * 86400000;
  const old = (await listTrash()).filter((d) => d.trashedAt < cutoff);
  for (const d of old) await deleteDeck(d.id);
  return old.length;
}
export const TRASH_RETENTION_DAYS = TRASH_DAYS;

// ---- version snapshots ----
export const putSnapshot = (snap) => run('snapshots', 'readwrite', (s) => s.add(snap));
export const deleteSnapshot = (id) => run('snapshots', 'readwrite', (s) => s.delete(id));
export const listSnapshots = (deckId) =>
  run('snapshots', 'readonly', (s) => s.index('deckId').getAll(deckId)).then((a) => a.sort((x, y) => y.at - x.at));
export async function deleteSnapshotsForDeck(deckId) {
  const list = await listSnapshots(deckId);
  for (const s of list) await deleteSnapshot(s.id);
}
// Keeps only the newest `limit` snapshots for a deck.
export async function pruneSnapshots(deckId, limit = SNAPSHOT_LIMIT) {
  const list = await listSnapshots(deckId);
  for (const s of list.slice(limit)) await deleteSnapshot(s.id);
}
export const SNAPSHOT_CAP = SNAPSHOT_LIMIT;

export const getAsset = (id) => run('assets', 'readonly', (s) => s.get(id));
export const putAsset = (asset) => run('assets', 'readwrite', (s) => s.put(asset));

export async function requestPersistence() {
  try { return await navigator.storage?.persist?.(); } catch { return false; }
}

export function getSetting(key, fallback) {
  try {
    const v = localStorage.getItem('bbc110.' + key);
    return v === null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
export function setSetting(key, value) {
  try { localStorage.setItem('bbc110.' + key, JSON.stringify(value)); } catch { /* storage blocked */ }
}
