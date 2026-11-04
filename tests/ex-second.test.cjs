const test = require('node:test'), assert = require('node:assert/strict');
const MemoryGame = require('../core.js');
const level = require('../levels.js').find(level => level.id === 42);
const create = () => { const game = new MemoryGame({ level }); game.start(0); return game; };
function pair(game, index, now) { game.select(index * 2, now); game.select(index * 2 + 1, now); }

test('EX second has 36 identical crabs and requires all eighteen pairs inside one fifteen-second window', () => {
  const game = create();
  assert.equal(level.rows, 6); assert.equal(level.columns, 6); assert.equal(game.duration, 60000);
  assert.equal(level.layout.length, 36); assert.ok(level.layout.every(kind => kind === 1));
  assert.deepEqual(game.conditions.map(c => [c.type, c.count, c.window]), [['timedPairs', 18, 15000]]);
  assert.equal(level.surf, undefined); assert.equal(level.fog, undefined); assert.equal(level.seagrass, undefined);
  for (let i = 0; i < 17; i++) pair(game, i, 750 * i);
  assert.equal(game.state, 'playing'); assert.equal(game.conditionStates[0].completed, false);
  pair(game, 17, 15000);
  assert.equal(game.state, 'won'); assert.equal(game.pairs, 18); assert.equal(game.mismatches, 0);
  assert.equal(game.conditionStates[0].completed, true); assert.equal(game.remaining, 60000);
});

test('15001 ms between the first and eighteenth successes fails despite the time rewards', () => {
  const game = create();
  for (let i = 0; i < 17; i++) pair(game, i, 750 * i);
  pair(game, 17, 15001);
  assert.equal(game.state, 'lost'); assert.equal(game.failureReason, 'conditions');
  assert.equal(game.pairs, 18); assert.equal(game.conditionStates[0].failed, true);
  assert.ok(game.remaining > 0); assert.ok(game.bonusTime > 0);
});

test('the window can start later in play; pauses do not consume it and retry clears it', () => {
  const game = create();
  pair(game, 0, 30000); game.pause(31000); game.update(131000);
  assert.equal(game.select(2, 131000), false);
  game.resume(200000);
  for (let i = 1; i < 18; i++) pair(game, i, 200000 + i * 500);
  assert.equal(game.state, 'won');
  game.start(250000);
  assert.deepEqual(game.pairTimes, []); assert.equal(game.remaining, 60000);
  assert.equal(game.conditionStates[0].completed, false); assert.equal(game.pairs, 0);
  assert.deepEqual(game.cards.map(card => card.value), [...level.layout]);
  assert.equal(game.select(0, 315000), false); assert.equal(game.failureReason, 'timeout');
});
