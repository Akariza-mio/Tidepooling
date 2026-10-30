const test=require('node:test');
const assert=require('node:assert/strict');
const Game=require('../core.js');
const levels=require('../levels.js');
const level=levels.find(level=>level.id===29);
const create=(data=level)=>{const game=new Game({level:data});game.start(0);return game;};
const condition=game=>game.conditionStates[0];
const match=(game,a,b,now)=>{assert.equal(game.select(a,now),true);assert.equal(game.select(b,now),true);};

test('reef nine has four exact grass cells, a fixed 6x6 five-kind deck excluding octopus and sixty seconds',()=>{
  const game=create();assert.equal(level.rows,6);assert.equal(level.columns,6);assert.equal(game.duration,60000);assert.equal(game.totalPairs,18);
  assert.deepEqual(game.cards.filter(card=>card.tangled).map(card=>card.index),[7,10,25,28]);
  assert.deepEqual([0,1,2,4,5].map(kind=>level.layout.filter(value=>value===kind).length),[8,8,8,6,6]);
  assert.equal(level.layout.includes(3),false);assert.notDeepEqual(level.layout,levels.find(level=>level.id===28).layout);
  assert.equal(game.conditions.length,1);assert.equal(condition(game).type,'minGrassMatches');assert.equal(condition(game).target,10);
  assert.equal(game.grassMatches,0);assert.equal(condition(game).completed,false);assert.equal(condition(game).failed,false);
});
test('one grass member contributes one cell and two grass members contribute two, with no double counting',()=>{
  const fixture={rows:2,columns:2,duration:60000,pairBonus:5000,layout:[0,0,1,1],seagrass:{cells:[0,1,2]},conditions:[{type:'minGrassMatches',target:3}]};
  const game=create(fixture);game.select(0,0);assert.equal(game.grassMatches,0);
  game.select(1,0);assert.equal(game.grassMatches,2);assert.equal(condition(game).completed,false);
  assert.equal(game.select(0,0),false);assert.equal(game.grassMatches,2);
  match(game,2,3,0);assert.equal(game.grassMatches,3);assert.equal(condition(game).completed,true);assert.equal(game.state,'won');
});
test('a complete board with only the four initial grass cells fails the collection condition',()=>{
  const game=create();for(const kind of [0,1,2,4,5])for(const card of game.cards.filter(card=>card.value===kind))game.select(card.index,0);
  assert.equal(game.pairs,18);assert.equal(game.grassMatches,4);assert.equal(game.state,'lost');assert.equal(game.failureReason,'conditions');
  assert.equal(condition(game).failed,true);
});
test('grass from two failed pairs can be harvested, reaching the target before all items and winning after pause',()=>{
  const game=create();match(game,7,0,0);game.update(500);match(game,10,35,500);game.update(10500);
  assert.equal(game.grassMatches,0);assert.equal(game.cards.filter(card=>card.tangled).length,12);
  assert.equal(condition(game).completed,false);assert.equal(condition(game).failed,false);
  while(game.grassMatches<10){
    const a=game.cards.find(card=>card.tangled && card.status==='hidden');
    const candidates=game.cards.filter(card=>card.index!==a.index && card.status==='hidden' && card.value===a.value);
    const b=candidates.find(card=>card.tangled)||candidates[0];
    const before=game.grassMatches;match(game,a.index,b.index,10500);
    assert.equal(game.grassMatches,before+1+Number(b.tangled));
  }
  assert.equal(condition(game).completed,true);assert.ok(game.pairs<18);
  game.pause(10500);game.update(70000);assert.equal(condition(game).completed,true);assert.equal(game.activeTime,10500);
  game.resume(70000);
  for(const kind of [0,1,2,4,5])for(const card of game.cards.filter(card=>card.value===kind && card.status!=='matched'))game.select(card.index,70000);
  assert.equal(game.state,'won');assert.equal(game.pairs,18);assert.equal(game.grassMatches,12);assert.equal(condition(game).completed,true);
  assert.ok(game.remaining<=60000);game.start(80000);
  assert.equal(game.grassMatches,0);assert.deepEqual(game.cards.map(card=>card.value),level.layout);
  assert.deepEqual(game.cards.filter(card=>card.tangled).map(card=>card.index),[7,10,25,28]);
});
test('the target checks immediately at exactly ten collected grass cells and remains checked while normal cells remain',()=>{
  const fixture={rows:2,columns:6,duration:60000,pairBonus:5000,layout:[0,0,1,1,2,2,3,3,4,4,5,5],seagrass:{cells:[0,1,2,3,4,5,6,7,8,9]},conditions:[{type:'minGrassMatches',target:10}]};
  const game=create(fixture);
  for(let i=0;i<10;i++)game.select(i,0);
  assert.equal(game.grassMatches,10);assert.equal(condition(game).completed,true);assert.equal(game.state,'playing');
  match(game,10,11,1000);assert.equal(game.grassMatches,10);assert.equal(game.state,'won');
});
test('reef nine does not inherit the eighth level mismatch limit',()=>{
  const game=create();for(let i=0;i<26;i++)match(game,0,2,i*500);
  game.update(13000);assert.equal(game.mismatches,26);assert.equal(game.state,'playing');assert.equal(game.grassMatches,0);
  assert.equal(condition(game).failed,false);
});
