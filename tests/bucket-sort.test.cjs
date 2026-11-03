const test = require('node:test');
const assert = require('node:assert/strict');
const BucketSort = require('../bucket-sort.js');
const levels = require('../levels.js');
const solution = require('./bucket-sort-solution.cjs');
const level = levels.find(level => level.id === 35);
function create(custom = level) { const game = new BucketSort({ level: custom }); game.start(0); return game; }
function move(game, from, to, now = 0) { assert.equal(game.source, null); assert.equal(game.select(from, now), true); assert.equal(game.select(to, now), true); }
test('fifth level uses four kinds, six buckets, two empty buffers and an immutable fixed deck', () => {
  const game = create();
  assert.equal(levels.length, 40); assert.equal(levels.some(level => level.id >= 41), false);
  assert.equal(level.type, 'bucketSort'); assert.equal(game.capacity, 4); assert.equal(game.duration, 60000);
  assert.equal(game.buckets.length, 6); assert.equal(game.buckets.filter(bucket => !bucket.length).length, 2);
  assert.deepEqual(game.buckets.flat(), level.layout);
  assert.deepEqual([0,1,2,4].map(kind => game.buckets.flat().filter(value => value === kind).length), [4,4,4,4]);
  assert.equal(game.sortedCount, 0); assert.equal(game.totalPairs, 0); assert.deepEqual(game.conditions, []); assert.equal(level.surf, undefined);
  assert.ok(Object.isFrozen(level.buckets) && level.buckets.every(Object.isFrozen));
});
test('only one top item moves; wrong kinds, full buckets and empty sources leave the deck and counters intact', () => {
  const game = create(); const initial = structuredClone(game.buckets);
  assert.equal(game.select(4,0), false); assert.equal(game.select(0,0), true); assert.equal(game.source, 0);
  assert.equal(game.select(1,0), false); assert.equal(game.source, 0); assert.deepEqual(game.buckets, initial); assert.equal(game.turns, 0);
  assert.equal(game.select(4,0), true); assert.deepEqual(game.buckets[0],[0,1,2]); assert.deepEqual(game.buckets[4],[4]);
  assert.equal(game.turns, 1); assert.equal(game.source, null);
  game.select(3,0); assert.equal(game.select(4,0), false); assert.match(game.feedback,/相同物品/); assert.equal(game.turns,1);
  game.select(3,0); move(game,3,0); assert.deepEqual(game.buckets[0],[0,1,2,2]);
  assert.equal(game.canMove(0,0),false); assert.equal(game.canMove(-1,0),false); assert.equal(game.canMove(0,99),false);
  const snapshot=structuredClone(game.buckets); for (const index of [-1,6,1.5,'0']) assert.equal(game.select(index,0),false);
  assert.deepEqual(game.buckets,snapshot);
});
test('selection can be canceled, and undo restores the exact deck without refunding time or movement count', () => {
  const game=create();game.select(0,500);game.select(0,500);assert.equal(game.source,null);assert.equal(game.turns,0);
  move(game,0,4,1000); assert.equal(game.undo(2000),true); assert.deepEqual(game.buckets,level.buckets);
  assert.equal(game.remaining,58000); assert.equal(game.turns,1);assert.equal(game.bonusTime,0);assert.equal(game.history.length,0);
  assert.equal(game.undo(2000),false); assert.deepEqual(level.buckets[0],[0,1,2,4]);
});
test('intro and pause freeze the clock and block selecting/undo; retry resets everything', () => {
  const game=create(); game.setTimerRunning(false,0);game.update(90000);
  assert.equal(game.remaining,60000);assert.equal(game.activeTime,0);assert.equal(game.select(0,90000),false);
  game.setTimerRunning(true,90000);move(game,0,4,91000);game.select(1,92000);game.pause(92000);
  const before=structuredClone(game.buckets);game.update(200000);assert.equal(game.remaining,58000);assert.equal(game.select(6,200000),false);assert.equal(game.undo(200000),false);
  assert.deepEqual(game.buckets,before);assert.equal(game.source,1);game.resume(200000);game.update(201000);assert.equal(game.remaining,57000);
  game.start(300000);assert.deepEqual(game.buckets,level.buckets);assert.equal(game.turns,0);assert.equal(game.history.length,0);assert.equal(game.source,null);assert.equal(game.remaining,60000);
});
test('authored layout is solvable with sixteen legal individual transfers, accepting different destination buckets', () => {
  for (const swap of [false,true]) {
    const game=create();const map=i=>swap ? i===4?5:i===5?4:i : i;
    solution.forEach(([from,to],i)=>{move(game,map(from),map(to),1000+i*500);assert.equal(game.buckets.flat().length,16);assert.equal(game.buckets.some(bucket=>bucket.length>4),false);});
    assert.equal(game.state,'won');assert.equal(game.sortedCount,4);assert.equal(game.turns,16);assert.equal(game.bonusTime,0);
    const board=structuredClone(game.buckets);assert.equal(game.select(0,20000),false);assert.equal(game.undo(20000),false);assert.deepEqual(game.buckets,board);
  }
});
test('partial single-kind buckets are not a win, and a last transfer at the deadline cannot win', () => {
  const game=create();solution.slice(0,-1).forEach(([from,to])=>move(game,from,to));assert.equal(game.state,'playing');
  const before=structuredClone(game.buckets);const [from,to]=solution.at(-1);game.select(from,59999);
  assert.equal(game.select(to,60000),false);assert.equal(game.state,'lost');assert.equal(game.failureReason,'timeout');assert.deepEqual(game.buckets,before);
  assert.equal(game.undo(60000),false);assert.equal(game.remaining,0);
});
