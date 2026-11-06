const test = require('node:test'), assert = require('node:assert/strict');
const MemoryGame = require('../core.js'), levels = require('../levels.js');
const level = levels.find(level => level.id === 47), grass = [2,8,14,20,26,32];
const create = () => { const game = new MemoryGame({level}); game.start(0); return game; };
const values = game => game.cards.map(card => card.value);

test('EX seventh has six kinds, a third column of grass, and only the mismatch-swap rule', () => {
  const game = create();
  assert.equal(level.rows,6); assert.equal(level.columns,6); assert.equal(game.duration,60000);
  assert.equal(game.totalPairs,18); assert.equal(game.pairBonus,5000);
  assert.deepEqual(Array.from({length:6},(_,kind)=>level.layout.filter(v=>v===kind).length),[6,6,6,6,6,6]);
  assert.deepEqual(game.cards.filter(c=>c.tangled).map(c=>c.index),grass);
  assert.deepEqual(game.conditions.map(c=>c.type),['mismatchSwap']);
  assert.equal(level.type,undefined); assert.equal(level.fog,undefined); assert.equal(level.surf,undefined);
  assert.equal(game.conditionStates[0].completed,false);
});

test('only the failed pair swaps once at cover time, preserving counts and the fixed source layout', () => {
  const game=create(), original=values(game);
  game.select(0,0); assert.equal(game.select(0,0),false); assert.deepEqual(values(game),original);
  game.select(1,0); assert.equal(game.mismatches,1); assert.equal(game.pairs,0);
  assert.equal(game.select(4,100),false); game.update(499); assert.deepEqual(values(game),original);
  game.update(500); const swapped=[...original]; [swapped[0],swapped[1]]=[swapped[1],swapped[0]];
  assert.deepEqual(values(game),swapped); assert.equal(game.cards[0].status,'hidden');
  assert.equal(game.bonusTime,0); assert.equal(game.remaining,59500);
  game.update(900); assert.deepEqual(values(game),swapped);
  game.select(0,1000); game.select(1,1000); game.update(1500); assert.deepEqual(values(game),original);
  assert.deepEqual([...level.layout],original); assert.equal(game.mismatches,2);
});

test('grass spreads and locks at the original cell while only its item is exchanged', () => {
  const game=create(), original=values(game);
  game.select(2,0); game.select(0,0); game.update(500);
  assert.equal(game.cards[2].value,original[0]); assert.equal(game.cards[0].value,original[2]);
  assert.equal(game.cards[0].tangled,false); assert.equal(game.cards[0].grassLockedUntil,null);
  assert.equal(game.cards[2].tangled,true); assert.equal(game.cards[2].grassLockedUntil,10000);
  for(const i of [1,3,8]) assert.equal(game.cards[i].tangled,true);
  assert.equal(game.select(2,500),false); game.update(9999); assert.equal(game.isGrassLocked(game.cards[2]),true);
  game.update(10000); assert.equal(game.isGrassLocked(game.cards[2]),false);
  game.start(11000); assert.deepEqual(values(game),original);
  assert.deepEqual(game.cards.filter(c=>c.tangled).map(c=>c.index),grass);
  assert.ok(game.cards.every(c=>c.grassLockedUntil===null));
});

test('pause freezes the pending swap, retry cancels it, and timeout precedes a late swap', () => {
  const game=create(), original=values(game); game.select(0,0); game.select(1,0); game.pause(200);
  game.update(90000); assert.deepEqual(values(game),original); assert.equal(game.remaining,59800);
  game.resume(100000); game.update(100299); assert.deepEqual(values(game),original);
  game.update(100300); assert.equal(game.cards[0].value,original[1]);
  game.start(200000); game.select(0,200000); game.select(1,200000); game.start(200100); game.update(200600);
  assert.deepEqual(values(game),original); assert.equal(game.mismatches,0); assert.equal(game.pending,null);
  game.start(300000); game.select(0,359700); game.select(1,359700); game.update(360000);
  assert.equal(game.failureReason,'timeout'); assert.deepEqual(values(game),original);
});

test('successful pairs use exchanged values, earn normal capped time, and finish the rule', () => {
  for(const mistake of [false,true]) {
    const game=create(); if(mistake){game.select(0,0);game.select(1,0);game.update(500);}
    for(let kind=0;kind<6;kind++) for(const card of game.cards.filter(c=>c.value===kind&&c.status==='hidden')) assert.equal(game.select(card.index,1000),true);
    assert.equal(game.state,'won'); assert.equal(game.pairs,18); assert.equal(game.mismatches,Number(mistake));
    assert.equal(game.conditionStates[0].completed,true); assert.equal(game.remaining,60000); assert.equal(game.bonusTime,1000);
  }
  const ordinary=new MemoryGame({level:levels.find(l=>l.id===8)});ordinary.start(0);
  const a=ordinary.cards[0],b=ordinary.cards.find(c=>c.value!==a.value),before=values(ordinary);
  ordinary.select(a.index,0);ordinary.select(b.index,0);ordinary.update(500);assert.deepEqual(values(ordinary),before);
});
