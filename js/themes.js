// Built-in output themes (single source of truth) and helpers. Themes are independent of the editor UI.
import { fontStack } from './fonts.js';

const DARK = 'rgba(255,255,255,.08)';
const LIGHT = 'rgba(15,23,42,.07)';
const t = (id, name, bg, fg, accent, muted, card, display, body) => ({ id, name, bg, fg, accent, muted, card, display, body });

export const THEMES = [
  t('midnight', 'Midnight', '#0b1020', '#f8fafc', '#facc15', '#94a3b8', DARK, 'Montserrat', 'Inter'),
  t('sunrise', 'Sunrise', '#7c2d12', '#fff7ed', '#fdba74', '#fed7aa', DARK, 'Playfair Display', 'Inter'),
  t('chalkboard', 'Chalkboard', '#1f3a2e', '#f1f5f0', '#fde68a', '#a7c4b5', DARK, 'Permanent Marker', 'Nunito'),
  t('neon', 'Neon Night', '#0a0a14', '#f5f3ff', '#22d3ee', '#a78bfa', 'rgba(34,211,238,.1)', 'Oswald', 'Inter'),
  t('clean', 'Clean White', '#ffffff', '#0f172a', '#2563eb', '#64748b', LIGHT, 'Poppins', 'Inter'),
  t('church', 'Church Classic', '#faf7f0', '#2b2118', '#9a6b2f', '#7a6a58', 'rgba(43,33,24,.07)', 'Playfair Display', 'Lora'),
  t('youth', 'Youth Bold', '#0f0f0f', '#ffffff', '#ffe600', '#bbbbbb', DARK, 'Anton', 'Poppins'),
  t('ocean', 'Ocean', '#082f49', '#f0f9ff', '#38bdf8', '#7dd3fc', DARK, 'Montserrat', 'Nunito'),
  t('forest', 'Forest', '#14281d', '#f0fdf4', '#86efac', '#86b99b', DARK, 'Lora', 'Nunito'),
  t('candy', 'Candy', '#fdf2f8', '#4a044e', '#ec4899', '#a21caf', 'rgba(74,4,78,.07)', 'Fredoka', 'Nunito'),
  t('slate', 'Slate', '#1e293b', '#e2e8f0', '#f97316', '#94a3b8', DARK, 'Oswald', 'Inter'),
  t('royal', 'Royal Purple', '#2e1065', '#faf5ff', '#fbbf24', '#c4b5fd', DARK, 'Playfair Display', 'Montserrat'),
  t('sand', 'Sand', '#f5efe6', '#292524', '#c2410c', '#78716c', 'rgba(41,37,36,.07)', 'Bebas Neue', 'Poppins'),
];

export const themeById = (id) => THEMES.find((x) => x.id === id) || THEMES[0];

// The theme record in effect for an id; 'custom' reads deck.customTheme.
export function resolveTheme(id, deck) {
  if (id === 'custom' && deck && deck.customTheme) return { id: 'custom', name: 'Custom', ...deck.customTheme };
  return themeById(id);
}

export function themeVars(id, deck) {
  const th = resolveTheme(id, deck);
  return {
    '--bg': th.bg, '--fg': th.fg, '--accent': th.accent, '--muted': th.muted, '--card': th.card,
    '--font-display': fontStack(th.display), '--font-body': fontStack(th.body),
  };
}

export function applyTheme(node, vars) {
  for (const k in vars) node.style.setProperty(k, vars[k]);
}

// Replaces var(--token) with the theme's real value, so editor UI outside the stage can preview it.
export function resolveColor(value, vars) {
  const m = /^var\((--[\w-]+)\)$/.exec(value || '');
  return m && vars[m[1]] ? vars[m[1]] : value;
}
