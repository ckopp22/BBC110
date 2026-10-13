// Import: reads a .bbc110.json project file or a full-library backup, migrates it if needed, and
// saves it under new ids so importing never collides with or overwrites what's already here.
import { SCHEMA_VERSION, uid } from './model.js';
import { saveNewDeck } from './store.js';

// Applied in order to bring an old deck up to the current schema. Empty for v1 since this is the
// first shipped schema; a future bump adds `1: (deck) => { ...; return deck; }` here.
const MIGRATIONS = {};

function migrateDeck(deck, fromVersion) {
  let d = deck, v = fromVersion || 1;
  if (v > SCHEMA_VERSION) throw new Error(`This file is from a newer version of BBC110 (schema ${v}) and can't be opened here.`);
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`This file is from a newer version of BBC110 (schema ${fromVersion}) and can't be opened here.`);
    d = step(d);
    v++;
  }
  return d;
}

// Reassigns every id in a deck (screens, elements) so an imported copy never collides with an
// existing one, the same way templates and "Duplicate" do.
function freshIds(deck) {
  const d = JSON.parse(JSON.stringify(deck));
  d.id = uid();
  for (const s of d.screens) {
    s.id = uid();
    for (const e of s.elements) e.id = uid();
  }
  return d;
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read that file.'));
    r.readAsText(file);
  });
}

// Returns { kind: 'deck', id } or { kind: 'library', count } on success; throws with a message on failure.
export async function importFile(file) {
  if (!/\.(bbc110\.json|json)$/i.test(file.name)) throw new Error('That doesn’t look like a BBC110 project file (.bbc110.json).');
  let data;
  try { data = JSON.parse(await readFile(file)); } catch { throw new Error('That file isn’t valid JSON.'); }
  if (data.app !== 'BBC110') throw new Error('That file wasn’t exported from BBC110.');

  if (Array.isArray(data.decks)) {
    let count = 0;
    for (const raw of data.decks) {
      try { await saveNewDeck(freshIds(migrateDeck(raw, data.schemaVersion))); count++; } catch { /* skip an unreadable deck, keep going */ }
    }
    if (!count) throw new Error('No readable screens were found in that backup.');
    return { kind: 'library', count };
  }
  if (data.deck) {
    const deck = freshIds(migrateDeck(data.deck, data.schemaVersion));
    const id = await saveNewDeck(deck);
    return { kind: 'deck', id };
  }
  throw new Error('That file doesn’t contain any BBC110 screens.');
}

// Wires a file input + drag-and-drop onto a drop zone. onDone(result) / onError(message).
export function wireImport({ dropZone, fileInput, onStart, onDone, onError }) {
  const run = async (file) => {
    if (!file) return;
    onStart?.();
    try { onDone(await importFile(file)); } catch (err) { onError(err.message || 'That file could not be imported.'); }
  };
  if (fileInput) fileInput.onchange = () => { run(fileInput.files[0]); fileInput.value = ''; };
  if (dropZone) {
    let depth = 0;
    dropZone.addEventListener('dragover', (e) => { if ([...e.dataTransfer.items].some((i) => i.kind === 'file')) e.preventDefault(); });
    dropZone.addEventListener('dragenter', (e) => { depth++; dropZone.classList.add('drop-hover'); e.preventDefault(); });
    dropZone.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; dropZone.classList.remove('drop-hover'); } });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      depth = 0;
      dropZone.classList.remove('drop-hover');
      run(e.dataTransfer.files[0]);
    });
  }
}

// File Handling API: if the app was launched to open a .bbc110.json (OS "Open with"), import it.
export function wireLaunchQueue(onDone, onError) {
  if (!('launchQueue' in window)) return;
  window.launchQueue.setConsumer(async (params) => {
    const handle = params.files && params.files[0];
    if (!handle) return;
    try { onDone(await importFile(await handle.getFile())); } catch (err) { onError?.(err.message); }
  });
}
