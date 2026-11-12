const test = require('node:test'), assert = require('node:assert/strict');
const Achievements = require('../achievements.js'), Journey = require('../journey.js'), Game = require('../core.js'), levels = require('../levels.js');
function tracker() {
  const values = new Map([['beach-pairs-achievements-version', Achievements.revision]]), notices = [];
  return { a: new Achievements({ getItem:k=>values.get(k)??null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k) }, d=>notices.push(d)), notices };
}
function journey() { const run = new Journey({level:levels.find(l=>l.id===16),random:()=>0});run.start(0);run.beginPreview(0);run.update(5000);return run; }
test('a real non-repeating route awards when no item is reachable even though one more empty step is possible',()=>{
  const run=journey(),{a,notices}=tracker(),route=[17,10,3,4,11,18,19,20,27,34,33,26];
  for(let i=0;i<route.length;i++){assert.equal(run.move(route[i],5000),true);a.record(run);assert.equal(a.earned.has('boxed-in'),i===route.length-1);}
  assert.equal(run.state,'playing');assert.equal(run.collectedCount,0);assert.equal(run.hasReachableTreasure(),false);
  assert.ok(run.walkNeighbors[run.position].some(i=>!run.isSpent(i)));assert.equal(run.move(25,5000),true);assert.equal(a.record(run),false);
  assert.equal(notices[0].method,'在2-6中把自己困住');assert.equal(notices[0].icon,'cage');
  assert.equal(new Achievements(a.storage).earned.has('boxed-in'),true);run.start(100000);assert.equal(run.trapped,false);
});
test('an impossible complete itinerary or current target does not mean all remaining objects are unreachable',()=>{
  const run=journey(),{a}=tracker();for(const i of [23,30,37,38])run.move(i,5000);
  assert.equal(run.completionRoute(run.target.index),null);assert.equal(run.hasReachableTreasure(),true);assert.equal(run.trapped,false);
  a.record(run);assert.equal(a.earned.has('boxed-in'),false);
  a.record({level:{id:15,type:'fogJourney'},state:'playing',trapped:true});assert.equal(a.earned.has('boxed-in'),false);
});
test('one-pair-short failure requires a pairing level and exactly one remaining pair, not a win or an exit',()=>{
  const level=levels.find(l=>l.id===8),run=new Game({level}),{a,notices}=tracker();run.start(0);
  const held=new Set(run.cards.filter(c=>c.value===run.cards[0].value).slice(0,2).map(c=>c.index));
  for(const kind of new Set(run.cards.map(c=>c.value)))for(const card of run.cards.filter(c=>c.value===kind&&!held.has(c.index)))run.select(card.index,0);
  assert.equal(run.pairs,17);assert.equal(a.record(run),false);run.update(run.duration);assert.equal(run.state,'lost');a.record(run);
  assert.equal(a.earned.has('one-pair-short'),true);assert.equal(notices[0].name,'差亿点');assert.equal(a.record(run),false);
  for(const [state,totalPairs,pairs] of [['lost',18,16],['lost',18,18],['won',18,18],['idle',18,17],['lost',0,0]]){
    const t=tracker();t.a.record({level,state,totalPairs,pairs});assert.equal(t.a.earned.has('one-pair-short'),false);
  }
});
test('crab rush requires a 5-2 win in at most ten formal seconds, excluding entry reading and pause',()=>{
  const level=levels.find(l=>l.id===42);
  for(const time of [9999,10000,10001]){
    const run=new Game({level}),{a}=tracker();run.start(0);run.setTimerRunning(false,0);run.update(60000);run.setTimerRunning(true,60000);
    assert.equal(run.playStartedAt,60000);run.pause(61000);run.update(100000);run.resume(151000);assert.equal(run.playStartedAt,60000);
    for(let i=0;i<34;i++)assert.equal(run.select(i,151000),true);
    assert.equal(a.record(run),true);assert.equal(a.earned.has('crab-rush'),false);
    assert.equal(run.select(34,150000+time),true);assert.equal(run.select(35,150000+time),true);assert.equal(run.state,'won');a.record(run);
    assert.equal(a.earned.has('crab-rush'),time<=10000);assert.equal(run.activeTime-run.playStartedAt,time);
    run.start(200000);assert.equal(run.playStartedAt,0);
  }
});
