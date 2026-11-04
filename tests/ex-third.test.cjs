const test = require('node:test'), assert = require('node:assert/strict');
const MemoryGame = require('../core.js');
const level = require('../levels.js').find(level => level.id === 43);
const grass = [9, 10, 14, 16, 18, 31];
const create = () => { const game = new MemoryGame({ level }); game.start(0); return game; };
function reveal(game, i, now) { if (game.cards[i].fog.covered) game.clearFog(i, now); return game.select(i, now); }

test('EX third combines full fog and six fixed scattered grass cells with four even item pools', () => {
  const game = create();
  assert.equal(level.rows, 6); assert.equal(level.columns, 6); assert.equal(game.duration, 60000);
  assert.equal(game.cards.length, 36); assert.equal(game.totalPairs, 18);
  assert.deepEqual([0,1,2,4].map(kind => level.layout.filter(k => k === kind).length), [10,10,8,8]);
  assert.deepEqual(game.cards.filter(c => c.tangled).map(c => c.index), grass);
  assert.ok(game.cards.every(c => c.fog.covered)); assert.deepEqual(game.conditions, []); assert.equal(level.surf, undefined);
  assert.equal(game.select(9, 0), false); game.clearFog(9, 0);
  assert.equal(game.cards[9].status, 'hidden'); assert.equal(game.cards[9].tangled, true);
  assert.equal(game.select(9, 0), true);
});

test('mismatched grass infects covered neighbors without clearing fog, while fog and locks expire independently', () => {
  const game = create(); reveal(game, 9, 0); reveal(game, 10, 0);
  assert.equal(game.mismatches, 1);
  for (const i of [3,4,8,11,15]) { assert.equal(game.cards[i].tangled, true); assert.equal(game.cards[i].fog.covered, true); }
  assert.equal(game.cards[0].tangled, false); assert.equal(game.cards[3].grassLockedUntil, null);
  game.update(500); assert.equal(game.cards[9].status, 'hidden'); assert.equal(game.isGrassLocked(game.cards[9]), true);
  game.update(5000); assert.equal(game.cards[9].fog.covered, true); assert.equal(game.isGrassLocked(game.cards[9]), true);
  assert.equal(game.clearFog(9, 5000), true); assert.equal(game.select(9, 5000), false);
  assert.equal(game.cards[9].grassLockedUntil, 10000);
  game.pause(5500); game.update(90000); assert.equal(game.activeTime, 5500);
  assert.equal(game.cards[9].fog.covered, false); assert.equal(game.isGrassLocked(game.cards[9]), true);
  game.resume(100000); game.update(104499); assert.equal(game.isGrassLocked(game.cards[9]), true);
  game.update(104500); assert.equal(game.isGrassLocked(game.cards[9]), false); assert.equal(game.cards[9].fog.covered, true);
});

test('collected cells stay collected under refog, the full mixed board can win, and retry restores both layers', () => {
  const game = create(); reveal(game, 0, 0); reveal(game, 4, 0); game.update(5000);
  assert.equal(game.cards[0].status, 'matched'); assert.equal(game.cards[0].fog.covered, true);
  assert.equal(game.clearFog(0, 5000), true); assert.equal(game.select(0, 5000), false); assert.equal(game.pairs, 1);
  for (const kind of [0,1,2,4]) for (const card of game.cards.filter(c => c.value === kind && c.status === 'hidden')) reveal(game, card.index, 5000);
  assert.equal(game.state, 'won'); assert.equal(game.pairs, 18); assert.equal(game.mismatches, 0);
  game.start(6000); assert.equal(game.remaining, 60000); assert.equal(game.pairs, 0);
  assert.deepEqual(game.cards.map(c => c.value), [...level.layout]);
  assert.deepEqual(game.cards.filter(c => c.tangled).map(c => c.index), grass);
  assert.ok(game.cards.every(c => c.fog.covered && c.grassLockedUntil === null));
  assert.equal(game.clearFog(9, 66000), false); assert.equal(game.failureReason, 'timeout');
});
