const test = require('node:test');
const assert = require('node:assert/strict');
const SurfGame = require('../surf.js');
const levels = require('../levels.js');
const level = levels.find(item => item.id === 32);
function create() { const game = new SurfGame({ level, random: () => 0 }); game.start(0); return game; }
function pair(game, now) {
  game.update(now);
  for (const a of game.cards) {
    if (a.status !== 'hidden' || game.isWashed(a.index)) continue;
    const b = game.cards.find(card => card.index !== a.index && card.value === a.value && card.status === 'hidden' && !game.isWashed(card.index));
    if (!b) continue;
    assert.equal(game.select(a.index, now), true); assert.equal(game.select(b.index, now), true);
    return true;
  }
  return false;
}
test('surf two is an independent fixed 6x6, sixty-second deck with six of each kind and only a rolling three-pair condition', () => {
  const game = create(); assert.equal(levels.length, 40); assert.equal(levels.some(item => item.id >= 41), false);
  assert.equal(level.rows, 6); assert.equal(level.columns, 6); assert.equal(level.duration, 60000); assert.equal(game.totalPairs, 18);
  assert.deepEqual([0,1,2,3,4,5].map(kind => level.layout.filter(value => value === kind).length), [6,6,6,6,6,6]);
  assert.deepEqual(level.surf, levels.find(item => item.id === 31).surf);
  assert.notDeepEqual(level.layout, levels.find(item => item.id === 31).layout);
  assert.equal(level.conditions.length, 1); assert.equal(level.conditions[0].type, 'timedPairs');
  assert.equal(level.conditions[0].count, 3); assert.equal(level.conditions[0].window, 5000);
  assert.equal(level.fog, undefined); assert.equal(level.seagrass, undefined); assert.equal(level.intro, undefined);
  game.start(10000); assert.deepEqual(game.cards.map(card => card.value), level.layout);
});
for (const [third, completed] of [[22000, true], [22001, false]]) test(`the five-second boundary is ${completed} across wave arrival and its three-second penalty at ${third}`, () => {
  const game = create(); assert.equal(pair(game, 17000), true); assert.equal(pair(game, 19500), true);
  assert.equal(game.conditionStates[0].completed, false); assert.equal(pair(game, third), true);
  assert.equal(game.surfPhase, 'washing'); assert.equal(game.waveCount, 1);
  assert.equal(game.conditionStates[0].completed, completed); assert.equal(game.state, 'playing');
  assert.deepEqual(game.pairTimes, [17000,19500,third]);
});
test('a later window can succeed, persists through waves, and retry clears it', () => {
  const game = create(); [0,6000,12000].forEach(now => assert.equal(pair(game, now), true));
  assert.equal(game.conditionStates[0].completed, false);
  [13000,14000].forEach(now => assert.equal(pair(game, now), true));
  assert.equal(game.conditionStates[0].completed, true); game.update(22000);
  assert.equal(game.waveCount, 1); assert.equal(game.conditionStates[0].completed, true);
  game.start(30000); assert.equal(game.conditionStates[0].completed, false);
  assert.deepEqual(game.pairTimes, []); assert.equal(game.waveCount, 0); assert.equal(game.remaining, 60000);
});
test('intro and pause exclude wall time from both the window and the surf clock', () => {
  const game = create(); game.setTimerRunning(false, 0); game.update(90000);
  assert.equal(game.surfTime, 0); assert.equal(game.remaining, 60000); assert.equal(game.select(0, 90000), false);
  game.setTimerRunning(true, 90000); assert.equal(pair(game, 107000), true); game.pause(108000);
  const time = game.surfTime; game.update(208000); assert.equal(game.surfTime, time);
  game.resume(208000); assert.equal(pair(game, 209500), true); assert.equal(pair(game, 212000), true);
  assert.equal(game.conditionStates[0].completed, true); assert.equal(game.waveCount, 1);
  assert.equal(game.pairTimes[2] - game.pairTimes[0], 5000);
});
for (const [spacing, expected] of [[0,'won'], [3100,'lost']]) test(`all eighteen pairs at spacing ${spacing} produce ${expected} while obeying surf blocking`, () => {
  const game = create(); let now = 0;
  for (let i = 0; i < 18; i++) {
    if (!pair(game, now)) { now = game.waveRetreatUntil + 1; assert.equal(pair(game, now), true); }
    now += spacing;
  }
  assert.equal(game.pairs, 18); assert.equal(game.state, expected);
  assert.equal(game.failureReason, expected === 'lost' ? 'conditions' : null);
  assert.equal(game.conditionStates[0].completed, expected === 'won'); assert.ok(game.remaining > 0);
});
