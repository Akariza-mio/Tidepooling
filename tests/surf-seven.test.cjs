const test = require('node:test');
const assert = require('node:assert/strict');
const SurfGame = require('../surf.js');
const levels = require('../levels.js');
const level = levels.find(level => level.id === 37);
function create(draws=[0,.99]) { let cursor=0;const game=new SurfGame({level,random:()=>draws[cursor++%draws.length]});game.start(0);return game; }
const pairs=[0,1,2,3,4,5].flatMap(kind=>{
  const indices=level.layout.flatMap((value,index)=>value===kind?[index]:[]);
  return [0,2,4].map(i=>({kind,cells:indices.slice(i,i+2)}));
});
function order(lastKind=5) {
  const octopus=pairs.find(pair=>pair.kind===3),conch=pairs.find(pair=>pair.kind===4);
  const last=pairs.find(pair=>pair.kind===lastKind&&pair!==octopus&&pair!==conch);
  return [...pairs.filter(pair=>![octopus,conch,last].includes(pair)),octopus,conch,last];
}
function match(game,pair,now=0) { for(const index of pair.cells)assert.equal(game.select(index,now),true); }
test('seventh level restores an independent balanced six-kind 6x6 matching deck and double surf configuration',()=>{
  const game=create();assert.equal(levels.length,40);assert.equal(levels.some(level=>level.id>=41),false);
  assert.equal(level.type,undefined);assert.equal(level.rows,6);assert.equal(level.columns,6);assert.equal(game.duration,60000);assert.equal(game.totalPairs,18);
  assert.deepEqual([0,1,2,3,4,5].map(kind=>level.layout.filter(value=>value===kind).length),[6,6,6,6,6,6]);
  assert.notDeepEqual(level.layout,levels.find(level=>level.id===34).layout);assert.deepEqual(level.surf,levels.find(level=>level.id===34).surf);
  assert.deepEqual(game.conditions.map(c=>[c.type,c.fromEnd,c.kind]),[['pairKindFromEnd',3,3],['pairKindFromEnd',2,4]]);
  assert.deepEqual(game.conditions.map(c=>c.itemRefs[0].kind),[3,4]);assert.equal(level.fog,undefined);assert.equal(level.seagrass,undefined);
});
for(const lastKind of [0,1,2,3,4,5])test(`only success number sixteen is octopus and seventeen is conch; final kind ${lastKind} remains unrestricted`,()=>{
  const game=create(),sequence=order(lastKind);
  sequence.slice(0,15).forEach(pair=>match(game,pair));assert.equal(game.pairs,15);assert.deepEqual(game.conditionStates.map(c=>c.completed),[false,false]);
  match(game,sequence[15]);assert.equal(game.pairs,16);assert.deepEqual(game.conditionStates.map(c=>c.completed),[true,false]);
  match(game,sequence[16]);assert.equal(game.pairs,17);assert.deepEqual(game.conditionStates.map(c=>c.completed),[true,true]);assert.equal(game.state,'playing');
  match(game,sequence[17]);assert.equal(game.state,'won');assert.equal(game.lastMatchedKind,lastKind);assert.equal(game.pairs,18);
});
for(const scenario of ['octopus-wrong','conch-wrong','both-wrong'])test(`${scenario}: wrong order can finish the board but fails the required AND conditions`,()=>{
  const game=create(),sequence=order();
  if(scenario==='octopus-wrong')[sequence[15],sequence[17]]=[sequence[17],sequence[15]];
  if(scenario==='conch-wrong')[sequence[16],sequence[17]]=[sequence[17],sequence[16]];
  if(scenario==='both-wrong')[sequence[15],sequence[16]]=[sequence[16],sequence[15]];
  sequence.slice(0,17).forEach(pair=>match(game,pair));assert.equal(game.state,'playing');assert.ok(game.conditionStates.every(c=>!c.failed));
  match(game,sequence[17]);assert.equal(game.state,'lost');assert.equal(game.failureReason,'conditions');assert.equal(game.pairs,18);
  assert.deepEqual(game.conditionStates.map(c=>c.completed),scenario==='octopus-wrong'?[false,true]:scenario==='conch-wrong'?[true,false]:[false,false]);
});
for(const [draws,covered] of [[[0,0],12],[[.99,.99],12],[[0,.99],11]])test(`two simultaneous surf targets block ${covered} cells and charge six seconds once`,()=>{
  const game=create(draws);game.update(12000);assert.equal(game.surfPhase,'warning');assert.equal(game.surfTargets.length,2);
  game.update(15000);assert.equal(game.surfPhase,'arriving');assert.equal(game.remaining,39000);assert.equal(game.cards.filter(c=>game.isWashed(c.index)).length,covered);
  for(const card of game.cards.filter(c=>game.isWashed(c.index)))assert.equal(game.select(card.index,15000),false);
  assert.equal(game.pairs,0);assert.deepEqual(game.pairKinds,[]);assert.equal(game.mismatches,0);assert.equal(game.remaining,39000);
  game.update(16000);assert.equal(game.surfPhase,'washing');game.update(21000);assert.equal(game.surfPhase,'retreating');game.update(22200);assert.equal(game.surfPhase,'calm');
});
test('reading/pause freeze waves; completed order conditions survive a wave and restart resets everything',()=>{
  const game=create(),sequence=order();game.setTimerRunning(false,0);game.update(90000);assert.equal(game.remaining,60000);assert.equal(game.surfTime,0);
  game.setTimerRunning(true,90000);sequence.slice(0,17).forEach(pair=>match(game,pair,90000));assert.deepEqual(game.conditionStates.map(c=>c.completed),[true,true]);
  game.update(105000);game.pause(105500);const remaining=game.remaining,targets=structuredClone(game.surfTargets);game.update(200000);
  assert.equal(game.remaining,remaining);assert.deepEqual(game.surfTargets,targets);assert.deepEqual(game.conditionStates.map(c=>c.completed),[true,true]);
  game.resume(200000);game.update(206700);match(game,sequence[17],206700);assert.equal(game.state,'won');
  game.start(300000);assert.deepEqual(game.cards.map(c=>c.value),level.layout);assert.deepEqual(game.pairKinds,[]);assert.deepEqual(game.conditionStates.map(c=>c.completed),[false,false]);assert.equal(game.waveCount,0);
});
test('mistakes do not count toward the required successful pair positions and no mistake limit leaks from earlier levels',()=>{
  const game=create();for(let i=0;i<21;i++){assert.equal(game.select(0,i*500),true);assert.equal(game.select(1,i*500),true);}game.update(11000);
  assert.equal(game.mismatches,21);assert.equal(game.state,'playing');assert.deepEqual(game.pairKinds,[]);order().forEach(pair=>match(game,pair,11000));assert.equal(game.state,'won');
});
test('correct first seventeen pairs cannot accept a final pair after the tide deadline',()=>{
  const game=create(),sequence=order();sequence.slice(0,17).forEach(pair=>match(game,pair));game.update(100000);
  assert.equal(game.state,'lost');assert.equal(game.failureReason,'timeout');assert.equal(game.pairs,17);assert.equal(game.select(sequence[17].cells[0],100000),false);
});
