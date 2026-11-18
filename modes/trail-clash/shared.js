// Rules shared by the server and the client model. The server only says which way every trail went
// ({ t: 'mv', d: [...] }); both sides then run the same `advance`, so crashes never need their own step.

export const SIZE = 40;
export const WALL = -1;
export const MATCH_MS = 90000;
export const SHRINK_AT_MS = 45000;
export const SHRINK_EVERY_MS = 2000;
export const START_MOVE_TICKS = 3; // ticks per cell at the start (20 ticks a second)
export const MIN_MOVE_TICKS = 2;
export const SPEED_UP_AT_MS = 25000;

export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left

const STARTS = [
  { x: 8, y: 8, dir: 1 },
  { x: 31, y: 31, dir: 3 },
  { x: 31, y: 8, dir: 2 },
  { x: 8, y: 31, dir: 0 },
];

export function startPlayers(count) {
  if (count === 1) return [{ x: 20, y: 30, dir: 0, alive: true, diedAt: -1, len: 1 }];
  return STARTS.slice(0, count).map((s) => ({ ...s, alive: true, diedAt: -1, len: 1 }));
}

export function startGrid(players) {
  const grid = new Array(SIZE * SIZE).fill(0);
  players.forEach((pl, p) => { grid[pl.y * SIZE + pl.x] = p + 1; });
  return grid;
}

export function moveTicksAt(timeMs) {
  return timeMs >= SPEED_UP_AT_MS ? MIN_MOVE_TICKS : START_MOVE_TICKS;
}

/** A turn is allowed unless it keeps the same heading or reverses into the trail. */
export function canTurn(heading, d) {
  return Number.isInteger(d) && d >= 0 && d <= 3 && d !== heading && d !== (heading + 2) % 4;
}

/**
 * Moves every living trail one cell. `dirs[p]` is the heading player p takes for this move.
 * Mutates grid and players, and returns the indexes of the players who crashed.
 */
export function advance(grid, players, dirs, moveNo) {
  const targets = players.map((pl, p) => {
    if (!pl.alive) return -1;
    pl.dir = dirs[p];
    const nx = pl.x + DIRS[pl.dir][0];
    const ny = pl.y + DIRS[pl.dir][1];
    if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) return -2;
    return ny * SIZE + nx;
  });

  const dead = [];
  players.forEach((pl, p) => {
    if (!pl.alive) return;
    const t = targets[p];
    const headOn = targets.some((other, q) => q !== p && other === t && t >= 0);
    if (t < 0 || grid[t] !== 0 || headOn) dead.push(p);
  });

  players.forEach((pl, p) => {
    if (!pl.alive) return;
    if (dead.includes(p)) {
      pl.alive = false;
      pl.diedAt = moveNo;
      return;
    }
    grid[targets[p]] = p + 1;
    pl.x = targets[p] % SIZE;
    pl.y = Math.floor(targets[p] / SIZE);
    pl.len++;
  });
  return dead;
}

/** Turns ring `ring` (0 is the outer edge) into wall. Players standing on it crash. */
export function shrink(grid, players, ring, moveNo) {
  const lo = ring;
  const hi = SIZE - 1 - ring;
  for (let i = lo; i <= hi; i++) {
    grid[lo * SIZE + i] = WALL;
    grid[hi * SIZE + i] = WALL;
    grid[i * SIZE + lo] = WALL;
    grid[i * SIZE + hi] = WALL;
  }
  const dead = [];
  players.forEach((pl, p) => {
    if (!pl.alive) return;
    if (pl.x === lo || pl.x === hi || pl.y === lo || pl.y === hi) {
      pl.alive = false;
      pl.diedAt = moveNo;
      dead.push(p);
    }
  });
  return dead;
}

/** Last one standing first; players who crashed on the same move share a place. */
export function ranking(order, players) {
  const key = (p) => (players[p].alive ? Number.MAX_SAFE_INTEGER : players[p].diedAt);
  const idx = order.map((_, p) => p).sort((a, b) => key(b) - key(a));
  const out = [];
  for (const p of idx) {
    const last = out[out.length - 1];
    const lastP = last === undefined ? -1 : order.indexOf(Array.isArray(last) ? last[0] : last);
    if (lastP >= 0 && key(lastP) === key(p)) {
      out[out.length - 1] = Array.isArray(last) ? [...last, order[p]] : [last, order[p]];
    } else {
      out.push(order[p]);
    }
  }
  return out;
}
