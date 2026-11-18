// Tile Frenzy client model.
//
// `auth` is what the server confirmed. Grabs are predicted: a tile this player has tapped is hidden at
// once and comes back only if the server rejects the grab (someone else was faster). Visual-only data
// (when a tile lit up, recent grab pop-ups) lives in `fx`, outside the snapshot, because a client that
// joined late through sync() never saw those moments.
export function createModel() {
  const auth = { me: -1, order: [], endsAt: 0, frenzyAt: 0, frenzy: false, over: false, tiles: [], players: [] };
  const fx = { litAt: [], pops: [], popCount: 0, events: 0 };
  let you = null;
  let pending = new Map(); // actionId -> tile index

  function apply(step) {
    switch (step.t) {
      case 'state':
        auth.order = step.order;
        auth.me = step.order.indexOf(you);
        auth.endsAt = step.endsAt;
        auth.frenzyAt = step.frenzyAt;
        auth.frenzy = step.frenzy;
        auth.over = step.over;
        auth.tiles = step.tiles.slice();
        auth.players = step.players.map((pl) => ({ ...pl }));
        fx.litAt = new Array(auth.tiles.length).fill(0);
        break;
      case 'lit':
        auth.tiles[step.i] = step.v;
        fx.litAt[step.i] = performanceNow();
        break;
      case 'fade':
        auth.tiles[step.i] = 0;
        break;
      case 'grab': {
        const v = auth.tiles[step.i];
        auth.tiles[step.i] = 0;
        const pl = auth.players[step.p];
        pl.score = step.score;
        pl.combo = step.combo;
        pl.grabs++;
        fx.popCount++;
        fx.pops.push({ i: step.i, p: step.p, pts: step.pts, combo: step.combo, v, at: performanceNow() });
        if (fx.pops.length > 64) fx.pops.shift();
        break;
      }
      case 'frenzy':
        auth.frenzy = true;
        break;
      case 'out':
        auth.players[step.p].out = true;
        break;
      case 'over':
        auth.over = true;
        break;
    }
    fx.events++;
  }

  return {
    state: auth,
    fx,

    applySync(steps, info) {
      you = info.you;
      pending = new Map();
      for (const step of steps) apply(step);
    },

    applySteps(batch) {
      for (const step of batch.steps) apply(step);
      if (batch.ackActionId !== undefined) pending.delete(batch.ackActionId);
    },

    onRejected(actionId) {
      pending.delete(actionId);
    },

    predict(actionId, i) {
      pending.set(actionId, i);
    },

    /** Value shown for tile i: hidden while this player's grab of it is in flight. */
    shownTile(i) {
      for (const index of pending.values()) if (index === i) return 0;
      return auth.tiles[i];
    },

    snapshot() {
      return JSON.parse(JSON.stringify(auth));
    },
  };
}

// The dev kit runs the model under Node, where `performance` exists too; keep a fallback anyway.
function performanceNow() {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}
