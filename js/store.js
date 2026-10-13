// Single source of truth for the library and the open deck. Actions record history and autosave via db.js.
import * as db from './db.js';
import { createHistory } from './history.js';
import { ASPECTS, newDeck, newScreen, sampleDeck, defaultElement, uid } from './model.js';

// rev: bumps on every change. structRev: bumps when the shape of the deck changes (add/remove/undo...).
const state = { library: [], trash: [], deck: null, screenIndex: 0, selectedId: null, rev: 0, structRev: 0, dirty: false };
const listeners = new Set();
const history = createHistory();
let saveTimer = null;
const lastSnapshotAt = {}; // deckId -> ms, throttles automatic version snapshots
const SNAPSHOT_INTERVAL_MS = 2 * 60 * 1000;

export const getState = () => state;
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => listeners.forEach((fn) => fn(state));

const currentScreen = () => state.deck && state.deck.screens[state.screenIndex];
const findElement = (id) => { const s = currentScreen(); return s ? s.elements.find((e) => e.id === id) : undefined; };
export const getSelected = () => findElement(state.selectedId) || null;
export const canUndo = () => history.canUndo();
export const canRedo = () => history.canRedo();
export const endGroup = () => history.endGroup();

export async function loadLibrary() {
  state.library = await db.listDecks();
  emit();
}

export async function loadTrash() {
  state.trash = await db.listTrash();
  emit();
}

export async function createDeck(kind = 'blank') {
  const deck = kind === 'sample' ? sampleDeck() : newDeck('Untitled', [newScreen('Screen 1')]);
  await db.putDeck(deck);
  return deck.id;
}

// Saves a deck built elsewhere (e.g. from a template or an import) and returns its id.
export async function saveNewDeck(deck) {
  await db.putDeck(deck);
  return deck.id;
}

export async function duplicateDeck(id) {
  const src = await db.getDeck(id);
  if (!src) return null;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid();
  copy.name += ' copy';
  copy.createdAt = copy.updatedAt = Date.now();
  delete copy.trashedAt;
  await db.putDeck(copy);
  await loadLibrary();
  return copy.id;
}

export async function openDeck(id) {
  await flush();
  const deck = await db.getDeck(id);
  state.deck = deck || null;
  state.screenIndex = 0;
  state.selectedId = null;
  state.dirty = false;
  history.clear();
  if (deck) {
    // Mark the start of this editing session so it can be restored later.
    db.putSnapshot({ deckId: deck.id, at: Date.now(), deck: JSON.parse(JSON.stringify(deck)) }).then(() => db.pruneSnapshots(deck.id));
    lastSnapshotAt[deck.id] = Date.now();
  }
  emit();
  return !!deck;
}

// Soft delete: moves the deck to Trash, where it's recoverable for 30 days.
export async function removeDeck(id) {
  await db.trashDeck(id);
  await loadLibrary();
}

export async function restoreFromTrash(id) {
  await db.restoreDeck(id);
  await loadTrash();
  await loadLibrary();
}

// Permanently deletes a trashed deck and its version history.
export async function purgeForever(id) {
  await db.deleteDeck(id);
  await db.deleteSnapshotsForDeck(id);
  await loadTrash();
}

// ---- version history ----
export const listVersions = (deckId) => db.listSnapshots(deckId);

export async function restoreVersion(snapshotDeck) {
  if (!state.deck) return;
  if (history.begin()) history.push(JSON.stringify(state.deck));
  // Snapshot the pre-restore state immediately (bypassing the usual throttle), so restoring is
  // itself always recoverable from Version history, not just via in-session undo.
  const now = Date.now();
  lastSnapshotAt[state.deck.id] = now;
  await db.putSnapshot({ deckId: state.deck.id, at: now, deck: JSON.parse(JSON.stringify(state.deck)) });
  await db.pruneSnapshots(state.deck.id);
  const keepId = state.deck.id, keepCreated = state.deck.createdAt;
  state.deck = { ...JSON.parse(JSON.stringify(snapshotDeck)), id: keepId, createdAt: keepCreated, updatedAt: Date.now() };
  state.screenIndex = Math.min(state.screenIndex, state.deck.screens.length - 1);
  state.selectedId = null;
  state.rev++; state.structRev++; state.dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
  emit();
}

// Mutates the open deck, records an undo step, and autosaves shortly after the last change.
export function updateDeck(mutator, key) {
  if (!state.deck) return;
  if (history.begin(key)) history.push(JSON.stringify(state.deck));
  mutator(state.deck);
  state.deck.updatedAt = Date.now();
  state.rev++;
  state.dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
  emit();
}

export async function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (state.deck && state.dirty) {
    state.dirty = false;
    const deck = state.deck;
    await db.putDeck(deck);
    const now = Date.now();
    if (now - (lastSnapshotAt[deck.id] || 0) > SNAPSHOT_INTERVAL_MS) {
      lastSnapshotAt[deck.id] = now;
      await db.putSnapshot({ deckId: deck.id, at: now, deck: JSON.parse(JSON.stringify(deck)) });
      await db.pruneSnapshots(deck.id);
    }
    emit();
  }
}

