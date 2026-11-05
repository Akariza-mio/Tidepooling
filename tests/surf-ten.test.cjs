const test=require('node:test'),assert=require('node:assert/strict');
const SurfGame=require('../surf.js'),levels=require('../levels.js');
const level=levels.find(level=>level.id===40);
function create(draws=[0,0,0]){let n=0;const game=new SurfGame({level,random:()=>draws[n++%draws.length]});game.start(0);return game;}
function mismatch(game,now){assert.equal(game.select(0,now),true);assert.equal(game.select(1,now),true);}
function pair(game,now,exclude=[]){const a=game.cards.find(a=>!exclude.includes(a.index)&&a.status==='hidden'&&!game.isWashed(a.index)&&game.cards.some(b=>b.index!==a.index&&!exclude.includes(b.index)&&b.value===a.value&&b.status==='hidden'&&!game.isWashed(b.index)));assert.ok(a);const b=game.cards.find(b=>b.index!==a.index&&!exclude.includes(b.index)&&b.value===a.value&&b.status==='hidden'&&!game.isWashed(b.index));game.select(a.index,now);game.select(b.index,now);}
function finish(game,now){for(const kind of [0,1,2,3,4,5])for(const c of game.cards.filter(c=>c.value===kind&&c.status==='hidden'))assert.equal(game.select(c.index,now),true);}
test('tenth level uses 6x6 six balanced kinds, sixty seconds, three unique lines and only a three-second mismatch penalty',()=>{
 const game=create();assert.equal(levels.length, 50);assert.equal(game.duration,60000);assert.equal(game.totalPairs,18);assert.equal(level.rows,6);assert.equal(level.columns,6);
 assert.deepEqual([0,1,2,3,4,5].map(kind=>level.layout.filter(v=>v===kind).length),[6,6,6,6,6,6]);
 assert.equal(level.surf.targetCount,3);assert.equal(level.surf.penalty,5000);assert.equal(level.surf.interval,15000);assert.equal(level.surf.duration,5000);
 assert.deepEqual(game.conditions.map(c=>[c.type,c.penalty]),[['mismatchTideRise',3000]]);assert.equal(game.conditions[0].label,'配对失败会导致潮水上涨');
 assert.equal(level.fog,undefined);assert.equal(level.seagrass,undefined);assert.equal(levels.find(level=>level.id===39).surf.targetCount,2);assert.equal(levels.find(level=>level.id===39).conditions[0].limit,20);assert.equal(levels.find(level=>level.id===38).surf.penalty,6000);
});
for(const [name,draws,count]of [['three rows',[0,0,0],18],['three columns',[.99,.99,.99],18],['two rows one column',[0,0,.99],16],['one row two columns',[0,.99,.99],16]])test(`${name}: three warnings, union of ${count} cells, one five-second charge and independent full five-second wash`,()=>{
 const game=create(draws);game.update(12000);assert.equal(game.surfPhase,'warning');assert.equal(game.surfTargets.length,3);assert.equal(new Set(game.surfTargets.map(t=>t.axis+t.index)).size,3);
 assert.equal(game.cards.some(c=>game.isWashed(c.index)),false);game.update(15000);assert.equal(game.waveCount,1);assert.equal(game.surfPhase,'arriving');assert.equal(game.remaining,40000);assert.equal(game.cards.filter(c=>game.isWashed(c.index)).length,count);
 for(const c of game.cards.filter(c=>game.isWashed(c.index)))assert.equal(game.select(c.index,15000),false);assert.equal(game.mismatches,0);assert.equal(game.remaining,40000);
 game.update(16000);assert.equal(game.surfPhase,'washing');game.update(20999);assert.equal(game.surfPhase,'washing');game.update(21000);assert.equal(game.surfPhase,'retreating');game.update(22200);assert.equal(game.surfPhase,'calm');
});
test('all 220 distinct unordered triples of the twelve lines are reachable without repeated lines',()=>{
 const triples=new Set();for(let a=0;a<12;a++)for(let b=0;b<11;b++)for(let c=0;c<10;c++){
  const game=create([(a+.1)/12,(b+.1)/11,(c+.1)/10]);game.update(12000);const keys=game.surfTargets.map(t=>t.axis+t.index).sort();assert.equal(new Set(keys).size,3);triples.add(keys.join('|'));
 }assert.equal(triples.size,220);
});
test('one mismatch charges three seconds once; single, duplicate and waiting inputs never charge and exposure remains 500ms',()=>{
 const game=create();game.select(0,1000);assert.equal(game.select(0,1000),false);assert.equal(game.remaining,59000);assert.equal(game.mismatches,0);
 game.select(1,1000);assert.equal(game.remaining,56000);assert.equal(game.mismatches,1);assert.equal(game.pending.at,1500);assert.equal(game.activeTime,1000);
 assert.equal(game.select(2,1000),false);assert.equal(game.remaining,56000);game.update(1499);assert.equal(game.cards[0].status,'open');game.update(1500);assert.equal(game.cards[0].status,'hidden');
});
test('mismatch and triple-wave penalties add without advancing pending cover or the wave clock',()=>{
 const game=create();mismatch(game,14900);assert.equal(game.remaining,42100);assert.equal(game.pending.at,15400);game.update(15000);assert.equal(game.remaining,37000);assert.equal(game.surfTime,15000);assert.equal(game.pending.at,15400);
 game.update(15399);assert.equal(game.cards[0].status,'open');game.update(15400);assert.equal(game.cards[0].status,'hidden');assert.equal(game.mismatches,1);
 const outside=game.cards.filter(c=>!game.isWashed(c.index));const a=outside[0],b=outside.find(c=>c.value!==a.value);const before=game.remaining;game.select(a.index,15400);game.select(b.index,15400);assert.equal(game.remaining,before-3000);assert.equal(game.mismatches,2);
});
test('twenty-one mistakes can still win with legal pair rewards, so no previous twenty-mistake limit remains',()=>{
 const game=create();for(let i=0;i<21;i++){mismatch(game,i*500);game.update((i+1)*500);if(i%4===3)pair(game,(i+1)*500,[0,1]);}
 assert.equal(game.mismatches,21);assert.equal(game.state,'playing');assert.equal(game.conditions[0].type,'mismatchTideRise');finish(game,11000);assert.equal(game.state,'won');assert.equal(game.pairs,18);assert.equal(game.conditionStates[0].completed,true);
});
test('a mismatch exhausting the remaining time loses immediately before cover and is a timeout, not a condition failure',()=>{
 const game=create();for(let i=0;i<14;i++){mismatch(game,i*500);game.update((i+1)*500);}mismatch(game,14000);assert.equal(game.remaining,1000);game.update(14500);assert.equal(game.remaining,500);mismatch(game,14500);
 assert.equal(game.state,'lost');assert.equal(game.failureReason,'timeout');assert.equal(game.pending,null);assert.equal(game.remaining,0);assert.equal(game.cards[1].status,'open');
});
test('reading and pause freeze triple waves and tide; retry resets all penalties, counters and targets',()=>{
 const game=create();game.setTimerRunning(false,0);game.update(90000);assert.equal(game.remaining,60000);assert.equal(game.surfTime,0);assert.equal(game.select(0,90000),false);
 game.setTimerRunning(true,90000);mismatch(game,91000);game.pause(91200);const remaining=game.remaining;game.update(200000);assert.equal(game.remaining,remaining);assert.equal(game.cards[0].status,'open');
 game.resume(200000);game.update(200300);assert.equal(game.cards[0].status,'hidden');game.update(214000);assert.equal(game.surfTargets.length,3);game.pause(214000);const targets=structuredClone(game.surfTargets);game.update(300000);assert.deepEqual(game.surfTargets,targets);
 game.start(400000);assert.equal(game.remaining,60000);assert.equal(game.mismatches,0);assert.equal(game.waveCount,0);assert.deepEqual(game.surfTargets,[]);assert.deepEqual(game.cards.map(c=>c.value),level.layout);
});
test('long frames charge five seconds once per wave and the third arrival exhausts the remaining time',()=>{
 const game=create();game.update(100000);assert.equal(game.state,'lost');assert.equal(game.failureReason,'timeout');assert.equal(game.remaining,0);assert.equal(game.waveCount,3);assert.equal(game.surfTime,45000);
});
