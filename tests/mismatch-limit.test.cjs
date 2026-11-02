const test = require('node:test');
const assert = require('node:assert/strict');
const MemoryGame = require('../core.js');
const levels = require('../levels.js');
const ninth = levels.find(level => level.id === 9);
const create = (level = ninth) => { const game = new MemoryGame({ level }); game.start(0); return game; };
function mistakes(game, count, now = 0) {
  for (let i = 0; i < count; i++) {
    assert.equal(game.select(0, now), true);
    assert.equal(game.select(1, now), true);
    if (game.state !== 'playing') break;
    now += 500;
    game.update(now);
  }
  return now;
}
function collect(game, kinds, now = 6000) {
  for (const kind of kinds) for (const card of game.cards.filter(card => card.value === kind && card.status === 'hidden')) game.select(card.index, now++);
}

test('ninth level has a fixed 4x6 five-kind board, 60 seconds, and a ten-mismatch condition', () => {
  const game = create();
  assert.equal(ninth.rows, 4);
  assert.equal(ninth.columns, 6);
  assert.equal(game.duration, 60000);
  assert.equal(game.totalPairs, 12);
  const counts = new Map();
  game.cards.forEach(card => counts.set(card.value, (counts.get(card.value) || 0) + 1));
  assert.deepEqual([...counts].sort((a, b) => a[0] - b[0]), [[0, 6], [1, 6], [2, 4], [4, 4], [5, 4]]);
  assert.equal(game.conditionStates[0].limit, 10);
  assert.equal(game.conditionStates[0].current, 0);
  assert.equal(game.conditionStates[0].completed, false);
  assert.equal(game.conditionStates[0].failed, false);
});

test('a mismatch is counted once per distinct pair, never for a single flip, duplicate click or blocked input', () => {
  const game = create();
  game.select(0, 0);
  assert.equal(game.mismatches, 0);
  assert.equal(game.select(0, 1), false);
  game.select(1, 2);
  assert.equal(game.mismatches, 1);
  assert.equal(game.select(2, 3), false);
  assert.equal(game.select(1, 4), false);
  game.update(501);
  assert.equal(game.cards[0].status, 'open');
  game.update(502);
  assert.equal(game.cards[0].status, 'hidden');
  game.select(2, 503);
  game.select(5, 504);
  assert.equal(game.pairs, 1);
  assert.equal(game.bonusTime, 504);
  assert.equal(game.mismatches, 1);
});

test('ten mismatches remain playable and the eleventh immediately fails without pending cover time', () => {
  const game = create();
  const now = mistakes(game, 10);
  assert.equal(game.mismatches, 10);
  assert.equal(game.state, 'playing');
  assert.equal(game.conditionStates[0].failed, false);
  game.select(0, now);
  game.select(1, now);
  assert.equal(game.mismatches, 11);
  assert.equal(game.conditionStates[0].current, 11);
  assert.equal(game.conditionStates[0].failed, true);
  assert.equal(game.state, 'lost');
  assert.equal(game.failureReason, 'conditions');
  assert.equal(game.pending, null);
  assert.equal(game.cards[1].status, 'open', 'Failure must happen on the second flip, not after 500 ms.');
  assert.ok(game.remaining > 0);
  assert.equal(game.select(2, now + 1), false);
  assert.equal(game.mismatches, 11);
});

test('all pairs can win with zero or exactly ten mismatches', () => {
  for (const count of [0, 10]) {
    const game = create();
    mistakes(game, count);
    collect(game, [0, 1, 2, 4, 5]);
    assert.equal(game.state, 'won');
    assert.equal(game.mismatches, count);
    assert.equal(game.conditionStates[0].completed, true);
    assert.equal(game.conditionStates[0].failed, false);
  }
});

test('mismatch limit composes with final-pair conditions using AND', () => {
  const level = { ...ninth, conditions: [...ninth.conditions, { id: 'last', type: 'lastPairKind', kind: 4 }] };
  for (const correctLast of [true, false]) {
    const game = create(level);
    mistakes(game, 10);
    collect(game, correctLast ? [0, 1, 2, 5, 4] : [4, 5, 2, 1, 0]);
    assert.equal(game.conditionStates[0].completed, true);
    assert.equal(game.state, correctLast ? 'won' : 'lost');
  }
  const early = create(level);
  mistakes(early, 11);
  assert.equal(early.state, 'lost');
  assert.equal(early.pairs, 0);
});

test('pausing preserves the count and pending exposure; retry restores the authored layout and zero count', () => {
  const game = create();
  game.select(0, 0);
  game.select(1, 0);
  game.pause(100);
  assert.equal(game.select(2, 1000), false);
  game.update(90000);
  assert.equal(game.mismatches, 1);
  game.resume(100000);
  game.update(100399);
  assert.equal(game.cards[0].status, 'open');
  game.update(100400);
  assert.equal(game.cards[0].status, 'hidden');
  game.start(110000);
  assert.equal(game.mismatches, 0);
  assert.equal(game.conditionStates[0].failed, false);
  assert.equal(game.pending, null);
  assert.deepEqual(game.cards.map(card => card.value), [...ninth.layout]);
});

test('timeout has priority over a late flip and normal levels do not gain a mismatch limit', () => {
  const game = create();
  mistakes(game, 10);
  assert.equal(game.select(0, 60000), false);
  assert.equal(game.mismatches, 10);
  assert.equal(game.failureReason, 'timeout');
  const normal = create(levels.find(level => level.id === 7));
  mistakes(normal, 11);
  assert.equal(normal.mismatches, 11);
  assert.equal(normal.state, 'playing');
});
