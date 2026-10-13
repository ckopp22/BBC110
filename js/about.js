// About / privacy / legal view (#/about).
const h = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };

export async function renderAbout(root, actions) {
  actions.replaceChildren();
  root.replaceChildren();

  const wrap = h('section', { className: 'library about' },
    h('a', { className: 'btn', href: '#/', textContent: '← My Screens' }),
    h('h1', { textContent: 'About BBC110' }),
    h('p', { className: 'sub', textContent: 'A screen-presentation tool by KPP Studio.' }),
    h('div', { className: 'about-body' },
      h('h2', { textContent: 'About' }),
      h('p', {}, 'BBC110 lets you design a screen and publish it to a TV or projector in minutes. It runs entirely in your browser: there is no server, no account, and no tracking.'),
      h('h2', { textContent: 'Privacy' }),
      h('p', {}, 'Your screens, images, and settings are stored only on this device, using your browser’s local storage (IndexedDB). Nothing is uploaded anywhere. Clearing your browser’s site data for BBC110 will delete that data permanently, so use Export to back up anything you want to keep.'),
      h('h2', { textContent: 'Legal' }),
      h('p', {}, 'BBC110 is provided as-is, with no warranty of any kind. You are responsible for any content you create or display with it.'),
      h('h2', { textContent: 'Version' }),
      h('p', { id: 'aboutVersion' }, 'Checking…')));

  root.append(wrap);
  try {
    const res = await fetch('sw.js', { cache: 'no-store' });
    const text = await res.text();
    const m = text.match(/CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
    wrap.querySelector('#aboutVersion').textContent = m ? m[1] : 'Unknown';
  } catch {
    wrap.querySelector('#aboutVersion').textContent = 'Unknown';
  }
}
