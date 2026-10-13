// Export dialog: project file, standalone HTML, PNG image, and print/PDF. Shared by the My Screens
// card menu and the editor's top bar.
import * as exp from '../export.js';

const h = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };

export function openExportDialog(deck, { screenIndex = 0 } = {}) {
  const dlg = h('dialog', { className: 'dialog export-dialog' });
  const status = h('p', { className: 'publish-status', hidden: true });
  const setStatus = (msg, ok) => { status.textContent = msg; status.hidden = !msg; status.classList.toggle('ok', !!ok); };

  function row(title, desc, { action, shareLabel } = {}) {
    const dl = h('button', { type: 'button', className: 'btn btn-primary', textContent: 'Download' });
    const sh = exp.canShareFiles() ? h('button', { type: 'button', className: 'btn', textContent: 'Share' }) : null;
    const run = async (share) => {
      dl.disabled = true; if (sh) sh.disabled = true;
      setStatus('Working…');
      try {
        const { blob, filename } = await action((msg) => setStatus(msg));
        if (share) { const r = await exp.shareOrDownload(blob, filename, deck.name); setStatus(r === 'shared' ? '' : r === 'cancelled' ? '' : `Saved ${filename}`, true); }
        else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10000); setStatus(`Saved ${filename}`, true); }
      } catch (err) { setStatus(err.message || 'That didn’t work.'); }
      dl.disabled = false; if (sh) sh.disabled = false;
    };
    dl.onclick = () => run(false);
    if (sh) sh.onclick = () => run(true);
    const r = h('div', { className: 'export-row' }, h('div', { className: 'export-row-text' }, h('b', { textContent: title }), h('span', { textContent: desc })), h('div', { className: 'export-row-btns' }, dl, ...(sh ? [sh] : [])));
    return r;
  }

  const rows = [
    row('Project file (.bbc110.json)', 'Full backup with images included. Re-import it on any device.', { action: async () => exp.exportJSON(deck) }),
    row('Standalone HTML', 'One file that plays offline anywhere — no app needed. Good for a USB stick.', { action: (p) => exp.exportStandaloneHTML(deck, p) }),
    row('Image (PNG)', 'A snapshot of the current screen, full resolution.', { action: () => exp.exportPNG(deck, screenIndex, { scale: 2 }) }),
  ];

  const printRow = h('div', { className: 'export-row' },
    h('div', { className: 'export-row-text' }, h('b', { textContent: 'Print / PDF' }), h('span', { textContent: 'One screen per page — choose "Save as PDF" in the print dialog.' })),
    h('div', { className: 'export-row-btns' }, h('button', { type: 'button', className: 'btn btn-primary', textContent: 'Print…', onclick: () => exp.printDeck(deck) })));

  const close = h('button', { type: 'button', className: 'btn', textContent: 'Close' });
  close.onclick = () => dlg.close();

  dlg.append(h('h2', { textContent: 'Export' }), h('div', { className: 'export-rows' }, ...rows, printRow), status, h('div', { className: 'dialog-actions' }, close));
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
}
