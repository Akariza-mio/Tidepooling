const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../journey.js');
const levels = require('../levels.js');
const level = levels.find(level => level.id === 16);
const create = (random = () => 0) => { const game = new Game({ level, random }); game.start(0); return game; };
const ready = random => { const game = create(random); game.beginPreview(0); game.update(5000); return game; };

test('sixth night level retains both clocks, cross sight, five distinct objects and obstacles', () => {
  const game = ready();
  assert.equal(level.rows, 7); assert.equal(level.columns, 7);
  assert.equal(game.duration, 60000); assert.equal(game.targetRemaining, 15000);
  assert.deepEqual([...game.visited], [24]);
  assert.equal(game.cards.filter(card => !card.fog.covered).length, 5);
  assert.deepEqual(level.treasures.map(item => item.kind), [0, 1, 2, 4, 5]);
  assert.ok(level.layout.includes(-1) && level.layout.includes(-2));
  for (const item of level.treasures) assert.ok(game.completionRoute(item.index), 'Every initial target has a full completion route.');
});

test('departed tiles including the spawn cannot be stepped on; invalid clicks spend no cells', () => {
  const game = ready();
  assert.equal(game.move(17, 5000), true);
  assert.equal(game.isSpent(24), true);
  assert.equal(game.move(24, 5000), false);
  assert.equal(game.position, 17); assert.equal(game.turns, 1);
  assert.equal(game.move(16, 5000), false);
  assert.equal(game.visited.has(16), false);
  assert.equal(game.move(48, 5000), false);
  assert.deepEqual([...game.visited], [24, 17]);
  game.pause(6000); game.resume(90000);
  assert.equal(game.isSpent(24), true); assert.equal(game.remaining, 59000);
  game.start(100000);
  assert.deepEqual([...game.visited], [24]); assert.equal(game.collectedCount, 0);
  assert.equal(game.phase, 'intro');
});

test('fifth night level still allows returning to visited sand', () => {
  const game = new Game({ level: levels.find(level => level.id === 15) });
  game.start(0); game.beginPreview(0); game.update(5000);
  game.move(17, 5000);
  assert.equal(game.move(24, 5000), true);
  assert.equal(game.isSpent(17), false);
});

test('100 randomized target runs can finish with five pickups and no repeated steps', () => {
  const firstKinds = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    let state = seed * 100003;
    const game = ready(() => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32));
    firstKinds.add(game.target.kind);
    let now = 5000;
    while (game.state === 'playing') {
      const route = game.completionRoute(game.target.index);
      assert.ok(route, 'Refreshed targets must retain a full solution.');
      const before = game.collectedCount;
      for (const next of route) {
        assert.equal(game.visited.has(next), false);
        assert.equal(game.move(next, ++now), true);
        if (game.collectedCount > before) break;
      }
    }
    assert.equal(game.state, 'won'); assert.equal(game.collectedCount, 5);
    assert.equal(game.visited.size, game.turns + 1);
    assert.equal(game.bonusTime, 0);
  }
  assert.equal(firstKinds.size, 5);
});

test('timeouts refresh only viable targets and wrong pickups still fail immediately', () => {
  const game = ready(); game.update(20000);
  assert.equal(game.penalties, 1); assert.equal(game.remaining, 25000);
  assert.ok(game.completionRoute(game.target.index));
  const wrong = ready();
  assert.equal(wrong.target.kind, 0);
  for (const index of [23, 22]) wrong.move(index, 5000);
  assert.equal(wrong.state, 'lost'); assert.equal(wrong.failureReason, 'wrongTarget');
});
