const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../core.js');
const level = require('../levels.js').find(level => level.id === 13);
function create() {
  const game = new Game({ level });
  game.start(0);
  return game;
}
function mistakes(game, count) {
  const a = game.cards.find(card => !card.fog);
  const b = game.cards.find(card => !card.fog && card.value !== a.value);
  for (let i = 0; i < count; i++) {
    assert.equal(game.select(a.index, i * 500), true);
    assert.equal(game.select(b.index, i * 500), true);
  }
}
function finish(game, now = 11000) {
  for (const kind of [0, 1, 2, 4, 5]) for (const card of game.cards.filter(card => card.value === kind)) {
    game.clearFog(card.index, now);
    assert.equal(game.select(card.index, now++), true);
  }
}

test('night level three has central 2x2 fog, balanced even counts, and fixed entries/restarts', () => {
  const game = create();
  assert.equal(game.duration, 60000);
  assert.equal(game.totalPairs, 18);
  assert.deepEqual(game.cards.filter(card => card.fog).map(card => card.index), [14, 15, 20, 21]);
  const pool = [...level.layout];
  for (let i = 0; i < 10; i++) {
    const before = game.cards.map(card => card.value);
    game.start(0);
    assert.deepEqual(game.cards.map(card => card.value), before);
    assert.deepEqual(create().cards.map(card => card.value), pool);
    assert.deepEqual([0, 1, 2, 4, 5].map(kind => game.cards.filter(card => card.value === kind).length), [8, 8, 8, 6, 6]);
    assert.deepEqual(level.layout, pool);
  }
  assert.equal(game.clearFog(14, 0), true);
  assert.equal(game.mismatches, 0);
  assert.equal(game.select(15, 1), false);
  game.update(5000);
  assert.equal(game.cards[14].fog.covered, true);
});

test('twenty mistakes remain playable; the twenty-first fails on the second flip without delay', () => {
  const game = create();
  mistakes(game, 20);
  assert.equal(game.state, 'playing');
  assert.equal(game.mismatches, 20);
  assert.equal(game.conditionStates[0].failed, false);
  game.update(10000);
  const a = game.cards.find(card => !card.fog);
  const b = game.cards.find(card => !card.fog && card.value !== a.value);
  game.select(a.index, 10000);
  game.select(b.index, 10000);
  assert.equal(game.mismatches, 21);
  assert.equal(game.state, 'lost');
  assert.equal(game.failureReason, 'conditions');
  assert.equal(game.pending, null);
  assert.equal(game.cards[b.index].status, 'open');
  assert.ok(game.remaining > 0);
  game.start(20000);
  assert.equal(game.mismatches, 0);
  assert.ok(game.cards.filter(card => card.fog).every(card => card.fog.covered));
});

for (const count of [0, 20]) test(`all pairs can win after ${count} mistakes, with no fish-last condition`, () => {
  const game = create();
  mistakes(game, count);
  finish(game);
  assert.equal(game.state, 'won');
  assert.equal(game.pairs, 18);
  assert.equal(game.mismatches, count);
  assert.deepEqual(game.conditions.map(condition => condition.type), ['maxMismatches']);
});
