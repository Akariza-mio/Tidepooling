const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../core.js');
const level = require('../levels.js').find(level => level.id === 18);
const create = () => { const game = new Game({ level }); game.start(0); return game; };
const pairs = [0, 1, 2, 4, 5].flatMap(kind => {
  const positions = level.layout.flatMap((value, i) => value === kind ? [i] : []);
  return Array.from({ length: positions.length / 2 }, (_, i) => positions.slice(i * 2, i * 2 + 2));
});
function match(game, index, now) {
  for (const cell of pairs[index]) { game.clearFog(cell, now); assert.equal(game.select(cell, now), true); }
}
test('night eight has exactly the red-circled fog cells, fixed even counts and no mismatch penalty', () => {
  const game = create();
  assert.equal(game.duration, 60000); assert.equal(game.totalPairs, 18);
  assert.deepEqual(game.cards.filter(card => card.fog).map(card => card.index), [2, 3, 7, 10, 14, 15, 19, 22, 25, 28, 32, 33]);
  assert.deepEqual([0, 1, 2, 4, 5].map(kind => level.layout.filter(value => value === kind).length), [8, 8, 8, 6, 6]);
  assert.equal(game.conditions.length, 1); assert.equal(game.conditions[0].type, 'timedPairs');
  game.select(0, 0); game.select(1, 0);
  assert.equal(game.mismatches, 1); assert.equal(game.remaining, 60000);
  game.start(10000); assert.deepEqual(game.cards.map(card => card.value), level.layout);
});
for (const [third, expected] of [[15000, true], [15001, false]]) test(`three matches spanning ${third - 10000} ms satisfy the exact five-second boundary: ${expected}`, () => {
  const game = create(); match(game, 0, 10000); match(game, 1, 12500);
  assert.equal(game.conditionStates[0].completed, false);
  match(game, 2, third); assert.equal(game.conditionStates[0].completed, expected);
  assert.equal(game.state, 'playing');
});
test('a later rolling window can succeed after early attempts miss; time bonuses do not extend the window', () => {
  const game = create(); match(game, 0, 0); match(game, 1, 6000); match(game, 2, 12000);
  assert.equal(game.conditionStates[0].completed, false); assert.equal(game.bonusTime, 10000);
  match(game, 3, 13000); match(game, 4, 14000);
  assert.equal(game.conditionStates[0].completed, true);
  game.update(30000); assert.equal(game.conditionStates[0].completed, true);
  game.start(40000); assert.deepEqual(game.pairTimes, []); assert.equal(game.conditionStates[0].completed, false);
});
test('pause time does not count toward the five-second window', () => {
  const game = create(); match(game, 0, 1000); game.pause(2000);
  game.update(62000); assert.deepEqual(game.pairTimes, [1000]);
  game.resume(62000); match(game, 1, 63000); match(game, 2, 65000);
  assert.deepEqual(game.pairTimes, [1000, 3000, 5000]); assert.equal(game.conditionStates[0].completed, true);
});
test('clearing fog, single flips and invalid inputs never count as completed pairs', () => {
  const game = create(); game.clearFog(2, 0); game.select(2, 0);
  assert.equal(game.select(2, 0), false); assert.equal(game.select(3, 0), false);
  assert.deepEqual(game.pairTimes, []); assert.equal(game.conditionStates[0].completed, false);
});
for (const [spacing, expected] of [[1000, 'won'], [3000, 'lost']]) test(`completing every pair with ${spacing} ms spacing results in ${expected}`, () => {
  const game = create(); pairs.forEach((_, i) => match(game, i, i * spacing));
  assert.equal(game.pairs, 18); assert.equal(game.state, expected);
  assert.equal(game.failureReason, expected === 'lost' ? 'conditions' : null);
  assert.equal(game.conditionStates[0].completed, expected === 'won');
});
test('the final match must precede the actual tide deadline even after the condition is checked', () => {
  const game = create(); match(game, 0, 0); match(game, 1, 1000); match(game, 2, 2000);
  game.update(75000); assert.equal(game.state, 'lost'); assert.equal(game.failureReason, 'timeout');
  assert.equal(game.select(pairs[3][0], 75000), false);
});
