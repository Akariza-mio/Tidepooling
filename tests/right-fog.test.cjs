const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../core.js');
const level = require('../levels.js').find(level => level.id === 17);
const create = (selected = level) => { const game = new Game({ level: selected }); game.start(0); return game; };
const mistake = (game, now) => { game.select(0, now); game.select(1, now); };

test('night seven has a fixed balanced 6x6 deck, 60 seconds and only the right three columns fogged', () => {
  const game = create();
  assert.equal(game.duration, 60000); assert.equal(game.totalPairs, 18);
  assert.deepEqual([0, 1, 2, 4, 5].map(kind => game.cards.filter(card => card.value === kind).length), [8, 8, 8, 6, 6]);
  assert.deepEqual(game.cards.filter(card => card.fog).map(card => card.index), Array.from({ length: 36 }, (_, i) => i).filter(i => i % 6 >= 3));
  game.start(10000); assert.deepEqual(game.cards.map(card => card.value), level.layout);
  assert.equal(game.conditions[0].label, '配对失败会导致潮水上涨');
});

test('one mismatch costs exactly three seconds once; the reveal and fog clocks are unaffected', () => {
  const game = create();
  game.clearFog(3, 0); game.select(0, 100);
  assert.equal(game.remaining, 59900);
  assert.equal(game.select(0, 100), false);
  game.select(1, 100);
  assert.equal(game.remaining, 56900); assert.equal(game.mismatches, 1);
  assert.equal(game.activeTime, 100); assert.equal(game.pending.at, 600);
  assert.equal(game.select(2, 100), false); assert.equal(game.remaining, 56900);
  game.update(599); assert.equal(game.cards[0].status, 'open');
  game.update(600); assert.equal(game.cards[0].status, 'hidden');
  game.update(4999); assert.equal(game.cards[3].fog.covered, false);
  game.update(5000); assert.equal(game.cards[3].fog.covered, true);
  assert.equal(game.remaining, 52000);
});

test('a penalty exhausting the time fails immediately; late clicks cannot receive a match bonus', () => {
  const game = create(); mistake(game, 58000);
  assert.equal(game.remaining, 0); assert.equal(game.state, 'lost');
  assert.equal(game.failureReason, 'timeout'); assert.equal(game.pending, null);
  assert.equal(game.select(2, 58000), false);
  const late = create(); late.select(0, 59999); late.select(5, 60000);
  assert.equal(late.state, 'lost'); assert.equal(late.bonusTime, 0);
});

test('matching caps recovered time; one mistake does not prevent later completion', () => {
  const game = create(); mistake(game, 0); game.update(500);
  for (const kind of [0, 1, 2, 4, 5]) for (const card of game.cards.filter(card => card.value === kind)) {
    game.clearFog(card.index, 500); assert.equal(game.select(card.index, 500), true);
  }
  assert.equal(game.state, 'won'); assert.equal(game.mismatches, 1);
  assert.equal(game.pairs, 18); assert.equal(game.bonusTime, 3500);
  assert.equal(game.remaining, 60000);
  assert.equal(game.conditionStates[0].completed, true);
});

test('pause freezes independent clocks and restart clears penalties and resets right-side fog', () => {
  const game = create(); game.clearFog(3, 0); mistake(game, 1000); game.pause(1100);
  game.update(60000); assert.equal(game.remaining, 55900);
  assert.equal(game.select(2, 60000), false); assert.equal(game.mismatches, 1);
  game.resume(60000); game.update(60400);
  assert.equal(game.cards[0].status, 'hidden'); assert.equal(game.cards[3].fog.covered, false);
  game.start(70000); assert.equal(game.remaining, 60000); assert.equal(game.mismatches, 0);
  assert.ok(game.cards.filter(card => card.fog).every(card => card.fog.covered));
});

test('penalties compose with a failure limit while other levels retain their original timing', () => {
  const game = create({ ...level, conditions: [...level.conditions, { type: 'maxMismatches', limit: 0 }] });
  mistake(game, 0); assert.equal(game.state, 'lost'); assert.equal(game.failureReason, 'conditions');
  assert.equal(game.remaining, 57000);
  const ordinary = create(require('../levels.js').find(level => level.id === 8));
  const other = ordinary.cards.find(card => card.value !== ordinary.cards[0].value);
  ordinary.select(0, 0); ordinary.select(other.index, 0);
  assert.equal(ordinary.remaining, 60000);
});
