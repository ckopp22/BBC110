// Undo/redo over JSON snapshots of the deck.
const LIMIT = 100;

export function createHistory() {
  let past = [], future = [], lastKey = null, lastAt = 0;
  return {
    // Call before a change. Returns true if the caller should push a snapshot of the pre-change state.
    // Changes with the same key within 1s (typing, dragging) merge into one undo step.
    begin(key) {
      const now = Date.now();
      const merge = !!key && key === lastKey && now - lastAt < 1000;
      lastKey = key || null; lastAt = now;
      return !merge;
    },
    push(snapshot) { past.push(snapshot); if (past.length > LIMIT) past.shift(); future = []; },
    endGroup() { lastKey = null; },
    undo(current) { if (!past.length) return null; future.push(current); lastKey = null; return past.pop(); },
    redo(current) { if (!future.length) return null; past.push(current); lastKey = null; return future.pop(); },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    clear() { past = []; future = []; lastKey = null; },
  };
}
