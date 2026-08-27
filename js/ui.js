// Small shared DOM helpers.
import { RESOURCES, PHASES } from './constants.js';

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child);
  }
  return node;
}

// The villager spread for one step: food / wood / gold / stone (+ builders).
// Zero-valued resources stay visible but dimmed so the row never reflows.
export function allocChips(alloc, { compact = false } = {}) {
  return el(
    'div',
    { class: compact ? 'alloc alloc-compact' : 'alloc' },
    RESOURCES.filter((r) => r.key !== 'builder' || (alloc.builder || 0) > 0).map((r) => {
      const value = alloc[r.key] || 0;
      return el(
        'span',
        { class: `chip chip-${r.key}${value === 0 ? ' chip-zero' : ''}`, title: r.label },
        el('span', { class: 'chip-icon', text: r.icon, 'aria-hidden': 'true' }),
        el('span', { class: 'chip-value', text: String(value) }),
        compact ? null : el('span', { class: 'chip-label', text: r.label }),
      );
    }),
  );
}

export function phaseBadge(phase) {
  const meta = PHASES[phase];
  if (!meta) return null;
  return el('span', { class: `phase phase-${phase}`, text: meta.label });
}

export function showError(container, error) {
  container.replaceChildren(
    el('div', { class: 'error' },
      el('h2', { text: 'Something went wrong' }),
      el('pre', { text: error.message || String(error) }),
      el('p', {}, el('a', { href: 'index.html', text: '← Back to builds' })),
    ),
  );
  console.error(error);
}

export function qs(name) {
  return new URLSearchParams(location.search).get(name);
}
