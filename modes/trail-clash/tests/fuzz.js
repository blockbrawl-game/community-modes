// Action generator for `devkit test`: turns now and then, and tries not to drive straight into a wall.
import { DIRS, SIZE } from '../shared.js';

export function nextAction(model, playerId, rng) {
  const s = model.state;
  const p = s.order.indexOf(playerId);
  const mine = s.players[p];
  if (s.over || !mine || !mine.alive) return null;

  const ahead = (d) => {
    const x = mine.x + DIRS[d][0];
    const y = mine.y + DIRS[d][1];
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE && s.grid[y * SIZE + x] === 0;
  };
  if (!ahead(mine.dir)) {
    const left = (mine.dir + 3) % 4;
    const right = (mine.dir + 1) % 4;
    return { t: 'turn', d: ahead(left) ? left : right };
  }
  if (rng.next() < 0.08) return { t: 'turn', d: (mine.dir + (rng.next() < 0.5 ? 1 : 3)) % 4 };
  if (rng.next() < 0.01) return { t: 'turn', d: rng.int(4) }; // sometimes invalid: same or reverse
  return null;
}
