// Rules shared by the server, the client model and the fuzz generator.

export const SIZE = 8;
export const CELLS = SIZE * SIZE;
export const MATCH_MS = 60000;
export const FRENZY_AT_MS = 50000; // the last ten seconds spawn twice as many tiles
export const COMBO_WINDOW_MS = 1000;
export const MAX_COMBO = 5;

// Tile values. 0 is an empty cell.
export const GOLD = 5;
export const BOMB = -3;

/** Points for grabbing a tile of value `v` with the given combo (after the grab). */
export function pointsFor(v, combo) {
  return v < 0 ? v : v * combo;
}

/** The combo a grab at `timeMs` produces, given the player's last grab. A bomb always breaks it. */
export function nextCombo(v, combo, lastGrabMs, timeMs) {
  if (v < 0) return 0;
  if (combo > 0 && timeMs - lastGrabMs <= COMBO_WINDOW_MS) return Math.min(MAX_COMBO, combo + 1);
  return 1;
}

/** How many tiles may be lit at once. */
export function targetLit(players, frenzy) {
  return Math.min(CELLS - 4, 3 + players * 2 + (frenzy ? 8 : 0));
}

/** Ranking for `result()`: highest score first, equal scores tied. */
export function rankByScore(order, scores) {
  const sorted = [...order].sort((a, b) => scores[b] - scores[a]);
  const ranking = [];
  for (const id of sorted) {
    const last = ranking[ranking.length - 1];
    const lastId = Array.isArray(last) ? last[0] : last;
    if (lastId !== undefined && scores[lastId] === scores[id]) {
      ranking[ranking.length - 1] = Array.isArray(last) ? [...last, id] : [last, id];
    } else {
      ranking.push(id);
    }
  }
  return ranking;
}
