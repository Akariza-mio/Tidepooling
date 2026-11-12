const test=require('node:test'),assert=require('node:assert/strict');
const SlotMachine=require('../slot-machine.js'),level=require('../levels.js').find(l=>l.id===45);
function create(options={}){let draws=[];const game=new SlotMachine({level,random:()=>draws.shift()??0,...options});game.start(0);return {game,draw:(...kinds)=>{draws=kinds.map(k=>(level.kinds.indexOf(k)+.1)/5);}};}
function earn(game,kind=1,now=0){const cards=game.cards.filter(c=>c.value===kind&&c.status==='hidden');assert.ok(cards.length>=2);assert.equal(game.select(cards[0].index,now),true);assert.equal(game.select(cards[1].index,now),true);}
function finish(game,now){game.update(now+1360);}
test('8x8 five-kind memory board starts with zero pulls and a capped two-minute timer',()=>{
 const {game}=create();assert.equal(level.rows,8);assert.equal(level.columns,8);assert.equal(game.duration,120000);assert.equal(game.totalItems,64);assert.equal(game.totalPairs,32);assert.equal(game.pairBonus,0);
 assert.deepEqual([0,1,2,4,5].map(k=>game.cards.filter(c=>c.value===k).length),[14,14,12,12,12]);assert.ok(game.cards.every(c=>c.status==='hidden'));assert.equal(game.credits,0);assert.equal(game.spin(0),false);assert.equal(game.hasSpun, false);
});
test('only manual pairs earn cumulative pulls; invalid clicks and mismatches do not; an unfinished turn blocks spending',()=>{
 const {game}=create();game.select(0,100);assert.equal(game.select(0,101),false);assert.equal(game.credits,0);game.select(1,102);assert.equal(game.mismatches,1);assert.equal(game.spin(103),false);assert.equal(game.select(2,104),false);
 game.update(602);earn(game,1,1000);earn(game,2,1000);assert.equal(game.manualPairs,2);assert.equal(game.credits,2);assert.equal(game.pairs,2);assert.equal(game.remaining,119000);assert.equal(game.bonusTime,0);
 game.select(0,1001);assert.equal(game.spin(1001),false);assert.equal(game.credits,2);assert.equal(game.hasSpun, false);
});
test('a later unsuccessful turn never revives the previous success message or grants another pull',()=>{
 const {game}=create();earn(game,1,100);assert.equal(game.feedback,'earned');assert.equal(game.credits,1);
 const matched=game.cards.find(c=>c.status==='matched').index;assert.equal(game.select(matched,110),false);assert.equal(game.feedback,'earned');
 assert.equal(game.select(0,120),true);assert.equal(game.feedback,'ready');assert.equal(game.select(0,121),false);assert.equal(game.feedback,'ready');
 assert.equal(game.select(1,130),true);assert.equal(game.feedback,'mismatch');assert.equal(game.credits,1);assert.equal(game.manualPairs,1);assert.equal(game.pairs,1);
 game.update(630);assert.equal(game.pending,null);assert.equal(game.selected.length,0);assert.equal(game.feedback,'mismatch');assert.equal(game.credits,1);
 earn(game,1,700);assert.equal(game.feedback,'earned');assert.equal(game.credits,2);assert.equal(game.manualPairs,2);
});
for(const outcome of [[0,0,1],[0,1,0],[1,0,0]])test('two alike '+outcome+' remove one pair, without time rewards or new pulls',()=>{
 const {game,draw}=create();earn(game);draw(...outcome);assert.equal(game.spin(1000),true);assert.equal(game.credits,0);assert.equal(game.spin(1001),false);
 game.update(1499);assert.deepEqual(game.stoppedReels,[false,false,false]);game.update(1500);assert.deepEqual(game.stoppedReels,[true,false,false]);game.update(1750);assert.deepEqual(game.stoppedReels,[true,true,false]);
 game.update(2000);assert.equal(game.phase,'matching');assert.equal(game.result.count,2);assert.ok(game.result.indices.every(i=>game.cards[i].status==='open'));assert.equal(game.select(3,2000),false);
 assert.equal(game.pairs,1);const bonus=game.bonusTime;game.update(2359);assert.equal(game.pairs,1);game.update(2360);
 assert.equal(game.pairs,2);assert.equal(game.autoPairs,1);assert.equal(game.manualPairs,1);assert.equal(game.credits,0);assert.equal(game.bonusTime,bonus);assert.equal(game.cards.filter(c=>c.value===0&&c.status==='hidden').length,12);
});
test('triple removes all remaining pairs of its kind, preserving even counts and awarding no pulls',()=>{
 const {game,draw}=create();earn(game);draw(0,0,1);game.spin(0);finish(game,0);earn(game,1,2000);draw(0,0,0);game.spin(2000);game.update(3000);assert.equal(game.result.count,12);finish(game,2000);
 assert.equal(game.pairs,9);assert.equal(game.autoPairs,7);assert.equal(game.manualPairs,2);assert.equal(game.credits,0);assert.equal(game.cards.filter(c=>c.value===0&&c.status!=='matched').length,0);
 for(const kind of level.kinds)assert.equal(game.cards.filter(c=>c.value===kind&&c.status!=='matched').length%2,0);
});
test('empty categories and misses consume earned pulls without refunding or clearing',()=>{
 const {game,draw}=create();for(let i=0;i<7;i++)earn(game,1);assert.equal(game.credits,7);
 draw(1,1,1);game.spin(0);game.update(1000);assert.equal(game.feedback,'empty');assert.equal(game.pairs,7);assert.equal(game.credits,6);
 draw(1,2,4);game.spin(2000);game.update(3000);assert.equal(game.feedback,'miss');assert.equal(game.result.count,0);assert.equal(game.pairs,7);assert.equal(game.credits,5);assert.equal(game.hasSpun,true);assert.equal('spins' in game,false);
});
test('all 125 independent outcomes obey the one-pair/all-pairs rules without free pulls',()=>{
 let misses=0,pairs=0,triples=0;
 for(const a of level.kinds)for(const b of level.kinds)for(const c of level.kinds){
  const {game,draw}=create();earn(game);const counts=Object.fromEntries(level.kinds.map(k=>[k,game.cards.filter(c=>c.value===k&&c.status==='hidden').length]));draw(a,b,c);game.spin(0);finish(game,0);
  const distinct=new Set([a,b,c]).size;assert.equal(game.autoPairs,distinct===1?counts[a]/2:distinct===2?1:0);assert.equal(game.credits,0);assert.equal(game.manualPairs,1);
  if(distinct===1)triples++;else if(distinct===2)pairs++;else misses++;
 }assert.deepEqual([misses,pairs,triples],[60,60,5]);
});
test('pause freezes reels and automatic reveal, and retry restores all hidden cells and zero credits',()=>{
 const {game,draw}=create();earn(game);draw(0,0,2);game.spin(0);game.pause(300);const reels=game.displayReels;game.update(90000);assert.deepEqual(game.displayReels,reels);assert.equal(game.spin(90000),false);
 game.resume(100000);game.update(100700);assert.equal(game.phase,'matching');game.pause(100850);const progress=game.matchProgress;game.update(300000);assert.equal(game.matchProgress,progress);assert.equal(game.pairs,1);
 game.resume(300000);game.update(300210);assert.equal(game.pairs,2);assert.equal(game.credits,0);
 game.start(400000);assert.equal(game.hasSpun, false);assert.equal(game.phase,'idle');assert.equal(game.pairs,0);assert.equal(game.credits,0);assert.equal(game.manualPairs,0);assert.equal(game.autoPairs,0);assert.equal(game.remaining,120000);assert.ok(game.cards.every(c=>c.status==='hidden'));assert.deepEqual(game.cards.map(c=>c.value),[...level.layout]);
});
test('both manual-only and mixed play can win; only manual pairs grant pulls',()=>{
 const manual=create().game;for(const kind of level.kinds)while(manual.cards.some(c=>c.value===kind&&c.status==='hidden'))earn(manual,kind,1000);
 assert.equal(manual.state,'won');assert.equal(manual.pairs,32);assert.equal(manual.hasSpun, false);assert.equal(manual.bonusTime,0);assert.equal(manual.remaining,119000);assert.equal(manual.credits,32);
 const {game,draw}=create();for(const [i,kind]of level.kinds.entries()){earn(game,kind,i*2000);draw(kind,kind,kind);game.spin(i*2000);const bonus=game.bonusTime;finish(game,i*2000);assert.equal(game.bonusTime,bonus);}
 assert.equal(game.state,'won');assert.equal(game.pairs,32);assert.equal(game.manualPairs,5);assert.equal(game.autoPairs,27);assert.equal(game.credits,0);assert.equal(game.spin(10000),false);
});
test('scheduled final pair before deadline wins despite a long frame; the exact deadline takes priority',()=>{
 for(const [duration,state,pairs]of [[1361,'won',2],[1360,'lost',1],[900,'lost',1]]){
  const {game}=create({level:{...level,layout:[0,0,1,1]},duration,pairBonus:0});earn(game,1);game.spin(0);game.update(200000);assert.equal(game.state,state);assert.equal(game.pairs,pairs);if(state==='lost')assert.equal(game.failureReason,'timeout');
 }
 const {game}=create();assert.equal(game.select(0,120000),false);assert.equal(game.manualPairs,0);assert.equal(game.failureReason,'timeout');
});
