const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../core.js');
const level = require('../levels.js').find(level => level.id === 19);
const create = () => { const game = new Game({ level }); game.start(0); return game; };
const pairs = [0, 1, 2, 4, 5].flatMap(kind => {
  const cells = level.layout.flatMap((value, index) => value === kind ? [index] : []);
  return Array.from({ length: cells.length / 2 }, (_, i) => ({ kind, cells: cells.slice(i * 2, i * 2 + 2) }));
});
const conch = pairs.find(pair => pair.kind === 4), fish = pairs.find(pair => pair.kind === 5);
const firstSixteen = pairs.filter(pair => pair !== conch && pair !== fish);
function match(game, pair, now) {
  for (const cell of pair.cells) { game.clearFog(cell, now); assert.equal(game.select(cell, now), true); }
}
function mistakes(game, count, start = 0) {
  for (let i = 0; i < count; i++) { game.select(6, start + i * 500); game.select(7, start + i * 500); }
  game.update(start + count * 500);
}

test('night nine uses a fixed balanced 6x6 deck with left/right/left half-row fog', () => {
  const game = create();
  assert.equal(game.duration, 60000); assert.equal(game.totalPairs, 18);
  assert.deepEqual(game.cards.filter(card => card.fog).map(card => card.index), [0, 1, 2, 15, 16, 17, 24, 25, 26]);
  assert.deepEqual([0, 1, 2, 4, 5].map(kind => level.layout.filter(value => value === kind).length), [8, 8, 8, 6, 6]);
  assert.deepEqual(game.conditions.map(condition => condition.type), ['pairKindFromEnd', 'maxMismatches']);
  game.clearFog(0, 0); assert.equal(game.mismatches, 0);
  game.update(5000); assert.equal(game.cards[0].fog.covered, true);
  game.start(10000); assert.deepEqual(game.cards.map(card => card.value), level.layout);
});

for (const count of [0, 20]) test(`correct penultimate conch wins with ${count} mistakes and a non-conch final pair`, () => {
  const game = create(); mistakes(game, count);
  firstSixteen.forEach(pair => match(game, pair, count * 500));
  assert.equal(game.conditionStates[0].completed, false);
  match(game, conch, count * 500);
  assert.equal(game.pairs, 17); assert.equal(game.conditionStates[0].completed, true);
  assert.equal(game.conditionStates[1].completed, false);
  match(game, fish, count * 500);
  assert.equal(game.state, 'won'); assert.equal(game.lastMatchedKind, 5);
  assert.ok(game.conditionStates.every(condition => condition.completed));
  assert.equal(game.bonusTime, count * 500);
});

test('a conch as only the final pair does not satisfy the penultimate condition', () => {
  const game = create(); firstSixteen.forEach(pair => match(game, pair, 0));
  match(game, fish, 0); assert.equal(game.state, 'playing');
  assert.equal(game.conditionStates[0].completed, false);
  match(game, conch, 0);
  assert.equal(game.state, 'lost'); assert.equal(game.failureReason, 'conditions');
  assert.equal(game.conditionStates[1].completed, true);
});

test('the twenty-first mistake fails instantly, without tide penalties or waiting for cover', () => {
  const game = create(); mistakes(game, 20);
  assert.equal(game.state, 'playing'); assert.equal(game.remaining, 50000);
  game.select(6, 10000); game.select(7, 10000);
  assert.equal(game.mismatches, 21); assert.equal(game.state, 'lost');
  assert.equal(game.failureReason, 'conditions'); assert.equal(game.pending, null);
  assert.equal(game.remaining, 50000); assert.equal(game.cards[7].status, 'open');
  assert.deepEqual(game.pairKinds, []);
});

test('a satisfied order condition composes with the mismatch limit using AND', () => {
  const combined = new Game({ level: { ...level, conditions: [{ ...level.conditions[0], fromEnd: 18 }, level.conditions[1]] } });
  combined.start(0); match(combined, conch, 0); mistakes(combined, 20, 0);
  combined.select(6, 10000); combined.select(7, 10000);
  assert.equal(combined.conditionStates[0].completed, true);
  assert.equal(combined.state, 'lost'); assert.equal(combined.failureReason, 'conditions');
});

test('pause preserves order and fog windows, while retry clears all per-run condition state', () => {
  const game = create(); match(game, conch, 0); game.clearFog(0, 1000); game.pause(2000);
  game.update(60000); assert.equal(game.remaining, 58000);
  assert.deepEqual(game.pairKinds, [4]); game.resume(60000); game.update(60999);
  assert.equal(game.cards[0].fog.covered, false);
  game.start(70000);
  assert.deepEqual(game.pairKinds, []); assert.equal(game.mismatches, 0);
  assert.ok(game.conditionStates.every(condition => !condition.completed));
  assert.equal(game.cards.filter(card => card.fog?.covered).length, 9);
});
