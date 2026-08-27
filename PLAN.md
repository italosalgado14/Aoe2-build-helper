# AoE2 Build Helper — Plan

Status: agreed, not started. No code written yet.
Repo: <https://github.com/italosalgado14/Aoe2-build-helper> · Pages from `main`, root.

## 1. Goal

A GitHub Pages site with two jobs:

1. **Read** a build order as a clean step list, showing the villager distribution at every step.
2. **Play** it — a timer that walks you through the steps live during a game, on a second
   screen or a side window.

## 2. Architecture

| Decision | Choice | Why |
| --- | --- | --- |
| Stack | Vanilla HTML + CSS + JS (ES modules) | No Node on this machine, no build step, Pages just serves it |
| Data | One JSON per build + a manifest | Adding a build = adding a file, never touching code |
| Hosting | GitHub Pages from `main`, root | Push = deploy |
| Storage | `localStorage` | Game speed and last-used build. No backend |

```
index.html                  build list
build.html?id=drush         read view
play.html?id=drush          timer view
css/style.css
js/data.js                  load + validate build JSON
js/timer.js                 timeline engine
js/ui.js                    rendering
builds/manifest.json        list of available builds
builds/drush.json           first build (from instructions.md)
```

## 3. Data model

Each step carries three things: **when** it fires, **what you do**, and **where every
villager is at that moment**.

```jsonc
{
  "id": "drush-into-scouts",
  "name": "Drush into Fast Feudal Scouts",
  "civs": ["generic"],
  "source": "Toaster226 — Learn Drush | 10 Minute AoE2 Build Orders",
  "difficulty": "intermediate",
  "steps": [
    {
      "vill": 10,                     // trigger: villager #10 pops
      "action": "Lure the 1st Boar / Rhino",
      "build": null,                  // building to place, if any
      "alloc": { "food": 6, "wood": 3, "gold": 0, "stone": 0, "builder": 1 },
      "note": "3 on wood pays for the early Barracks + House"
    }
  ],
  "ages": [ { "at": 20, "label": "Click up to Feudal" } ]
}
```

### Why `alloc` is cumulative

`alloc` is the **full villager state at that step**, not a delta. Two reasons:

- You asked for it directly: every step should say how many villagers are on food, wood,
  gold and stone.
- Because the play view lets you jump forward and back, the display must be readable from
  a single step without replaying history.

Load-time check: `sum(alloc) == villager count at that step`. A typo in a build file then
fails loudly instead of silently showing a wrong spread.

### Non-villager steps

Steps that aren't triggered by a villager popping (queue 2 Militia, research Loom, drop the
Stable) use a `pop`, `age`, or `time` trigger instead of `vill`.

## 4. Timing engine

AoE2 builds are paced by **villager production**, not wall clock: a villager is ~25s, so
step timings are *derived* from villager number rather than hand-written. Build files
therefore contain no clock times — only triggers.

Two decisions, both settled:

- **Game speed — default 1.7x.** DE multiplayer default. Selector offers 1.0 / 1.5 / 1.7
  and scales the whole timeline; the choice is remembered in `localStorage`. A timer that
  ignores game speed is off by 70% and useless.
- **Advance — auto clock plus manual Next.** The clock runs on the ideal timeline, but a
  large **Next** button re-syncs the guide to where you actually are, and a drift indicator
  shows the gap (`vill 12 · +14s behind`). A strict auto-only timer desyncs a few minutes
  in and gets closed; manual-only loses the pacing that makes the build a build.

Consequence: the villager-allocation display follows **your** position, not the clock's.

## 5. Screens

- **Index** — one card per build: name, civ, difficulty, uptime target.
- **Build** — full step table with a villager-allocation column. Printable.
- **Play** — big clock, current step large, next step below it, live counters
  (`food 6 · wood 3 · gold 0 · stone 0`), Start / Pause / Next / Reset.
  Dark, high contrast, readable at a glance mid-game.

Language: **English** throughout, keeping standard AoE2 terminology (Drush, Fast Castle,
Loom, uptime).

## 6. Milestones

1. Repo skeleton + Pages live (empty shell deploying).
2. Encode the Drush build as `builds/drush.json` — this is what validates the schema.
3. Read view.
4. Play view + timer engine.
5. Polish: narrow-window and mobile layout, keyboard shortcuts (space = Next), print styles.

## 7. Open

- More builds. Two or three in hand would stress-test the schema before it's locked in —
  the cheapest time to find out it's wrong. Write them the way `instructions.md` is
  written ("Villagers 7–9: build a Lumber Camp"); no clock times needed.
- Constants to verify during implementation, not now: exact villager train time, Loom and
  Feudal research times, and how the in-game clock relates to game speed.
