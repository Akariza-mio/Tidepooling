const test = require('node:test');
const assert = require('node:assert/strict');
const SurfGame = require('../surf.js');
const levels = require('../levels.js');
const level = levels.find(item => item.id === 34);
function create(draws = [0,0]) {
  let cursor = 0;
  const game = new SurfGame({ level, random: () => draws[cursor++ % draws.length] });
  game.start(0); return game;
}
test('surf four is a fixed balanced 6x6, six-kind, sixty-second matching level with two targets and no inherited conditions', () => {
  const game = create(); assert.equal(levels.length, 50); assert.equal(levels.some(item => item.id > 50), false);
  assert.equal(level.rows, 6); assert.equal(level.columns, 6); assert.equal(game.duration, 60000); assert.equal(game.totalPairs, 18);
  assert.deepEqual([0,1,2,3,4,5].map(kind => level.layout.filter(value => value === kind).length), [6,6,6,6,6,6]);
  assert.notDeepEqual(level.layout, levels.find(item => item.id === 33).layout);
  assert.equal(level.surf.targetCount, 2); assert.equal(level.surf.interval, 15000); assert.equal(level.surf.duration, 5000);
  assert.equal(level.surf.penalty, 6000); assert.ok(levels.filter(item => item.id >= 31 && item.id <= 33).every(item => item.surf.penalty === 3000));
  assert.deepEqual(game.conditions, []); assert.equal(level.fog, undefined); assert.equal(level.seagrass, undefined);
});
for (const [name, draws, expected, cells] of [
  ['two rows', [0,0], [{ axis:'row',index:0 },{ axis:'row',index:1 }], 12],
  ['two columns', [.99,.99], [{ axis:'column',index:5 },{ axis:'column',index:4 }], 12],
  ['row and column', [0,.99], [{ axis:'row',index:0 },{ axis:'column',index:5 }], 11]
]) test(`${name}: warn together, charge once, and mask the union through independent entry/wash/exit phases`, () => {
  const game = create(draws); game.update(11999); assert.deepEqual(game.surfTargets, []);
  game.update(12000); assert.deepEqual(game.surfTargets, expected); const targets = JSON.stringify(game.surfTargets);
  assert.equal(game.surfPhase, 'warning'); assert.equal(game.cards.some(card => game.isWashed(card.index)), false);
  game.update(14999); assert.equal(JSON.stringify(game.surfTargets), targets);
  game.update(15000); assert.equal(game.waveCount, 1); assert.equal(game.remaining, 39000); assert.equal(game.surfPhase, 'arriving');
  assert.equal(game.cards.filter(card => game.isWashed(card.index)).length, cells);
  for (const card of game.cards.filter(card => game.isWashed(card.index))) assert.equal(game.select(card.index, 15000), false);
  assert.equal(game.mismatches, 0); assert.equal(game.turns, 0); assert.equal(game.remaining, 39000);
  const a = game.cards.find(card => !game.isWashed(card.index));
  const b = game.cards.find(card => card.index !== a.index && !game.isWashed(card.index) && card.value === a.value);
  assert.equal(game.select(a.index, 15000), true); assert.equal(game.select(b.index, 15000), true); assert.equal(game.pairs, 1);
  assert.equal(game.remaining, 44000); assert.equal(game.surfTime, 15000);
  game.update(16000); assert.equal(game.surfPhase, 'washing'); assert.equal(JSON.stringify(game.surfTargets), targets);
  game.update(20999); assert.equal(game.surfPhase, 'washing'); game.update(21000); assert.equal(game.surfPhase, 'retreating');
  game.update(22199); assert.equal(game.cards.filter(card => game.isWashed(card.index)).length, cells);
  game.update(22200); assert.equal(game.surfPhase, 'calm'); assert.deepEqual(game.surfTargets, []);
  game.update(27000); assert.equal(game.surfTargets.length, 2); game.update(30000); assert.equal(game.waveCount, 2);
});
test('all sixty-six distinct unordered pairs from the twelve lines are reachable without duplicates', () => {
  const pairs = new Set();
  for (let first = 0; first < 12; first++) for (let second = 0; second < 11; second++) {
    const game = create([(first+.1)/12,(second+.1)/11]); game.update(12000);
    const keys = game.surfTargets.map(target => target.axis + target.index).sort();
    assert.notEqual(keys[0], keys[1]); pairs.add(keys.join('|'));
  }
  assert.equal(pairs.size, 66);
});
test('intro, pause and restart freeze or reset both targets together and preserve the fixed deck', () => {
  const game = create([0,.99]); game.setTimerRunning(false, 0); game.update(90000);
  assert.equal(game.surfTime, 0); assert.deepEqual(game.surfTargets, []); assert.equal(game.remaining, 60000);
  game.setTimerRunning(true, 90000); game.update(102000); const targets = JSON.stringify(game.surfTargets);
  game.pause(103000); game.update(200000); assert.equal(JSON.stringify(game.surfTargets), targets); assert.equal(game.surfTime, 13000);
  game.resume(200000); game.update(202000); assert.equal(game.waveCount, 1); assert.equal(game.surfPhase, 'arriving');
  game.pause(202500); const remaining = game.remaining; game.update(300000);
  assert.equal(game.remaining, remaining); assert.equal(game.surfTime, 15500); assert.equal(game.surfTargets.length, 2);
  game.resume(300000); game.update(306700); assert.equal(game.surfTime, 22200); assert.deepEqual(game.surfTargets, []);
  game.start(400000); assert.deepEqual(game.cards.map(card => card.value), level.layout);
  assert.equal(game.waveCount, 0); assert.equal(game.surfTime, 0); assert.deepEqual(game.surfTargets, []);
});
test('twenty-one mistakes are permitted and the prior level failure limit does not leak', () => {
  const game = create();
  for (let i = 0; i < 21; i++) { assert.equal(game.select(0, i*500), true); assert.equal(game.select(1, i*500), true); }
  game.update(11000); assert.equal(game.mismatches, 21); assert.equal(game.state, 'playing');
  for (const kind of [0,1,2,3,4,5]) for (const card of game.cards.filter(card => card.value === kind)) assert.equal(game.select(card.index, 11000), true);
  assert.equal(game.state, 'won'); assert.equal(game.pairs, 18);
});
test('collected holes under either line remain masked and never resurrect, and surf cannot prevent a completed-board victory', () => {
  const game = create();
  for (const card of game.cards.slice(0,12)) {
    if (card.status === 'matched') continue;
    const partner = game.cards.find(other => other.index !== card.index && other.value === card.value && other.status === 'hidden');
    assert.equal(game.select(card.index, 1000), true); assert.equal(game.select(partner.index, 1000), true);
  }
  game.update(15000); assert.equal(game.surfTargets.length, 2);
  assert.ok(game.cards.slice(0,12).every(card => card.status === 'matched' && game.isWashed(card.index)));
  for (const kind of [0,1,2,3,4,5]) for (const card of game.cards.filter(card => card.value === kind && card.status === 'hidden')) assert.equal(game.select(card.index, 15000), true);
  assert.equal(game.state, 'won'); assert.equal(game.pairs, 18);
});
test('long-frame penalties are per wave, including a row/column intersection, rather than per selected line or cell', () => {
  const game = create([0,.99]); game.update(100000);
  assert.equal(game.state, 'lost'); assert.equal(game.failureReason, 'timeout'); assert.equal(game.waveCount, 3);
  assert.equal(game.surfTime, 45000); assert.equal(game.remaining, 0);
});
