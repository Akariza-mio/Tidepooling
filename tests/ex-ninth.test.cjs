const test=require('node:test'),assert=require('node:assert/strict');
const Game=require('../core.js'),level=require('../levels.js').find(l=>l.id===49);
// Test replenishment separately from preparation; countdown cases below use the real level.
const create=(preparing=false)=>{const game=new Game({level:preparing?level:{...level,startCountdown:0}});game.start(0);return game;};
const pair=(game,now)=>{const a=game.cards.find(c=>c.status==='hidden'),b=game.cards.find(c=>c.index!==a.index&&c.status==='hidden'&&c.value===a.value);assert.equal(game.select(a.index,now),true);assert.equal(game.select(b.index,now),true);};
test('EX ninth has a 6x6 four-kind board, ten seconds and three seconds of preparation',()=>{
 const game=create(true);assert.equal(level.rows,6);assert.equal(level.columns,6);assert.equal(game.duration,10000);assert.equal(game.pairBonus,2000);assert.equal(game.totalPairs,18);assert.equal(level.startCountdown,3000);
 assert.deepEqual([0,1,2,4].map(k=>level.layout.filter(v=>v===k).length),[10,10,8,8]);assert.equal(new Set(level.layout).size,4);assert.deepEqual(game.conditions,[]);
 for(const name of ['type','intro','fog','seagrass','surf','randomize'])assert.equal(level[name],undefined);
});
test('preparation shows 3-2-1, blocks flips and spends no main time before the exact start boundary',()=>{
 const game=create(true);assert.equal(game.select(0,0),false);
 for(const [now,seconds]of [[0,3],[999,3],[1000,2],[1999,2],[2000,1],[2999,1]]){
  game.update(now);assert.equal(Math.ceil(game.countdownRemaining/1000),seconds);assert.equal(game.remaining,10000);assert.equal(game.elapsed,0);assert.equal(game.activeTime,0);assert.equal(game.timerRunning,false);assert.equal(game.select(0,now),false);
 }
 game.update(3000);assert.equal(game.countdownRemaining,0);assert.equal(game.timerRunning,true);assert.equal(game.remaining,10000);assert.equal(game.activeTime,0);assert.equal(game.select(0,3000),true);game.update(3001);assert.equal(game.remaining,9999);
});
test('long frames charge only time after preparation, and pause freezes the unfinished countdown',()=>{
 const game=create(true);game.update(6500);assert.equal(game.countdownRemaining,0);assert.equal(game.elapsed,3500);assert.equal(game.activeTime,3500);assert.equal(game.remaining,6500);
 const paused=create(true);paused.pause(1200);assert.equal(paused.countdownRemaining,1800);paused.update(90000);assert.equal(paused.countdownRemaining,1800);assert.equal(paused.remaining,10000);
 paused.resume(100000);paused.update(101799);assert.equal(paused.countdownRemaining,1);assert.equal(paused.remaining,10000);paused.update(101800);assert.equal(paused.countdownRemaining,0);assert.equal(paused.timerRunning,true);assert.equal(paused.remaining,10000);
 paused.start(200000);paused.update(202000);assert.equal(paused.countdownRemaining,1000);paused.start(203000);assert.equal(paused.countdownRemaining,3000);paused.update(206000);assert.equal(paused.remaining,10000);assert.equal(paused.elapsed,0);assert.equal(paused.pairs,0);
 const ordinary=new Game({level:require('../levels.js').find(l=>l.id===8)});ordinary.start(0);assert.equal(ordinary.countdownRemaining,0);assert.equal(ordinary.timerRunning,true);
});
test('successful pairs add up to two seconds and overflow is discarded at the ten-second cap',()=>{
 const game=create();pair(game,1000);assert.equal(game.remaining,10000);assert.equal(game.bonusTime,1000);
 pair(game,6000);assert.equal(game.remaining,7000);assert.equal(game.bonusTime,3000);
 pair(game,6000);assert.equal(game.remaining,9000);assert.equal(game.bonusTime,5000);
 pair(game,6000);assert.equal(game.remaining,10000);assert.equal(game.bonusTime,6000);
 pair(game,6000);assert.equal(game.remaining,10000);assert.equal(game.bonusTime,6000);
 game.update(15999);assert.equal(game.remaining,1);game.update(16000);assert.equal(game.failureReason,'timeout');
});
test('continual matches can sustain thirty-six seconds and win all eighteen pairs',()=>{
 const game=create();for(let n=1;n<=18;n++){pair(game,n*2000);assert.equal(game.remaining,10000);}
 assert.equal(game.state,'won');assert.equal(game.pairs,18);assert.equal(game.elapsed,36000);assert.equal(game.bonusTime,36000);assert.equal(game.mismatches,0);
});
test('mismatches still reveal for half a second and single or invalid clicks cannot replenish time',()=>{
 const game=create();assert.equal(game.select(0,2000),true);assert.equal(game.select(1,2000),true);assert.equal(game.mismatches,1);assert.equal(game.bonusTime,0);assert.equal(game.remaining,8000);
 assert.equal(game.select(2,2100),false);game.update(2499);assert.equal(game.cards[0].status,'open');game.update(2500);assert.equal(game.cards[0].status,'hidden');assert.equal(game.remaining,7500);
 game.select(0,9000);assert.equal(game.select(0,9001),false);assert.equal(game.bonusTime,0);game.update(10000);assert.equal(game.failureReason,'timeout');assert.equal(game.pairs,0);
});
test('pause freezes the short clock and retry resets the fixed board and all earned time',()=>{
 const game=create();pair(game,5000);game.pause(6500);assert.equal(game.remaining,5500);
 game.update(100000);assert.equal(game.remaining,5500);game.resume(110000);game.update(115499);assert.equal(game.remaining,1);game.update(115500);assert.equal(game.state,'lost');
 game.start(200000);assert.equal(game.remaining,10000);assert.equal(game.pairs,0);assert.equal(game.bonusTime,0);assert.equal(game.mismatches,0);assert.deepEqual(game.cards.map(c=>c.value),[...level.layout]);assert.ok(game.cards.every(c=>c.status==='hidden'));
});
test('the final pair must precede the deadline created by the previous seventeen rewards',()=>{
 for(const now of [43999,44000]){
  const game=create();for(let n=1;n<=17;n++)pair(game,n*2000);
  const [a,b]=game.cards.filter(c=>c.status==='hidden');game.select(a.index,43999);assert.equal(game.select(b.index,now),now===43999);
  assert.equal(game.state,now===43999?'won':'lost');assert.equal(game.pairs,now===43999?18:17);if(now===44000)assert.equal(game.failureReason,'timeout');
 }
});
