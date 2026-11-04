const test=require('node:test'),assert=require('node:assert/strict');
const SurfGame=require('../surf.js'),levels=require('../levels.js'),level=levels.find(l=>l.id===44);
function create(options={}){const game=new SurfGame({level,random:()=>0,...options});game.start(0);return game;}
test('EX fourth has five paired pools and progressively growing fifteen-second waves with a fixed five-second penalty',()=>{
 const game=create();assert.equal(level.rows,6);assert.equal(level.columns,6);assert.equal(game.duration,60000);assert.equal(game.totalPairs,18);
 assert.deepEqual([0,1,2,4,5].map(kind=>level.layout.filter(k=>k===kind).length),[8,8,8,6,6]);assert.deepEqual(game.conditions,[]);assert.equal(level.fog,undefined);assert.equal(level.seagrass,undefined);
 assert.equal(level.surf.interval,15000);assert.equal(level.surf.duration,5000);assert.equal(level.surf.penalty,5000);
});
test('every round adds one distinct line through all twelve lines, then caps at the available lines',()=>{
 const game=create({duration:1000000});
 for(let n=1;n<=14;n++){
  game.update(n*15000-3000);assert.equal(game.surfPhase,'warning');assert.equal(game.surfTargets.length,Math.min(n,12));
  assert.equal(new Set(game.surfTargets.map(t=>t.axis+t.index)).size,Math.min(n,12));assert.equal(game.cards.some(c=>game.isWashed(c.index)),false);
  game.update(n*15000);assert.equal(game.waveCount,n);assert.equal(game.remaining,1000000-n*20000);
  if(n>=6)assert.equal(game.cards.filter(c=>game.isWashed(c.index)).length,36);
  game.update(n*15000+999);assert.equal(game.surfPhase,'arriving');
  game.update(n*15000+1000);assert.equal(game.surfPhase,'washing');
  game.update(n*15000+5999);assert.equal(game.surfPhase,'washing');
  game.update(n*15000+6000);assert.equal(game.surfPhase,'retreating');
  game.update(n*15000+7200);assert.equal(game.surfPhase,'calm');
 }
});
test('mixed rows and columns block their union, including collected holes, without moving items or adding mismatch penalties',()=>{
 let draws=[];const game=create({random:()=>draws.shift()??0});
 game.select(0,0);game.select(5,0);game.update(22200);
 draws=[0,.99];game.update(27000);assert.deepEqual(game.surfTargets,[{axis:'row',index:0},{axis:'column',index:5}]);
 game.update(30000);assert.equal(game.cards.filter(c=>game.isWashed(c.index)).length,11);
 assert.equal(game.isWashed(0),true);assert.equal(game.cards[0].status,'matched');assert.equal(game.select(0,30000),false);
 assert.equal(game.select(1,30000),false);assert.equal(game.mismatches,0);
 game.select(6,30000);game.select(7,30000);assert.equal(game.mismatches,1);assert.equal(game.remaining,20000);
 game.update(30500);assert.equal(game.cards[6].status,'hidden');
 game.update(37200);assert.deepEqual(game.cards.map(c=>c.value),[...level.layout]);assert.equal(game.cards[0].status,'matched');
});
test('pause freezes growth and wave travel; retry restores the first one-line wave and full minute',()=>{
 const game=create();game.setTimerRunning(false,0);game.update(90000);assert.equal(game.surfTime,0);assert.equal(game.remaining,60000);
 game.setTimerRunning(true,90000);game.update(120000);assert.equal(game.waveCount,2);assert.equal(game.surfTargets.length,2);
 game.pause(120100);const time=game.surfTime,remaining=game.remaining,targets=structuredClone(game.surfTargets);
 game.update(200000);assert.equal(game.surfTime,time);assert.equal(game.remaining,remaining);assert.deepEqual(game.surfTargets,targets);
 game.resume(200000);game.update(200900);assert.equal(game.surfPhase,'washing');
 game.start(300000);assert.equal(game.waveCount,0);assert.deepEqual(game.surfTargets,[]);assert.equal(game.remaining,60000);
 game.update(312000);assert.equal(game.surfTargets.length,1);
});
test('long frames preserve the growing schedule and fixed penalties until ordinary timeout',()=>{
 const game=create();game.update(100000);assert.equal(game.state,'lost');assert.equal(game.failureReason,'timeout');assert.equal(game.remaining,0);
 assert.equal(game.surfTime,45000);assert.equal(game.waveCount,3);assert.equal(game.surfTargets.length,3);
});
test('players may finish all pairs with no inherited conditions or forced number of waves',()=>{
 const game=create();for(const kind of [0,1,2,4,5])for(const c of game.cards.filter(c=>c.value===kind))assert.equal(game.select(c.index,1000),true);
 assert.equal(game.state,'won');assert.equal(game.pairs,18);assert.equal(game.waveCount,0);
});
