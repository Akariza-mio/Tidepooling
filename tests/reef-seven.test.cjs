const test=require('node:test');
const assert=require('node:assert/strict');
const Game=require('../core.js');
const levels=require('../levels.js');
const level=levels.find(level=>level.id===27);
const grass=[2,3,7,10,13,16,20,21,26,27];
const create=()=>{const game=new Game({level});game.start(0);return game;};

test('reef seven restores 6x6 matching with six even-count kinds, octopus intro and the exact ten red circles',()=>{
  const game=create();assert.equal(level.rows,6);assert.equal(level.columns,6);assert.equal(game.duration,60000);
  assert.equal(game.totalPairs,18);assert.equal(game.pairBonus,5000);
  assert.deepEqual(level.newItem,{kind:3,name:'八爪鱼'});
  assert.deepEqual([0,1,2,3,4,5].map(kind=>level.layout.filter(value=>value===kind).length),[6,6,6,6,6,6]);
  assert.deepEqual(game.cards.filter(card=>card.tangled).map(card=>card.index),grass);
  assert.deepEqual(game.conditions,[]);assert.equal(level.type,undefined);
  game.start(10000);assert.deepEqual(game.cards.map(card=>card.value),level.layout);
});
test('ordinary grass spreading may exceed ten cells without inheriting the old limit, and locks still expire',()=>{
  const game=create();game.select(2,0);game.select(0,0);
  assert.equal(game.cards[1].tangled,true);assert.equal(game.cards[8].tangled,true);
  assert.equal(game.cards[0].tangled,false);assert.equal(game.cards.filter(card=>card.tangled).length,12);
  assert.equal(game.state,'playing');game.update(500);
  assert.equal(game.isGrassLocked(game.cards[2]),true);assert.equal(game.select(2,500),false);
  game.update(10000);assert.equal(game.isGrassLocked(game.cards[2]),false);
  for(const kind of [0,1,2,3,4,5])for(const card of game.cards.filter(card=>card.value===kind))assert.equal(game.select(card.index,10000),true);
  assert.equal(game.state,'won');assert.equal(game.pairs,18);assert.ok(game.remaining<=60000);
  game.start(20000);assert.deepEqual(game.cards.filter(card=>card.tangled).map(card=>card.index),grass);
  assert.deepEqual(game.cards.map(card=>card.value),level.layout);
});
test('octopuses match and grant capped time exactly like the other five types',()=>{
  const game=create();game.select(6,6000);game.select(7,6000);
  assert.equal(game.pairs,1);assert.equal(game.lastMatchedKind,3);assert.equal(game.bonusTime,5000);
  assert.equal(game.remaining,59000);assert.equal(game.cards[7].status,'matched');
  assert.equal(game.cards.filter(card=>card.tangled).length,10);
});

test('reef eight has its own fixed six-kind deck, sixty seconds and the exact ten marked grass cells',()=>{
  const next=levels.find(level=>level.id===28),game=new Game({level:next});game.start(0);
  assert.equal(next.rows,6);assert.equal(next.columns,6);assert.equal(game.duration,60000);
  assert.equal(game.totalPairs,18);assert.equal(next.newItem,undefined);assert.equal(next.intro,undefined);
  assert.equal(game.conditions.length,1);assert.equal(game.conditions[0].type,'maxMismatches');assert.equal(game.conditions[0].limit,20);
  assert.deepEqual(game.cards.filter(card=>card.tangled).map(card=>card.index),[3,8,9,10,13,15,17,21,27,33]);
  assert.deepEqual([0,1,2,3,4,5].map(kind=>next.layout.filter(value=>value===kind).length),[6,6,6,6,6,6]);
  assert.notDeepEqual(next.layout,level.layout);
  game.start(10000);assert.deepEqual(game.cards.map(card=>card.value),next.layout);
});

test('reef eight spreads and locks grass, pauses correctly, can collect all six kinds and resets to a sixty-second deadline',()=>{
  const next=levels.find(level=>level.id===28),game=new Game({level:next});game.start(0);
  game.select(3,0);game.select(0,0);
  assert.equal(game.cards[2].tangled,true);assert.equal(game.cards[4].tangled,true);
  assert.equal(game.cards.filter(card=>card.tangled).length,12);assert.equal(game.state,'playing');
  game.update(500);assert.equal(game.isGrassLocked(game.cards[3]),true);
  game.pause(1000);game.update(31000);assert.equal(game.activeTime,1000);
  game.resume(31000);game.update(40000);assert.equal(game.isGrassLocked(game.cards[3]),false);
  for(const kind of [0,1,2,3,4,5])for(const card of game.cards.filter(card=>card.value===kind))assert.equal(game.select(card.index,40000),true);
  assert.equal(game.state,'won');assert.equal(game.pairs,18);assert.ok(game.remaining<=60000);
  game.start(50000);assert.deepEqual(game.cards.map(card=>card.value),next.layout);
  assert.deepEqual(game.cards.filter(card=>card.tangled).map(card=>card.index),next.seagrass.cells);
  game.update(110000);assert.equal(game.state,'lost');assert.equal(game.failureReason,'timeout');
});

test('reef eight permits twenty mistakes and fails instantly on the twenty-first distinct pair',()=>{
  const next=levels.find(level=>level.id===28),game=new Game({level:next});game.start(0);
  game.select(0,0);assert.equal(game.select(0,0),false);assert.equal(game.mismatches,0);
  game.select(2,0);assert.equal(game.select(1,0),false);assert.equal(game.mismatches,1);
  for(let i=1;i<20;i++){game.select(0,i*500);game.select(2,i*500);}
  game.update(10000);assert.equal(game.mismatches,20);assert.equal(game.state,'playing');
  assert.equal(game.conditionStates[0].failed,false);assert.equal(game.conditionStates[0].completed,false);
  game.select(0,10000);game.select(2,10000);
  assert.equal(game.mismatches,21);assert.equal(game.state,'lost');assert.equal(game.failureReason,'conditions');
  assert.equal(game.pending,null);assert.equal(game.cards[2].status,'open');
  assert.equal(game.select(1,10000),false);
  game.start(20000);assert.equal(game.mismatches,0);assert.equal(game.conditionStates[0].failed,false);
});

test('reef eight can still collect all six kinds after exactly twenty mistakes',()=>{
  const next=levels.find(level=>level.id===28),game=new Game({level:next});game.start(0);
  for(let i=0;i<20;i++){game.select(0,i*500);game.select(2,i*500);}
  game.update(10000);
  for(const kind of [0,1,2,3,4,5])for(const card of game.cards.filter(card=>card.value===kind))assert.equal(game.select(card.index,10000),true);
  assert.equal(game.state,'won');assert.equal(game.pairs,18);assert.equal(game.mismatches,20);
  assert.equal(game.conditionStates[0].completed,true);
});
