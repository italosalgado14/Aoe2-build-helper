import { loadBuild, formatClock } from './data.js';
import { el, allocChips, phaseBadge, showError, qs } from './ui.js';
import { PHASES } from './constants.js';

const app = document.getElementById('app');

function stepRow(step, previous) {
  const phaseChanged = !previous || previous.phase !== step.phase;
  return [
    phaseChanged && PHASES[step.phase]
      ? el('tr', { class: 'phase-row' }, el('td', { colspan: '4' }, phaseBadge(step.phase)))
      : null,
    el('tr', { class: `step-row phase-${step.phase}` },
      el('td', { class: 'col-time' },
        el('span', { class: 'time', text: formatClock(step.time) }),
        el('span', { class: 'trigger', text: step.label }),
      ),
      el('td', { class: 'col-action' },
        el('span', { class: 'action', text: step.action }),
        step.build ? el('span', { class: 'build-tag', text: step.build }) : null,
        step.note ? el('p', { class: 'note', text: step.note }) : null,
      ),
      el('td', { class: 'col-alloc' }, allocChips(step.alloc, { compact: true })),
      el('td', { class: 'col-pop', text: `${step.vills}` }),
    ),
  ];
}

try {
  const id = qs('id');
  if (!id) throw new Error('No build id in the URL.');
  const build = await loadBuild(id);
  document.title = `${build.name} — AoE2 Build Helper`;

  let previous = null;
  const rows = build.steps.flatMap((step) => {
    const out = stepRow(step, previous);
    previous = step;
    return out;
  });

  app.replaceChildren(
    el('div', { class: 'build-head' },
      el('h1', { text: build.name }),
      build.goal ? el('p', { class: 'goal', text: build.goal }) : null,
      el('ul', { class: 'meta' },
        el('li', { text: (build.civs || ['Generic']).join(', ') }),
        el('li', { text: build.difficulty || 'Any' }),
        el('li', { text: `Ends ${formatClock(build.duration)}` }),
      ),
      el('a', { class: 'btn btn-primary btn-lg', href: `play.html?id=${encodeURIComponent(build.id)}`, text: '▶ Play this build' }),
    ),
    build.notes?.length
      ? el('ul', { class: 'callout' }, build.notes.map((n) => el('li', { text: n })))
      : null,
    el('table', { class: 'steps' },
      el('thead', {}, el('tr', {},
        el('th', { text: 'Time' }),
        el('th', { text: 'Do' }),
        el('th', { text: 'Villagers on' }),
        el('th', { text: 'Vills' }),
      )),
      el('tbody', {}, rows),
    ),
    build.followUps?.length
      ? el('section', { class: 'follow-ups' },
          el('h2', { text: 'Follow-up options' }),
          el('ul', {}, build.followUps.map((f) =>
            el('li', {}, el('strong', { text: f.name }), ' — ', f.detail))),
        )
      : null,
    build.source ? el('p', { class: 'source', text: `Source: ${build.source}` }) : null,
  );
} catch (error) {
  showError(app, error);
}
