const test = require('node:test');
const assert = require('node:assert/strict');
const MemoryGame = require('../core.js');
const levels = require('../levels.js');

const create = (options = {}) => {
  const game = new MemoryGame(options);
  game.start(0);
  return game;
};
const findPair = game => {
  const a = game.cards.find(card => card.status === 'hidden');
  return [a.index, game.cards.find(card => card.index !== a.index && card.status === 'hidden' && card.value === a.value).index];
};
const collectInKindOrder = (game, kinds, lastNow = 1000) => {
  const ordered = kinds.flatMap(kind => game.cards.filter(card => card.value === kind && card.status === 'hidden').map(card => card.index));
  ordered.forEach((index, i) => game.select(index, i === ordered.length - 1 ? lastNow : i));
};

test('level ten has 64 fixed cells, five even-count kinds, 120 seconds without time rewards and all 32 pairs required', () => {
  const level = levels.find(level => level.id === 10);
  const game = create({ level });
  assert.equal(level.rows, 8);
  assert.equal(level.columns, 8);
  assert.equal(game.cards.length, 64);
  assert.equal(game.totalPairs, 32);
  assert.equal(game.duration, 120000);
  assert.equal(game.conditions[0].type, 'noPairBonus');
  assert.equal(game.pairBonus, 0);
  const counts = new Map();
  game.cards.forEach(card => counts.set(card.value, (counts.get(card.value) || 0) + 1));
  assert.deepEqual([...counts].sort((a, b) => a[0] - b[0]), [[0, 14], [1, 14], [2, 12], [4, 12], [5, 12]]);
  for (let pair = 0; pair < 32; pair++) {
    const [a, b] = findPair(game);
    game.select(a, pair * 2);
    game.select(b, pair * 2 + 1);
    assert.equal(game.state, pair === 31 ? 'won' : 'playing');
    assert.equal(game.bonusTime, 0);
    assert.equal(game.remaining, 120000 - (pair * 2 + 1));
  }
  assert.equal(game.pairs, 32);
  assert.equal(game.bonusTime, 0);
  assert.ok(game.cards.every(card => card.status === 'matched'));
  game.start(1000);
  assert.deepEqual(game.cards.map(card => card.value), [...level.layout]);
  assert.equal(game.pairs, 0);
  assert.equal(game.mismatches, 0);
  const [a, b] = findPair(game);
  game.select(a, 61000); game.select(b, 61000);
  assert.equal(game.remaining, 60000);
  assert.equal(game.bonusTime, 0);
  game.update(120999);
  assert.equal(game.state, 'playing');
  game.update(121000);
  assert.equal(game.failureReason, 'timeout');
});

test('level eight expands to a fixed 6x6 board and requires all eighteen pairs', () => {
  const level = levels.find(level => level.id === 8);
  const game = create({ level });
  assert.equal(level.rows, 6);
  assert.equal(level.columns, 6);
  assert.equal(game.duration, 60000);
  assert.equal(game.cards.length, 36);
  assert.equal(game.totalPairs, 18);
  assert.deepEqual(game.conditions, []);
  const counts = new Map();
  game.cards.forEach(card => counts.set(card.value, (counts.get(card.value) || 0) + 1));
  assert.deepEqual([...counts].sort((a, b) => a[0] - b[0]), [[0, 8], [1, 8], [2, 8], [4, 6], [5, 6]]);
  for (let pair = 0; pair < 18; pair++) {
    const [a, b] = findPair(game);
    game.select(a, pair * 2);
    game.select(b, pair * 2 + 1);
    if (pair === 11) assert.equal(game.state, 'playing', 'The larger board must not finish after twelve pairs.');
  }
  assert.equal(game.state, 'won');
  assert.equal(game.pairs, 18);
  assert.equal(game.bonusTime, 35);
  assert.ok(game.cards.every(card => card.status === 'matched'));
  game.start(2000);
  assert.deepEqual(game.cards.map(card => card.value), [...level.layout]);
  assert.equal(game.totalPairs, 18);
});

test('level seven restores matching with five kinds, fixed 4x6 layout and 60 seconds', () => {
  const level = levels.find(level => level.id === 7);
  const game = create({ level });
  assert.equal(game.level.rows, 4);
  assert.equal(game.level.columns, 6);
  assert.equal(game.duration, 60000);
  assert.equal(game.totalPairs, 12);
  assert.deepEqual(game.conditions, []);
  const counts = new Map();
  game.cards.forEach(card => counts.set(card.value, (counts.get(card.value) || 0) + 1));
  assert.deepEqual([...counts].sort((a, b) => a[0] - b[0]), [[0, 6], [1, 6], [2, 4], [4, 4], [5, 4]]);
  const initial = game.cards.map(card => card.value);
  collectInKindOrder(game, [5, 4, 2, 1, 0]);
  assert.equal(game.state, 'won', 'Any final kind passes, with no extra condition.');
  assert.equal(game.pairs, 12);
  assert.equal(game.bonusTime, 1000);
  assert.ok(game.cards.every(card => card.status === 'matched'));
  game.start(2000);
  assert.deepEqual(game.cards.map(card => card.value), initial);
  assert.equal(game.pairs, 0);
  game.update(62000);
  assert.equal(game.state, 'lost');
  assert.equal(game.failureReason, 'timeout');
});

