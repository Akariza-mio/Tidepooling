const test=require('node:test'),assert=require('node:assert/strict');
const ArithmeticGame=require('../arithmetic.js'),level=require('../levels.js').find(l=>l.id===46);
const create=()=>{const game=new ArithmeticGame({level});game.start(0);return game;};
const answer=game=>ArithmeticGame.evaluate(game.round.target,game.round.values);
test('ten increasing rounds have consistent clues and a unique positive integer solution',()=>{
 assert.equal(level.duration,90000);assert.equal(level.rounds.length,10);assert.equal(level.type,'arithmetic');assert.equal(level.intro,undefined);assert.equal(level.wrongPenalty,5000);
 assert.deepEqual(level.rounds.map(r=>ArithmeticGame.evaluate(r.target,r.values)),[5,8,4,12,22,15,20,34,43,44]);
 for(const round of level.rounds){
  const kinds=Object.keys(round.values);assert.ok(kinds.length>=1&&kinds.length<=3);
  assert.ok(Object.values(round.values).every(v=>Number.isInteger(v)&&v>=1&&v<=12));
  const satisfies=values=>round.clues.every(c=>c.terms.reduce((s,t)=>s+t.coefficient*values[t.kind],0)===c.total);
  assert.equal(satisfies(round.values),true);let solutions=0;
  const search=(index,values)=>{if(index===kinds.length){if(satisfies(values))solutions++;return;}for(let n=1;n<=12;n++){values[kinds[index]]=n;search(index+1,values);}};
  search(0,{});assert.equal(solutions,1);
 }
 assert.deepEqual(level.rounds.map(r=>r.clues.length),[1,1,2,2,2,3,3,3,3,3]);
 assert.equal(level.rounds[9].target.op,'*');assert.equal(level.rounds[9].target.left.op,'+');
});
test('only a correct answer advances one round; wrong and invalid answers cannot skip or add time',()=>{
 const game=create();assert.equal(game.completed,0);assert.equal(game.totalPairs,0);assert.equal(game.select(0,0),false);
 for(const raw of ['', ' ', 'abc', '-5', '5.0', '5e0', '1000', null])assert.equal(game.submit(raw,1000),false);
 assert.equal(game.turns,0);assert.equal(game.completed,0);assert.equal(game.remaining,89000);
 for(let i=0;i<3;i++)assert.equal(game.submit(9,1000),false);
 assert.equal(game.completed,0);assert.equal(game.wrongAnswers,3);assert.equal(game.feedback,'wrong');assert.equal(game.remaining,74000);assert.equal(game.activeTime,1000);
 assert.equal(game.submit('005',1000),true);assert.equal(game.completed,1);assert.equal(game.roundIndex,1);assert.equal(game.feedback,'correct');
 assert.equal(game.submit('',1000),false);assert.equal(game.completed,1);assert.equal(game.bonusTime,0);assert.equal(game.remaining,74000);
 assert.equal(game.submit(5,1000),false);assert.equal(game.completed,1);assert.equal(answer(game),8);assert.equal(game.remaining,69000);
});
test('wrong answers subtract five seconds per submission and an exhausted penalty ends the run immediately',()=>{
 const game=create();game.update(84999);assert.equal(game.remaining,5001);
 assert.equal(game.submit('',84999),false);assert.equal(game.remaining,5001);assert.equal(game.wrongAnswers,0);
 assert.equal(game.submit(9,84999),false);assert.equal(game.remaining,1);assert.equal(game.state,'playing');assert.equal(game.completed,0);assert.equal(game.activeTime,84999);
 assert.equal(game.submit(9,84999),false);assert.equal(game.remaining,0);assert.equal(game.state,'lost');assert.equal(game.failureReason,'timeout');assert.equal(game.wrongAnswers,2);
 assert.equal(game.submit(5,84999),false);assert.equal(game.completed,0);assert.equal(game.wrongAnswers,2);
 game.start(200000);assert.equal(game.remaining,90000);assert.equal(game.wrongAnswers,0);
 game.update(285000);game.submit(9,285000);assert.equal(game.state,'lost');assert.equal(game.remaining,0);
 const reduced=create();reduced.submit(9,0);for(let i=0;i<9;i++)reduced.submit(answer(reduced),0);
 assert.equal(reduced.submit(answer(reduced),85000),false);assert.equal(reduced.failureReason,'timeout');assert.equal(reduced.completed,9);
});
test('a disabled timer and pause freeze the common timer; retry restores all ten rounds',()=>{
 const game=create();game.setTimerRunning(false,0);assert.equal(game.submit(5,50000),false);game.update(60000);
 assert.equal(game.remaining,90000);assert.equal(game.activeTime,0);
 game.setTimerRunning(true,60000);game.submit(5,61000);game.pause(62000);const remaining=game.remaining;
 game.update(90000);assert.equal(game.submit(8,90000),false);assert.equal(game.remaining,remaining);assert.equal(game.completed,1);
 game.resume(100000);game.update(101000);assert.equal(game.remaining,87000);assert.equal(game.roundIndex,1);
 game.start(200000);assert.equal(game.completed,0);assert.equal(game.wrongAnswers,0);assert.equal(game.turns,0);assert.equal(game.remaining,90000);assert.equal(game.feedback,'ready');
});
test('ten correct rounds win without rewards, and the exact tide deadline rejects the final answer',()=>{
 for(const [now,state,completed]of [[89999,'won',10],[90000,'lost',9]]){
  const game=create();for(let i=0;i<9;i++)assert.equal(game.submit(answer(game),i*1000),true);
  assert.equal(game.state,'playing');assert.equal(game.completed,9);assert.equal(game.submit(answer(game),now),state==='won');
  assert.equal(game.state,state);assert.equal(game.completed,completed);assert.equal(game.bonusTime,0);
  if(state==='lost')assert.equal(game.failureReason,'timeout');assert.equal(game.submit(44,now+1),false);
 }
});
