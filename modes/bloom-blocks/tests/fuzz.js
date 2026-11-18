// Action generator for `devkit test`: plants a random hand shape somewhere it fits, on its own turn.
import { HAND, SIZE, fits } from '../shared.js';

export function nextAction(model, playerId, rng) {
  const s = model.state;
  const p = s.order.indexOf(playerId);
  if (s.over || p < 0) return null;
  if (rng.next() < 0.05) return { t: 'place', k: rng.int(HAND), x: rng.int(SIZE), y: rng.int(SIZE) }; // maybe out of turn
  if (p !== s.turn) return null;

  const options = [];
  s.hands[p].forEach((shapeId, k) => {
    if (shapeId < 0) return;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (fits(s.board, shapeId, x, y)) options.push({ t: 'place', k, x, y });
  });
  return options.length ? rng.pick(options) : null;
}
