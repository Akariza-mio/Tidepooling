const test = require('node:test');
const assert = require('node:assert/strict');
const Game = require('../core.js');
const levels = require('../levels.js');
const level = levels.find(level => level.id === 24);
const create = (override = level) => { const game = new Game({level:override}); game.start(0); return game; };
const limit = game => game.conditionStates.find(condition => condition.type === 'maxGrass');
const flip = (game,a,b,now) => { assert.equal(game.select(a,now),true); assert.equal(game.select(b,now),true); };

test('reef fourth has exactly three marked grass cells, a fixed balanced deck, sixty seconds and only a ten-grass limit', () => {
  const game = create();
  assert.equal(level.rows,6); assert.equal(level.columns,6); assert.equal(game.duration,60000);
  assert.equal(game.totalPairs,18); assert.equal(game.conditions.length,1);
  assert.equal(limit(game).limit,10); assert.equal(limit(game).current,3);
  assert.deepEqual(game.cards.filter(card => card.tangled).map(card => card.index),[7,16,26]);
  assert.deepEqual([0,1,2,4,5].map(kind=>level.layout.filter(value=>value===kind).length),[8,8,8,6,6]);
  assert.notDeepEqual(level.layout,levels.find(level=>level.id===23).layout);
  game.start(10000); assert.deepEqual(game.cards.map(card=>card.value),level.layout);
});

test('an open or purple-locked grass tile still counts; invalid clicks cannot spread twice', () => {
  const game = create(); game.select(7,0); assert.equal(limit(game).current,3);
  game.select(35,0); assert.equal(limit(game).current,7);
  assert.equal(game.cards[7].status,'open'); assert.equal(limit(game).completed,false);
  assert.equal(game.select(16,0),false); assert.equal(limit(game).current,7);
  game.update(500); assert.equal(game.isGrassLocked(game.cards[7]),true);
  assert.equal(limit(game).current,7);
  game.update(10000); assert.equal(game.isGrassLocked(game.cards[7]),false);
  assert.equal(limit(game).current,7);
});

test('eleven live grass tiles fail immediately on the second mismatch, before covering or any further match', () => {
  const game = create(); flip(game,7,35,0); game.update(500);
  flip(game,16,35,500);
  assert.equal(limit(game).current,11); assert.equal(limit(game).failed,true);
  assert.equal(game.state,'lost'); assert.equal(game.failureReason,'conditions');
  assert.equal(game.pending,null); assert.equal(game.cards[16].status,'open');
  assert.equal(game.pairs,0); assert.equal(game.select(0,500),false);
  game.update(120000); assert.equal(limit(game).current,11);
  game.start(130000); assert.equal(limit(game).current,3); assert.equal(limit(game).failed,false);
  assert.ok(game.cards.every(card=>!game.isGrassLocked(card)));
});

test('exactly ten is allowed; matching grass reduces the live count and can lead to a complete victory', () => {
  const game = create(); flip(game,7,1,0); game.update(500);
  flip(game,16,35,500);
  assert.equal(limit(game).current,10); assert.equal(limit(game).failed,false);
  assert.equal(game.state,'playing'); assert.equal(limit(game).completed,false);
  game.update(1000); game.pause(1000); game.update(60000);
  assert.equal(limit(game).current,10); assert.equal(game.activeTime,1000);
  game.resume(60000); flip(game,6,8,60000);
  assert.equal(limit(game).current,8);
  assert.equal(game.cards[6].tangled,true); assert.equal(game.cards[6].status,'matched');
  assert.equal(limit(game).completed,false);
  game.update(70000);
  for(const kind of [0,1,2,4,5]) for(const card of game.cards.filter(card=>card.value===kind && card.status!=='matched')) assert.equal(game.select(card.index,70000),true);
  assert.equal(game.state,'won'); assert.equal(game.pairs,18);
  assert.equal(limit(game).current,0); assert.equal(limit(game).completed,true);
  assert.ok(game.remaining<=60000);
});

test('grass limit composes with other conditions and never leaks into other reef levels', () => {
  const game = create({...level,conditions:[...level.conditions,{type:'maxMismatches',limit:0}]});
  flip(game,0,1,0); assert.equal(game.state,'lost');
  assert.equal(limit(game).current,3); assert.equal(limit(game).failed,false);
  const other = create(levels.find(level=>level.id===22));
  assert.deepEqual(other.conditionStates,[]);
  assert.equal(other.cards.filter(card=>card.tangled).length,12);
  assert.equal(other.state,'playing');
});
