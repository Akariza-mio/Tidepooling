// Synthetic fixtures exercise spreading boundaries; the authored first level is checked below.
const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../core.js');
const levels = require('../levels.js');
const fixture = cells => ({ rows: 4, columns: 4, duration: 60000, pairBonus: 5000,
  seagrass: { cells }, layout: [0,1,2,3,0,1,2,3,2,3,0,1,2,3,0,1] });
const create = (cells = [5]) => { const game = new Game({ level: fixture(cells) }); game.start(0); return game; };
test('the swapped first reef level uses only its eight marked cells and a fixed solvable five-kind deck', () => {
  const level = levels.find(level => level.id === 21), game = new Game({ level }); game.start(0);
  const initialGrass = [4,9,11,16,19,24,26,31];
  assert.equal(level.rows, 6); assert.equal(level.columns, 6); assert.equal(game.duration, 60000);
  assert.equal(level.intro, 'seagrass'); assert.deepEqual(game.conditions, []);
  assert.deepEqual(game.cards.filter(card => card.tangled).map(card => card.index), initialGrass);
  assert.deepEqual([0,1,2,4,5].map(kind => level.layout.filter(value => value === kind).length), [8,8,8,6,6]);
  assert.notDeepEqual(level.layout, levels.find(level => level.id === 22).layout);
  game.select(4, 0); game.select(3, 0);
  assert.equal(game.cards[3].tangled, false);
  assert.equal(game.cards[5].tangled, true); assert.equal(game.cards[10].tangled, true);
  game.update(500); assert.equal(game.isGrassLocked(game.cards[4]), true);
  game.update(10000); assert.equal(game.isGrassLocked(game.cards[4]), false);
  for (const kind of [0,1,2,4,5]) for (const card of game.cards.filter(card => card.value === kind)) assert.equal(game.select(card.index, 10000), true);
  assert.equal(game.state, 'won'); assert.equal(game.pairs, 18); assert.ok(game.remaining <= 60000);
  game.start(20000); assert.deepEqual(game.cards.map(card => card.value), level.layout);
  assert.deepEqual(game.cards.filter(card => card.tangled).map(card => card.index), initialGrass);
});

