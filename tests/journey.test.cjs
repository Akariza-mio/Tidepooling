const test = require('node:test');
const assert = require('node:assert/strict');
const Journey = require('../journey.js');
const level = require('../levels.js').find(level => level.id === 15);
const create = (options = {}) => { const game = new Journey({ level, random: () => 0, ...options }); game.start(0); return game; };
const ready = (options) => { const game = create(options); game.beginPreview(0); game.update(5000); return game; };
function path(game, goal) {
  const blocked = new Set(level.treasures.filter(item => !game.collected.has(item.index) && item.index !== goal).map(item => item.index));
  const queue = [[game.position]], seen = new Set([game.position]);
  for (const route of queue) {
    const last = route.at(-1);
    if (last === goal) return route.slice(1);
    for (const next of [last - 7, last + 7, last - 1, last + 1]) {
      if (next < 0 || next >= 49 || Math.abs(Math.floor(last / 7) - Math.floor(next / 7)) + Math.abs(last % 7 - next % 7) !== 1 || game.cards[next].value < 0 || blocked.has(next) || seen.has(next)) continue;
      seen.add(next); queue.push([...route, next]);
    }
  }
  throw Error('Target must be reachable without touching other objects');
}
function collectTarget(game, now = 5000) { for (const index of path(game, game.target.index)) assert.equal(game.move(index, now), true); }

test('7x7 map starts at the center and contains five distinct reachable items', () => {
  const game = ready();
  assert.equal(level.rows, 7); assert.equal(level.columns, 7);
  assert.equal(game.cards.length, 49); assert.equal(game.position, 24);
  assert.deepEqual(level.treasures.map(item => item.kind), [0, 1, 2, 4, 5]);
  for (const item of level.treasures) assert.ok(path(game, item.index).length);
});

test('intro and five-second preview freeze both clocks; only the overrun counts as play time', () => {
  const game = create(); game.update(90000);
  assert.equal(game.remaining, 60000); assert.equal(game.target, null);
  assert.equal(game.move(23, 90000), false);
  game.beginPreview(90000); game.update(94999);
  assert.equal(game.phase, 'preview'); assert.equal(game.remaining, 60000);
  game.update(97000);
  assert.equal(game.phase, 'exploring'); assert.equal(game.remaining, 58000);
  assert.equal(game.targetRemaining, 13000);
});

test('sight is exactly the five-cell cross and movement is cardinal, local and obstacle-aware', () => {
  const game = ready();
  assert.deepEqual(game.cards.filter(card => !card.fog.covered).map(card => card.index), [17, 23, 24, 25, 31]);
  assert.equal(game.move(16, 5000), false); assert.equal(game.move(1, 5000), false);
  assert.equal(game.move(-1, 5000), false); assert.equal(game.clearFog(1, 5000), false);
  assert.equal(game.move(17, 5000), true);
  assert.equal(game.move(16, 5000), false); assert.equal(game.position, 17);
  assert.equal(game.cards[31].fog.covered, true);
});

test('touching a wrong item fails immediately without forcing the tide to full', () => {
  const game = ready();
  assert.equal(game.target.kind, 0);
  for (const index of path(game, 21)) game.move(index, 5000);
  assert.equal(game.state, 'lost'); assert.equal(game.failureReason, 'wrongTarget');
  assert.equal(game.wrongKind, 2); assert.equal(game.collectedCount, 0);
  assert.equal(game.remaining, 60000); assert.equal(game.move(22, 5000), false);
});

