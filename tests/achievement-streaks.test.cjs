const test = require('node:test'), assert = require('node:assert/strict');
const Achievements = require('../achievements.js'), Slot = require('../slot-machine.js'), Surf = require('../surf.js'), MathGame = require('../arithmetic.js'), Game = require('../core.js'), levels = require('../levels.js');
function tracker() {
  const values = new Map([['beach-pairs-achievements-version', Achievements.revision]]), notices = [];
  const a = new Achievements({ getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }, d => notices.push(d));
  return { a, notices };
}
function earn(run, kind, now = run.lastNow) {
  const pair = run.cards.filter(c => c.value === kind && c.status === 'hidden').slice(0, 2); assert.equal(pair.length, 2);
  pair.forEach(c => assert.equal(run.select(c.index, now), true));
}
function spin(run, outcome, now = run.lastNow) {
  const draws = outcome.map(k => (run.level.kinds.indexOf(k) + .1) / run.level.kinds.length); run.random = () => draws.shift();
  assert.equal(run.spin(now), true); run.update(now + 1360);
}
test('five completed zero-clear spins award, including empty-category hits; manual pairs do not break the spin streak', () => {
  for (const emptyKind of [false, true]) {
    const run = new Slot({ level: levels.find(l => l.id === 45) }), { a } = tracker(); run.start(0);
    assert.equal(run.spin(0), false); assert.equal(run.noRewardStreak, 0);
    if (emptyKind) for (let i = 0; i < 7; i++) earn(run, 1);
    for (let i = 0; i < 5; i++) {
      if (!emptyKind) earn(run, 1);
      spin(run, emptyKind ? [1,1,1] : [0,2,4]); a.record(run);
      assert.equal(run.noRewardStreak, i + 1); assert.equal(a.earned.has('thanks-for-playing'), i === 4);
    }
    assert.equal(run.autoPairs, 0); assert.equal(a.record(run), false);
    run.start(100000); assert.equal(run.noRewardStreak, 0); assert.equal(run.fiveNoRewardPulls, false);
  }
});
test('a paying result breaks the empty-spin sequence and an unfinished or paused spin does not count', () => {
  const run = new Slot({ level: levels.find(l => l.id === 45) }), { a } = tracker(); run.start(0);
  for (let i = 0; i < 5; i++) earn(run, 1); for (let i = 0; i < 4; i++) earn(run, 2);
  for (let i = 0; i < 4; i++) spin(run, [0,2,4]);
  spin(run, [0,0,4]); assert.equal(run.noRewardStreak, 0);
  for (let i = 0; i < 3; i++) spin(run, [0,2,4]);
  run.random = (() => { const draws = [0,.21,.41]; return () => draws.shift(); })(); assert.equal(run.spin(run.lastNow), true);
  const at = run.lastNow; run.update(at + 999); assert.equal(run.noRewardStreak, 3);
  run.pause(at + 999); run.update(at + 100000); assert.equal(run.noRewardStreak, 3);
  run.resume(at + 100000); run.update(at + 100001); assert.equal(run.noRewardStreak, 4);
  a.record(run); assert.equal(a.earned.has('thanks-for-playing'), false);
});
function surfPair(run, now) {
  run.update(now);
  const available = run.cards.filter(c => c.status === 'hidden' && !run.isWashed(c.index));
  const first = available.find(c => available.filter(d => c.value === d.value).length >= 2), pair = available.filter(c => c.value === first.value).slice(0, 2);
  pair.forEach(c => assert.equal(run.select(c.index, now), true));
}
test('three pairs within one washing phase award; warning/arrival/departure and separate waves cannot be added together', () => {
  const level = levels.find(l => l.id === 31), { a } = tracker(), run = new Surf({ level, random: () => 0 }); run.start(0);
  surfPair(run, 19000); surfPair(run, 20500); assert.equal(run.wavePairs, 0);
  surfPair(run, 21000); surfPair(run, 22000); a.record(run); assert.equal(a.earned.has('wave-rider'), false);
  surfPair(run, 26000); assert.equal(run.wavePairs, 2); a.record(run); assert.equal(a.earned.has('wave-rider'), false);
  surfPair(run, 41000); assert.equal(run.wavePairs, 1); a.record(run); assert.equal(a.earned.has('wave-rider'), false);
  surfPair(run, 42000); run.pause(42000); run.update(100000); run.resume(100000); surfPair(run, 101000);
  assert.equal(run.wavePairs, 3); a.record(run); assert.equal(a.earned.has('wave-rider'), true); assert.equal(a.record(run), false);
  run.start(200000); assert.equal(run.wavePairs, 0); assert.equal(run.threePairsInWave, false);
});
test('three wrong answers must be for one math round; invalid input is not a wrong answer and a correct answer resets the counter', () => {
  const run = new MathGame({ level: levels.find(l => l.id === 46) }), { a } = tracker(); run.start(0);
  run.submit(999, 0); run.submit(999, 0); run.submit('', 0); assert.equal(run.roundWrongStreak, 2); a.record(run); assert.equal(a.earned.has('beyond-syllabus'), false);
  run.submit(MathGame.evaluate(run.round.target, run.round.values), 0); assert.equal(run.roundWrongStreak, 0);
  run.submit(999, 0); a.record(run); assert.equal(a.earned.has('beyond-syllabus'), false);
  run.submit(999, 0); run.submit(999, 0); a.record(run); assert.equal(a.earned.has('beyond-syllabus'), true); assert.equal(run.completed, 1);
  run.submit(MathGame.evaluate(run.round.target, run.round.values), 0); assert.equal(run.roundWrongStreak, 0); assert.equal(a.record(run), false);
  run.start(10000); assert.equal(run.roundWrongStreak, 0); assert.equal(run.threeWrongInRound, false);
});
test('single-sided love awards at thirty unpaired active seconds, never fails the ending, and excludes pause or an earlier win', () => {
  const run = new Game({ level: levels.find(l => l.id === 50) }), { a, notices } = tracker(); run.start(0);
  run.update(29999); assert.equal(a.record(run), false); run.pause(29999); run.update(90000); assert.equal(a.record(run), false);
  run.resume(100000); run.update(100001); a.record(run);
  assert.equal(run.state, 'playing'); assert.equal(run.failureReason, null); assert.equal(run.progress, 0); assert.deepEqual(notices.map(d => d.name), ['单相思']);
  assert.equal(notices[0].method, ''); assert.equal(a.earned.has('zen-mode'), false); assert.equal(a.record(run), false);
  run.update(1000000); assert.equal(run.state, 'playing'); run.select(0,1000000); run.select(1,1000000); assert.equal(run.state,'won');
  for (const time of [29999,30000]) {
    const g = new Game({ level: run.level }), t = tracker(); g.start(0); g.select(0,0); g.select(1,time); t.a.record(g);
    assert.equal(t.a.earned.has('one-sided-love'),time===30000); g.update(1000000); assert.equal(g.state,'won');
  }
});