test('fourth-level condition stays unchecked during play and passes only when the last pair is a conch', () => {
  const game = create({ level: levels[3] });
  game.select(0, 0);
  game.select(4, 1);
  assert.equal(game.pairs, 1);
  assert.equal(game.lastMatchedKind, 4);
  assert.equal(game.conditionStates[0].completed, false);
  game.pause(2);
  assert.equal(game.conditionStates[0].completed, false);
  game.resume(3);
  collectInKindOrder(game, [0, 1, 2, 4]);
  assert.equal(game.state, 'won');
  assert.equal(game.failureReason, null);
  assert.equal(game.conditionStates[0].completed, true);
  assert.equal(game.pairs, 12);
});

test('collecting all items in the wrong order fails the condition without timing out', () => {
  const game = create({ level: levels[3] });
  collectInKindOrder(game, [4]);
  assert.equal(game.state, 'playing', 'Using all conches early is not an instant-death condition.');
  assert.equal(game.conditionStates[0].completed, false);
  collectInKindOrder(game, [0, 1, 2], 2000);
  assert.equal(game.pairs, 12);
  assert.equal(game.state, 'lost');
  assert.equal(game.failureReason, 'conditions');
  assert.ok(game.remaining > 0);
  assert.equal(game.conditionStates[0].failed, true);
  game.start(3000);
  assert.equal(game.failureReason, null);
  assert.equal(game.lastMatchedKind, null);
  assert.equal(game.conditionStates[0].completed, false);
});

test('all configured conditions must pass, including when the first one is satisfied', () => {
  const level = { ...levels[3], conditions: [
    levels[3].conditions[0],
    { id: 'second-condition', type: 'lastPairKind', checkAt: 'completion', kind: 0, label: '测试第二条判定' }
  ] };
  const game = create({ level });
  collectInKindOrder(game, [0, 1, 2, 4]);
  assert.deepEqual(game.conditionStates.map(condition => condition.completed), [true, false]);
  assert.equal(game.state, 'lost');
  assert.equal(game.failureReason, 'conditions');
});

test('a final conch pair must still be matched before the actual deadline', () => {
  const beforeDeadline = create({ level: levels[3], duration: 10000, pairBonus: 0 });
  collectInKindOrder(beforeDeadline, [0, 1, 2, 4], 9999);
  assert.equal(beforeDeadline.state, 'won');
  const tooLate = create({ level: levels[3], duration: 10000, pairBonus: 0 });
  collectInKindOrder(tooLate, [0, 1, 2, 4], 10000);
  assert.equal(tooLate.state, 'lost');
  assert.equal(tooLate.failureReason, 'timeout');
  assert.equal(tooLate.pairs, 11);
});

test('4×4 teaching deck repeats three item types with even counts and resets cleanly', () => {
  const game = create();
  assert.equal(game.cards.length, 16);
  assert.equal(game.level.rows, 4);
  assert.equal(game.level.columns, 4);
  assert.equal(game.totalPairs, 8);
  const counts = new Map();
  game.cards.forEach(card => counts.set(card.value, (counts.get(card.value) || 0) + 1));
  assert.equal(counts.size, 3);
  assert.deepEqual([...counts.values()].sort((a, b) => a - b), [4, 6, 6]);
  assert.ok([...counts.values()].every(count => count % 2 === 0));
  game.select(0, 100);
  game.start(200);
  assert.equal(game.elapsed, 0);
  assert.equal(game.pairs, 0);
  assert.equal(game.selected.length, 0);
  assert.ok(game.cards.every(card => card.status === 'hidden'));
});
test('level one has a fixed layout across restarts and new game instances', () => {
  const game = create();
  const initial = game.cards.map(card => card.value);
  game.select(0, 10);
  game.select(3, 20);
  game.start(30);
  assert.deepEqual(game.cards.map(card => card.value), initial);
  assert.ok(game.cards.every(card => card.status === 'hidden'));
  assert.deepEqual(create().cards.map(card => card.value), initial);
  assert.deepEqual(initial, [...levels[0].layout]);
  assert.equal(game.duration, 60000);
  assert.ok(Object.isFrozen(levels[0].layout));
});

