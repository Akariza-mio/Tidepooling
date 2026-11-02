const test = require('node:test');
const assert = require('node:assert/strict');
const GrassPuzzle = require('../grass-puzzle.js');
const level = require('../levels.js').find(level=>level.id===25);
const create = () => {const game=new GrassPuzzle({level});game.start(0);return game;};
const solution = [0,4,5,7,10,11,12,15,18,23];

test('fifth reef level is a fixed 5x5 grass puzzle with fourteen grass cells and sixty seconds',()=>{
  const game=create();assert.equal(level.type,'grassPuzzle');
  assert.equal(level.rows,5);assert.equal(level.columns,5);assert.equal(game.duration,60000);
  assert.equal(game.grassCount,14);assert.equal(game.totalPairs,0);assert.equal(game.pairBonus,0);
  assert.deepEqual(game.conditions,[]);assert.deepEqual(game.cards.map(card=>card.value),level.layout);
});
test('a corner and an edge affect only their orthogonal neighbors, never diagonal or wrapped cells',()=>{
  for(const [index,expected] of [[0,[0,1,5]],[4,[3,4,9]],[6,[1,5,6,7,11]],[24,[19,23,24]]]) {
    const game=create(),before=game.cards.map(card=>card.grass);
    assert.equal(game.select(index,1000),true);
    assert.deepEqual(game.cards.flatMap((card,i)=>card.grass!==before[i]?[i]:[]),expected);
    assert.equal(game.turns,1);assert.equal(game.bonusTime,0);assert.equal(game.remaining,59000);
  }
});
test('bare sand is clickable; repeating an operation reverses it without a cooldown or pairing lock',()=>{
  const game=create();assert.equal(game.cards[0].grass,false);
  for(let n=0;n<20;n++) assert.equal(game.select(0,0),true);
  assert.deepEqual(game.cards.map(card=>card.value),level.layout);
  assert.equal(game.grassCount,14);assert.equal(game.turns,20);assert.equal(game.state,'playing');
  assert.equal(game.pending,null);assert.equal(game.mismatches,0);assert.equal(game.pairs,0);assert.equal(game.bonusTime,0);
});
for(const moves of [solution,[1,3,5,7,12,13,14,15,18,20,21,24],[0,0,...solution],[...solution].reverse()]) test(`accepts a legal clearing sequence ${moves.join(',')}`,()=>{
  const game=create();moves.forEach((index,i)=>assert.equal(game.select(index,i*100),true));
  assert.equal(game.state,'won');assert.equal(game.grassCount,0);assert.equal(game.turns,moves.length);
  assert.equal(game.cards.every(card=>card.status==='clear'),true);assert.equal(game.bonusTime,0);
  const board=game.cards.map(card=>card.value);assert.equal(game.select(0,10000),false);
  assert.deepEqual(game.cards.map(card=>card.value),board);
});
test('all first-row choices confirm a shortest solution of ten moves',()=>{
  // Once the first row is chosen, every lower row is forced by the row above.
  // Searching these 32 possibilities independently checks all solution parities.
  const solutions=[];
  for(let first=0;first<32;first++) {
    const board=[...level.layout];let count=0;
    const press=(r,c)=>{
      count++;
      for(const [rr,cc] of [[r,c],[r-1,c],[r+1,c],[r,c-1],[r,c+1]])
        if(rr>=0 && rr<5 && cc>=0 && cc<5)board[rr*5+cc]^=1;
    };
    for(let c=0;c<5;c++)if(first&(1<<c))press(0,c);
    for(let r=1;r<5;r++)for(let c=0;c<5;c++)if(board[(r-1)*5+c])press(r,c);
    if(board.every(value=>value===0))solutions.push(count);
  }
  assert.equal(solutions.length,4);assert.equal(Math.min(...solutions),10);
});
test('intro freezes the tide and disallows even direct model input; pausing retains the board',()=>{
  const game=create();game.setTimerRunning(false,0);
  assert.equal(game.select(0,100000),false);assert.equal(game.remaining,60000);assert.equal(game.turns,0);
  game.setTimerRunning(true,100000);game.select(0,101000);game.pause(102000);
  const board=game.cards.map(card=>card.value),remaining=game.remaining;
  assert.equal(game.select(5,150000),false);game.update(160000);
  assert.deepEqual(game.cards.map(card=>card.value),board);assert.equal(game.remaining,remaining);
  game.resume(200000);game.update(201000);assert.equal(game.remaining,remaining-1000);
});
test('the exact tide deadline beats the last move, but a just-in-time solve wins',()=>{
  for(const [at,state] of [[59999,'won'],[60000,'lost']]) {
    const game=create();solution.slice(0,-1).forEach(index=>game.select(index,0));
    assert.equal(game.select(solution.at(-1),at),state==='won');assert.equal(game.state,state);
    if(state==='lost'){assert.equal(game.failureReason,'timeout');assert.ok(game.grassCount>0);}
    assert.equal(game.bonusTime,0);
  }
});
test('invalid input is ignored and retry restores the same fourteen grass cells and clean counters',()=>{
  const game=create();for(const index of [-1,25,0.5,'0',null])assert.equal(game.select(index,0),false);
  assert.equal(game.turns,0);game.select(0,1000);game.start(50000);
  assert.deepEqual(game.cards.map(card=>card.value),level.layout);assert.equal(game.turns,0);
  assert.equal(game.remaining,60000);assert.equal(game.grassCount,14);assert.deepEqual(game.lastAffected,[]);
});
