// IndexedDB wrapper (decks + assets) and localStorage settings.
const DB_NAME = 'bbc110';
const DB_VERSION = 1;
let dbPromise;

function open() {
  return (dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('decks', { keyPath: 'id' });
      d.createObjectStore('assets', { keyPath: 'id' });
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
  run('decks', 'readonly', (s) => s.getAll()).then((a) => a.sort((x, y) => y.updatedAt - x.updatedAt));

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
