const test = require('node:test');
const assert = require('node:assert/strict');
const MemoryGame = require('../core.js');
const levels = require('../levels.js');

const create = (options = {}) => {
  const game = new MemoryGame(options);
  game.start(0);
  return game;
};
const findPair = game => {
  const a = game.cards.find(card => card.status === 'hidden');
  return [a.index, game.cards.find(card => card.index !== a.index && card.status === 'hidden' && card.value === a.value).index];
};

test('6×6 deck repeats four shell types with even counts and resets cleanly', () => {
  const game = create();
  assert.equal(game.cards.length, 36);
  const counts = new Map();
  game.cards.forEach(card => counts.set(card.value, (counts.get(card.value) || 0) + 1));
  assert.equal(counts.size, 4);
  assert.deepEqual([...counts.values()].sort((a, b) => a - b), [8, 8, 10, 10]);
  assert.ok([...counts.values()].every(count => count % 2 === 0));
  game.select(0, 100);
  game.start(200);
  assert.equal(game.elapsed, 0);
  assert.equal(game.pairs, 0);
  assert.equal(game.selected.length, 0);
  assert.ok(game.cards.every(card => card.status === 'hidden'));
});
test('level one has a fixed layout across restarts and new game instances', () => {
  const game = create();
  const initial = game.cards.map(card => card.value);
  game.select(0, 10);
  game.select(3, 20);
  game.start(30);
  assert.deepEqual(game.cards.map(card => card.value), initial);
  assert.ok(game.cards.every(card => card.status === 'hidden'));
  assert.deepEqual(create().cards.map(card => card.value), initial);
  assert.deepEqual(initial, [...levels[0].layout]);
  assert.equal(game.duration, 120000);
  assert.ok(Object.isFrozen(levels[0].layout));
});
test('any two copies of the same shell can match, repeatedly within one level', () => {
  const game = create();
  const copies = game.cards.filter(card => card.value === 0);
  game.select(copies[0].index, 10);
  game.select(copies[copies.length - 1].index, 20);
  game.select(copies[2].index, 30);
  game.select(copies[1].index, 40);
  assert.equal(game.pairs, 2);
  assert.equal(game.cards.filter(card => card.status === 'matched').length, 4);
  assert.equal(game.cards.filter(card => card.value === 0 && card.status === 'hidden').length, copies.length - 4);
});
test('a mismatch stays visible for 500 ms, then immediately accepts the next tile', () => {
  const game = create();
  assert.equal(game.revealDuration, 500);
  const a = 0, b = game.cards.find(card => card.value !== game.cards[a].value).index;
  assert.equal(game.select(a, 100), true);
  assert.equal(game.select(a, 101), false);
  assert.equal(game.select(b, 200), true);
  assert.equal(game.cards[a].status, 'open');
  assert.equal(game.cards[b].status, 'open');
  const c = game.cards.find(card => card.index !== a && card.index !== b).index;
  assert.equal(game.select(c, 201), false);
  game.update(699);
  assert.equal(game.cards[b].status, 'open');
  game.update(700);
  assert.equal(game.cards[a].status, 'hidden');
  assert.equal(game.cards[b].status, 'hidden');
  assert.equal(game.select(c, 700), true);
});
test('a match collects exactly two cards and cannot be selected again', () => {
  const game = create();
  const [a, b] = findPair(game);
  game.select(a, 20);
  game.select(b, 40);
  assert.equal(game.pairs, 1);
  assert.equal(game.cards[a].status, 'matched');
  assert.equal(game.cards[b].status, 'matched');
  assert.equal(game.select(a, 50), false);
  assert.equal(game.selected.length, 0);
});
test('all 18 pairs win before animation completion, even just before timeout', () => {
  const game = create({ duration: 10000 });
  let now = 0;
  for (let i = 0; i < 18; i++) {
    const [a, b] = findPair(game);
    game.select(a, ++now);
    game.select(b, i === 17 ? 9999 : ++now);
  }
  assert.equal(game.state, 'won');
  game.update(12000);
  assert.equal(game.state, 'won');
  assert.equal(game.pairs, 18);
});
test('timeout ends the level and late clicks cannot turn a loss into a win', () => {
  const game = create({ duration: 1000 });
  const [a, b] = findPair(game);
  game.select(a, 999);
  assert.equal(game.select(b, 1000), false);
  assert.equal(game.state, 'lost');
  assert.equal(game.pairs, 0);
  assert.equal(game.progress, 1);
});
test('paused wall time is excluded, including mismatch exposure time', () => {
  const game = create({ duration: 5000 });
  const b = game.cards.find(card => card.value !== game.cards[0].value).index;
  game.select(0, 100);
  game.select(b, 200);
  assert.equal(game.pause(500), true);
  game.update(8000);
  assert.equal(game.elapsed, 500);
  assert.equal(game.select(5, 8500), false);
  game.resume(9000);
  game.update(9199);
  assert.equal(game.cards[0].status, 'open');
  game.update(9200);
  assert.equal(game.cards[0].status, 'hidden');
  assert.equal(game.elapsed, 700);
});
test('clock jumps use elapsed milliseconds, independent of rendered frames', () => {
  const game = create();
  game.update(60000);
  assert.equal(game.progress, .5);
  game.update(119999);
  assert.equal(game.state, 'playing');
  game.update(120000);
  assert.equal(game.state, 'lost');
  assert.equal(game.progress, 1);
});
