// Built-in templates (assets/templates/templates.json) and conversion into a fresh, fully editable deck.
import { newDeck, newScreen, newElement, nextEvening } from './model.js';

let cache = null;

// Resolves to [{ id, name, category, description, deck }]. The file is precached, so this works offline.
export async function loadTemplates() {
  if (!cache) {
    const res = await fetch(new URL('../assets/templates/templates.json', import.meta.url));
    if (!res.ok) throw new Error('Templates unavailable');
    cache = await res.json();
  }
  return cache;
}

export function blankDeck() { return newDeck('Untitled', [newScreen('Screen 1')]); }

// Builds one fully-editable screen (fresh ids) from a template record's screen at `index`. "@evening" becomes the next 6:30 PM.
function buildScreen(tpl, index) {
  const t = JSON.parse(JSON.stringify(tpl).replaceAll('@evening', nextEvening()));
  const s = t.deck.screens[index];
  const extra = {};
  for (const k of ['durationSec', 'transition', 'stagger', 'theme']) if (s[k] != null) extra[k] = s[k];
  if (s.background) extra.background = { overlay: null, ...s.background };
  const screen = newScreen(s.name, extra);
  screen.elements = (s.elements || []).map((e, i) => {
    const base = newElement(e.type);
    return { ...base, ...e, id: base.id, z: e.z ?? i + 1, style: { ...e.style }, content: { ...e.content }, animation: { ...base.animation, ...e.animation } };
  });
  return screen;
}

// Template element records are partial; fill in ids and defaults.
export function instantiate(tpl) {
  const d = tpl.deck;
  const screens = d.screens.map((s, i) => buildScreen(tpl, i));
  const deck = newDeck(tpl.name, screens);
  deck.theme = d.theme || deck.theme;
  deck.mode = d.mode || 'manual';
  deck.aspect = d.aspect || '16:9';
  deck.defaultDurationSec = d.defaultDurationSec || 10;
  if (d.transition) deck.transition = d.transition;
  return deck;
}

// Inserts one screen template's output into any existing deck.
export function instantiateScreen(tpl, index) { return buildScreen(tpl, index); }

// A single-screen preview deck, styled like the source template, for thumbnailing one screen.
export function previewDeckForScreen(tpl, index) {
  const deck = newDeck(tpl.name, [buildScreen(tpl, index)]);
  deck.theme = tpl.deck.theme || deck.theme;
  deck.aspect = tpl.deck.aspect || '16:9';
  return deck;
}

// Flattened [{ label, category, tpl, index }] across every built-in template's screens, for an "add a screen" picker.
export async function loadScreenTemplates() {
  const templates = await loadTemplates();
  const list = [];
  templates.forEach((t) => {
    t.deck.screens.forEach((s, i) => {
      list.push({ label: t.deck.screens.length > 1 ? `${t.name} — ${s.name}` : t.name, category: t.category, tpl: t, index: i });
    });
  });
  return list;
}
