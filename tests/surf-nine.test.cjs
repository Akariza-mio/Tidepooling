const test=require('node:test'),assert=require('node:assert/strict');
const SurfGame=require('../surf.js'),levels=require('../levels.js');
const level=levels.find(level=>level.id===39);
function create(draws=[0,0]){let n=0;const game=new SurfGame({level,random:()=>draws[n++%draws.length]});game.start(0);return game;}
function mistakes(game,count){for(let i=0;i<count;i++){assert.equal(game.select(0,i*500),true);assert.equal(game.select(1,i*500),true);}game.update(count*500);}
function finish(game,now){for(const kind of [0,1,2,3,4,5])for(const card of game.cards.filter(c=>c.value===kind&&c.status==='hidden'))assert.equal(game.select(card.index,now),true);}
test('restored ninth level keeps its original fixed layout, six kinds, sixty seconds, double waves and only a twenty-mistake limit',()=>{
 const game=create();assert.equal(levels.length, 48);assert.equal(levels.some(level=>level.id >= 49),false);assert.equal(game.duration,60000);assert.equal(game.totalPairs,18);
 assert.equal(level.rows,6);assert.equal(level.columns,6);assert.deepEqual([0,1,2,3,4,5].map(kind=>level.layout.filter(v=>v===kind).length),[6,6,6,6,6,6]);
 assert.deepEqual(level.layout,[1,3,2,0,3,1,1,5,4,3,5,5,0,0,5,1,4,2,5,4,4,3,3,1,4,2,0,0,4,0,1,2,2,5,3,2]);
 assert.deepEqual(level.surf,levels.find(level=>level.id===38).surf);assert.deepEqual(game.conditions.map(c=>[c.type,c.limit]),[['maxMismatches',20]]);
 assert.equal(level.fog,undefined);assert.equal(level.seagrass,undefined);assert.notDeepEqual(level.layout,levels.find(level=>level.id===40).layout);
});
test('exactly twenty mistakes remain playable; the twenty-first fails immediately and does not deduct time',()=>{
 const game=create();mistakes(game,20);assert.equal(game.state,'playing');assert.equal(game.mismatches,20);assert.equal(game.conditionStates[0].completed,false);
 const before=game.remaining;game.select(0,10000);game.select(1,10000);assert.equal(game.mismatches,21);assert.equal(game.state,'lost');assert.equal(game.failureReason,'conditions');assert.equal(game.pending,null);assert.equal(game.remaining,before);
});
for(const count of [0,20])test(`full matching after ${count} mistakes still wins without the tenth-level penalty rule`,()=>{
 const game=create();mistakes(game,count);finish(game,11000);assert.equal(game.state,'won');assert.equal(game.pairs,18);assert.equal(game.mismatches,count);assert.equal(game.conditionStates[0].completed,true);
});
for(const [draws,count]of [[[0,0],12],[[.99,.99],12],[[0,.99],11]])test(`restored double surf covers ${count} cells and charges only six seconds`,()=>{
 const game=create(draws);game.update(12000);assert.equal(game.surfTargets.length,2);game.update(15000);assert.equal(game.remaining,39000);assert.equal(game.surfPhase,'arriving');assert.equal(game.cards.filter(c=>game.isWashed(c.index)).length,count);
 for(const c of game.cards.filter(c=>game.isWashed(c.index)))assert.equal(game.select(c.index,15000),false);assert.equal(game.mismatches,0);game.update(16000);assert.equal(game.surfPhase,'washing');game.update(21000);assert.equal(game.surfPhase,'retreating');game.update(22200);assert.equal(game.surfPhase,'calm');
});
test('invalid inputs never add mistakes and the wave penalty leaves the full 500ms mismatch exposure',()=>{
 const game=create();game.select(0,14900);assert.equal(game.select(0,14900),false);game.select(1,14900);assert.equal(game.mismatches,1);assert.equal(game.pending.at,15400);assert.equal(game.select(12,14900),false);
 game.update(15000);assert.equal(game.pending.at,15400);game.update(15399);assert.equal(game.cards[0].status,'open');game.update(15400);assert.equal(game.cards[0].status,'hidden');
});
test('reading/pause freeze both waves and retry clears failures while retaining the original deck',()=>{
 const game=create();game.setTimerRunning(false,0);game.update(90000);assert.equal(game.remaining,60000);assert.equal(game.select(0,90000),false);game.setTimerRunning(true,90000);
 game.select(0,91000);game.select(1,91000);game.pause(92000);const before=game.remaining;game.update(200000);assert.equal(game.remaining,before);game.resume(200000);game.update(213000);assert.equal(game.surfTargets.length,2);
 game.start(300000);assert.equal(game.mismatches,0);assert.equal(game.waveCount,0);assert.deepEqual(game.cards.map(c=>c.value),level.layout);
});
test('restored double-wave timeout is at forty-five active seconds',()=>{
 const game=create();game.update(100000);assert.equal(game.state,'lost');assert.equal(game.failureReason,'timeout');assert.equal(game.surfTime,45000);assert.equal(game.waveCount,3);
});
