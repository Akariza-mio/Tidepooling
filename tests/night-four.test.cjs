const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../core.js');
const level = require('../levels.js').find(level => level.id === 14);
const create = () => {
  let seed = 14809;
  const game = new Game({ level, random: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32) });
  game.start(0);
  return game;
};

test('night level four shuffles each start while preserving counts, its pool and one crab pair', () => {
  const game = create();
  assert.equal(game.duration, 60000);
  assert.equal(game.totalPairs, 18);
  assert.equal(level.rows, 6);
  assert.equal(level.columns, 6);
  assert.deepEqual([0, 1, 2, 4, 5].map(kind => game.cards.filter(card => card.value === kind).length), [10, 2, 8, 8, 8]);
  const pool = [...level.layout];
  const crabPositions = new Set();
  for (let i = 0; i < 20; i++) {
    const before = game.cards.map(card => card.value);
    game.start(i * 5000);
    assert.notDeepEqual(game.cards.map(card => card.value), before);
    assert.deepEqual([0, 1, 2, 4, 5].map(kind => game.cards.filter(card => card.value === kind).length), [10, 2, 8, 8, 8]);
    assert.deepEqual(level.layout, pool);
    crabPositions.add(game.cards.filter(card => card.value === 1).map(card => card.index).join(','));
  }
  assert.ok(crabPositions.size > 1, 'The unique crab pair must also change positions.');
});

test('fog covers exactly the twelve cells marked in the user reference', () => {
  const game = create();
  const pattern = Array.from({ length: 6 }, (_, row) => game.cards.slice(row * 6, row * 6 + 6).map(card => card.fog ? '#' : '.').join(''));
  assert.deepEqual(pattern, ['.#..#.', '.#.#..', '.##...', '.##...', '.#.#..', '.#..#.']);
  assert.equal(game.cards.filter(card => card.fog).length, 12);
  assert.equal(game.select(1, 0), false);
  assert.equal(game.clearFog(1, 0), true);
  assert.equal(game.cards[1].status, 'hidden');
  game.update(5000);
  assert.equal(game.cards[1].fog.covered, true);
});

test('night levels two and three retain their fixed layouts', () => {
  for (const id of [12, 13]) {
    const fixedLevel = require('../levels.js').find(level => level.id === id);
    const game = new Game({ level: fixedLevel, random: () => { throw Error('Only level fourteen may shuffle'); } });
    game.start(0);
    game.start(5000);
    assert.deepEqual(game.cards.map(card => card.value), [...fixedLevel.layout]);
  }
});

for (const lastKind of [1, 0]) test(`crab-last condition ${lastKind === 1 ? 'passes' : 'fails'} for final kind ${lastKind}`, () => {
  const game = create();
  let now = 0;
  for (const kind of [0, 1, 2, 4, 5].filter(kind => kind !== lastKind).concat(lastKind)) {
    for (const card of game.cards.filter(card => card.value === kind)) {
      game.clearFog(card.index, now);
      assert.equal(game.select(card.index, ++now), true);
      if (game.pairs < game.totalPairs) {
        assert.equal(game.state, 'playing', 'Crabs collected early fail only at completion.');
        assert.equal(game.conditionStates[0].completed, false);
      }
    }
  }
  assert.equal(game.pairs, 18);
  assert.equal(game.state, lastKind === 1 ? 'won' : 'lost');
  assert.equal(game.failureReason, lastKind === 1 ? null : 'conditions');
  assert.equal(game.lastMatchedKind, lastKind);
});
