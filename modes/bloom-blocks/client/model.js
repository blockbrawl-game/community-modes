// Bloom Blocks client model. `auth` mirrors the server by running the shared rules on each step.
// The last placement's details (which cells bloomed, points gained) go to `fx` for the animations;
// they are not part of the snapshot because a client that joins through sync() never saw them.
import { applyPlacement } from '../shared.js';

export function createModel() {
  const auth = { me: -1, order: [], board: [], hands: [], players: [], turn: 0, turnEndsAt: 0, placements: 0, over: false, why: null };
  const fx = { events: [], count: 0 };
  let you = null;
  let pending = null; // { actionId, k, x, y } while a placement is in flight

  function event(e) {
    fx.count++;
    fx.events.push({ ...e, at: now() });
    if (fx.events.length > 12) fx.events.shift();
  }

  function apply(step) {
    switch (step.t) {
      case 'state':
        auth.order = step.order;
        auth.me = step.order.indexOf(you);
        auth.board = step.board.slice();
        auth.hands = step.hands.map((h) => h.slice());
        auth.players = step.players.map((pl) => ({ ...pl }));
        auth.turn = step.turn;
        auth.turnEndsAt = step.turnEndsAt;
        auth.placements = step.placements;
        auth.over = step.over;
        auth.why = step.why;
        break;
      case 'place': {
        const outcome = applyPlacement(auth, step.p, step.k, step.x, step.y);
        event({ kind: 'place', p: step.p, x: step.x, y: step.y, ...outcome, streak: auth.players[step.p].streak });
        break;
      }
      case 'hand':
        auth.hands[step.p] = step.h.slice();
        event({ kind: 'hand', p: step.p });
        break;
      case 'turn':
        auth.turn = step.p;
        auth.turnEndsAt = step.endsAt;
        break;
      case 'timeout':
        auth.players[step.p].streak = 0;
        event({ kind: 'timeout', p: step.p });
        break;
      case 'out':
        auth.players[step.p].out = true;
        break;
      case 'over':
        auth.over = true;
        auth.why = step.why;
        break;
    }
  }

  return {
    state: auth,
    fx,

    applySync(steps, info) {
      you = info.you;
      pending = null;
      for (const step of steps) apply(step);
    },

    applySteps(batch) {
      for (const step of batch.steps) apply(step);
      if (pending && batch.ackActionId === pending.actionId) pending = null;
    },

    onRejected(actionId) {
      if (pending && pending.actionId === actionId) pending = null;
    },

    predict(actionId, k, x, y) {
      pending = { actionId, k, x, y };
    },

    /** The placement shown before the server confirms it, or null. */
    pending() {
      return pending;
    },

    snapshot() {
      return JSON.parse(JSON.stringify(auth));
    },
  };
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}
