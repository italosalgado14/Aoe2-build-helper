import { loadBuild, formatClock, formatDrift, stepIndexAt } from './data.js';
import { GameClock } from './timer.js';
import { el, mount, allocChips, phaseBadge, showError, qs } from './ui.js';
import { FollowState } from './follow.js';
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
  const follow = new FollowState();
  let wakeLock = null;

  const autoIndex = () => stepIndexAt(steps, clock.gameSeconds);
  const currentIndex = () => follow.resolve(autoIndex());

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
  const prevEl = el('div', { class: 'prev' });
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

  mount(app, 
    el('header', { class: 'play-header' },
      el('a', { class: 'back', href: `build.html?id=${encodeURIComponent(build.id)}`, text: '← Build' }),
      el('h1', { text: build.name }),
      el('label', { class: 'speed-wrap' }, 'Speed ', speedEl),
    ),
    el('section', { class: 'stage' },
      el('div', { class: 'clock-row' }, clockEl, el('div', { class: 'clock-meta' }, statusEl, driftEl)),
      el('div', { class: 'progress' }, progressEl),
      prevEl,
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
    const target = Math.min(steps.length - 1, Math.max(0, currentIndex() + delta));
    if (delta > 0 && !clock.running) clock.start();
    follow.goTo(target, autoIndex());
    render();
  }

  function jumpTo(index) {
    follow.goTo(index, autoIndex());
    render();
  }

  function resumeFollow() {
    follow.follow(autoIndex());
    render();
  }

  function reset() {
    clock.reset();
    follow.follow(0);
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

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (clock.running) requestWakeLock(); // the browser drops the lock when hidden
    render();
  });

  // Scroll only the step list, never the page: on the narrow layout the list is
  // in normal flow, so scrollIntoView would drag the clock off-screen.
  function centreInList(index) {
    const item = listEl.children[index];
    if (!item || listEl.scrollHeight <= listEl.clientHeight) return;
    const delta = item.getBoundingClientRect().top - listEl.getBoundingClientRect().top;
    // Assigned directly rather than scrollTo({behavior:'smooth'}): smooth scrolls
    // cancel each other when Next is pressed rapidly, and the animation is a
    // no-op in some environments, which left the list stuck at the top.
    listEl.scrollTop = listEl.scrollTop + delta - listEl.clientHeight / 2 + item.offsetHeight / 2;
  }

  let lastRendered = -1;
  function render() {
    const gameSeconds = clock.gameSeconds;
    const index = currentIndex(); // also hands control back if the clock caught up
    const current = steps[index];
    const next = steps[index + 1];
    const previous = steps[index - 1];

    clockEl.textContent = formatClock(gameSeconds);
    clockEl.classList.toggle('paused', !clock.running);
    playBtn.textContent = clock.running ? '❚❚ Pause' : (gameSeconds > 0 ? '▶ Resume' : '▶ Start');

    statusEl.textContent = follow.auto ? 'Following clock' : 'Manual';
    statusEl.classList.toggle('manual', !follow.auto);
    followBtn.hidden = follow.auto;

    // Drift only means something when you are driving: in auto mode the current
    // step is by definition one the clock has already passed, so a drift figure
    // would read "behind" permanently. Show the countdown to the next step instead.
    if (!follow.auto) {
      const drift = gameSeconds - current.time;
      driftEl.textContent = formatDrift(drift);
      driftEl.className = `drift ${drift > 12 ? 'late' : ''}`;
    } else {
      driftEl.textContent = next ? `next in ${Math.max(0, Math.ceil(next.time - gameSeconds))}s` : '';
      driftEl.className = 'drift';
    }

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
      prevEl.replaceChildren(
        previous
          ? el('div', { class: 'prev-inner' },
              el('span', { class: 'prev-tag', text: 'Done' }),
              el('span', { class: 'prev-time', text: formatClock(previous.time) }),
              el('span', { class: 'prev-action', text: previous.action }),
              previous.build ? el('span', { class: 'prev-build', text: previous.build }) : null)
          : el('div', { class: 'prev-inner empty', text: 'Start of the build' }),
      );
      nextEl.replaceChildren(
        next
          ? el('div', { class: 'next-inner' },
              el('span', { class: 'next-tag', text: 'Next' }),
              el('span', { class: 'next-time', text: formatClock(next.time) }),
              el('span', { class: 'next-action', text: next.action }),
              next.build ? el('span', { class: 'next-build', text: next.build }) : null)
          : el('div', { class: 'next-inner done', text: `Build complete — ${PHASES[current.phase]?.label || 'done'} reached.` }),
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
