// Loading, validation and timeline derivation for build files.
import { VILL_TRAIN_SECONDS, STARTING_VILLAGERS, AGE_RESEARCH_SECONDS, PHASES } from './constants.js';

export function parseClock(value) {
  if (typeof value === 'number') return value;
  const m = /^(\d+):([0-5]\d)$/.exec(String(value).trim());
  if (!m) throw new Error(`Bad clock value: "${value}" (expected m:ss)`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatDrift(seconds) {
  const s = Math.round(seconds);
  if (Math.abs(s) < 3) return 'on time';
  const abs = Math.abs(s);
  const body = abs >= 60 ? `${Math.floor(abs / 60)}m ${abs % 60}s` : `${abs}s`;
  return s > 0 ? `${body} behind` : `${body} ahead`;
}

// Villager N pops at (N - 3) * 25 game seconds. The first three exist at 0:00.
export function villagerTime(n) {
  return Math.max(0, n - STARTING_VILLAGERS) * VILL_TRAIN_SECONDS;
}

// How many villagers exist at a given game time. Only valid while the Town
// Centre is producing without a pause, i.e. up to the first age-up click —
// after that, production is build-specific and must be stated explicitly.
export function villagersAt(gameSeconds) {
  return STARTING_VILLAGERS + Math.floor(gameSeconds / VILL_TRAIN_SECONDS);
}

// One resolver for every trigger shape, used for both `ages` and `steps`.
//   vill / pop  — derived from villager production
//   time        — a fixed game clock reading
//   age         — the moment you ARRIVE in that age
//   click       — the moment you CLICK UP to that age
function resolveTrigger(trigger, ages, what) {
  const offset = trigger.offset || 0;
  if (trigger.vill != null) return villagerTime(trigger.vill) + offset;
  if (trigger.pop != null) return villagerTime(trigger.pop - 1) + offset;
  if (trigger.time != null) return parseClock(trigger.time) + offset;
  if (trigger.age != null) {
    const t = ages.arrivals[trigger.age];
    if (t == null) throw new Error(`${what} references age "${trigger.age}", which is not declared before it`);
    return t + offset;
  }
  if (trigger.click != null) {
    const t = ages.clicks[trigger.click];
    if (t == null) throw new Error(`${what} references the "${trigger.click}" click, which is not declared before it`);
    return t + offset;
  }
  throw new Error(`${what} has no trigger (vill / pop / time / age / click)`);
}

// A build declares only when it CLICKS each age; the arrival time is the click
// plus that age's research, so the research constants stay in one place.
function resolveAges(raw) {
  const clicks = {};
  const arrivals = {};
  for (const entry of raw.ages || []) {
    const research = AGE_RESEARCH_SECONDS[entry.age];
    if (research == null) throw new Error(`Unknown age "${entry.age}" (expected ${Object.keys(AGE_RESEARCH_SECONDS).join(' / ')})`);
    const click = resolveTrigger(entry.at, { clicks, arrivals }, `ages entry "${entry.age}"`);
    clicks[entry.age] = click;
    arrivals[entry.age] = click + research;
  }
  return { clicks, arrivals };
}

function stepLabel(step) {
  if (step.label) return step.label;
  if (step.through != null) return `Villagers ${step.vill}–${step.through}`;
  if (step.vill != null) return `Villager ${step.vill}`;
  if (step.age != null) return PHASES[step.age]?.label || step.age;
  if (step.click != null) return `Click ${step.click[0].toUpperCase()}${step.click.slice(1)}`;
  return 'Timed';
}

// Turns a raw build file into one with derived time/vills/label on every step.
// Throws on any inconsistency so a bad build file fails loudly at load.
export function prepareBuild(raw) {
  if (!raw || !Array.isArray(raw.steps) || raw.steps.length === 0) {
    throw new Error('Build has no steps');
  }
  const problems = [];
  const ages = resolveAges(raw);
  const clickTimes = Object.values(ages.clicks);
  const firstClick = clickTimes.length ? Math.min(...clickTimes) : Infinity;

  const steps = raw.steps.map((step, index) => {
    const where = `step ${index + 1} ("${step.action}")`;
    const time = resolveTrigger(step, ages, where);

    // villagersAt() assumes an unbroken TC. Past the first click-up that stops
    // being true — these builds queue their own villagers during each uptime —
    // so require the author to state the count rather than guessing wrong.
    let vills = step.vills;
    if (vills == null) {
      if (time > firstClick) {
        problems.push(`${where} is after the first age-up click, so it needs an explicit "vills"`);
      }
      vills = villagersAt(time);
    }

    const sum = Object.values(step.alloc || {}).reduce((a, b) => a + b, 0);
    if (sum !== vills) {
      problems.push(`${where}: allocation totals ${sum} but there are ${vills} villagers`);
    }
    if (step.phase && !PHASES[step.phase]) {
      problems.push(`${where}: unknown phase "${step.phase}"`);
    }
    return { ...step, index, time, vills, label: stepLabel(step) };
  });

  for (let i = 1; i < steps.length; i++) {
    if (steps[i].time < steps[i - 1].time) {
      problems.push(`step ${i + 1} ("${steps[i].action}") goes backwards in time (${formatClock(steps[i].time)} after ${formatClock(steps[i - 1].time)})`);
    }
  }
  if (problems.length) throw new Error(`Invalid build "${raw.id}":\n  - ${problems.join('\n  - ')}`);

  return { ...raw, steps, ages, duration: steps[steps.length - 1].time };
}

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} loading ${url}`);
  return res.json();
}

export async function loadManifest() {
  return (await getJSON('builds/manifest.json')).builds;
}

export async function loadBuild(id) {
  const builds = await loadManifest();
  const entry = builds.find((b) => b.id === id);
  if (!entry) throw new Error(`No build with id "${id}"`);
  return prepareBuild(await getJSON(entry.file));
}

// Index of the last step whose time has already passed.
export function stepIndexAt(steps, gameSeconds) {
  let index = 0;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].time <= gameSeconds) index = i;
    else break;
  }
  return index;
}
