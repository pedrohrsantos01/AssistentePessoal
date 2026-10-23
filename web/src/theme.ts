import { tokens } from '../../app/src/theme/tokens.ts';
const t = tokens('dark', 'holo');
export function applyTheme() {
  const vars = {
    bg: t.bg.base, surface: t.bg.elevated, border: t.border.decorative,
    control: t.border.interactive, text: t.text.primary, dim: t.text.secondary,
    accent: t.accent.fill, 'accent-line': t.accent.line, soft: t.bg.accentSoft,
    'on-accent': t.text.onAccent, error: t.status.error, 'm-full':t.metrics.full, 'm-proofAction':`${t.metrics.profileLabel}px`,
    'font-body': `'${t.fonts.body.regular}', sans-serif`,
    'font-semibold': `'${t.fonts.body.semibold}', sans-serif`,
    'font-mono': `'${t.fonts.mono.regular}', monospace`,
    // Only proof-shell dimensions are new; product rhythm comes from native tokens.
    'proof-width': '430px', 'proof-diagnostics-width': '680px',
    'radius-card': `${t.radius.card}px`, 'radius-check': `${t.radius.check}px`,
    'radius-pill': `${t.metrics.pillRadius}px`,
    ...Object.fromEntries(Object.entries(t.line).map(([key, value]) => [`line-${key}`, String(value)])),
    ...Object.fromEntries(Object.entries(t.space).map(([key, value]) => [`s-${key}`, `${value}px`])),
    ...Object.fromEntries(Object.entries(t.typeSize).map(([key, value]) => [`f-${key}`, `${value}px`])),
    ...Object.fromEntries(['touch', 'habitRow', 'tile', 'check', 'border', 'xpInset', 'sectionLetter', 'stepLetter', 'bracket', 'bracketOffset'].map(key => {
      const value = t.metrics[key as keyof typeof t.metrics];
      return [`m-${key}`, `${value}px`];
    })),
  };
  for (const [key, value] of Object.entries(vars)) document.documentElement.style.setProperty(`--${key}`, value);
}
