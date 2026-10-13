// Single source of truth for the library and the open deck. Actions persist via db.js.
import * as db from './db.js';
import { newDeck, newScreen, sampleDeck } from './model.js';

const state = { library: [], deck: null, screenIndex: 0 };
const listeners = new Set();
let saveTimer = null;

export const getState = () => state;
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => listeners.forEach((fn) => fn(state));

export async function loadLibrary() {
  state.library = await db.listDecks();
  emit();
}

export async function createDeck(kind = 'blank') {
  const deck = kind === 'sample' ? sampleDeck() : newDeck('Untitled', [newScreen('Screen 1')]);
  await db.putDeck(deck);
  return deck.id;
}

export async function openDeck(id) {
  await flush();
  const deck = await db.getDeck(id);
  state.deck = deck || null;
  state.screenIndex = 0;
  emit();
  return !!deck;
}

export function closeDeck() { state.deck = null; emit(); }

export async function removeDeck(id) {
  await db.deleteDeck(id);
  await loadLibrary();
}

export function setScreenIndex(i) {
  if (!state.deck || i < 0 || i >= state.deck.screens.length) return;
  state.screenIndex = i;
  emit();
}

// Mutates the open deck, then autosaves shortly after the last change.
export function updateDeck(mutator) {
  if (!state.deck) return;
  mutator(state.deck);
  state.deck.updatedAt = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 400);
  emit();
}

export async function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (state.deck) await db.putDeck(state.deck);
}

// Don't lose the last edit if the tab is hidden or closed during the debounce.
addEventListener('pagehide', () => { if (saveTimer) flush(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveTimer) flush(); });