test('correct contact collects once, immediately changes the target, and five successes win without returning', () => {
  const game = ready();
  const pool = [...level.layout];
  for (let i = 0; i < 5; i++) {
    const old = game.target;
    collectTarget(game);
    assert.equal(game.collectedCount, i + 1);
    if (i < 4) { assert.notEqual(game.target.kind, old.kind); assert.equal(game.targetRemaining, 15000); }
  }
  assert.equal(game.state, 'won'); assert.notEqual(game.position, level.start);
  assert.equal(game.bonusTime, 0); assert.equal(game.pairs, 0);
  assert.deepEqual(level.layout, pool);
  assert.ok(game.targetHistory.every((kind, i, list) => !i || kind !== list[i - 1]));
  game.start(10000);
  assert.equal(game.position, 24); assert.equal(game.collectedCount, 0);
  assert.equal(game.target, null); assert.equal(game.penalties, 0); assert.equal(game.phase, 'intro');
});

test('a fifteen-second miss adds twenty seconds to the tide, switches targets, and resets only the target clock', () => {
  const game = ready();
  const before = game.target.kind;
  game.update(19999); assert.equal(game.penalties, 0);
  game.update(20000);
  assert.equal(game.penalties, 1); assert.equal(game.remaining, 25000);
  assert.equal(game.targetRemaining, 15000); assert.notEqual(game.target.kind, before);
  assert.equal(game.penaltyActive, true);
  game.update(35000);
  assert.equal(game.state, 'lost'); assert.equal(game.failureReason, 'timeout');
  assert.equal(game.penalties, 2); assert.equal(game.remaining, 0);
});

test('large clock jumps process target deadlines exactly once and cannot skip penalties', () => {
  const game = ready(); game.update(45000);
  assert.equal(game.state, 'lost'); assert.equal(game.penalties, 2);
  const long = ready({ duration: 300000 }); long.update(45000);
  assert.equal(long.penalties, 2); assert.equal(long.remaining, 220000);
  assert.ok(long.targetHistory.every((kind, i, list) => !i || kind !== list[i - 1]));
});

test('pause freezes preview, target countdown and tide; deadlines take priority over late moves', () => {
  const preview = create(); preview.beginPreview(0); preview.pause(1000);
  preview.update(90000); assert.equal(preview.previewSeconds, 4);
  preview.resume(90000); preview.update(94000);
  assert.equal(preview.targetRemaining, 15000); assert.equal(preview.remaining, 60000);
  const game = ready(); game.pause(6000); game.update(90000);
  assert.equal(game.remaining, 59000); assert.equal(game.targetRemaining, 14000);
  game.resume(100000); game.update(101000);
  assert.equal(game.remaining, 58000); assert.equal(game.targetRemaining, 13000);
  const expired = ready({ duration: 1 });
  assert.equal(expired.move(23, 5001), false); assert.equal(expired.failureReason, 'timeout');
});

test('the final remaining item continues after a miss without duplicate draws or resurrecting collected items', () => {
  const game = ready(); for (let i = 0; i < 4; i++) collectTarget(game);
  const history = [...game.targetHistory]; const target = game.target;
  game.update(20000);
  assert.equal(game.penalties, 1); assert.equal(game.target.kind, target.kind);
  assert.deepEqual(game.targetHistory, history); assert.equal(game.targetRemaining, 15000);
  assert.equal(game.collectedCount, 4);
  collectTarget(game, 20000); assert.equal(game.state, 'won');
});

test('correct pickups and revisits never add tide time; fifteen-second targets still reset', () => {
  const game = ready(); game.update(13000); collectTarget(game, 13000);
  assert.equal(game.bonusTime, 0); assert.equal(game.remaining, 52000);
  assert.equal(game.targetRemaining, 15000);
  game.move(2, 13000); game.move(1, 13000);
  assert.equal(game.collectedCount, 1); assert.equal(game.remaining, 52000);
  game.pause(13500); game.update(90000); assert.equal(game.remaining, 51500);
  game.resume(100000); game.update(100500); assert.equal(game.remaining, 51000);
  const short = ready({ duration: 20000 }); collectTarget(short);
  assert.equal(short.remaining, 20000);
  short.update(20000); assert.equal(short.failureReason, 'timeout');
  assert.equal(short.remaining, 0); assert.equal(short.penalties, 1);
});