test('level two has a fixed 4×6 layout with three item types and twelve complete pairs', () => {
  const game = create({ level: levels[1] });
  assert.equal(game.level.rows, 4);
  assert.equal(game.level.columns, 6);
  assert.equal(game.cards.length, 24);
  assert.ok(game.cards.every(card => card.status === 'hidden' && Number.isInteger(card.value)));
  assert.equal(game.totalPairs, 12);
  const counts = new Map();
  game.cards.forEach(card => counts.set(card.value, (counts.get(card.value) || 0) + 1));
  assert.deepEqual([...counts.values()], [8, 8, 8]);
  assert.equal(game.pairs, 0);
  assert.equal(game.bonusTime, 0);
  const initial = game.cards.map(card => card.value);
  game.select(0, 10);
  game.start(20);
  assert.deepEqual(game.cards.map(card => card.value), initial);
  assert.equal(game.cards.filter(card => card.status === 'hidden').length, 24);
  assert.equal(game.duration, 60000);
});

test('all twenty-four level-two items must be collected to win', () => {
  const game = create({ level: levels[1] });
  for (let pair = 0; pair < 12; pair++) {
    const [a, b] = findPair(game);
    game.select(a, pair * 2);
    game.select(b, pair * 2 + 1);
  }
  assert.equal(game.state, 'won');
  assert.equal(game.pairs, 12);
  assert.equal(game.bonusTime, 23);
  assert.ok(game.cards.every(card => card.status === 'matched'));
  assert.equal(game.select(12, 100), false);
  assert.equal(game.pairs, 12);
});

test('level three adds matching conches to a distinct fixed 4×6 board and can be completed', () => {
  const game = create({ level: levels[2] });
  assert.deepEqual(game.level.newItem, { kind: 4, name: '海螺' });
  assert.equal(game.duration, 60000);
  assert.equal(game.level.rows, 4);
  assert.equal(game.level.columns, 6);
  assert.equal(game.totalPairs, 12);
  const counts = new Map();
  game.cards.forEach(card => counts.set(card.value, (counts.get(card.value) || 0) + 1));
  assert.deepEqual([...counts.keys()].sort(), [0, 1, 2, 4]);
  assert.deepEqual([...counts.values()], [6, 6, 6, 6]);
  assert.notDeepEqual(game.level.layout, levels[1].layout);
  for (let pair = 0; pair < game.totalPairs; pair++) {
    const [a, b] = findPair(game);
    game.select(a, pair * 2);
    game.select(b, pair * 2 + 1);
  }
  assert.equal(game.state, 'won');
  game.start(100);
  assert.ok(game.cards.every(card => card.status === 'hidden'));
  assert.deepEqual(game.cards.map(card => card.value), [...game.level.layout]);
});
test('any two copies of the same shell can match, repeatedly within one level', () => {
  const game = create();
  const copies = game.cards.filter(card => card.value === 0);
  game.select(copies[0].index, 10);
  game.select(copies[copies.length - 1].index, 20);
  game.select(copies[2].index, 30);
  game.select(copies[1].index, 40);
  assert.equal(game.pairs, 2);
  assert.equal(game.cards.filter(card => card.status === 'matched').length, 4);
  assert.equal(game.cards.filter(card => card.value === 0 && card.status === 'hidden').length, copies.length - 4);
});
test('a mismatch stays visible for 500 ms, then immediately accepts the next tile', () => {
  const game = create();
  assert.equal(game.revealDuration, 500);
  const a = 0, b = game.cards.find(card => card.value !== game.cards[a].value).index;
  assert.equal(game.select(a, 100), true);
  assert.equal(game.select(a, 101), false);
  assert.equal(game.select(b, 200), true);
  assert.equal(game.cards[a].status, 'open');
  assert.equal(game.cards[b].status, 'open');
  const c = game.cards.find(card => card.index !== a && card.index !== b).index;
  assert.equal(game.select(c, 201), false);
  game.update(699);
  assert.equal(game.cards[b].status, 'open');
  game.update(700);
  assert.equal(game.cards[a].status, 'hidden');
  assert.equal(game.cards[b].status, 'hidden');
  assert.equal(game.select(c, 700), true);
});
test('a match collects exactly two cards and cannot be selected again', () => {
  const game = create();
  const [a, b] = findPair(game);
  game.select(a, 20);
  game.select(b, 40);
  assert.equal(game.pairs, 1);
  assert.equal(game.cards[a].status, 'matched');
  assert.equal(game.cards[b].status, 'matched');
  assert.equal(game.select(a, 50), false);
  assert.equal(game.selected.length, 0);
});
test('all eight pairs win before animation completion, even just before timeout', () => {
  const game = create({ duration: 10000, pairBonus: 0 });
  let now = 0;
  for (let i = 0; i < game.totalPairs; i++) {
    const [a, b] = findPair(game);
    game.select(a, ++now);
    game.select(b, i === game.totalPairs - 1 ? 9999 : ++now);
  }
  assert.equal(game.state, 'won');
  game.update(12000);
  assert.equal(game.state, 'won');
  assert.equal(game.pairs, 8);
});
test('timeout ends the level and late clicks cannot turn a loss into a win', () => {
  const game = create({ duration: 1000 });
  const [a, b] = findPair(game);
  game.select(a, 999);
  assert.equal(game.select(b, 1000), false);
  assert.equal(game.state, 'lost');
  assert.equal(game.pairs, 0);
  assert.equal(game.progress, 1);
});
test('paused wall time is excluded, including mismatch exposure time', () => {
  const game = create({ duration: 5000 });
  const b = game.cards.find(card => card.value !== game.cards[0].value).index;
  game.select(0, 100);
  game.select(b, 200);
  assert.equal(game.pause(500), true);
  game.update(8000);
  assert.equal(game.elapsed, 500);
  assert.equal(game.select(5, 8500), false);
  game.resume(9000);
  game.update(9199);
  assert.equal(game.cards[0].status, 'open');
  game.update(9200);
  assert.equal(game.cards[0].status, 'hidden');
  assert.equal(game.elapsed, 700);
});
test('clock jumps use elapsed milliseconds, independent of rendered frames', () => {
  const game = create();
  game.update(30000);
  assert.equal(game.progress, .5);
  game.update(59999);
  assert.equal(game.state, 'playing');
  game.update(60000);
  assert.equal(game.state, 'lost');
  assert.equal(game.progress, 1);
});

