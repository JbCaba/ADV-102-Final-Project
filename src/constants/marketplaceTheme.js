import { Platform } from 'react-native';

/** Gaming‑themed marketplace palette */
export const market = {
  // Backgrounds
  dark:        '#0a0e1a',
  darkCard:    '#111827',
  darkSurface: '#1a1f35',
  pageBg:      '#0d1117',

  // Neon accents
  cyan:        '#00f0ff',
  cyanDark:    '#00b8d4',
  purple:      '#a855f7',
  purpleDark:  '#7c3aed',
  gold:        '#fbbf24',
  goldDark:    '#f59e0b',
  red:         '#ff3b5c',
  redPressed:  '#e11d48',
  green:       '#22c55e',

  // Legacy aliases
  teal:        '#00f0ff',
  tealDark:    '#00b8d4',

  // Text
  text:        '#e2e8f0',
  textMuted:   '#64748b',
  textBright:  '#f8fafc',

  // Borders
  border:      'rgba(255,255,255,0.08)',
  borderGlow:  'rgba(0,240,255,0.2)',

  white:       '#ffffff',
};

/**
 * Web Font Scale helper.
 * Usage: fontSize: wfs(12)  →  16 on web, 12 on phone
 */
export const WEB_SCALE = 1.35;
export const wfs = (size) =>
  Platform.OS === 'web' ? Math.round(size * WEB_SCALE) : size;
