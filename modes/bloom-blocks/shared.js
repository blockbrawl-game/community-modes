// Rules shared by the server, the client model and the fuzz generator. A placement step only says which
// hand slot went where; both sides then run `place`, so cleared lines and points are never sent.

export const SIZE = 9;
export const HAND = 3;
export const TURN_MS = 20000;
export const MAX_PLACEMENTS = 80;

// Each shape is a list of [dx, dy] cells and a flower colour (1-7). The board stores the colour.
export const SHAPES = [
  { c: [[0, 0]], k: 1 },
  { c: [[0, 0], [1, 0]], k: 2 },
  { c: [[0, 0], [0, 1]], k: 2 },
  { c: [[0, 0], [1, 0], [2, 0]], k: 3 },
  { c: [[0, 0], [0, 1], [0, 2]], k: 3 },
  { c: [[0, 0], [1, 0], [0, 1]], k: 4 },
  { c: [[0, 0], [1, 0], [1, 1]], k: 4 },
  { c: [[1, 0], [0, 1], [1, 1]], k: 4 },
  { c: [[0, 0], [0, 1], [1, 1]], k: 4 },
  { c: [[0, 0], [1, 0], [0, 1], [1, 1]], k: 5 },
  { c: [[0, 0], [1, 0], [2, 0], [3, 0]], k: 6 },
  { c: [[0, 0], [0, 1], [0, 2], [0, 3]], k: 6 },
  { c: [[0, 0], [1, 0], [2, 0], [1, 1]], k: 7 },
  { c: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], k: 3 },
  { c: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]], k: 2 },
];

export function emptyBoard() {
  return new Array(SIZE * SIZE).fill(0);
}

export function fits(board, shapeId, x, y) {
  const shape = SHAPES[shapeId];
  if (!shape || !Number.isInteger(x) || !Number.isInteger(y)) return false;
  for (const [dx, dy] of shape.c) {
    const cx = x + dx, cy = y + dy;
    if (cx < 0 || cy < 0 || cx >= SIZE || cy >= SIZE || board[cy * SIZE + cx] !== 0) return false;
  }
  return true;
}

export function anyFit(board, hand) {
  for (const shapeId of hand) {
    if (shapeId < 0) continue;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (fits(board, shapeId, x, y)) return true;
  }
  return false;
}

/** Full rows and columns if the shape were placed at (x, y), without changing the board. */
export function linesIfPlaced(board, shapeId, x, y) {
  const b = board.slice();
  for (const [dx, dy] of SHAPES[shapeId].c) b[(y + dy) * SIZE + x + dx] = 1;
  return fullLines(b);
}

function fullLines(board) {
  const rows = [], cols = [];
  for (let i = 0; i < SIZE; i++) {
    let row = true, col = true;
    for (let j = 0; j < SIZE; j++) {
      if (board[i * SIZE + j] === 0) row = false;
      if (board[j * SIZE + i] === 0) col = false;
    }
    if (row) rows.push(i);
    if (col) cols.push(i);
  }
  return { rows, cols };
}

export function points(cells, lines, streak) {
  return cells + (lines > 0 ? 10 * lines * lines + 5 * streak : 0);
}

/**
 * Places a shape that fits and clears full rows and columns. Mutates `board`.
 * Returns { lines, cleared: [{ i, k }] } where cleared lists every cell that bloomed and its colour.
 */
export function place(board, shapeId, x, y) {
  const shape = SHAPES[shapeId];
  for (const [dx, dy] of shape.c) board[(y + dy) * SIZE + x + dx] = shape.k;
  const { rows, cols } = fullLines(board);
  const clear = new Set();
  for (const r of rows) for (let j = 0; j < SIZE; j++) clear.add(r * SIZE + j);
  for (const c of cols) for (let j = 0; j < SIZE; j++) clear.add(j * SIZE + c);
  const cleared = [];
  for (const i of clear) { cleared.push({ i, k: board[i] }); board[i] = 0; }
  return { lines: rows.length + cols.length, cells: shape.c.length, cleared };
}

/** Applies a placement to the shared match state; identical on server and client. */
export function applyPlacement(state, p, slot, x, y) {
  const shapeId = state.hands[p][slot];
  const outcome = place(state.board, shapeId, x, y);
  const player = state.players[p];
  player.streak = outcome.lines > 0 ? player.streak + 1 : 0;
  const gained = points(outcome.cells, outcome.lines, player.streak);
  player.score += gained;
  state.hands[p][slot] = -1;
  state.placements++;
  return { ...outcome, gained, shapeId };
}

/** Highest score first; a player who left finishes last. */
export function ranking(order, players) {
  const key = (p) => (players[p].out ? -1 : players[p].score);
  const idx = order.map((_, p) => p).sort((a, b) => key(b) - key(a));
  const out = [];
  for (const p of idx) {
    const last = out[out.length - 1];
    const lastP = last === undefined ? -1 : order.indexOf(Array.isArray(last) ? last[0] : last);
    if (lastP >= 0 && key(lastP) === key(p)) out[out.length - 1] = Array.isArray(last) ? [...last, order[p]] : [last, order[p]];
    else out.push(order[p]);
  }
  return out;
}
