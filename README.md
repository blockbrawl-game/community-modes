# BlockBrawl community modes

SDK, dev kit and reference modes for writing custom BlockBrawl game modes in HTML5/JS.

A mode has two halves:

- **Server logic** (`server.js`) runs on the BlockBrawl servers inside a V8 sandbox. It is the only authority on the rules.
- **Client** (`client/`) is an HTML5 app that renders the match and sends the player's actions. It runs in a sandboxed frame with no network access.

The two halves talk through **steps**: small JSON facts the server emits and the client applies. When a player joins or reconnects, the server sends a **sync**: the steps that rebuild that player's view from nothing.

## Quick start

Requires Node 20 or newer.

```bash
npm install
```

```bash
node devkit/cli.js dev duel-lite
```

Open the printed dashboard URL. It shows every player side by side, with latency and packet-drop sliders, a message log and a live view of the server state.

```bash
node devkit/cli.js test duel-lite
```

## Layout

| Folder | What it is |
| --- | --- |
| `sdk/` | `defineMode`, `reject`, `connect` and the TypeScript interfaces (`types.d.ts`) |
| `runtime/` | The sandbox prelude and limits shared by the dev kit and the real server |
| `shell/` | The trusted host page code that wraps a mode client |
| `devkit/` | The `dev`, `test` and `build` commands |
| `modes/duel-lite/` | Turn-based reference mode: steps, private hands, sync |
| `modes/stack-race/` | Real-time reference mode: ticking and client prediction |
| `modes/tile-frenzy/` | Showcase, load test: 1-8 players at 30 ticks a second grabbing tiles on a shared board |
| `modes/trail-clash/` | Showcase, real time: 1-4 light trails at 20 ticks a second, queued turns, a shrinking arena |
| `modes/bloom-blocks/` | Showcase, visuals: turn-based placement puzzle for 1-2 players with drag and drop and particle effects |
| `docs/` | Guides |

## A mode package

```
modes/<mode-id>/
  mode.json          id, version, player counts, tickRate, file names
  server.js          export default defineMode({ ... })
  shared.js          optional rules used by both halves
  client/index.html  the client page
  client/model.js    export function createModel()  (no DOM access)
  tests/fuzz.js      export function nextAction(model, playerId, rng)
```

Start by copying `modes/duel-lite`.

## Docs

- [Interfaces](docs/interfaces.md): what a mode must implement.
- [Steps and sync](docs/steps-and-sync.md): how to keep clients consistent and bandwidth low.
- [Prediction](docs/prediction.md): making fast-paced modes feel instant.
- [Limits and testing](docs/limits.md): the sandbox rules and what `devkit test` checks.

## How a mode goes live

1. Open a pull request with one mode under `modes/<your-id>/`. CI runs `node scripts/check-modes.mjs`.
2. A maintainer reads the code and plays the mode.
3. Accepted modes are copied into a private release repository and pinned by hash in the game server. Merging here does **not** put a mode live, and an update only goes live after the same review.

Read [CONTRIBUTING.md](CONTRIBUTING.md) first.
