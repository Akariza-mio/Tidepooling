const test = require('node:test');
const assert = require('node:assert/strict');
const MemoryGame = require('../core.js');
const level = require('../levels.js').find(level => level.id === 41);
const create = () => { const game = new MemoryGame({ level }); game.start(0); return game; };
function finish(game, now) {
  for (const kind of [0, 1, 2, 4]) {
    for (const card of game.cards.filter(card => card.value === kind && card.status === 'hidden')) {
      game.select(card.index, now++);
    }
  }
}

test('EX first challenge permits zero or one mistake and still requires all eight pairs', () => {
  assert.equal(level.rows, 4); assert.equal(level.columns, 4);
  assert.equal(level.duration, 60000);
  assert.deepEqual([0, 1, 2, 4].map(kind => level.layout.filter(value => value === kind).length), [4, 4, 4, 4]);
  assert.equal(level.surf, undefined); assert.equal(level.fog, undefined); assert.equal(level.seagrass, undefined);
  for (const mistakes of [0, 1]) {
    const game = create();
    if (mistakes) {
      game.select(0, 0); game.select(1, 0); game.update(500);
      assert.equal(game.state, 'playing'); assert.equal(game.mismatches, 1);
    }
    finish(game, 1000);
    assert.equal(game.state, 'won'); assert.equal(game.pairs, 8);
    assert.equal(game.mismatches, mistakes); assert.equal(game.conditionStates[0].completed, true);
    assert.ok(game.remaining <= 60000); assert.ok(game.bonusTime > 0);
  }
});

test('the second mistake fails immediately, including while an earlier matched pair is being collected', () => {
  const game = create();
  game.select(2, 0); game.select(5, 0);
  game.select(0, 1); game.select(1, 1); game.update(501);
  game.select(0, 502); game.select(1, 502);
  assert.equal(game.state, 'lost'); assert.equal(game.failureReason, 'conditions');
  assert.equal(game.mismatches, 2); assert.equal(game.conditionStates[0].failed, true);
  assert.equal(game.pending, null); assert.equal(game.cards[1].status, 'open');
  assert.ok(game.remaining > 0); assert.equal(game.select(3, 503), false);
});

test('invalid inputs do not spend the allowance, pause freezes exposure, retry restores it', () => {
  const game = create();
  game.select(0, 0); assert.equal(game.select(0, 1), false);
  assert.equal(game.mismatches, 0);
  game.select(1, 2); assert.equal(game.select(2, 3), false);
  game.pause(102); const remaining = game.remaining;
  game.update(90102); assert.equal(game.select(2, 90102), false);
  assert.equal(game.remaining, remaining); assert.equal(game.mismatches, 1);
  game.resume(100000); game.update(100399);
  assert.equal(game.cards[0].status, 'open');
  game.update(100400); assert.equal(game.cards[0].status, 'hidden');
  game.start(110000);
  assert.equal(game.mismatches, 0); assert.equal(game.remaining, 60000);
  assert.deepEqual(game.cards.map(card => card.value), [...level.layout]);
  assert.equal(game.conditionStates[0].failed, false);
  assert.equal(game.select(0, 170000), false); assert.equal(game.failureReason, 'timeout');
});
