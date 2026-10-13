// Scoreboard element: named teams with big numbers. Scores are adjusted live in Show mode and persisted.

export function render(el, node, ctx = {}) {
  const c = el.content || {}, s = el.style || {};
  const names = (c.teams || []).filter((t) => t.trim()).slice(0, 6);
  const size = s.fontSize || 220;
  node.style.display = 'flex';
  node.style.gap = '24px';
  node.style.color = s.color || 'var(--fg)';
  if (s.fontFamily) node.style.fontFamily = s.fontFamily;

  const key = ctx.persist && ctx.deckId ? `bbc110.score.${ctx.deckId}.${el.id}` : null;
  let scores = [];
  if (key) { try { scores = JSON.parse(localStorage.getItem(key)) || []; } catch { scores = []; } }
  scores = names.map((_, i) => (Number.isFinite(scores[i]) ? scores[i] : 0));
  const save = () => { if (key) { try { localStorage.setItem(key, JSON.stringify(scores)); } catch { /* storage blocked */ } } };

  const numbers = [];
  const btn = (label, aria, onclick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sb-btn';
    b.textContent = label;
    b.setAttribute('aria-label', aria);
    b.style.fontSize = size * 0.24 + 'px';
    b.onclick = (e) => { e.stopPropagation(); onclick(); };
    return b;
  };
  const adjust = (i, d) => { if (i < 0 || i >= scores.length) return; scores[i] += d; numbers[i].textContent = scores[i]; save(); };

  names.forEach((name, i) => {
    const card = document.createElement('div');
    card.className = 'sb-card';
    card.style.cssText = `flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${size * 0.06}px;`;
    card.style.background = s.cardFill || 'var(--card)';
    card.style.borderRadius = (s.radius ?? 28) + 'px';
    const label = document.createElement('div');
    label.textContent = name;
    label.style.cssText = `font-size:${size * 0.28}px;font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
    label.style.color = s.nameColor || 'var(--muted)';
    const num = document.createElement('div');
    num.className = 'sb-score';
    num.style.cssText = `font-size:${size}px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;`;
    num.textContent = scores[i];
    numbers.push(num);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:16px;';
    row.append(btn('−', `Subtract from ${name}`, () => adjust(i, -1)), btn('+', `Add to ${name}`, () => adjust(i, 1)));
    card.append(label, num, row);
    node.append(card);
  });

  const reset = () => { scores = scores.map(() => 0); numbers.forEach((n) => { n.textContent = 0; }); save(); };
  return { controller: { type: 'score', count: names.length, adjust, reset } };
}
