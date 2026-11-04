const test=require('node:test'),assert=require('node:assert/strict');
const Game=require('../core.js'),level=require('../levels.js').find(l=>l.id===48);
const create=()=>{const game=new Game({level});game.start(0);return game;};
const reveal=(game,i,now)=>{game.clearFog(i,now);return game.select(i,now);};
const pair=(game,kind,now)=>{const cards=game.cards.filter(c=>c.value===kind&&c.status==='hidden').slice(0,2);assert.equal(cards.length,2);for(const c of cards)assert.equal(reveal(game,c.index,now),true);};
test('EX eighth has six kinds including eight conches and eighteen alternating fog cells',()=>{
 const game=create();assert.equal(level.rows,6);assert.equal(level.columns,6);assert.equal(game.duration,60000);assert.equal(game.pairBonus,5000);assert.equal(game.totalPairs,18);
 assert.deepEqual(Array.from({length:6},(_,k)=>level.layout.filter(v=>v===k).length),[6,6,6,6,8,4]);
 assert.equal(level.fog.duration,5000);assert.equal(game.cards.filter(c=>c.fog).length,18);assert.equal(game.cards[0].fog,null);
 for(let i=0;i<36;i++){assert.equal(Boolean(game.cards[i].fog),(Math.floor(i/6)+i%6)%2===1);if(i%6<5)assert.notEqual(Boolean(game.cards[i].fog),Boolean(game.cards[i+1].fog));if(i<30)assert.notEqual(Boolean(game.cards[i].fog),Boolean(game.cards[i+6].fog));}
 assert.equal(level.seagrass,undefined);assert.equal(level.surf,undefined);assert.equal(level.type,undefined);
 assert.deepEqual(game.conditions.map(c=>[c.type,c.kind,c.count]),[['firstPairsKind',4,4]]);
});
test('four conch pairs mark the condition immediately, then any remaining kind is allowed and the whole board is still required',()=>{
 const game=create();for(let n=1;n<=4;n++){pair(game,4,n*1000);assert.equal(game.conditionStates[0].current,n);assert.equal(game.conditionStates[0].completed,n===4);assert.equal(game.state,'playing');}
 assert.deepEqual(game.pairKinds,[4,4,4,4]);assert.equal(game.cards.filter(c=>c.value===4&&c.status==='hidden').length,0);
 for(const kind of [0,1,2,3,5])while(game.cards.some(c=>c.value===kind&&c.status==='hidden'))pair(game,kind,5000);
 assert.equal(game.state,'won');assert.equal(game.pairs,18);assert.equal(game.conditionStates[0].completed,true);assert.equal(game.conditionStates[0].current,4);assert.equal(game.remaining,60000);
});
test('any other kind in each of the first four successful positions fails immediately',()=>{
 for(let position=1;position<=4;position++)for(const kind of [0,1,2,3,5]){
  const game=create();for(let i=1;i<position;i++)pair(game,4,i);
  pair(game,kind,100);assert.equal(game.state,'lost');assert.equal(game.failureReason,'conditions');assert.equal(game.pairs,position);assert.equal(game.conditionStates[0].failed,true);assert.equal(game.conditionStates[0].completed,false);assert.equal(game.select(0,101),false);
 }
});
test('fog clearing, single flips, duplicate clicks and mismatches never consume a required successful position',()=>{
 const game=create();assert.equal(game.clearFog(1,0),true);const until=game.cards[1].fog.until;assert.equal(game.clearFog(1,100),false);assert.equal(game.cards[1].fog.until,until);
 assert.equal(reveal(game,0,100),true);assert.equal(game.select(0,101),false);assert.equal(reveal(game,2,102),true);assert.equal(game.mismatches,1);assert.equal(game.pairs,0);assert.equal(game.conditionStates[0].current,0);assert.equal(game.state,'playing');
 assert.equal(game.select(3,103),false);game.update(602);assert.equal(game.cards[0].status,'hidden');
 for(let n=0;n<4;n++)pair(game,4,1000);assert.equal(game.conditionStates[0].completed,true);assert.equal(game.mismatches,1);
});
test('refogged collected holes do not count again; pause freezes fog and retry restores the sequence and layout',()=>{
 const game=create();for(let n=0;n<4;n++)pair(game,4,0);game.update(5000);
 assert.equal(game.cards[10].status,'matched');assert.equal(game.cards[10].fog.covered,true);game.clearFog(10,5000);assert.equal(game.select(10,5000),false);assert.equal(game.pairs,4);assert.equal(game.conditionStates[0].completed,true);
 game.pause(6000);const fog=game.cards.map(c=>c.fog?{...c.fog}:null),remaining=game.remaining;game.update(90000);assert.deepEqual(game.cards.map(c=>c.fog),fog);assert.equal(game.remaining,remaining);
 game.resume(100000);game.update(103999);assert.equal(game.cards[10].fog.covered,false);game.update(104000);assert.equal(game.cards[10].fog.covered,true);
 game.start(110000);assert.equal(game.remaining,60000);assert.equal(game.pairs,0);assert.equal(game.mismatches,0);assert.equal(game.conditionStates[0].current,0);assert.equal(game.conditionStates[0].completed,false);assert.deepEqual(game.cards.map(c=>c.value),[...level.layout]);assert.ok(game.cards.every(c=>c.status==='hidden'&&(!c.fog||c.fog.covered)));
});
test('the tide deadline takes priority over a late fourth conch pair',()=>{
 const game=create();for(let n=0;n<3;n++)pair(game,4,0);const last=game.cards.filter(c=>c.value===4&&c.status==='hidden');
 assert.equal(reveal(game,last[0].index,59999),true);assert.equal(reveal(game,last[1].index,60000),false);assert.equal(game.state,'lost');assert.equal(game.failureReason,'timeout');assert.equal(game.pairs,3);assert.equal(game.conditionStates[0].completed,false);
});
