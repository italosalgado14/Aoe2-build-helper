import { loadManifest } from './data.js';
import { el, showError } from './ui.js';

const app = document.getElementById('app');

function card(build) {
  return el('article', { class: 'card' },
    el('div', { class: 'card-body' },
      el('h2', {}, el('a', { href: `build.html?id=${encodeURIComponent(build.id)}`, text: build.name })),
      el('p', { class: 'card-summary', text: build.summary || '' }),
      el('ul', { class: 'meta' },
        el('li', { text: (build.civs || ['Generic']).join(', ') }),
        el('li', { text: build.difficulty || 'Any' }),
        build.uptime ? el('li', { text: `Up at ${build.uptime}` }) : null,
      ),
    ),
    el('div', { class: 'card-actions' },
      el('a', { class: 'btn btn-primary', href: `play.html?id=${encodeURIComponent(build.id)}`, text: '▶ Play' }),
      el('a', { class: 'btn', href: `build.html?id=${encodeURIComponent(build.id)}`, text: 'Read' }),
    ),
  );
}

try {
  const builds = await loadManifest();
  app.replaceChildren(
    builds.length
      ? el('div', { class: 'card-grid' }, builds.map(card))
      : el('p', { class: 'empty', text: 'No builds yet.' }),
  );
} catch (error) {
  showError(app, error);
}
