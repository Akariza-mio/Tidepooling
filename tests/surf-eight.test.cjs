const test=require('node:test'),assert=require('node:assert/strict');
const SurfGame=require('../surf.js'),levels=require('../levels.js');
const level=levels.find(level=>level.id===38);
function create(draws=[0,.99]) {let cursor=0;const game=new SurfGame({level,random:()=>draws[cursor++%draws.length]});game.start(0);return game;}
function pair(game,now) {
  game.update(now);
  const a=game.cards.find(a=>a.status==='hidden'&&!game.isWashed(a.index)&&game.cards.some(b=>b.index!==a.index&&b.value===a.value&&b.status==='hidden'&&!game.isWashed(b.index)));
  if(!a)return false;
  const b=game.cards.find(b=>b.index!==a.index&&b.value===a.value&&b.status==='hidden'&&!game.isWashed(b.index));
  assert.equal(game.select(a.index,now),true);assert.equal(game.select(b.index,now),true);return true;
}
test('eighth level is an independent six-kind 6x6 sixty-second deck with double surf and only a two-in-two condition',()=>{
  const game=create();assert.equal(levels.length,40);assert.equal(levels.some(level=>level.id>=41),false);
  assert.equal(level.rows,6);assert.equal(level.columns,6);assert.equal(game.totalPairs,18);assert.equal(game.duration,60000);
  assert.deepEqual([0,1,2,3,4,5].map(kind=>level.layout.filter(value=>value===kind).length),[6,6,6,6,6,6]);
  assert.deepEqual(level.surf,levels.find(level=>level.id===37).surf);assert.notDeepEqual(level.layout,levels.find(level=>level.id===37).layout);
  assert.deepEqual(game.conditions.map(c=>[c.type,c.count,c.window]),[['timedPairs',2,2000]]);assert.equal(level.fog,undefined);assert.equal(level.seagrass,undefined);
});
for(const [second,completed]of [[12000,true],[12001,false]])test(`two successful pairs exactly ${second-10000}ms apart count as ${completed}`,()=>{
  const game=create();assert.equal(pair(game,10000),true);assert.equal(game.conditionStates[0].completed,false);assert.equal(pair(game,second),true);
  assert.deepEqual(game.pairTimes,[10000,second]);assert.equal(game.conditionStates[0].completed,completed);
});
for(const [second,completed]of [[16300,true],[16301,false]])test(`the two-second window stays exact across double-wave arrival and its six-second penalty (${second})`,()=>{
  const game=create();pair(game,14300);const before=game.remaining;pair(game,second);
  assert.equal(game.waveCount,1);assert.equal(game.surfPhase,'washing');assert.equal(game.conditionStates[0].completed,completed);
  assert.equal(before-game.remaining,(second-14300)+6000-5000);assert.deepEqual(game.pairTimes,[14300,second]);
});
test('a later rolling window works, stays checked and resets on retry',()=>{
  const game=create();[10000,13000,16000].forEach(now=>assert.equal(pair(game,now),true));assert.equal(game.conditionStates[0].completed,false);
  pair(game,18000);assert.equal(game.conditionStates[0].completed,true);game.update(22200);assert.equal(game.conditionStates[0].completed,true);
  game.start(90000);assert.deepEqual(game.cards.map(card=>card.value),level.layout);assert.deepEqual(game.pairTimes,[]);assert.equal(game.conditionStates[0].completed,false);assert.equal(game.waveCount,0);
});
test('reading and pause freeze both clocks and exclude paused time from the window',()=>{
  const game=create();game.setTimerRunning(false,0);game.update(90000);assert.equal(game.remaining,60000);assert.equal(game.surfTime,0);assert.equal(game.select(0,90000),false);
  game.setTimerRunning(true,90000);pair(game,100000);game.pause(101000);const remaining=game.remaining;game.update(200000);assert.equal(game.remaining,remaining);
  game.resume(200000);pair(game,201000);assert.equal(game.conditionStates[0].completed,true);assert.equal(game.pairTimes[1]-game.pairTimes[0],2000);
});
test('mistakes between two successes are permitted, and washed/repeated clicks cannot satisfy the condition',()=>{
  const game=create();game.update(15000);for(const card of game.cards.filter(card=>game.isWashed(card.index)))assert.equal(game.select(card.index,15000),false);
  assert.deepEqual(game.pairTimes,[]);assert.equal(game.conditionStates[0].completed,false);game.update(22200);pair(game,22200);
  const a=game.cards.find(c=>c.status==='hidden'),b=game.cards.find(c=>c.status==='hidden'&&c.value!==a.value);
  game.select(a.index,22500);assert.equal(game.select(a.index,22500),false);game.select(b.index,22500);assert.equal(game.mismatches,1);
  game.update(23000);pair(game,24200);assert.equal(game.conditionStates[0].completed,true);assert.deepEqual(game.pairTimes,[22200,24200]);
});
for(const [spacing,state]of [[0,'won'],[2100,'lost']])test(`all eighteen pairs spaced ${spacing}ms apart produce ${state} independently of previous order conditions`,()=>{
  const game=create();let now=0;
  for(let i=0;i<18;i++){if(!pair(game,now)){now=game.waveRetreatUntil+1;assert.equal(pair(game,now),true);}now+=spacing;}
  assert.equal(game.pairs,18);assert.equal(game.state,state);assert.equal(game.failureReason,state==='lost'?'conditions':null);assert.ok(game.remaining>0);
});
test('a completed two-pair condition cannot bypass timeout with items still uncollected',()=>{
  const game=create();pair(game,0);pair(game,1000);assert.equal(game.conditionStates[0].completed,true);game.update(100000);
  assert.equal(game.state,'lost');assert.equal(game.failureReason,'timeout');assert.equal(game.pairs,2);assert.equal(game.remaining,0);
});
