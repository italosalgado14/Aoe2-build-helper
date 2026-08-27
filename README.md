# AoE2 Build Helper

Page: https://italosalgado14.github.io/Aoe2-build-helper/

Age of Empires II build orders with a live follow-along timer. Every step shows
exactly how many villagers should be on **food, wood, gold and stone** at that
moment.

**Live:** <https://italosalgado14.github.io/Aoe2-build-helper/>

- **Read view** — the whole build as a table, printable.
- **Play view** — a big game clock, the current step, the next step, the villager
  spread, and a drift indicator telling you how far behind the ideal timeline you are.

No build step, no dependencies. Plain HTML, CSS and ES modules.

## How the timing works

AoE2 builds are paced by villager production, not by the wall clock, so build files
contain **triggers, not timestamps**. The site derives the timeline:

| Constant | Value | Where |
| --- | --- | --- |
| Villager training | 25 game-seconds | `js/constants.js` |
| Feudal research | 130 game-seconds | `js/constants.js` |
| Castle research | 160 game-seconds | `js/constants.js` |
| Imperial research | 190 game-seconds | `js/constants.js` |
| Loom | 25 game-seconds | `js/constants.js` |
| Starting villagers | 3 | `js/constants.js` |

The age constants were cross-checked against Toaster226's Fast Imperial, which
states a 12:27 Castle click and "~18:00" Imperial: 747 + 160 + 190 = 18:17.

Villager *N* pops at `(N - 3) x 25` game-seconds. Villager count at any moment is
`3 + floor(time / 25)`.

**Game speed** never changes those numbers — it changes how fast the clock ticks in
real time, exactly like the in-game clock. At 1.7x (DE multiplayer default) the page's
clock advances 1.7 seconds per real second, so it matches the timer you see in game.
Click-up at 6:45 is 6:45 at every speed.

Displayed times are the ideal timeline with **zero Town Center idle time**. Real games
run 30–60s behind that, which is why the play view has a manual **Next** button and
shows your drift.

## Adding a build

1. Drop a JSON file in `builds/`.
2. Add an entry to `builds/manifest.json`.

That's it — no code changes.

```jsonc
{
  "id": "my-build",
  "name": "Fast Castle into Knights",
  "civs": ["Franks"],
  "difficulty": "Intermediate",
  "goal": "One line describing the plan.",
  "source": "Where it came from",
  "notes": ["Shown as a callout at the top of the read view."],

  // When you CLICK each age. Arrival = click + that age's research time,
  // so the research constants live in one place. Order matters: a later
  // entry may reference an earlier one.
  "ages": [
    { "age": "feudal", "at": { "vill": 24, "offset": 5 } },
    { "age": "castle", "at": { "age": "feudal", "offset": 80 } }
  ],

  "steps": [
    {
      "vill": 10,                  // trigger — see below
      "offset": 15,                // optional: game-seconds after the trigger
      "phase": "dark",             // see phases below
      "action": "Lure the 1st Boar",
      "build": "Barracks",         // optional badge
      "alloc": { "food": 7, "wood": 3, "gold": 0, "stone": 0, "builder": 0 },
      "note": "Optional extra detail."
    }
  ],
  "followUps": [{ "name": "Option", "detail": "What it leads into." }],
  "civTips": [{ "name": "Franks", "detail": "Why this civ suits the build." }]
}
```

### Triggers

| Field | Meaning |
| --- | --- |
| `vill: N` | When villager N is trained |
| `pop: N` | At population N (villagers + scout) |
| `time: "7:05"` | At a fixed game clock time |
| `age: "castle"` | When you ARRIVE in that age |
| `click: "castle"` | When you CLICK UP to that age |
| `offset: 15` | Game-seconds added to any of the above |
| `through: N` | Display only — labels the step "Villagers 4–6" |
| `vills: 19` | The villager count at this step — see below |

Prefer `age` / `click` over hard-coded `time` values: they stay correct if a
research constant changes.

### Phases

`dark`, `uptime-feudal`, `feudal`, `uptime-castle`, `castle`,
`uptime-imperial`, `imperial`. Each gets a coloured badge and groups the read
view.

### `alloc` is cumulative

`alloc` is the **full villager state at that step**, not a change. `builder` counts
villagers currently putting up a building.

The villager count is derived as `3 + floor(time / 25)` — but that only holds while
the Town Centre never pauses, which stops being true after the first age-up click
(builds queue their own villagers during each uptime). So **every step after the
first click needs an explicit `vills`**, and the loader refuses to guess.

The loader rejects a build outright if any of these fail:

- `sum(alloc) != vills` on any step
- a step after the first age-up click has no explicit `vills`
- steps go backwards in time
- an unknown `phase`, an unknown age, or an `age`/`click` reference to an age
  that is not declared before it

Both bugs in the seed Drush build were caught this way rather than by reading the
data.

## Running locally

ES modules and `fetch` need a real HTTP server — opening `index.html` from disk will
not work.

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Tests

Open `selftest.html` on the local server — 72 checks covering the clock (tick rate,
pause, mid-run speed changes), the time/villager derivations, the follow-state logic
in both directions, and the validator's rejections.

It loops over `builds/manifest.json`, so **every build you add is checked
automatically** — no test to update.