addEventListener('pagehide', () => { if (saveTimer) flush(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveTimer) flush(); });

function restore(json) {
  state.deck = JSON.parse(json);
  state.screenIndex = Math.min(state.screenIndex, state.deck.screens.length - 1);
  if (!findElement(state.selectedId)) state.selectedId = null;
  state.rev++; state.structRev++; state.dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
  emit();
}
export function undo() { const s = history.undo(JSON.stringify(state.deck)); if (s != null) restore(s); }
export function redo() { const s = history.redo(JSON.stringify(state.deck)); if (s != null) restore(s); }

// ---- selection and screens ----
export function select(id) {
  if (state.selectedId === id) return;
  state.selectedId = id;
  emit();
}

export function setScreenIndex(i) {
  if (!state.deck || i < 0 || i >= state.deck.screens.length) return;
  state.screenIndex = i;
  state.selectedId = null;
  state.structRev++;
  emit();
}

export function setScreenProps(patch, key) {
  updateDeck((d) => Object.assign(d.screens[state.screenIndex], patch), key);
}

export function addScreen() {
  updateDeck((d) => {
    d.screens.splice(state.screenIndex + 1, 0, newScreen(`Screen ${d.screens.length + 1}`, { durationSec: d.defaultDurationSec }));
  });
  setScreenIndex(state.screenIndex + 1);
}

export function duplicateScreen() {
  updateDeck((d) => {
    const copy = JSON.parse(JSON.stringify(d.screens[state.screenIndex]));
    copy.id = uid();
    copy.name += ' copy';
    copy.elements.forEach((e) => { e.id = uid(); });
    d.screens.splice(state.screenIndex + 1, 0, copy);
  });
  setScreenIndex(state.screenIndex + 1);
}

export function removeScreen() {
  if (state.deck.screens.length < 2) return;
  updateDeck((d) => d.screens.splice(state.screenIndex, 1));
  state.screenIndex = Math.min(state.screenIndex, state.deck.screens.length - 1);
  state.selectedId = null;
  state.structRev++;
  emit();
}

export function moveScreen(dir) {
  const i = state.screenIndex, j = i + dir;
  if (j < 0 || j >= state.deck.screens.length) return;
  updateDeck((d) => { const [s] = d.screens.splice(i, 1); d.screens.splice(j, 0, s); });
  state.screenIndex = j;
  state.structRev++;
  emit();
}

// ---- elements ----
const maxZ = (s) => s.elements.reduce((m, e) => Math.max(m, e.z), 0);

export function addElement(kind, extra = {}) {
  let id;
  updateDeck((d) => {
    const s = d.screens[state.screenIndex];
    const [W, H] = ASPECTS[d.aspect] || ASPECTS['16:9'];
    const el = defaultElement(kind, extra);
    if (kind === 'banner' || kind === 'ticker') { el.w = W; el.x = 0; el.y = H - el.h; }
    else { el.x = Math.round((W - el.w) / 2); el.y = Math.round((H - el.h) / 2); }
    el.z = maxZ(s) + 1;
    s.elements.push(el);
    id = el.id;
  });
  state.selectedId = id;
  state.structRev++;
  emit();
}

// patch may carry top-level props plus style/content/animation objects, which are merged.
export function updateElement(id, patch, key) {
  updateDeck(() => {
    const el = findElement(id);
    if (!el) return;
    for (const k in patch) {
      if (k === 'style' || k === 'content' || k === 'animation') Object.assign(el[k], patch[k]);
      else el[k] = patch[k];
    }
  }, key);
}

export function removeElement(id) {
  updateDeck(() => {
    const s = currentScreen();
    s.elements = s.elements.filter((e) => e.id !== id);
  });
  if (state.selectedId === id) state.selectedId = null;
  state.structRev++;
  emit();
}

export function duplicateElement(id) {
  let nid;
  updateDeck(() => {
    const s = currentScreen();
    const src = findElement(id);
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = nid = uid();
    copy.x += 40; copy.y += 40;
    copy.z = maxZ(s) + 1;
    s.elements.push(copy);
  });
  if (nid) state.selectedId = nid;
  state.structRev++;
  emit();
}

// how: front | back | up | down
export function reorderElement(id, how) {
  updateDeck(() => {
    const list = [...currentScreen().elements].sort((a, b) => a.z - b.z);
    const i = list.findIndex((e) => e.id === id);
    if (i < 0) return;
    const [el] = list.splice(i, 1);
    const to = { front: list.length, back: 0, up: Math.min(i + 1, list.length), down: Math.max(i - 1, 0) }[how];
    list.splice(to, 0, el);
    list.forEach((e, k) => { e.z = k + 1; });
  });
  state.structRev++;
  emit();
}
