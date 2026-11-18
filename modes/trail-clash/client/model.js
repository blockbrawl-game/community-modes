// Trail Clash client model.
//
// `auth` mirrors the server exactly by running the shared rules on each { t: 'mv' } step. Turns this
// player sent but the server has not confirmed are kept in `pending`, so the arrow in front of the
// head shows the new heading at once. Animation timing lives in `fx`, outside the snapshot.
import { WALL, advance, shrink } from '../shared.js';

export function createModel() {
  const auth = { me: -1, order: [], grid: [], players: [], moves: 0, ring: -1, moveTicks: 3, endsAt: 0, over: false, queued: [] };
  const fx = { lastMoveAt: 0, crashes: [], crashCount: 0, shrinkAt: 0 };
  let you = null;
  let pending = [];

  function crashed(list) {
    for (const p of list) {
      fx.crashCount++;
      fx.crashes.push({ p, x: auth.players[p].x, y: auth.players[p].y, at: now() });
    }
    if (fx.crashes.length > 16) fx.crashes.splice(0, fx.crashes.length - 16);
  }

  function apply(step) {
    switch (step.t) {
      case 'state':
        auth.order = step.order;
        auth.me = step.order.indexOf(you);
        auth.grid = step.grid.slice();
        auth.players = step.players.map((pl) => ({ ...pl }));
        auth.moves = step.moves;
        auth.ring = step.ring;
        auth.moveTicks = step.moveTicks;
        auth.endsAt = step.endsAt;
        auth.over = step.over;
        auth.queued = step.queues.map((q) => q.slice());
        break;
      case 'q':
        auth.queued[step.p].push(step.d);
        break;
      case 'mv':
        auth.moves++;
        auth.queued.forEach((q, p) => { if (q.length && q[0] === step.d[p]) q.shift(); });
        crashed(advance(auth.grid, auth.players, step.d, auth.moves));
        fx.lastMoveAt = now();
        break;
      case 'shrink':
        auth.ring++;
        crashed(shrink(auth.grid, auth.players, auth.ring, auth.moves));
        fx.shrinkAt = now();
        break;
      case 'speed':
        auth.moveTicks = step.n;
        break;
      case 'die':
        auth.players[step.p].alive = false;
        auth.players[step.p].diedAt = auth.moves;
        crashed([step.p]);
        break;
      case 'over':
        auth.over = true;
        break;
    }
  }

  return {
    state: auth,
    fx,
    WALL,

    applySync(steps, info) {
      you = info.you;
      pending = [];
      for (const step of steps) apply(step);
    },

    applySteps(batch) {
      for (const step of batch.steps) apply(step);
      if (batch.ackActionId !== undefined) {
        const index = pending.findIndex((e) => e.actionId === batch.ackActionId);
        if (index >= 0) pending.splice(0, index + 1);
      }
    },

    onRejected(actionId) {
      pending = pending.filter((e) => e.actionId !== actionId);
    },

    predict(actionId, d) {
      pending.push({ actionId, d });
    },

    /** The heading this player will have after every turn it has sent: drawn as the arrow. */
    nextHeading() {
      const mine = auth.players[auth.me];
      if (!mine) return 0;
      if (pending.length) return pending[pending.length - 1].d;
      const q = auth.queued[auth.me];
      return q && q.length ? q[q.length - 1] : mine.dir;
    },

    pendingCount() {
      return pending.length + (auth.queued[auth.me]?.length ?? 0);
    },

    snapshot() {
      return JSON.parse(JSON.stringify(auth));
    },
  };
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}
