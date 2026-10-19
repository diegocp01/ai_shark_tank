// Inline SVG icons (24x24, stroke-based) so the UI has no icon-font dependency.

const PATHS = {
  play: `<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>`,
  pause: `<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>`,
  next: `<path d="M6 5.5v13l9-6.5z" fill="currentColor" stroke="none"/><path d="M18 5.5v13"/>`,
  restart: `<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>`,
  verdict: `<path d="M5 5.5v13l6.5-6.5zM12 5.5v13l6.5-6.5z" fill="currentColor" stroke="none"/>`,
  voiceOn: `<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>`,
  voiceOff: `<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" stroke="none"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18"/>`,
  download: `<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>`,
  copy: `<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>`,
  link: `<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`,
  dice: `<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.3" fill="currentColor" stroke="none"/>`,
  exit: `<path d="M14 5h4.5A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 8l-4 4 4 4M6 12h10"/>`,
  sparkle: `<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9-1.9 5.1-1.9-5.1-5.1-1.9 5.1-1.9z" fill="currentColor" stroke="none"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="currentColor" stroke="none"/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
  x: `<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>`,
  board: `<rect x="4" y="5" width="16" height="14" rx="2.5"/><path d="M4 10h16M10 10v9"/>`,
  transcript: `<path d="M5 6.5h14M5 11h14M5 15.5h9"/>`,
  // Category / product glyphs
  paw: `<circle cx="7.5" cy="9" r="1.8"/><circle cx="12" cy="6.8" r="1.8"/><circle cx="16.5" cy="9" r="1.8"/><path d="M8 16.2c0-2.6 1.8-4.7 4-4.7s4 2.1 4 4.7c0 1.6-1.4 2.3-4 2.3s-4-.7-4-2.3z"/>`,
  chart: `<path d="M4.5 19.5h15"/><path d="M7 16v-4.5M11 16V8.5M15 16v-6M19 16V5.5"/>`,
  bowl: `<path d="M4 11.5h16a8 8 0 0 1-16 0z"/><path d="M8.5 7.5c0-1.5 1-1.5 1-3M12 7.5c0-1.5 1-1.5 1-3M15.5 7.5c0-1.5 1-1.5 1-3"/>`,
  leaf: `<path d="M19 5c-8 0-13 4-13 10 0 2 1 3.5 1 3.5S9 19 11 19c6 0 8-6 8-14z"/><path d="M5 20c3-5 6-8 10-10"/>`,
  wave: `<path d="M3 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2"/><path d="M3 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2"/><circle cx="12" cy="7" r="3"/>`,
  sock: `<path d="M9 3.5h6v8.5l3.4 3.3a3 3 0 0 1-4.2 4.3l-5.2-5V3.5z"/><path d="M9 7h6"/>`,
  chip: `<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3.5v3.5M14 3.5v3.5M10 17v3.5M14 17v3.5M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5"/>`,
  heart: `<path d="M12 19.5s-7.5-4.4-7.5-9.7A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4c0 5.3-7.5 9.7-7.5 9.7z"/>`,
  store: `<path d="M4.5 9.5l1.5-5h12l1.5 5"/><path d="M4.5 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0"/><path d="M6 12v7.5h12V12"/>`,
  spark: `<path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.8 2.8M15.2 15.2L18 18M6 18l2.8-2.8M15.2 8.8L18 6"/>`,
};

export function icon(name, { className = "", label = "" } = {}) {
  const body = PATHS[name] || PATHS.spark;
  const a11y = label ? `role="img" aria-label="${label}"` : `aria-hidden="true"`;

  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${a11y} focusable="false">${body}</svg>`;
}
