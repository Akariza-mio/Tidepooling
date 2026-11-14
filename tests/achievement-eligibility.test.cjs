const test=require('node:test'),assert=require('node:assert/strict');
const Achievements=require('../achievements.js'),levels=require('../levels.js'),Game=require('../core.js'),Surf=require('../surf.js');
const modes={diagonalPuzzle:require('../puzzle.js'),fogJourney:require('../journey.js'),grassPuzzle:require('../grass-puzzle.js'),bucketSort:require('../bucket-sort.js'),arithmetic:require('../arithmetic.js'),slotMachine:require('../slot-machine.js')};
const pairingAwards=['flawless-clear','picky-eater','zen-mode','one-pair-short'];
function create(level){const Run=level.surf?Surf:modes[level.type]??Game,run=new Run({level,random:()=>0});run.start(0);return run;}
test('all 50 authored levels award zen only for an actual zero-pair pairing timeout',()=>{
 for(const level of levels){
  const run=create(level),a=new Achievements(null);if(level.type==='fogJourney')run.beginPreview(0);
  run.update(1000000);a.record(run);
  if(!level.untimed){assert.equal(run.state,'lost',String(level.id));assert.equal(run.failureReason,'timeout',String(level.id));}
  assert.equal(a.earned.has('zen-mode'),run.totalPairs>0&&!level.untimed,String(level.id));
 }
});
test('pairing-only achievements cannot use inherited zero counts or an unrelated event trace in any non-pairing mode',()=>{
 for(const level of levels){
  const run=create(level);if(run.totalPairs>0)continue;
  for(const state of ['playing','lost','won']){
   run.state=state;run.failureReason='timeout';run.pairs=0;run.mismatches=0;run.pairKinds=Array(6).fill(1);
   const a=new Achievements(null);a.record(run);
   for(const id of pairingAwards)assert.equal(a.earned.has(id),false,`${level.id}/${state}/${id}`);
  }
 }
 // Victory near the deadline is intentionally available in non-pairing games.
 const run=create(levels.find(l=>l.id===5));run.update(run.duration-3000);run.state='won';const a=new Achievements(null);a.record(run);
 assert.equal(a.earned.has('last-second-clear'),true);
});
test('1-6 speed achievement excludes a long intro as well as pause, and includes exactly thirty formal seconds',()=>{
 const level=levels.find(l=>l.id===6),solution=[0,2,5,1,4,1,4,0,2,5,2,5,1,4,0,4,0,2,5,1,5,1,4,0,2];
 for(const time of [29999,30000,30001]){
  const run=create(level),a=new Achievements(null);run.setTimerRunning(false,0);run.update(60000);run.setTimerRunning(true,60000);
  run.pause(61000);run.resume(161000);
  solution.forEach((kind,i)=>{if(!run.cards[i].fixed)assert.equal(run.place(i,kind,160000+time),true);});
  assert.equal(run.state,'won');assert.equal(run.activeTime,60000+time);a.record(run);
  assert.equal(a.earned.has('quick-search'),time<=30000);
 }
});
