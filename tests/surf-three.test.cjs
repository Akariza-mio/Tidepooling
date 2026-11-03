const test = require('node:test');
const assert = require('node:assert/strict');
const SurfGame = require('../surf.js');
const levels = require('../levels.js');
const level = levels.find(item => item.id === 33);
function create(random = () => 0) { const game = new SurfGame({ level, random }); game.start(0); return game; }
function mistakes(game, count) {
  for (let i = 0; i < count; i++) {
    assert.equal(game.select(0, i * 500), true); assert.equal(game.select(1, i * 500), true);
  }
}
function finish(game, now) {
  for (const kind of [0,1,2,3,4,5]) for (const card of game.cards.filter(card => card.value === kind && card.status === 'hidden')) {
    assert.equal(game.select(card.index, now), true);
  }
}
test('surf three has six balanced kinds on an independent fixed 6x6 board, sixty seconds and only a twenty-mistake condition', () => {
  const game = create(); assert.equal(levels.length, 34); assert.equal(levels.some(item => item.id >= 35), false);
  assert.equal(level.rows, 6); assert.equal(level.columns, 6); assert.equal(game.duration, 60000); assert.equal(game.totalPairs, 18);
  assert.deepEqual([0,1,2,3,4,5].map(kind => level.layout.filter(value => value === kind).length), [6,6,6,6,6,6]);
  assert.notDeepEqual(level.layout, levels.find(item => item.id === 32).layout);
  assert.equal(level.conditions.length, 1); assert.equal(level.conditions[0].type, 'maxMismatches'); assert.equal(level.conditions[0].limit, 20);
  assert.equal(level.fog, undefined); assert.equal(level.seagrass, undefined);
});
for (const [axis, random] of [['row', () => 0], ['column', () => .99]]) test(`${axis}: fifteen-second cadence retains separate entry, full wash and exit without shortening exposure`, () => {
  const game = create(random); game.update(11999); assert.equal(game.surfPhase, 'calm');
  game.update(12000); assert.equal(game.surfPhase, 'warning'); assert.equal(game.surfTarget.axis, axis);
  game.update(15000); assert.equal(game.surfPhase, 'arriving'); assert.equal(game.waveCount, 1); assert.equal(game.remaining, 42000);
  assert.equal(game.activeTime, 15000); assert.equal(game.mismatches, 0); assert.equal(game.cards.filter(card => game.isWashed(card.index)).length, 6);
  const blocked = game.cards.find(card => game.isWashed(card.index)); assert.equal(game.select(blocked.index, 15000), false);
  assert.equal(game.mismatches, 0); game.update(16000); assert.equal(game.surfPhase, 'washing');
  game.update(20999); assert.equal(game.surfPhase, 'washing'); game.update(21000); assert.equal(game.surfPhase, 'retreating');
  game.update(22200); assert.equal(game.surfPhase, 'calm');
  game.update(27000); assert.equal(game.surfPhase, 'warning'); game.update(30000); assert.equal(game.waveCount, 2);
  assert.equal(game.remaining, 24000);
});
test('twenty mismatches are allowed, and the twenty-first fails on its second flip immediately', () => {
  const game = create(); mistakes(game, 20); game.update(10000);
  assert.equal(game.state, 'playing'); assert.equal(game.mismatches, 20); assert.equal(game.conditionStates[0].completed, false);
  const before = game.remaining; assert.equal(game.select(0, 10000), true); assert.equal(game.select(1, 10000), true);
  assert.equal(game.state, 'lost'); assert.equal(game.mismatches, 21); assert.equal(game.failureReason, 'conditions');
  assert.equal(game.pending, null); assert.equal(game.cards[1].status, 'open'); assert.equal(game.remaining, before);
});
for (const count of [0,20]) test(`all eighteen pairs can win after ${count} mistakes, without inheriting the prior timed-pair condition`, () => {
  const game = create(); mistakes(game, count); game.update(11000); finish(game, 11000);
  assert.equal(game.state, 'won'); assert.equal(game.pairs, 18); assert.equal(game.mismatches, count);
  assert.equal(game.conditionStates[0].completed, true); assert.deepEqual(game.conditions.map(item => item.type), ['maxMismatches']);
});
test('single, repeated, waiting and wave-covered clicks never count as mistakes; wave penalties do not advance mismatch exposure', () => {
  const game = create(); game.select(0, 14900); assert.equal(game.mismatches, 0);
  assert.equal(game.select(0, 14900), false); game.select(1, 14900); assert.equal(game.mismatches, 1);
  assert.equal(game.select(2, 14900), false); assert.equal(game.mismatches, 1); assert.equal(game.pending.at, 15400);
  game.update(15000); assert.equal(game.waveCount, 1); assert.equal(game.select(2, 15000), false);
  assert.equal(game.pending.at, 15400); assert.equal(game.cards[0].status, 'open');
  game.update(15400); assert.equal(game.cards[0].status, 'hidden'); assert.equal(game.mismatches, 1);
});
test('intro/pause freeze counters and waves, while retry restores the independent layout and clears failures', () => {
  const game = create(); game.setTimerRunning(false, 0); game.update(60000);
  assert.equal(game.select(0, 60000), false); assert.equal(game.surfTime, 0); assert.equal(game.remaining, 60000);
  game.setTimerRunning(true, 60000); game.select(0, 61000); game.select(1, 61000);
  game.pause(61500); const remaining = game.remaining; game.update(100000);
  assert.equal(game.remaining, remaining); assert.equal(game.mismatches, 1); assert.equal(game.surfTime, 1500);
  game.resume(100000); game.update(114000); assert.equal(game.surfPhase, 'arriving');
  game.start(120000); assert.equal(game.mismatches, 0); assert.equal(game.waveCount, 0); assert.equal(game.surfTime, 0);
  assert.equal(game.conditionStates[0].completed, false); assert.deepEqual(game.cards.map(card => card.value), level.layout);
});
test('a long frame charges each scheduled wave only once and reaches timeout at fifty-one active seconds', () => {
  const game = create(); game.update(100000);
  assert.equal(game.state, 'lost'); assert.equal(game.failureReason, 'timeout'); assert.equal(game.remaining, 0);
  assert.equal(game.waveCount, 3); assert.equal(game.surfTime, 51000); assert.equal(game.mismatches, 0);
});
