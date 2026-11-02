const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../core.js');
const level = require('../levels.js').find(level => level.id === 11);
const create = () => { const game = new Game({ level }); game.start(0); return game; };

test('night chapter starts with twelve independent fog cells in the top two rows', () => {
  const game = create();
  assert.equal(level.rows, 6);
  assert.equal(level.columns, 6);
  assert.equal(game.totalPairs, 18);
  assert.equal(game.duration, 60000);
  assert.deepEqual([...new Set(level.layout)].sort(), [0, 1, 2, 4, 5]);
  assert.deepEqual(game.cards.filter(card => card.fog).map(card => card.index), Array.from({ length: 12 }, (_, i) => i));
  assert.ok(game.cards.slice(0, 12).every(card => card.fog.covered));
  assert.equal(game.select(0, 0), false, 'Covered sand cannot be flipped directly.');
});

test('clearing fog is a separate action and each opening lasts exactly five active seconds', () => {
  const game = create();
  assert.equal(game.clearFog(0, 100), true);
  assert.equal(game.cards[0].status, 'hidden');
  assert.equal(game.turns, 0);
  assert.equal(game.mismatches, 0);
  assert.equal(game.bonusTime, 0);
  game.clearFog(1, 1000);
  assert.equal(game.clearFog(0, 2000), false, 'Repeated tapping does not extend a window.');
  game.update(5099);
  assert.equal(game.cards[0].fog.covered, false);
  game.update(5100);
  assert.equal(game.cards[0].fog.covered, true);
  assert.equal(game.cards[1].fog.covered, false);
  game.update(6000);
  assert.equal(game.cards[1].fog.covered, true);
  assert.equal(game.clearFog(0, 6000), true);
  assert.equal(game.select(0, 6001), true);
});

test('fog restoration conceals open/collected cells without changing matching state', () => {
  const game = create();
  game.clearFog(0, 0);
  game.clearFog(7, 0);
  game.select(0, 1);
  game.select(7, 2);
  assert.equal(game.pairs, 1);
  assert.equal(game.bonusTime, 2);
  game.update(5000);
  assert.equal(game.cards[0].fog.covered, true);
  assert.equal(game.cards[0].status, 'matched');
  assert.equal(game.clearFog(0, 5001), true, 'Collected holes can still have their fog cleared.');
  assert.equal(game.select(0, 5002), false);
  assert.equal(game.pairs, 1);
  game.clearFog(1, 5003);
  game.select(1, 5004);
  game.update(10003);
  assert.equal(game.cards[1].status, 'open');
  assert.deepEqual(game.selected, [1]);
  assert.equal(game.cards[1].fog.covered, true);
});

test('fog timing ignores pair bonuses and pauses together with gameplay', () => {
  const game = create();
  game.clearFog(0, 0);
  game.select(12, 1);
  game.select(23, 2); // two crabs below the fog
  assert.equal(game.pairs, 1);
  game.pause(1000);
  assert.equal(game.clearFog(1, 90000), false);
  game.update(90000);
  assert.equal(game.cards[0].fog.covered, false);
  game.resume(100000);
  game.update(103999);
  assert.equal(game.cards[0].fog.covered, false);
  game.update(104000);
  assert.equal(game.cards[0].fog.covered, true);
});

test('fog can be cleared during mismatch exposure without skipping the matching lock', () => {
  const game = create();
  game.select(12, 0);
  game.select(13, 1);
  assert.equal(game.clearFog(0, 100), true);
  assert.equal(game.select(0, 200), false);
  assert.equal(game.mismatches, 1);
  game.update(501);
  assert.equal(game.select(0, 502), true);
});

test('remaining fog never blocks victory and retry restores all twelve fog blocks', () => {
  const game = create();
  for (let i = 0; i < 12; i++) game.clearFog(i, 0);
  // Finish all fog-zone pairs before letting the fog return, leaving a bottom pair.
  const deferred = [32, 35];
  const groups = [0, 1, 2, 4, 5].map(kind => game.cards.filter(card => card.value === kind && !deferred.includes(card.index)).map(card => card.index));
  let now = 1;
  for (const group of groups) for (const index of group) game.select(index, now++);
  game.update(5000);
  assert.ok(game.cards.slice(0, 12).every(card => card.fog.covered && card.status === 'matched'));
  deferred.forEach(index => game.select(index, ++now + 5000));
  assert.equal(game.state, 'won');
  assert.equal(game.pairs, 18);
  game.start(10000);
  assert.equal(game.pairs, 0);
  assert.ok(game.cards.slice(0, 12).every(card => card.fog.covered && card.fog.until === null));
  assert.deepEqual(game.cards.map(card => card.value), [...level.layout]);
});

test('intro, terminal states and expired windows cannot bypass fog/time rules', () => {
  const game = create();
  game.setTimerRunning(false, 0);
  game.update(90000);
  assert.equal(game.clearFog(0, 90000), false);
  assert.equal(game.remaining, 60000);
  game.setTimerRunning(true, 90000);
  game.clearFog(0, 90000);
  assert.equal(game.select(0, 95000), false, 'Expiry is checked before a late sand flip.');
  assert.equal(game.cards[0].status, 'hidden');
  assert.equal(game.clearFog(0, 150000), false);
  assert.equal(game.failureReason, 'timeout');
});
