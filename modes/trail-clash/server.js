// Trail Clash: real-time steering with queued turns.
//
// A turn is queued (up to two, so a quick double-tap U-turn works) and taken on the next move. Every
// move the server sends one step with every player's heading; clients run the same `advance` and so
// see exactly the same crashes without them being sent.
import { defineMode, reject } from '@blockbrawl/mode-sdk/server';
import {
  MATCH_MS, SHRINK_AT_MS, SHRINK_EVERY_MS, SIZE,
  advance, canTurn, moveTicksAt, ranking, shrink, startGrid, startPlayers,
} from './shared.js';

function aliveCount(state) {
  return state.players.filter((pl) => pl.alive).length;
}

function checkOver(state, ctx) {
  if (state.over) return;
  const alive = aliveCount(state);
  const solo = state.players.length === 1;
  if (ctx.timeMs >= MATCH_MS || alive === 0 || (!solo && alive <= 1)) {
    state.over = true;
    ctx.emit({ t: 'over' });
  }
}

export default defineMode({
  setup(ctx) {
    const players = startPlayers(ctx.players.length);
    return {
      order: ctx.players.map((p) => p.id),
      grid: startGrid(players),
      players,
      queues: players.map(() => []),
      moveTicks: moveTicksAt(0),
      moveIn: moveTicksAt(0),
      moves: 0,
      ring: -1,
      nextShrinkMs: SHRINK_AT_MS,
      over: false,
    };
  },

  onAction(state, action, ctx) {
    if (state.over) throw reject('match_over');
    const p = state.order.indexOf(ctx.playerId);
    const pl = state.players[p];
    if (!pl || !pl.alive) throw reject('out');
    if (!action || action.t !== 'turn') throw reject('unknown_action');
    const queue = state.queues[p];
    if (queue.length >= 2) throw reject('too_fast');
    const heading = queue.length ? queue[queue.length - 1] : pl.dir;
    if (!canTurn(heading, action.d)) throw reject('bad_turn');
    queue.push(action.d);
    ctx.emit({ t: 'q', p, d: action.d }); // lets other clients show where a trail is about to go
  },

  onTick(state, dtMs, ctx) {
    if (state.over) return;

    const moveTicks = moveTicksAt(ctx.timeMs);
    if (moveTicks !== state.moveTicks) {
      state.moveTicks = moveTicks;
      ctx.emit({ t: 'speed', n: moveTicks });
    }

    if (ctx.timeMs >= state.nextShrinkMs && state.ring < SIZE / 2 - 2) {
      state.ring++;
      state.nextShrinkMs += SHRINK_EVERY_MS;
      shrink(state.grid, state.players, state.ring, state.moves);
      ctx.emit({ t: 'shrink' });
      checkOver(state, ctx);
      if (state.over) return;
    }

    if (--state.moveIn > 0) return;
    state.moveIn = state.moveTicks;
    const dirs = state.players.map((pl, p) => (state.queues[p].length ? state.queues[p].shift() : pl.dir));
    state.moves++;
    advance(state.grid, state.players, dirs, state.moves);
    ctx.emit({ t: 'mv', d: dirs });
    checkOver(state, ctx);
  },

  onPlayerStatus(state, playerId, status, ctx) {
    if (status !== 'forfeited' || state.over) return;
    const p = state.order.indexOf(playerId);
    const pl = state.players[p];
    if (!pl || !pl.alive) return;
    pl.alive = false;
    pl.diedAt = state.moves;
    ctx.emit({ t: 'die', p });
    checkOver(state, ctx);
  },

  sync(state) {
    return [{
      t: 'state',
      order: state.order,
      grid: state.grid,
      players: state.players,
      queues: state.queues,
      moves: state.moves,
      ring: state.ring,
      moveTicks: state.moveTicks,
      endsAt: MATCH_MS,
      over: state.over,
    }];
  },

  result(state) {
    if (!state.over) return null;
    const scores = {};
    state.order.forEach((id, p) => { scores[id] = state.players[p].len; });
    return { ranking: ranking(state.order, state.players), scores };
  },
});