test('a successful pair discards rewards above the initial budget', () => {
  const game = create();
  const [a, b] = findPair(game);
  game.select(a, 1000);
  game.select(b, 2000);
  assert.equal(game.bonusTime, 2000);
  assert.equal(game.elapsed, 2000);
  assert.equal(game.remaining, 60000);
  assert.equal(game.progress, 0);
  game.select(a, 2000);
  assert.equal(game.bonusTime, 2000);
  game.start(3000);
  assert.equal(game.bonusTime, 0);
  assert.equal(game.remaining, 60000);
});
test('a late match retreats the tide and extends the actual timeout', () => {
  const game = create();
  const [a, b] = findPair(game);
  game.select(a, 59000);
  const before = game.progress;
  game.select(b, 59999);
  assert.equal(game.remaining, 5001);
  assert.ok(game.progress < before);
  game.update(60000);
  assert.equal(game.state, 'playing');
  assert.equal(game.remaining, 5000);
  game.update(64999);
  assert.equal(game.state, 'playing');
  game.update(65000);
  assert.equal(game.state, 'lost');
});
test('mismatches do not award time and pausing preserves earned time', () => {
  const game = create();
  game.select(0, 100);
  game.select(1, 200);
  game.update(700);
  assert.equal(game.bonusTime, 0);
  game.select(0, 800);
  game.select(3, 900);
  assert.equal(game.bonusTime, 900);
  game.pause(1000);
  const remaining = game.remaining;
  game.update(100000);
  assert.equal(game.remaining, remaining);
  game.resume(100000);
  game.update(101000);
  assert.equal(game.remaining, remaining - 1000);
});

test('tutorial freezes the countdown while real matches, mismatch exposure and rewards still work', () => {
  const game = create();
  game.setTimerRunning(false, 0);
  game.update(120000);
  assert.equal(game.elapsed, 0);
  assert.equal(game.state, 'playing');
  game.select(0, 120001);
  game.select(3, 120002);
  assert.equal(game.pairs, 1);
  assert.equal(game.remaining, 60000);
  game.select(1, 120100);
  game.select(2, 120200);
  game.update(120699);
  assert.equal(game.cards[1].status, 'open');
  game.update(120700);
  assert.equal(game.cards[1].status, 'hidden');
  assert.equal(game.elapsed, 0);
  game.setTimerRunning(true, 200000);
  game.update(201000);
  assert.equal(game.elapsed, 1000);
  assert.equal(game.pairs, 1);
  assert.equal(game.remaining, 59000);
});

test('pause also freezes tutorial mismatch exposure and restarting restores a normal timer', () => {
  const game = create();
  game.setTimerRunning(false, 0);
  game.select(0, 100);
  game.select(1, 200);
  game.pause(300);
  game.resume(10000);
  game.update(10399);
  assert.equal(game.cards[0].status, 'open');
  game.update(10400);
  assert.equal(game.cards[0].status, 'hidden');
  assert.equal(game.elapsed, 0);
  game.start(20000);
  game.update(21000);
  assert.equal(game.timerRunning, true);
  assert.equal(game.elapsed, 1000);
  assert.equal(game.pairs, 0);
});
