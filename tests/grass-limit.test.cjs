const test=require('node:test');
const assert=require('node:assert/strict');
const GrassPuzzle=require('../grass-puzzle.js');
const levels=require('../levels.js');
const level=levels.find(level=>level.id===26);
const solution=[0,2,6,7,8,9,11,13,14,18,19,20];
const create=()=>{const game=new GrassPuzzle({level});game.start(0);return game;};
const condition=game=>game.conditionStates[0];

test('sixth reef level uses its own fixed board, sixty seconds and the same fifteen-move limit',()=>{
  const fifth=levels.find(level=>level.id===25),game=create();
  assert.notDeepEqual(level.layout,fifth.layout);assert.equal(level.rows,5);assert.equal(level.columns,5);
  assert.equal(level.duration,fifth.duration);assert.equal(game.duration,60000);assert.equal(game.grassCount,16);
  assert.equal(game.conditions.length,1);assert.equal(condition(game).limit,15);assert.equal(condition(game).current,0);
  assert.equal(game.pairBonus,0);assert.deepEqual(level.rewards,fifth.rewards);
});
test('one center click toggles five cells but costs one move; invalid clicks never count',()=>{
  const game=create(),before=game.cards.map(card=>card.grass);
  for(const index of [-1,25,0.5,'0',null])assert.equal(game.select(index,0),false);
  assert.equal(condition(game).current,0);
  assert.equal(game.select(6,0),true);
  assert.deepEqual(game.cards.flatMap((card,i)=>card.grass!==before[i]?[i]:[]),[1,5,6,7,11]);
  assert.equal(condition(game).current,1);assert.equal(condition(game).completed,false);
  game.select(6,0);assert.deepEqual(game.cards.map(card=>card.grass),before);assert.equal(condition(game).current,2);
});
for(const moves of [solution,[4,5,6,8,11,13,14,15,17,18,22,24],[0,0,...solution]]) test(`a legal ${moves.length}-move solution succeeds below the fifteen-move cap`,()=>{
  const game=create();moves.forEach((index,i)=>assert.equal(game.select(index,i*100),true));
  assert.equal(game.state,'won');assert.equal(game.grassCount,0);assert.equal(condition(game).completed,true);
  assert.equal(condition(game).current,moves.length);assert.equal(game.bonusTime,0);
});
test('fifteen moves remain playable and the sixteenth immediately loses',()=>{
  const game=create();for(let i=0;i<15;i++)assert.equal(game.select(0,0),true);
  assert.equal(game.state,'playing');assert.equal(condition(game).current,15);assert.equal(condition(game).failed,false);
  assert.equal(game.select(0,0),true);assert.equal(game.state,'lost');assert.equal(game.failureReason,'conditions');
  assert.equal(condition(game).current,16);assert.equal(condition(game).failed,true);assert.equal(condition(game).completed,false);
  assert.equal(game.select(1,0),false);assert.equal(game.turns,16);
});
test('even a sixteenth move that clears every grass cell fails the condition',()=>{
  const game=create(),moves=[0,0,0,0,...solution];
  moves.slice(0,-1).forEach(index=>game.select(index,0));
  assert.equal(game.state,'playing');assert.equal(game.turns,15);assert.ok(game.grassCount>0);
  game.select(moves.at(-1),0);
  assert.equal(game.grassCount,0);assert.equal(game.state,'lost');assert.equal(game.failureReason,'conditions');
  assert.equal(condition(game).failed,true);assert.equal(condition(game).completed,false);
});
test('intro and pause freeze the run; retry resets the budget and fixed board',()=>{
  const game=create();game.setTimerRunning(false,0);
  assert.equal(game.select(0,10000),false);assert.equal(game.turns,0);assert.equal(game.remaining,60000);
  game.setTimerRunning(true,10000);game.select(0,11000);game.pause(12000);
  const remaining=game.remaining,board=game.cards.map(card=>card.value);
  assert.equal(game.select(0,100000),false);assert.equal(game.turns,1);assert.equal(game.remaining,remaining);
  assert.deepEqual(game.cards.map(card=>card.value),board);game.resume(200000);game.update(201000);
  assert.equal(game.remaining,remaining-1000);game.start(300000);
  assert.equal(game.turns,0);assert.deepEqual(game.cards.map(card=>card.value),level.layout);assert.equal(condition(game).completed,false);
});
test('independent first-row search certifies that the new sixth layout needs twelve moves',()=>{
  const lengths=[];
  for(let first=0;first<32;first++){
    const board=[...level.layout];let count=0;
    const press=(row,col)=>{
      count++;
      for(const [r,c]of [[row,col],[row-1,col],[row+1,col],[row,col-1],[row,col+1]])
        if(r>=0 && r<5 && c>=0 && c<5)board[r*5+c]^=1;
    };
    for(let col=0;col<5;col++)if(first&(1<<col))press(0,col);
    for(let row=1;row<5;row++)for(let col=0;col<5;col++)if(board[(row-1)*5+col])press(row,col);
    if(board.every(value=>value===0))lengths.push(count);
  }
  assert.equal(lengths.length,4);assert.equal(Math.min(...lengths),12);
  assert.ok(lengths.every(length=>length<=15));
});
test('a timeout takes precedence over a late sixteenth input and level five remains unrestricted',()=>{
  const game=create();for(let i=0;i<15;i++)game.select(0,0);
  assert.equal(game.select(0,60000),false);assert.equal(game.failureReason,'timeout');assert.equal(game.turns,15);
  const fifth=new GrassPuzzle({level:levels.find(level=>level.id===25)});fifth.start(0);
  for(let i=0;i<20;i++)assert.equal(fifth.select(0,0),true);
  assert.equal(fifth.state,'playing');assert.deepEqual(fifth.conditionStates,[]);
});
