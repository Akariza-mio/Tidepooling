const test = require('node:test');
const assert = require('node:assert/strict');
const BucketSort = require('../bucket-sort.js');
const levels = require('../levels.js');
const solution = require('./bucket-sort-six-solution.cjs');
const level = levels.find(level => level.id === 36);
function create(custom=level) { const game = new BucketSort({ level:custom }); game.start(0); return game; }
function move(game, from, to, now=0) { assert.ok(game.canMove(from,to));assert.equal(game.select(from,now),true);assert.equal(game.select(to,now),true); }
test('exhaustive breadth-first search proves the authored single-empty layout needs at least 34 transfers', () => {
  // Bucket positions are interchangeable under the rules and the completion condition.
  const key = buckets => buckets.map(bucket => bucket.join(',')).sort().join('|');
  const queue = [{ buckets: level.buckets.map(bucket => [...bucket]), depth: 0 }], seen = new Set([key(level.buckets)]);
  let minimum = null;
  for (let head = 0; head < queue.length; head++) {
    const { buckets, depth } = queue[head];
    if (buckets.every(bucket => !bucket.length || bucket.length === level.capacity && bucket.every(kind => kind === bucket[0]))) { minimum = depth; break; }
    for (let from = 0; from < buckets.length; from++) if (buckets[from].length) for (let to = 0; to < buckets.length; to++) {
      if (from === to || buckets[to].length >= level.capacity || buckets[to].length && buckets[to].at(-1) !== buckets[from].at(-1)) continue;
      const next = buckets.map(bucket => [...bucket]); next[to].push(next[from].pop()); const state = key(next);
      if (!seen.has(state)) { seen.add(state); queue.push({ buckets: next, depth: depth + 1 }); }
    }
  }
  assert.equal(minimum, 34); assert.equal(level.optimalMoves, minimum); assert.equal(solution.length, minimum);
});
test('sixth sorting level contains six kinds of four in seven buckets with one empty, starts without an intro and keeps fifth independent', () => {
  const game=create();assert.equal(levels.length, 50);assert.equal(levels.some(level=>level.id > 50),false);
  assert.equal(level.type,'bucketSort');assert.equal(level.intro,undefined);assert.equal(level.duration,60000);assert.equal(level.capacity,4);
  assert.equal(game.timerRunning,true);assert.equal(game.buckets.length,7);assert.equal(game.buckets.filter(bucket=>!bucket.length).length,1);
  assert.deepEqual([0,1,2,3,4,5].map(kind=>game.buckets.flat().filter(value=>value===kind).length),[4,4,4,4,4,4]);
  assert.deepEqual(game.buckets.flat(),level.layout);assert.ok(level.buckets.every(Object.isFrozen));
  const fifth=levels.find(level=>level.id===35);assert.equal(fifth.intro,'bucketSort');assert.equal(fifth.layout.length,16);assert.equal(fifth.duration,60000);
  assert.notDeepEqual(game.buckets,fifth.buckets);assert.deepEqual(game.conditions,[]);assert.equal(level.surf,undefined);
  game.update(1000);assert.equal(game.remaining,59000);
});
test('the fixed single-empty layout accepts thirty-four legal transfers and reordered bucket positions, without bonuses', () => {
  for(const reordered of [false,true]) {
    const map=i=>reordered?(i+1)%7:i,buckets=Array(7);
    level.buckets.forEach((bucket,i)=>{buckets[map(i)]=bucket;});
    const game=create({...level,buckets,layout:buckets.flat()});
    solution.forEach(([from,to],i)=>{move(game,map(from),map(to),i*500);assert.equal(game.buckets.flat().length,24);});
    assert.equal(game.state,'won');assert.equal(game.sortedCount,6);assert.equal(game.turns,34);assert.equal(game.bonusTime,0);assert.equal(game.buckets.filter(bucket=>!bucket.length).length,1);
    assert.equal(game.undo(20000),false);assert.equal(game.select(0,20000),false);
  }
});
test('sixth level directly switches sources without a move, and freezes pause, undo and restart correctly', () => {
  const game=create(),initial=structuredClone(game.buckets);game.select(0,500);assert.equal(game.select(1,500),true);assert.equal(game.source,1);assert.equal(game.turns,0);
  assert.equal(game.select(2,500),true);assert.equal(game.source,2);assert.deepEqual(game.buckets,initial);assert.equal(game.history.length,0);
  game.select(0,500);assert.equal(game.source,0);
  assert.equal(game.select(6,1000),true);assert.deepEqual(game.buckets[6],[5]);const board=structuredClone(game.buckets);
  game.pause(2000);game.update(90000);assert.equal(game.remaining,58000);assert.equal(game.select(6,90000),false);assert.equal(game.undo(90000),false);assert.deepEqual(game.buckets,board);
  game.resume(90000);assert.equal(game.undo(91000),true);assert.equal(game.remaining,57000);assert.deepEqual(game.buckets,level.buckets);
  game.start(100000);assert.equal(game.timerRunning,true);assert.equal(game.source,null);assert.equal(game.turns,0);assert.equal(game.history.length,0);assert.deepEqual(game.buckets,level.buckets);
});
test('a final transfer at sixty seconds loses immediately and retry starts a fresh active minute', () => {
  const game=create();solution.slice(0,-1).forEach(([from,to])=>move(game,from,to));const [from,to]=solution.at(-1);
  game.select(from,59999);const board=structuredClone(game.buckets);assert.equal(game.select(to,60000),false);
  assert.equal(game.state,'lost');assert.equal(game.failureReason,'timeout');assert.deepEqual(game.buckets,board);assert.equal(game.remaining,0);
  game.start(90000);assert.equal(game.remaining,60000);assert.equal(game.timerRunning,true);game.update(91000);assert.equal(game.remaining,59000);
});
