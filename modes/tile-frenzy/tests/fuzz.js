// Action generator for `devkit test`: grabs what a player can see, sometimes a stale or empty tile.
import { CELLS } from '../shared.js';

export function nextAction(model, playerId, rng) {
  const s = model.state;
  const mine = s.players[s.order.indexOf(playerId)];
  if (s.over || !mine || mine.out) return null;

  if (rng.next() < 0.1) return { t: 'grab', i: rng.int(CELLS) };
  const lit = [];
  for (let i = 0; i < s.tiles.length; i++) {
    // A careful player skips bombs most of the time.
    if (s.tiles[i] > 0 || (s.tiles[i] < 0 && rng.next() < 0.15)) lit.push(i);
  }
  return lit.length ? { t: 'grab', i: rng.pick(lit) } : null;
}
