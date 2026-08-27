// Loading, validation and timeline derivation for build files.
import { VILL_TRAIN_SECONDS, STARTING_VILLAGERS } from './constants.js';

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

function stepTime(step) {
  const offset = step.offset || 0;
  if (step.vill != null) return villagerTime(step.vill) + offset;
  if (step.time != null) return parseClock(step.time) + offset;
  if (step.pop != null) return villagerTime(step.pop - 1) + offset;
  throw new Error(`Step has no trigger (vill / time / pop): ${step.action}`);
}

// How many villagers exist at a given game time, assuming the TC never idles.
export function villagersAt(gameSeconds) {
  return STARTING_VILLAGERS + Math.floor(gameSeconds / VILL_TRAIN_SECONDS);
}

// Derived from the step's time, not its trigger: a step with an `offset` can
// land after the next villager has already popped. `vills` overrides this for
// phases where production has stopped (uptime, researching an age).
function stepVillagers(step, time) {
  return step.vills != null ? step.vills : villagersAt(time);
}

function stepLabel(step) {
  if (step.label) return step.label;
  if (step.through != null) return `Villagers ${step.vill}–${step.through}`;
  if (step.vill != null) return `Villager ${step.vill}`;
  return 'Timed';
}

// Turns a raw build file into one with derived time/vills/label on every step.
// Throws on any inconsistency so a bad build file fails loudly at load.
export function prepareBuild(raw) {
  if (!raw || !Array.isArray(raw.steps) || raw.steps.length === 0) {
    throw new Error('Build has no steps');
  }
  const problems = [];
  const steps = raw.steps.map((step, index) => {
    const time = stepTime(step);
    const vills = stepVillagers(step, time);
    const alloc = step.alloc || {};
    const sum = Object.values(alloc).reduce((a, b) => a + b, 0);
    if (sum !== vills) {
      problems.push(`step ${index + 1} ("${step.action}"): allocation totals ${sum} but there are ${vills} villagers`);
    }
    return { ...step, index, time, vills, label: stepLabel(step) };
  });

  for (let i = 1; i < steps.length; i++) {
    if (steps[i].time < steps[i - 1].time) {
      problems.push(`step ${i + 1} ("${steps[i].action}") goes backwards in time (${formatClock(steps[i].time)} after ${formatClock(steps[i - 1].time)})`);
    }
  }
  if (problems.length) throw new Error(`Invalid build "${raw.id}":\n  - ${problems.join('\n  - ')}`);

  return { ...raw, steps, duration: steps[steps.length - 1].time };
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
