const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../core.js');
const levels = require('../levels.js');
const level = levels.find(level => level.id === 23);
const grass = [2,8,12,13,14,15,16,17,20,26,32];
const pairs = [0,1,2,4,5].flatMap(kind => {
  const indices = level.layout.flatMap((value, i) => value === kind ? [i] : []);
  return Array.from({length: indices.length / 2}, (_, i) => indices.slice(i * 2, i * 2 + 2));
});
const create = () => { const game = new Game({ level }); game.start(0); return game; };
const match = (game, n, now) => pairs[n].forEach(index => assert.equal(game.select(index, now), true));
test('reef third has eleven grass cells on row/column three, five balanced kinds and a fixed sixty-second deck', () => {
  const game = create();
  assert.equal(level.rows, 6); assert.equal(level.columns, 6); assert.equal(game.duration, 60000);
  assert.equal(game.totalPairs, 18);
  assert.deepEqual(game.cards.filter(card => card.tangled).map(card => card.index), grass);
  assert.deepEqual([0,1,2,4,5].map(kind => level.layout.filter(value => value === kind).length), [8,8,8,6,6]);
  assert.equal(game.conditions[0].type, 'timedPairs');
  assert.notDeepEqual(level.layout, levels.find(level => level.id === 22).layout);
  game.select(2, 0); game.select(1, 0);
  assert.equal(game.isGrassLocked(game.cards[2]), true);
  assert.equal(game.cards[3].tangled, true); assert.equal(game.cards[1].tangled, false);
  game.start(10000); assert.deepEqual(game.cards.map(card => card.value), level.layout);
  assert.deepEqual(game.cards.filter(card => card.tangled).map(card => card.index), grass);
});
for (const [third, expected] of [[15000,true],[15001,false]]) test(`reef third three-match window at ${third - 10000} ms: ${expected}`, () => {
  const game = create(); match(game, 0, 10000); match(game, 1, 12500); match(game, 2, third);
  assert.equal(game.conditionStates[0].completed, expected);
});
for (const [spacing, state] of [[1000,'won'],[3100,'lost']]) test(`clearing reef third at ${spacing} ms intervals results in ${state}`, () => {
  const game = create(); pairs.forEach((_, i) => match(game, i, i * spacing));
  assert.equal(game.pairs, 18); assert.equal(game.state, state);
  assert.equal(game.conditionStates[0].completed, state === 'won');
  if (state === 'lost') assert.equal(game.failureReason, 'conditions');
  assert.ok(game.remaining <= 60000);
});
