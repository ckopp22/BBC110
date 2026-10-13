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

// Template element records are partial; fill in ids and defaults. "@evening" becomes the next 6:30 PM.
export function instantiate(tpl) {
  const t = JSON.parse(JSON.stringify(tpl).replaceAll('@evening', nextEvening()));
  const d = t.deck;
  const screens = d.screens.map((s) => {
    const extra = {};
    for (const k of ['durationSec', 'transition', 'stagger', 'theme']) if (s[k] != null) extra[k] = s[k];
    if (s.background) extra.background = { overlay: null, ...s.background };
    const screen = newScreen(s.name, extra);
    screen.elements = (s.elements || []).map((e, i) => {
      const base = newElement(e.type);
      return { ...base, ...e, id: base.id, z: e.z ?? i + 1, style: { ...e.style }, content: { ...e.content }, animation: { ...base.animation, ...e.animation } };
    });
    return screen;
  });
  const deck = newDeck(t.name, screens);
  deck.theme = d.theme || deck.theme;
  deck.mode = d.mode || 'manual';
  deck.aspect = d.aspect || '16:9';
  deck.defaultDurationSec = d.defaultDurationSec || 10;
  if (d.transition) deck.transition = d.transition;
  return deck;
}
