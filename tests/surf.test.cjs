const test = require('node:test');
const assert = require('node:assert/strict');
const SurfGame = require('../surf.js');
const levels = require('../levels.js');
const level = levels.find(level => level.id === 31);
function create(options = {}) {
  const game = new SurfGame({ level, random: () => 0, ...options });
  game.start(0);
  return game;
}
const collect = (game, indices, now) => indices.forEach(index => assert.equal(game.select(index, now), true));

test('surf one has a fixed five-kind 6x6 deck, sixty seconds and no inherited grass or conditions', () => {
  assert.equal(levels.length, 48); assert.equal(levels.some(item => item.id >= 49), false);
  const game = create();
  assert.equal(game.duration, 60000); assert.equal(game.totalPairs, 18);
  assert.deepEqual([0,1,2,4,5].map(kind => level.layout.filter(value => value === kind).length), [8,8,8,6,6]);
  assert.equal(level.layout.includes(3), false); assert.equal(level.rows, 6); assert.equal(level.columns, 6);
  assert.deepEqual(game.conditions, []); assert.equal(level.seagrass, undefined); assert.equal(level.fog, undefined);
  assert.equal(level.surf.interval, 20000); assert.equal(level.surf.duration, 5000); assert.equal(level.surf.penalty, 3000);
  assert.notDeepEqual(level.layout, levels.find(item => item.id === 30).layout);
});
for (const [axis, random] of [['row', () => 0], ['column', () => .99]]) {
  test(`${axis}: a stable target warns before exactly twenty seconds, has separate entry, a full five-second wash and exit`, () => {
    const game = create({ random });
    game.update(16999); assert.equal(game.surfPhase, 'calm'); assert.equal(game.surfTarget, null);
    game.update(17000); assert.equal(game.surfPhase, 'warning'); assert.equal(game.surfTarget.axis, axis);
    const target = { ...game.surfTarget };
    game.update(19999); assert.deepEqual(game.surfTarget, target); assert.equal(game.waveCount, 0);
    game.update(20000); assert.equal(game.surfPhase, 'arriving'); assert.equal(game.waveCount, 1);
    assert.equal(game.remaining, 37000); assert.equal(game.surfTime, 20000); assert.equal(game.activeTime, 20000);
    const covered = game.cards.filter(card => game.isWashed(card.index)); assert.equal(covered.length, 6);
    for (const card of covered) assert.equal(game.select(card.index, 20000), false);
    assert.equal(game.turns, 0); assert.equal(game.mismatches, 0); assert.equal(game.pairs, 0);
    const other = game.cards.find(card => !game.isWashed(card.index));
    assert.equal(game.select(other.index, 20000), true);
    game.update(20999); assert.equal(game.surfPhase, 'arriving');
    game.update(21000); assert.equal(game.surfPhase, 'washing');
    game.update(25999); assert.equal(game.surfPhase, 'washing');
    game.update(26000); assert.equal(game.surfPhase, 'retreating');
    assert.equal(game.isWashed(covered[0].index), true);
    assert.equal(game.select(covered[0].index, 26000), false);
    game.update(27199); assert.equal(game.surfPhase, 'retreating');
    game.update(27200); assert.equal(game.surfPhase, 'calm'); assert.equal(game.surfTarget, null);
    assert.ok(game.cards.every(card => !game.isWashed(card.index)));
    assert.equal(game.select(covered[0].index, 27200), true);
  });
}
test('warning is actionable, never rerolls its target, and does not charge the penalty early', () => {
  let calls = 0;
  const game = create({ random: () => { calls++; return 0; } });
  game.update(17000); const target = { ...game.surfTarget };
  collect(game, [2,5], 18000);
  assert.equal(game.pairs, 1); assert.equal(game.surfPhase, 'warning'); assert.equal(game.waveCount, 0);
  game.update(19999); assert.deepEqual(game.surfTarget, target); assert.equal(calls, 2);
  game.update(20000); assert.equal(game.waveCount, 1); assert.equal(calls, 2);
});
test('intro reading and paused wall time never advance warnings, arrivals or tide', () => {
  const game = create(); game.setTimerRunning(false, 0); game.update(90000);
  assert.equal(game.remaining, 60000); assert.equal(game.surfTime, 0); assert.equal(game.surfPhase, 'calm');
  assert.equal(game.select(0, 90000), false);
  game.setTimerRunning(true, 90000); game.update(108000); assert.equal(game.surfPhase, 'warning');
  game.pause(108000); const before = game.remaining; game.update(200000);
  assert.equal(game.surfTime, 18000); assert.equal(game.remaining, before);
  game.resume(200000); game.update(201999); assert.equal(game.surfPhase, 'warning');
  game.update(202000); assert.equal(game.surfPhase, 'arriving'); assert.equal(game.waveCount, 1);
  game.pause(203000); game.update(400000); assert.equal(game.surfTime, 21000);
  game.resume(400000); game.update(403999); assert.equal(game.surfPhase, 'washing');
  game.update(405000); assert.equal(game.surfPhase, 'retreating');
  game.update(406200); assert.equal(game.surfPhase, 'calm'); assert.equal(game.surfTime, 27200);
});
test('pair rewards retain their sixty-second cap and never delay the next wave or its retreat', () => {
  const game = create(); collect(game, [2,5], 19000);
  assert.equal(game.remaining, 46000); assert.equal(game.bonusTime, 5000);
  game.update(20000); assert.equal(game.remaining, 42000); assert.equal(game.surfPhase, 'arriving');
  collect(game, [6,13], 20000); assert.equal(game.remaining, 47000); assert.equal(game.surfTime, 20000);
  game.update(27200); assert.equal(game.surfPhase, 'calm'); assert.equal(game.nextWaveAt, 40000);
  game.update(37000); assert.equal(game.surfPhase, 'warning');
  game.update(40000); assert.equal(game.waveCount, 2); assert.equal(game.waveUntil, 46000); assert.equal(game.waveRetreatUntil, 47200);
  const full = create(); collect(full, [2,5,4,6], 1000); assert.equal(full.remaining, 60000);
  assert.equal(full.bonusTime, 1000); assert.equal(full.surfTime, 1000);
});
test('wave arrival does not advance a pending mismatch by its three-second tide penalty', () => {
  const game = create(); collect(game, [0,1], 19900);
  assert.equal(game.pending.at, 20400);
  game.update(20000); assert.equal(game.cards[0].status, 'open'); assert.equal(game.pending.at, 20400);
  game.update(20399); assert.equal(game.cards[0].status, 'open');
  game.update(20400); assert.equal(game.cards[0].status, 'hidden'); assert.equal(game.pending, null);
  assert.equal(game.isWashed(0), true); assert.equal(game.surfPhase, 'arriving');
});
test('a previously opened card remains selected under surf and can match an accessible partner without flipping the washed cell', () => {
  const game = create(); assert.equal(game.select(0, 19000), true);
  game.update(20000); assert.equal(game.cards[0].status, 'open'); assert.equal(game.isWashed(0), true);
  assert.equal(game.select(0, 20000), false); assert.equal(game.select(10, 20000), true);
  assert.equal(game.pairs, 1); assert.equal(game.cards[0].status, 'matched'); assert.equal(game.isWashed(0), true);
  game.update(25000); assert.equal(game.cards[0].status, 'matched'); assert.equal(game.select(0, 25000), false);
});
test('surf covers collected holes without resurrecting rewards, and retry restores the fixed deck with fresh clocks', () => {
  const game = create(); collect(game, [2,5], 1000); game.update(20000);
  assert.equal(game.isWashed(2), true); assert.equal(game.cards[2].status, 'matched');
  const bonus = game.bonusTime; assert.equal(game.select(2, 20000), false); assert.equal(game.bonusTime, bonus);
  game.start(30000); assert.deepEqual(game.cards.map(card => card.value), level.layout);
  assert.equal(game.surfTime, 0); assert.equal(game.waveCount, 0); assert.equal(game.surfPhase, 'calm');
  assert.equal(game.surfTarget, null); assert.equal(game.remaining, 60000); assert.equal(game.pairs, 0);
});
test('a long frame processes two arrivals once each and stops at the actual fifty-four-second timeout', () => {
  const game = create(); game.update(100000);
  assert.equal(game.state, 'lost'); assert.equal(game.failureReason, 'timeout'); assert.equal(game.remaining, 0);
  assert.equal(game.waveCount, 2); assert.equal(game.surfTime, 54000); assert.equal(game.activeTime, 54000);
  assert.equal(game.select(0, 100000), false); assert.equal(game.bonusTime, 0);
});
test('arrival penalties can end a run instantly, while natural timeout at the same deadline precedes arrival', () => {
  const charged = create({ duration: 22000 }); charged.update(20000);
  assert.equal(charged.state, 'lost'); assert.equal(charged.waveCount, 1); assert.equal(charged.failureReason, 'timeout');
  assert.equal(charged.pending, null); assert.equal(charged.select(0, 20000), false);
  const natural = create({ duration: 20000 }); natural.update(20000);
  assert.equal(natural.state, 'lost'); assert.equal(natural.waveCount, 0);
});
test('completing every pair during a wash wins immediately even while collected holes are still hidden', () => {
  const game = create();
  for (const card of game.cards.slice(0,6)) if (card.status === 'hidden') {
    const partner = game.cards.find(item => item.index !== card.index && item.value === card.value && item.status === 'hidden');
    collect(game, [card.index, partner.index], 1000);
  }
  game.update(21000); assert.equal(game.surfPhase, 'washing');
  for (const kind of [0,1,2,4,5]) collect(game, game.cards.filter(card => card.value === kind && card.status === 'hidden').map(card => card.index), 21000);
  assert.equal(game.state, 'won'); assert.equal(game.pairs, 18);
  game.update(100000); assert.equal(game.waveCount, 1);
});