test('the swapped second reef level has the exact twelve red-circle cells and an independent fixed deck', () => {
  assert.equal(levels.length, 32); assert.equal(levels.some(level => level.id >= 33), false);
  const level = levels.find(level => level.id === 22), game = new Game({ level }); game.start(0);
  assert.equal(level.rows, 6); assert.equal(level.columns, 6); assert.equal(game.duration, 60000);
  assert.equal(game.totalPairs, 18); assert.equal(level.intro, undefined);
  assert.deepEqual(game.cards.filter(card => card.tangled).map(card => card.index), [2,5,7,10,12,15,20,23,25,28,30,33]);
  assert.deepEqual([0,1,2,4,5].map(kind => level.layout.filter(value => value === kind).length), [8,8,8,6,6]);
  game.select(2, 0); game.select(3, 0);
  assert.equal(game.cards[3].tangled, false, 'An open ordinary partner is not infectable.');
  assert.equal(game.cards[1].tangled, true); assert.equal(game.cards[8].tangled, true);
  game.update(10000);
  for (const kind of [0,1,2,4,5]) for (const card of game.cards.filter(card => card.value === kind)) assert.equal(game.select(card.index, 10000), true);
  assert.equal(game.state, 'won'); assert.equal(game.pairs, 18);
  game.start(20000); assert.deepEqual(game.cards.map(card => card.value), level.layout);
  assert.equal(game.cards.filter(card => card.tangled).length, 12);
});
test('green grass is directly selectable; matching does not release adjacent grass', () => {
  const game = create([5, 6]);
  assert.equal(game.select(5, 0), true); assert.equal(game.select(1, 0), true);
  assert.equal(game.pairs, 1); assert.equal(game.bonusTime, 0);
  assert.equal(game.cards[6].tangled, true); assert.equal(game.isGrassLocked(game.cards[6]), false);
});
test('a grass mismatch spreads one ring; newly infected grass spreads on its next mismatch', () => {
  const game = create(); game.select(5, 0); game.select(4, 0);
  assert.deepEqual(game.cards.filter(card => card.tangled).map(card => card.index), [1,5,6,9]);
  assert.equal(game.isGrassLocked(game.cards[5]), true);
  assert.equal(game.isGrassLocked(game.cards[4]), false);
  assert.equal(game.cards[4].tangled, false);
  assert.equal(game.cards[5].status, 'open'); assert.equal(game.cards[4].status, 'open');
  assert.equal(game.select(1, 0), false);
  game.update(500); assert.equal(game.cards[5].status, 'hidden');
  assert.equal(game.select(5, 500), false); assert.equal(game.select(9, 500), true);
  game.select(2, 500);
  assert.equal(game.cards[8].tangled, true); assert.equal(game.cards[10].tangled, true);
  assert.equal(game.cards[2].tangled, false);
  assert.equal(game.cards[5].grassLockedUntil, 10000);
  assert.equal(game.cards[9].grassLockedUntil, 10500);
});
test('both original grass members spread and lock; diagonals remain normal', () => {
  const game = create([5, 10]); game.select(5, 0); game.select(10, 0);
  assert.deepEqual(game.cards.filter(card => card.tangled).map(card => card.index), [1,4,5,6,9,10,11,14]);
  assert.equal(game.cards[5].grassLockedUntil, 10000); assert.equal(game.cards[10].grassLockedUntil, 10000);
  assert.equal(game.cards[2].tangled, false); assert.equal(game.cards[8].tangled, false);
});
test('edge propagation never wraps and normal mismatches do not grow grass', () => {
  const edge = create([3]); edge.select(3, 0); edge.select(0, 0);
  assert.deepEqual(edge.cards.filter(card => card.tangled).map(card => card.index), [2,3,7]);
  const plain = create(); plain.select(0, 0); plain.select(1, 0);
  assert.deepEqual(plain.cards.filter(card => card.tangled).map(card => card.index), [5]);
  assert.equal(plain.cards[0].grassLockedUntil, null); assert.equal(plain.mismatches, 1);
});
test('locks expire at exactly ten active seconds regardless of matching time bonuses', () => {
  const game = create(); game.select(5, 0); game.select(4, 0);
  game.update(500); game.select(2, 500); game.select(6, 500);
  assert.equal(game.bonusTime, 500); assert.equal(game.cards[5].grassLockedUntil, 10000);
  game.update(9999); assert.equal(game.isGrassLocked(game.cards[5]), true);
  game.update(10000); assert.equal(game.isGrassLocked(game.cards[5]), false);
  assert.equal(game.cards[5].tangled, true); assert.equal(game.select(5, 10000), true);
});
test('pause freezes locks and retry restores only the initial grass', () => {
  const game = create(); game.select(5, 1000); game.select(4, 1000); game.pause(2000);
  game.update(62000); assert.equal(game.activeTime, 2000);
  game.resume(62000); game.update(70999); assert.equal(game.isGrassLocked(game.cards[5]), true);
  game.update(71000); assert.equal(game.isGrassLocked(game.cards[5]), false);
  game.start(80000);
  assert.deepEqual(game.cards.filter(card => card.tangled).map(card => card.index), [5]);
  assert.ok(game.cards.every(card => card.grassLockedUntil === null)); assert.equal(game.mismatches, 0);
});
test('propagation never resurrects collected items or blocks final victory', () => {
  const game = create(); game.select(0, 0); game.select(4, 0);
  game.select(5, 1000); game.select(2, 1000);
  assert.equal(game.cards[4].tangled, false); assert.equal(game.cards[4].status, 'matched');
  assert.equal(game.pairs, 1); assert.equal(game.select(4, 11000), false);
  for (const kind of [0,1,2,3]) for (const card of game.cards.filter(card => card.value === kind && card.status === 'hidden')) game.select(card.index, 11000);
  assert.equal(game.state, 'won'); assert.equal(game.pairs, 8);
});

test('existing grass, fog-covered cells and other unavailable positions are skipped', () => {
  const level = { ...fixture([5,6]), fog: { cells: [1], duration: 5000 } };
  const game = new Game({ level }); game.start(0);
  game.cards[6].grassLockedUntil = 6000;
  game.select(5, 0); game.select(4, 0);
  assert.equal(game.cards[1].tangled, false, 'Covered fog is not a selectable ordinary cell.');
  assert.equal(game.cards[4].tangled, false, 'The currently open partner is not selectable.');
  assert.equal(game.cards[6].grassLockedUntil, 6000, 'Existing grass is unchanged.');
  assert.equal(game.cards[9].tangled, true, 'An adjacent closed ordinary cell is infected.');
});
