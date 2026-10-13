// Data model: schema factories (see MDD §5.3). No DOM, no storage.
export const SCHEMA_VERSION = 1;

export const ASPECTS = {
  '16:9': [1920, 1080],
  '16:10': [1920, 1200],
  '4:3': [1920, 1440],
  '9:16': [1080, 1920],
  '1:1': [1080, 1080],
};

export const uid = () =>
  (globalThis.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export function newElement(type, props = {}) {
  return {
    id: uid(), type,
    x: 0, y: 0, w: 400, h: 200, rotation: 0, z: 1,
    hidden: false, locked: false,
    style: {}, content: {},
    animation: { in: 'none', loop: 'none', out: 'none', delayMs: 0, durationMs: 600, easing: 'smooth' },
    ...props,
  };
}

export function newScreen(name = 'Screen', props = {}) {
  return {
    id: uid(), name, durationSec: 10,
    background: { type: 'color', value: '', overlay: null },
    elements: [],
    ...props,
  };
}

export function newDeck(name = 'Untitled', screens = [newScreen('Screen 1')]) {
  const now = Date.now();
  return {
    id: uid(), name, schemaVersion: SCHEMA_VERSION,
    aspect: '16:9', theme: 'midnight',
    mode: 'manual', defaultDurationSec: 10,
    transition: { type: 'fade', durationMs: 600 },
    screens, createdAt: now, updatedAt: now,
  };
}

const anim = (inn, delayMs = 0, durationMs = 700) => ({ in: inn, loop: 'none', out: 'none', delayMs, durationMs, easing: 'smooth' });

export function sampleDeck() {
  const welcome = newScreen('Welcome', {
    durationSec: 12,
    background: { type: 'gradient', value: 'linear-gradient(135deg,#0b1020 0%,#1e3a8a 100%)', overlay: null },
    elements: [
      newElement('shape', { x: 160, y: 420, w: 220, h: 10, style: { fill: 'var(--accent)', radius: 5 }, animation: anim('slide-right', 400) }),
      newElement('text', {
        x: 160, y: 200, w: 1600, h: 200, z: 2,
        content: { text: 'Welcome to Youth Night' },
        style: { fontSize: 140, fontWeight: 800, valign: 'bottom' }, animation: anim('slide-up', 100, 800),
      }),
      newElement('text', {
        x: 160, y: 470, w: 1400, h: 260, z: 2,
        content: { text: 'Wednesdays at 6:30 PM\nGrab a snack and find a seat!' },
        style: { fontSize: 64, fontWeight: 500, color: 'var(--muted)', lineHeight: 1.3 }, animation: anim('fade', 600, 900),
      }),
    ],
  });
  const news = newScreen('Announcements', {
    durationSec: 12,
    background: { type: 'color', value: '#111827', overlay: null },
    elements: [
      newElement('text', {
        x: 160, y: 120, w: 1600, h: 140, z: 2,
        content: { text: 'This Week' },
        style: { fontSize: 110, fontWeight: 800, color: 'var(--accent)' }, animation: anim('slide-down'),
      }),
      newElement('shape', { x: 160, y: 300, w: 1600, h: 560, style: { fill: 'rgba(255,255,255,.07)', radius: 32 }, animation: anim('fade', 200) }),
      newElement('text', {
        x: 220, y: 340, w: 1480, h: 480, z: 3,
        content: { text: '• Game night this Friday\n• Bring a friend, win a prize\n• Retreat sign-ups close Sunday' },
        style: { fontSize: 72, fontWeight: 600, lineHeight: 1.5 }, animation: anim('fade', 500, 900),
      }),
    ],
  });
  const deck = newDeck('Sample: Youth Night', [welcome, news]);
  deck.mode = 'loop';
  deck.transition = { type: 'push', durationMs: 700 };
  return deck;
}

// Local "YYYY-MM-DDTHH:mm" for the next 6:30 PM, the default target for new countdowns.
export function nextEvening() {
  const d = new Date();
  d.setHours(18, 30, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Starting values for elements added from the Add panel (text, rect, circle, image, clock, timer, banner, ticker, qr, scoreboard).
export function defaultElement(kind, extra = {}) {
  const presets = {
    text: { type: 'text', w: 900, h: 220, content: { text: 'New text' }, style: { fontSize: 110, fontWeight: 700 } },
    rect: { type: 'shape', w: 500, h: 320, style: { fill: 'var(--accent)', radius: 24 } },
    circle: { type: 'shape', w: 360, h: 360, style: { fill: 'var(--accent)', shape: 'circle' } },
    image: { type: 'image', w: 800, h: 450, content: { src: '', alt: '' }, style: { fit: 'cover', radius: 0 } },
    clock: { type: 'clock', w: 760, h: 220, content: { kind: 'digital', hour12: true, seconds: false, showAmPm: true, timeZone: '' }, style: { fontSize: 170, fontWeight: 700, align: 'center', valign: 'middle' } },
    timer: {
      type: 'timer', w: 1000, h: 280,
      content: { mode: 'until', target: nextEvening(), repeat: 'none', durationSec: 600, format: 'auto', onZero: 'hold', message: 'Starting now!', holdSec: 30, beep: false },
      style: { fontSize: 220, fontWeight: 800, align: 'center', valign: 'middle' },
    },
    banner: { type: 'banner', w: 1920, h: 150, content: { text: 'Announcement', icon: '\u{1F4E3}' }, style: { variant: 'solid', fontSize: 64, fontWeight: 700, align: 'left' } },
    ticker: { type: 'ticker', w: 1920, h: 110, content: { messages: ['Welcome!', 'Tonight: game night at 6:30', 'Bring a friend'], speed: 140, direction: 'left', separator: '\u2022' }, style: { variant: 'solid', fontSize: 56, fontWeight: 700 } },
    qr: { type: 'qr', w: 420, h: 420, content: { text: 'https://example.com', ecl: 'M' }, style: { fg: '#000000', bg: '#ffffff', radius: 16 } },
    scoreboard: { type: 'scoreboard', w: 1400, h: 520, content: { teams: ['Team A', 'Team B'] }, style: { fontSize: 220 } },
  };
  const { type, ...p } = presets[kind];
  const { content, style, ...rest } = extra;
  return newElement(type, { ...p, ...rest, content: { ...p.content, ...content }, style: { ...p.style, ...style } });
}
