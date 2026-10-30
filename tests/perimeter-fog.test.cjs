const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../core.js');
const levels = require('../levels.js');
const level = levels.find(level => level.id === 12);
function create() {
  const game = new Game({ level });
  game.start(0);
  return game;
}
const counts = game => [0, 1, 2, 4, 5].map(kind => game.cards.filter(card => card.value === kind).length);

test('night level two has 20 perimeter fog cells, a clear 4x4 center and balanced even counts', () => {
  const game = create();
  assert.equal(game.duration, 60000);
  assert.equal(game.totalPairs, 18);
  assert.deepEqual(counts(game), [8, 8, 8, 6, 6]);
  assert.equal(game.cards.filter(card => card.fog).length, 20);
  for (const card of game.cards) {
    const row = Math.floor(card.index / 6), col = card.index % 6;
    assert.equal(Boolean(card.fog), row === 0 || row === 5 || col === 0 || col === 5);
  }
  assert.equal(game.clearFog(7, 0), false);
  assert.equal(game.select(35, 0), false);
  assert.equal(game.clearFog(35, 0), true);
  game.update(5000);
  assert.equal(game.cards[35].fog.covered, true);
});

test('entries and restarts retain the authored layout without changing counts', () => {
  const game = create(), pool = [...level.layout];
  for (let i = 0; i < 20; i++) {
    const before = game.cards.map(card => card.value);
    game.start(i * 1000);
    assert.deepEqual(game.cards.map(card => card.value), before);
    assert.deepEqual(create().cards.map(card => card.value), pool);
    assert.deepEqual(counts(game), [8, 8, 8, 6, 6]);
    assert.ok(game.cards.filter(card => card.fog).every(card => card.fog.covered));
    assert.deepEqual(level.layout, pool);
  }
  const fixed = new Game({ level: levels.find(level => level.id === 11) });
  fixed.start(0);
  assert.deepEqual(fixed.cards.map(card => card.value), [...fixed.level.layout]);
});

for (const lastKind of [5, 0]) test(`last pair kind ${lastKind} correctly ${lastKind === 5 ? 'wins' : 'fails'}`, () => {
  const game = create();
  assert.equal(game.conditionStates[0].completed, false);
  let now = 0;
  for (const kind of [0, 1, 2, 4, 5].filter(kind => kind !== lastKind).concat(lastKind)) {
    for (const card of game.cards.filter(card => card.value === kind)) {
      game.clearFog(card.index, now);
      assert.equal(game.select(card.index, ++now), true);
    }
  }
  assert.equal(game.pairs, 18);
  assert.equal(game.lastMatchedKind, lastKind);
  assert.equal(game.state, lastKind === 5 ? 'won' : 'lost');
  assert.equal(game.failureReason, lastKind === 5 ? null : 'conditions');
});
