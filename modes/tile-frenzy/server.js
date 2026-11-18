// Tile Frenzy: a fast, crowded real-time mode.
//
// Every tick (30 a second) the server lights new tiles and lets old ones fade. Players grab lit tiles;
// the first grab the server sees wins. Steps are tiny ({ t: 'lit', i, v } and friends) so even eight
// players at full speed stay far below the batch and bandwidth limits.
import { defineMode, reject } from '@blockbrawl/mode-sdk/server';
import { BOMB, CELLS, FRENZY_AT_MS, GOLD, MATCH_MS, nextCombo, pointsFor, rankByScore, targetLit } from './shared.js';

function rollValue(rng) {
  const r = rng.next();
  if (r < 0.06) return GOLD;
  if (r < 0.16) return BOMB;
  if (r < 0.5) return 1;
  if (r < 0.82) return 2;
  return 3;
}

function lifetimeMs(v, rng) {
  if (v === GOLD) return 700 + rng.int(300);
  if (v === BOMB) return 2500 + rng.int(1000);
  return 1100 + rng.int(900);
}

function spawn(state, ctx) {
  // Pick a random empty cell by walking from a random start; the board is never full.
  let i = ctx.rng.int(CELLS);
  while (state.tiles[i] !== 0) i = (i + 1) % CELLS;
  const v = rollValue(ctx.rng);
  state.tiles[i] = v;
  state.fadeAt[i] = ctx.timeMs + lifetimeMs(v, ctx.rng);
  state.lit++;
  ctx.emit({ t: 'lit', i, v });
}

function finish(state, ctx) {
  state.over = true;
  ctx.emit({ t: 'over' });
}

export default defineMode({
  setup(ctx) {
    return {
      order: ctx.players.map((p) => p.id),
      tiles: new Array(CELLS).fill(0),
      fadeAt: new Array(CELLS).fill(0),
      lit: 0,
      frenzy: false,
      players: ctx.players.map(() => ({ score: 0, combo: 0, lastGrabMs: -1e9, grabs: 0, out: false })),
      over: false,
    };
  },

  onAction(state, action, ctx) {
    if (state.over) throw reject('match_over');
    const p = state.order.indexOf(ctx.playerId);
    const player = state.players[p];
    if (!player || player.out) throw reject('out');
    if (!action || action.t !== 'grab' || !Number.isInteger(action.i) || action.i < 0 || action.i >= CELLS) {
      throw reject('unknown_action');
    }
    const v = state.tiles[action.i];
    if (v === 0) throw reject('gone'); // someone was faster, or it faded

    const combo = nextCombo(v, player.combo, player.lastGrabMs, ctx.timeMs);
    const points = pointsFor(v, combo);
    state.tiles[action.i] = 0;
    state.fadeAt[action.i] = 0;
    state.lit--;
    player.combo = combo;
    player.lastGrabMs = ctx.timeMs;
    player.score += points;
    player.grabs++;
    ctx.emit({ t: 'grab', i: action.i, p, pts: points, combo, score: player.score });
  },

  onTick(state, dtMs, ctx) {
    if (state.over) return;
    if (ctx.timeMs >= MATCH_MS) {
      finish(state, ctx);
      return;
    }
    if (!state.frenzy && ctx.timeMs >= FRENZY_AT_MS) {
      state.frenzy = true;
      ctx.emit({ t: 'frenzy' });
    }

    for (let i = 0; i < CELLS; i++) {
      if (state.tiles[i] !== 0 && state.fadeAt[i] <= ctx.timeMs) {
        state.tiles[i] = 0;
        state.fadeAt[i] = 0;
        state.lit--;
        ctx.emit({ t: 'fade', i });
      }
    }

    const active = state.players.filter((pl) => !pl.out).length;
    const target = targetLit(Math.max(1, active), state.frenzy);
    // Up to two new tiles a tick, so the board fills quickly but not all at once.
    for (let n = 0; n < 2 && state.lit < target; n++) {
      if (ctx.rng.next() < (state.frenzy ? 0.7 : 0.35)) spawn(state, ctx);
    }
  },

  onPlayerStatus(state, playerId, status, ctx) {
    if (status !== 'forfeited' || state.over) return;
    const p = state.order.indexOf(playerId);
    const player = state.players[p];
    if (!player || player.out) return;
    player.out = true;
    ctx.emit({ t: 'out', p });
    if (state.players.every((pl) => pl.out)) finish(state, ctx);
  },

  sync(state) {
    return [{
      t: 'state',
      order: state.order,
      endsAt: MATCH_MS,
      frenzyAt: FRENZY_AT_MS,
      tiles: state.tiles,
      frenzy: state.frenzy,
      over: state.over,
      players: state.players.map((pl) => ({ score: pl.score, combo: pl.combo, grabs: pl.grabs, out: pl.out })),
    }];
  },

  result(state) {
    if (!state.over) return null;
    const scores = {};
    state.order.forEach((id, p) => { scores[id] = state.players[p].score; });
    return { ranking: rankByScore(state.order, scores), scores };
  },
});
