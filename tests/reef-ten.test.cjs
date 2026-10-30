const test=require('node:test');
const assert=require('node:assert/strict');
const Game=require('../core.js');
const levels=require('../levels.js');
const level=levels.find(level=>level.id===30);
const grass=[0,1,7,8,14,15,21,22,28,29,35];
const create=()=>{const game=new Game({level});game.start(0);return game;};
test('reef ten has a fixed balanced six-kind 6x6 deck, sixty seconds, eleven exact grass cells and only a three-second penalty',()=>{
  const game=create();assert.equal(level.rows,6);assert.equal(level.columns,6);assert.equal(game.duration,60000);assert.equal(game.totalPairs,18);
  assert.deepEqual([0,1,2,3,4,5].map(kind=>level.layout.filter(value=>value===kind).length),[6,6,6,6,6,6]);
  assert.deepEqual(game.cards.filter(card=>card.tangled).map(card=>card.index),grass);
  assert.equal(game.conditions.length,1);assert.equal(game.conditions[0].type,'mismatchTideRise');assert.equal(game.conditions[0].penalty,3000);
  assert.notDeepEqual(level.layout,levels.find(level=>level.id===29).layout);
});
test('one completed mismatch charges once; single, duplicate and blocked input never charge extra',()=>{
  const game=create();game.select(2,100);assert.equal(game.remaining,59900);
  assert.equal(game.select(2,100),false);assert.equal(game.mismatches,0);
  game.select(3,100);assert.equal(game.mismatches,1);assert.equal(game.remaining,56900);
  assert.equal(game.activeTime,100);assert.equal(game.pending.at,600);
  assert.equal(game.select(4,100),false);assert.equal(game.remaining,56900);
  game.update(599);assert.equal(game.cards[2].status,'open');
  game.update(600);assert.equal(game.cards[2].status,'hidden');
});
test('a grass mismatch spreads while charging time, without shortening its ten-second lock or pause',()=>{
  const game=create();game.select(7,100);game.select(3,100);
  assert.equal(game.remaining,56900);assert.equal(game.cards[7].grassLockedUntil,10100);
  assert.equal(game.cards[6].tangled,true);assert.equal(game.cards[13].tangled,true);
  assert.equal(game.cards[3].tangled,false);assert.equal(game.cards.filter(card=>card.tangled).length,13);
  game.update(600);game.pause(600);game.update(50000);
  assert.equal(game.activeTime,600);assert.equal(game.remaining,56400);
  game.resume(50000);game.update(59499);assert.equal(game.isGrassLocked(game.cards[7]),true);
  game.update(59500);assert.equal(game.isGrassLocked(game.cards[7]),false);
  assert.equal(game.remaining,46900);
});
test('a penalty exhausting the remaining time causes immediate timeout before the pair is covered',()=>{
  const game=create();game.select(2,58000);game.select(3,58000);
  assert.equal(game.state,'lost');assert.equal(game.failureReason,'timeout');assert.equal(game.remaining,0);
  assert.equal(game.pending,null);assert.equal(game.cards[3].status,'open');assert.equal(game.select(4,58000),false);
});
test('grass recovery and matching bonuses still permit full victory, with no inherited grass-harvest requirement',()=>{
  const game=create();game.select(7,0);game.select(3,0);game.update(10000);
  for(const kind of [0,1,2,3,4,5])for(const card of game.cards.filter(card=>card.value===kind))assert.equal(game.select(card.index,10000),true);
  assert.equal(game.state,'won');assert.equal(game.pairs,18);assert.equal(game.mismatches,1);
  assert.equal(game.remaining,60000);assert.equal(game.conditionStates[0].completed,true);
  game.start(20000);assert.deepEqual(game.cards.map(card=>card.value),level.layout);
  assert.deepEqual(game.cards.filter(card=>card.tangled).map(card=>card.index),grass);
  assert.equal(game.elapsed,0);assert.equal(game.mismatches,0);assert.equal(game.bonusTime,0);assert.equal(game.grassMatches,0);
});
