// Bundled font catalog (files in assets/fonts, declared in css/fonts.css) plus a few system fonts.
const g = (cat, list) => [cat, list.map(([name, fb]) => ({ name, stack: `"${name}", ${fb}` }))];

export const FONT_GROUPS = [
  g('Sans', [['Inter', 'system-ui, sans-serif'], ['Poppins', 'system-ui, sans-serif'], ['Montserrat', 'system-ui, sans-serif'], ['Nunito', 'system-ui, sans-serif']]),
  g('Display', [['Bebas Neue', 'Impact, sans-serif'], ['Anton', 'Impact, sans-serif'], ['Oswald', 'Impact, sans-serif'], ['Fredoka', 'system-ui, sans-serif']]),
  g('Serif', [['Playfair Display', 'Georgia, serif'], ['Lora', 'Georgia, serif'], ['Merriweather', 'Georgia, serif']]),
  g('Script', [['Pacifico', 'cursive'], ['Dancing Script', 'cursive'], ['Caveat', 'cursive'], ['Permanent Marker', 'cursive']]),
  g('Mono', [['JetBrains Mono', 'ui-monospace, Menlo, monospace']]),
  ['System', [
    { name: 'System UI', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
    { name: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
    { name: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
    { name: 'Courier New', stack: '"Courier New", monospace' },
  ]],
];

const ALL = FONT_GROUPS.flatMap(([, list]) => list);
export const fontStack = (name) => (ALL.find((f) => f.name === name) || ALL.find((f) => f.name === 'System UI')).stack;

// First family name in a CSS font stack, or '' for var()/empty values.
export function firstFamily(stack) {
  const m = /^\s*"?([^",()]+)"?/.exec(stack || '');
  return m && !String(stack).trim().startsWith('var(') ? m[1].trim() : '';
}
