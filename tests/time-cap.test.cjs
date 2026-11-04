const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../core.js');
const levels = require('../levels.js');
function pair(game, now) {
  const opening = game.conditions.find(condition => condition.type === 'firstPairsKind' && game.pairs < condition.count);
  const a = game.cards.find(card => card.status === 'hidden' && (!opening || card.value === opening.kind));
  const b = game.cards.find(card => card.index !== a.index && card.status === 'hidden' && card.value === a.value);
  for (const card of [a, b]) {
    game.clearFog(card.index, now);
    assert.equal(game.select(card.index, now), true);
  }
}
for (const level of levels.filter(level => !level.type && !level.surf && level.pairBonus > 0)) test(`level ${level.id} discards overflow across repeated rewards and has no hidden bank`, () => {
  const game = new Game({ level }); game.start(0);
  game.update(1000); assert.equal(game.remaining, level.duration - 1000);
  pair(game, 1000); assert.equal(game.remaining, level.duration);
  pair(game, 1000); pair(game, 1000); assert.equal(game.remaining, level.duration);
  game.update(2000); assert.equal(game.remaining, level.duration - 1000);
  game.pause(2000); game.update(100000); assert.equal(game.remaining, level.duration - 1000);
  game.resume(100000);
  game.update(100000 + level.duration - 1001); assert.equal(game.remaining, 1);
  game.update(100000 + level.duration - 1000); assert.equal(game.state, 'lost');
  assert.equal(game.failureReason, 'timeout');
});
for (const duration of [60000, 90000]) test(`reward cap follows a ${duration / 1000}-second level and retains full bonuses below the cap`, () => {
  const game = new Game({ level: levels[0], duration }); game.start(0);
  pair(game, 10000); assert.equal(game.remaining, duration - 5000);
  pair(game, 10000); assert.equal(game.remaining, duration);
  pair(game, 10000); assert.equal(game.remaining, duration);
  game.update(11000); assert.equal(game.remaining, duration - 1000);
  game.start(20000); assert.equal(game.remaining, duration); assert.equal(game.bonusTime, 0);
});
