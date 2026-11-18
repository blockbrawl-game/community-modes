// Bloom Blocks: a turn-based placement puzzle, solo or as a two-player duel on one shared garden.
//
// The server is light on purpose (two ticks a second, only for the duel turn clock); the client does
// all the visual work. That makes this mode the counterpart to Tile Frenzy when testing: low server
// load, heavy rendering.
import { defineMode, reject } from '@blockbrawl/mode-sdk/server';
import { HAND, MAX_PLACEMENTS, SHAPES, TURN_MS, anyFit, applyPlacement, emptyBoard, fits, ranking } from './shared.js';

function deal(state, p, ctx) {
  const hand = [];
  for (let n = 0; n < HAND; n++) hand.push(ctx.rng.int(SHAPES.length));
  state.hands[p] = hand;
  ctx.emit({ t: 'hand', p, h: hand });
}

function finish(state, ctx, why) {
  state.over = true;
  state.why = why;
  ctx.emit({ t: 'over', why });
}

/** Hands the turn to the next player and ends the match if they cannot plant anything. */
function nextTurn(state, ctx) {
  const solo = state.players.length === 1;
  if (!solo) state.turn = (state.turn + 1) % state.players.length;
  state.turnEndsAt = solo ? 0 : ctx.timeMs + TURN_MS;
  ctx.emit({ t: 'turn', p: state.turn, endsAt: state.turnEndsAt });
  if (state.placements >= MAX_PLACEMENTS) finish(state, ctx, 'season_over');
  else if (!anyFit(state.board, state.hands[state.turn])) finish(state, ctx, 'garden_full');
}

export default defineMode({
  setup(ctx) {
    const solo = ctx.players.length === 1;
    const state = {
      order: ctx.players.map((p) => p.id),
      board: emptyBoard(),
      hands: ctx.players.map(() => []),
      players: ctx.players.map(() => ({ score: 0, streak: 0, out: false })),
      turn: 0,
      turnEndsAt: solo ? 0 : TURN_MS,
      placements: 0,
      over: false,
      why: null,
    };
    for (let p = 0; p < ctx.players.length; p++) deal(state, p, ctx);
    return state;
  },

  onAction(state, action, ctx) {
    if (state.over) throw reject('match_over');
    const p = state.order.indexOf(ctx.playerId);
    if (p < 0 || state.players[p].out) throw reject('out');
    if (p !== state.turn) throw reject('not_your_turn');
    if (!action || action.t !== 'place') throw reject('unknown_action');
    const { k, x, y } = action;
    if (!Number.isInteger(k) || k < 0 || k >= HAND) throw reject('bad_slot');
    const shapeId = state.hands[p][k];
    if (shapeId === undefined || shapeId < 0) throw reject('slot_empty');
    if (!fits(state.board, shapeId, x, y)) throw reject('does_not_fit');

    applyPlacement(state, p, k, x, y);
    ctx.emit({ t: 'place', p, k, x, y });
    if (state.hands[p].every((s) => s < 0)) deal(state, p, ctx);
    nextTurn(state, ctx);
  },

  onTick(state, dtMs, ctx) {
    if (state.over || state.players.length === 1) return;
    if (ctx.timeMs >= state.turnEndsAt) {
      ctx.emit({ t: 'timeout', p: state.turn });
      state.players[state.turn].streak = 0;
      nextTurn(state, ctx);
    }
  },

  onPlayerStatus(state, playerId, status, ctx) {
    if (status !== 'forfeited' || state.over) return;
    const p = state.order.indexOf(playerId);
    if (p < 0 || state.players[p].out) return;
    state.players[p].out = true;
    ctx.emit({ t: 'out', p });
    finish(state, ctx, 'forfeit');
  },

  sync(state) {
    return [{
      t: 'state',
      order: state.order,
      board: state.board,
      hands: state.hands,
      players: state.players,
      turn: state.turn,
      turnEndsAt: state.turnEndsAt,
      placements: state.placements,
      over: state.over,
      why: state.why,
    }];
  },

  result(state) {
    if (!state.over) return null;
    const scores = {};
    state.order.forEach((id, p) => { scores[id] = state.players[p].score; });
    return { ranking: ranking(state.order, state.players), scores };
  },
});
