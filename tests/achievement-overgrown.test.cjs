const test = require('node:test'), assert = require('node:assert/strict');
const Achievements = require('../achievements.js'), Game = require('../core.js'), GrassPuzzle = require('../grass-puzzle.js'), levels = require('../levels.js');
const moves = [[0,7,10],[500,20,28],[1000,1,25],[1500,2,11],[2000,12,26],[2500,0,29]];
const key = 'beach-pairs-achievements-v2';
function tracker() {
  const values = new Map([['beach-pairs-achievements-version', Achievements.revision], ['beach-pairs-completed-levels', '[1,22]']]), notices = [];
  const storage = {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  return {a:new Achievements(storage,d=>notices.push(d)),storage,notices};
}
test('full grass spreads through a real zero-pair run and awards once, including purple locked cells', () => {
  const run = new Game({level:levels.find(l=>l.id===22)}), {a,storage,notices}=tracker(); run.start(0);
  for(const [now,first,second] of moves) {
    assert.equal(a.record(run),false); assert.equal(run.select(first,now),true); assert.equal(run.select(second,now),true);
    a.record(run); assert.equal(a.earned.has('overgrown'), now===2500);
  }
  assert.equal(run.pairs,0); assert.equal(run.cards.every(c=>c.tangled),true); assert.ok(run.cards.some(c=>run.isGrassLocked(c)));
  assert.deepEqual(notices.map(d=>d.name),['寸步难行']); assert.equal(notices[0].method,'让一关内全部格子都被海草覆盖');
  assert.equal(a.record(run),false); assert.equal(new Achievements(storage).earned.has('overgrown'),true);
  assert.equal(storage.getItem('beach-pairs-completed-levels'),'[1,22]'); assert.deepEqual(JSON.parse(storage.getItem(key)),['overgrown']);
  run.start(10000); assert.equal(run.cards.filter(c=>c.tangled).length,12); const fresh=tracker(); assert.equal(fresh.a.record(run),false);
});
test('one uncovered cell, any paired cell, previous successful pair, empty board or idle state cannot award', () => {
  const run=new Game({level:levels.find(l=>l.id===22)});run.start(0);
  for(const [now,a,b] of moves){run.select(a,now);run.select(b,now);}
  const a=tracker().a;run.cards[0].tangled=false;assert.equal(a.record(run),false);run.cards[0].tangled=true;
  run.pairs=1;assert.equal(a.record(run),false);run.pairs=0;run.cards[0].status='matched';assert.equal(a.record(run),false);
  run.cards[0].status='hidden';run.state='idle';assert.equal(a.record(run),false);run.state='playing';run.cards=[];assert.equal(a.record(run),false);
});
test('all seaweed means the whole board in the grass flip mode too, not just the pairing grass representation', () => {
  const run=new GrassPuzzle({level:{id:25,type:'grassPuzzle',rows:2,columns:2,duration:60000,layout:[0,0,0,1]}});run.start(0);
  const {a}=tracker();assert.equal(a.record(run),false);assert.equal(run.select(0,0),true);assert.equal(run.cards.every(c=>c.grass),true);
  assert.equal(run.pairs,0);assert.equal(a.record(run),true);assert.equal(a.earned.has('overgrown'),true);
});
