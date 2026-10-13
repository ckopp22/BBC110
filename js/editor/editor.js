// Editor view. Phase 2: canvas + screens list on the shared renderer. Editing tools arrive in Phase 3.
import { createStage } from '../renderer.js';
import * as store from '../store.js';

let unsubscribe = null;

export async function renderEditor(root, actions, id) {
  unsubscribe?.();
  unsubscribe = null;
  root.replaceChildren();
  actions.replaceChildren();

  const found = await store.openDeck(id);
  if (!found) {
    root.innerHTML = '<section class="library"><h1>Screen not found</h1><p class="sub">It may have been deleted.</p><a class="btn btn-primary" href="#/">Back to My Screens</a></section>';
    return;
  }
  const deck = store.getState().deck;

  const back = Object.assign(document.createElement('a'), { className: 'btn', href: '#/', textContent: 'My Screens' });
  const name = Object.assign(document.createElement('input'), { className: 'name-input', value: deck.name });
  name.setAttribute('aria-label', 'Deck name');
  name.oninput = () => store.updateDeck((d) => { d.name = name.value.trim() || 'Untitled'; });
  const publish = Object.assign(document.createElement('a'), {
    className: 'btn btn-primary', textContent: 'Publish',
    href: `show.html?id=${encodeURIComponent(deck.id)}`,
  });
  publish.onclick = () => store.flush();
  actions.append(back, name, publish);

  root.innerHTML = `
    <div class="editor">
      <aside class="panel left"><h2>Screens</h2><div id="screens"></div></aside>
      <div class="canvas-wrap"><div id="canvas"></div></div>
      <aside class="panel right"><h2>Inspector</h2><div id="inspector"></div></aside>
    </div>`;
  const stage = createStage(root.querySelector('#canvas'), deck);
  const list = root.querySelector('#screens');
  const inspector = root.querySelector('#inspector');

  function draw() {
    const { deck, screenIndex } = store.getState();
    stage.setScreen(screenIndex);
    list.replaceChildren(...deck.screens.map((s, i) => {
      const b = document.createElement('button');
      b.className = 'screen-item';
      b.setAttribute('aria-current', i === screenIndex);
      b.onclick = () => store.setScreenIndex(i);
      const thumb = document.createElement('div');
      const label = document.createElement('span');
      label.textContent = `${i + 1}. ${s.name}`;
      b.append(thumb, label);
      createStage(thumb, { ...deck }).setScreen(i);
      return b;
    }));
    const s = deck.screens[screenIndex];
    inspector.innerHTML = `
      <p class="kv"><b>${s.name}</b></p>
      <p class="kv">${s.elements.length} element${s.elements.length === 1 ? '' : 's'}</p>
      <p class="kv">Canvas ${deck.aspect}</p>
      <p class="kv">Editing tools arrive in Phase 3.</p>`;
  }
  draw();
  // Re-render on screen change only; name edits don't need a canvas redraw.
  let lastIndex = store.getState().screenIndex;
  unsubscribe = store.subscribe((st) => {
    if (st.screenIndex !== lastIndex) { lastIndex = st.screenIndex; draw(); }
  });
}
