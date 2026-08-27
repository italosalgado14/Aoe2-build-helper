# AoE2 Build Helper

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
| Feudal Age research | 130 game-seconds | `js/constants.js` |
| Loom | 25 game-seconds | `js/constants.js` |
| Starting villagers | 3 | `js/constants.js` |

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
  "steps": [
    {
      "vill": 10,                  // trigger — see below
      "offset": 15,                // optional: game-seconds after the trigger
      "phase": "dark",             // dark | uptime | feudal | castle
      "action": "Lure the 1st Boar",
      "build": "Barracks",         // optional badge
      "alloc": { "food": 7, "wood": 3, "gold": 0, "stone": 0, "builder": 0 },
      "note": "Optional extra detail."
    }
  ],
  "followUps": [{ "name": "Option", "detail": "What it leads into." }]
}
```

### Triggers

| Field | Meaning |
| --- | --- |
| `vill: N` | When villager N is trained |
| `through: N` | Display only — labels the step "Villagers 4–6" |
| `time: "7:05"` | At a fixed game clock time |
| `pop: N` | At population N (villagers + scout) |
| `offset: 15` | Game-seconds added to any of the above |
| `vills: 19` | Override the villager count — required once production stops (uptime, researching an age) |

### `alloc` is cumulative

`alloc` is the **full villager state at that step**, not a change. `builder` counts
villagers currently putting up a building. The loader enforces
`sum(alloc) == villager count`, so a typo fails loudly instead of quietly showing you
the wrong spread. It also enforces that steps never go backwards in time.

## Running locally

ES modules and `fetch` need a real HTTP server — opening `index.html` from disk will
not work.

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Tests

Open `selftest.html` on the local server. It exercises the clock (tick rate, pause,
mid-run speed changes), the time/villager derivations, and the build validator.
