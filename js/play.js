import { loadBuild, formatClock, formatDrift, stepIndexAt } from './data.js';
import { GameClock } from './timer.js';
import { el, allocChips, phaseBadge, showError, qs } from './ui.js';
import { GAME_SPEEDS, DEFAULT_SPEED, STORAGE_KEYS, PHASES } from './constants.js';

const app = document.getElementById('app');

function readSpeed() {
  const stored = Number(localStorage.getItem(STORAGE_KEYS.speed));
  return GAME_SPEEDS.some((s) => s.multiplier === stored) ? stored : DEFAULT_SPEED;
}

try {
  const id = qs('id');
  if (!id) throw new Error('No build id in the URL.');
  const build = await loadBuild(id);
  document.title = `${build.name} — Play`;
  localStorage.setItem(STORAGE_KEYS.lastBuild, build.id);

  const steps = build.steps;
  const clock = new GameClock(readSpeed());
  let autoFollow = true;
  let manualIndex = 0;
  let wakeLock = null;

  const currentIndex = () => (autoFollow ? stepIndexAt(steps, clock.gameSeconds) : manualIndex);

  // ---- static shell -------------------------------------------------------
  const clockEl = el('div', { class: 'clock', text: '0:00' });
  const speedEl = el('select', { class: 'speed', 'aria-label': 'Game speed' },
    GAME_SPEEDS.map((s) => el('option', { value: String(s.multiplier), selected: s.multiplier === clock.speed, text: s.hint })));
  const statusEl = el('span', { class: 'status' });
  const driftEl = el('span', { class: 'drift' });
  const progressEl = el('div', { class: 'progress-fill' });

  const stepLabelEl = el('div', { class: 'now-label' });
  const stepActionEl = el('div', { class: 'now-action' });
  const stepBuildEl = el('div', { class: 'now-build' });
  const stepNoteEl = el('p', { class: 'now-note' });
  const allocEl = el('div', { class: 'now-alloc' });
  const nextEl = el('div', { class: 'next' });

  const playBtn = el('button', { class: 'btn btn-primary btn-lg', onClick: toggleRun });
  const nextBtn = el('button', { class: 'btn btn-lg', text: 'Next ▸', onClick: () => step(1) });
  const prevBtn = el('button', { class: 'btn', text: '◂ Prev', onClick: () => step(-1) });
  const followBtn = el('button', { class: 'btn', text: 'Follow clock', onClick: resumeFollow });
  const resetBtn = el('button', { class: 'btn btn-quiet', text: 'Reset', onClick: reset });

  const listEl = el('ol', { class: 'step-list' }, steps.map((s, i) =>
    el('li', {
      class: `step-item phase-${s.phase}`,
      'data-index': String(i),
      onClick: () => jumpTo(i),
    },
      el('span', { class: 'si-time', text: formatClock(s.time) }),
      el('span', { class: 'si-label', text: s.label }),
      el('span', { class: 'si-action', text: s.action }),
    )));

  app.replaceChildren(
    el('header', { class: 'play-header' },
      el('a', { class: 'back', href: `build.html?id=${encodeURIComponent(build.id)}`, text: '← Build' }),
      el('h1', { text: build.name }),
      el('label', { class: 'speed-wrap' }, 'Speed ', speedEl),
    ),
    el('section', { class: 'stage' },
      el('div', { class: 'clock-row' }, clockEl, el('div', { class: 'clock-meta' }, statusEl, driftEl)),
      el('div', { class: 'progress' }, progressEl),
      el('div', { class: 'now' }, stepLabelEl, stepActionEl, stepBuildEl, stepNoteEl,
        el('div', { class: 'now-alloc-wrap' }, el('span', { class: 'now-alloc-title', text: 'Villagers on' }), allocEl)),
      nextEl,
      el('div', { class: 'controls' }, playBtn, prevBtn, nextBtn, followBtn, resetBtn),
      el('p', { class: 'hint', text: 'Space = next · ← prev · P = pause · R = reset. Times are the ideal zero-idle timeline; use Next to stay in sync.' }),
    ),
    el('aside', { class: 'timeline' }, el('h2', { text: 'All steps' }), listEl),
  );

  // ---- behaviour ----------------------------------------------------------
  function toggleRun() {
    clock.toggle();
    if (clock.running) requestWakeLock(); else releaseWakeLock();
    render();
  }

  function step(delta) {
    const from = currentIndex();
    const target = Math.min(steps.length - 1, Math.max(0, from + delta));
    autoFollow = false;
    manualIndex = target;
    if (delta > 0 && !clock.running) clock.start();
    render();
  }

  function jumpTo(index) {
    autoFollow = false;
    manualIndex = index;
    render();
  }

  function resumeFollow() {
    autoFollow = true;
    render();
  }

  function reset() {
    clock.reset();
    autoFollow = true;
    manualIndex = 0;
    releaseWakeLock();
    render();
  }

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    } catch { /* not supported or denied — the timer still works */ }
  }

  function releaseWakeLock() {
    wakeLock?.release?.().catch(() => {});
    wakeLock = null;
  }

  speedEl.addEventListener('change', () => {
    const value = Number(speedEl.value);
    clock.setSpeed(value); // banks elapsed time first, so the clock never jumps
    localStorage.setItem(STORAGE_KEYS.speed, String(value));
    render();
  });

  document.addEventListener('keydown', (event) => {
    if (event.target.matches('select, input, textarea')) return;
    const key = event.key.toLowerCase();
    if (event.code === 'Space' || key === 'arrowright') { event.preventDefault(); step(1); }
    else if (key === 'arrowleft') { event.preventDefault(); step(-1); }
    else if (key === 'p') { event.preventDefault(); toggleRun(); }
    else if (key === 'r') { event.preventDefault(); reset(); }
  });

  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  // Scroll only the step list, never the page: on the narrow layout the list is
  // in normal flow, so scrollIntoView would drag the clock off-screen.
  function centreInList(index) {
    const item = listEl.children[index];
    if (!item || listEl.scrollHeight <= listEl.clientHeight) return;
    const delta = item.getBoundingClientRect().top - listEl.getBoundingClientRect().top;
    listEl.scrollTo({
      top: listEl.scrollTop + delta - listEl.clientHeight / 2 + item.offsetHeight / 2,
      behavior: 'smooth',
    });
  }

  let lastRendered = -1;
  function render() {
    const gameSeconds = clock.gameSeconds;
    const index = currentIndex();
    const current = steps[index];
    const next = steps[index + 1];

    clockEl.textContent = formatClock(gameSeconds);
    clockEl.classList.toggle('paused', !clock.running);
    playBtn.textContent = clock.running ? '❚❚ Pause' : (gameSeconds > 0 ? '▶ Resume' : '▶ Start');

    // If the clock catches up to a step you advanced to early, hand control back.
    if (!autoFollow && stepIndexAt(steps, gameSeconds) >= manualIndex) autoFollow = true;
    statusEl.textContent = autoFollow ? 'Following clock' : 'Manual';
    statusEl.classList.toggle('manual', !autoFollow);
    followBtn.hidden = autoFollow;

    driftEl.textContent = clock.running || gameSeconds > 0 ? formatDrift(gameSeconds - current.time) : '';
    driftEl.className = `drift ${gameSeconds - current.time > 12 ? 'late' : ''}`;

    progressEl.style.width = `${Math.min(100, (gameSeconds / build.duration) * 100)}%`;

    if (index !== lastRendered) {
      stepLabelEl.replaceChildren(
        el('span', { class: 'now-time', text: formatClock(current.time) }),
        el('span', { class: 'now-trigger', text: current.label }),
        phaseBadge(current.phase),
      );
      stepActionEl.textContent = current.action;
      stepBuildEl.replaceChildren(current.build ? el('span', { class: 'build-tag', text: current.build }) : '');
      stepNoteEl.textContent = current.note || '';
      stepNoteEl.hidden = !current.note;
      allocEl.replaceChildren(allocChips(current.alloc));
      nextEl.replaceChildren(
        next
          ? el('div', { class: 'next-inner' },
              el('span', { class: 'next-tag', text: 'Next' }),
              el('span', { class: 'next-time', text: formatClock(next.time) }),
              el('span', { class: 'next-action', text: next.action }))
          : el('div', { class: 'next-inner done', text: 'Build complete — you are in Feudal with pressure on the map.' }),
      );
      for (const item of listEl.children) {
        const i = Number(item.dataset.index);
        item.classList.toggle('current', i === index);
        item.classList.toggle('past', i < index);
      }
      centreInList(index);
      nextBtn.disabled = !next;
      prevBtn.disabled = index === 0;
      lastRendered = index;
    }
  }

  function loop() {
    render();
    requestAnimationFrame(loop);
  }
  render();
  requestAnimationFrame(loop);
} catch (error) {
  showError(app, error);
}
