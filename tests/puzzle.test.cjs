const test = require('node:test');
const assert = require('node:assert/strict');
const Puzzle = require('../puzzle.js');
const levels = require('../levels.js');
const level = levels.find(level => level.id === 5);
const solution = [0, 1, 2, 4, 2, 4, 0, 1, 4, 2, 1, 0, 1, 0, 4, 2];
const create = () => { const game = new Puzzle({ level }); game.start(0); return game; };
const fill = (game, values, now = 100) => values.forEach((value, i) => { if (!game.cards[i].fixed) game.place(i, value, now); });

test('fifth level has exactly two immutable clues, four kinds and a 60-second budget', () => {
  const game = create();
  assert.equal(game.cards.length, 16);
  assert.equal(game.filledCount, 2);
  assert.deepEqual(game.cards.filter(cell => cell.fixed).map(cell => [cell.index, cell.value]), [[0, 0], [15, 2]]);
  assert.deepEqual(level.kinds, [0, 1, 2, 4]);
  assert.equal(game.duration, 60000);
  assert.equal(game.place(0, 1, 1), false);
  assert.equal(game.place(15, null, 2), false);
  assert.equal(game.place(1, 3, 3), false);
  assert.equal(game.select(1, 4), false);
  assert.equal(game.filledCount, 2);
});

for (const [name, indices, value] of [
  ['row', [0, 1], 0], ['column', [0, 4], 0],
  ['main diagonal', [0, 10], 0], ['opposite diagonal', [3, 12], 1]
]) test(`detects duplicates in a ${name}`, () => {
  const game = create();
  indices.forEach(index => game.place(index, value, 1));
  assert.deepEqual([...game.conflicts].sort((a, b) => a - b), indices);
  assert.equal(game.state, 'playing');
});

test('erasing and replacing a filled cell removes conflicts without changing the clues', () => {
  const game = create();
  game.place(1, 0, 100);
  assert.equal(game.conflicts.size, 2);
  game.place(1, null, 200);
  assert.equal(game.conflicts.size, 0);
  assert.equal(game.filledCount, 2);
  game.place(1, 1, 300);
  assert.equal(game.conflicts.size, 0);
  assert.equal(game.filledCount, 3);
  assert.equal(game.bonusTime, 0);
  assert.equal(game.remaining, 59700);
});

test('a full board with valid rows and columns still needs both diagonals', () => {
  const game = create();
  fill(game, [0, 1, 2, 4, 1, 2, 4, 0, 2, 4, 0, 1, 4, 0, 1, 2]);
  assert.equal(game.filledCount, 16);
  assert.equal(game.state, 'playing');
  assert.ok(game.conflicts.size > 0);
  fill(game, solution, 200);
  assert.equal(game.state, 'won');
});

test('accepts different legal solutions without imposing 2x2 box constraints', () => {
  for (const values of [solution, [0, 4, 2, 1, 2, 1, 0, 4, 1, 2, 4, 0, 4, 0, 1, 2]]) {
    const game = create();
    fill(game, values);
    assert.equal(game.state, 'won');
    assert.equal(game.conflicts.size, 0);
    assert.equal(game.bonusTime, 0);
  }
});

test('entry reading and paused time do not consume the 60-second budget', () => {
  const game = create();
  game.setTimerRunning(false, 0);
  game.update(90000);
  assert.equal(game.remaining, 60000);
  game.setTimerRunning(true, 90000);
  game.place(1, 1, 91000);
  game.pause(92000);
  assert.equal(game.place(2, 2, 100000), false);
  game.update(190000);
  assert.equal(game.remaining, 58000);
  game.resume(200000);
  game.update(201000);
  assert.equal(game.remaining, 57000);
});

test('deadline takes priority over the last input; just-in-time completion succeeds', () => {
  for (const now of [59999, 60000, 60001]) {
    const game = create();
    solution.forEach((value, index) => { if (!game.cards[index].fixed && index !== 14) game.place(index, value, 100); });
    assert.equal(game.place(14, solution[14], now), now < 60000);
    assert.equal(game.state, now < 60000 ? 'won' : 'lost');
    assert.equal(game.failureReason, now < 60000 ? null : 'timeout');
  }
});

test('retry resets time and entries to the same two fixed clues', () => {
  const game = create();
  fill(game, solution);
  game.start(10000);
  assert.equal(game.state, 'playing');
  assert.equal(game.remaining, 60000);
  assert.equal(game.turns, 0);
  assert.equal(game.filledCount, 2);
  assert.deepEqual(game.cards.map(card => card.value), [...level.layout]);
});

const sixthLevel = levels.find(level => level.id === 6);
const sixthSolution = [0, 2, 5, 1, 4, 1, 4, 0, 2, 5, 2, 5, 1, 4, 0, 4, 0, 2, 5, 1, 5, 1, 4, 0, 2];
const createSixth = () => { const game = new Puzzle({ level: sixthLevel }); game.start(0); return game; };

test('sixth level has 25 cells, four fixed clues, fish and a 90-second budget', () => {
  const game = createSixth();
  assert.equal(game.cards.length, 25);
  assert.equal(game.filledCount, 4);
  assert.equal(game.duration, 90000);
  assert.deepEqual(sixthLevel.kinds, [0, 1, 2, 4, 5]);
  assert.deepEqual(sixthLevel.newItem, { kind: 5, name: '鱼儿' });
  assert.equal(game.conflicts.size, 0);
  for (const cell of game.cards.filter(cell => cell.fixed)) {
    assert.equal(cell.value, sixthSolution[cell.index]);
    assert.equal(game.place(cell.index, null, 10), false);
  }
  game.place(2, 5, 20);
  assert.equal(game.cards[2].value, 5);
  game.start(100);
  assert.deepEqual(game.cards.map(cell => cell.value), [...sixthLevel.layout]);
});

test('odd-sized board checks the central clue against both full diagonals', () => {
  for (const index of [6, 8]) {
    const game = createSixth();
    game.place(index, 1, 100);
    assert.deepEqual([...game.conflicts].sort((a, b) => a - b), [index, 12]);
  }
});

test('sixth-level clues admit a complete solution and an alternative legal solution', () => {
  // Swapping shrimp and conch is not suitable for the fixed conch clue. Swap
  // columns 1 and 3 together with rows 1 and 3, preserving both diagonals/clues.
  const permutation = [0, 3, 2, 1, 4];
  const alternative = permutation.flatMap(row => permutation.map(column => sixthSolution[row * 5 + column]));
  assert.notDeepEqual(alternative, sixthSolution);
  for (const values of [sixthSolution, alternative]) {
    const game = createSixth();
    fill(game, values, 89999);
    assert.equal(game.state, 'won');
    assert.equal(game.conflicts.size, 0);
    assert.equal(game.bonusTime, 0);
    assert.equal(game.filledCount, 25);
  }
});

test('sixth-level timer lasts 90 seconds and refuses completion at the deadline', () => {
  const game = createSixth();
  game.update(60000);
  assert.equal(game.state, 'playing');
  assert.equal(game.remaining, 30000);
  fill(game, sixthSolution, 90000);
  assert.equal(game.state, 'lost');
  assert.equal(game.failureReason, 'timeout');
  assert.equal(game.filledCount, 4);
});
