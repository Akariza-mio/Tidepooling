const test=require('node:test'),assert=require('node:assert/strict');
const Game=require('../core.js'),levels=require('../levels.js'),level=levels.find(l=>l.id===24);
const create=(override=level)=>{const g=new Game({level:override});g.start(0);return g;};
const rule=g=>g.conditionStates.find(c=>c.type==='maxGrass');
const flip=(g,a,b,t=0)=>{assert.equal(g.select(a,t),true);assert.equal(g.select(b,t),true);};
test('reef fourth starts at the allowed five-grass limit with five fixed dispersed cells and the original deck',()=>{
 const g=create();assert.equal(level.rows,6);assert.equal(level.columns,6);assert.equal(g.duration,60000);assert.equal(g.totalPairs,18);
 assert.equal(rule(g).limit,5);assert.equal(rule(g).current,5);assert.equal(rule(g).failed,false);assert.equal(g.state,'playing');
 assert.equal(new Set(level.seagrass.cells).size,5);assert.ok(level.seagrass.cells.every(i=>Number.isInteger(i)&&i>=0&&i<36));
 assert.ok(new Set(level.seagrass.cells.map(i=>Math.floor(i/6))).size>=4);assert.ok(new Set(level.seagrass.cells.map(i=>i%6)).size>=4);
 assert.deepEqual(g.cards.filter(c=>c.tangled).map(c=>c.index),[...level.seagrass.cells]);assert.deepEqual([0,1,2,4,5].map(k=>level.layout.filter(v=>v===k).length),[8,8,8,6,6]);
 g.start(5000);assert.deepEqual(g.cards.map(c=>c.value),[...level.layout]);assert.deepEqual(g.cards.filter(c=>c.tangled).map(c=>c.index),[...level.seagrass.cells]);
});
test('a sixth live grass cell fails immediately, before cover animation or another match',()=>{
 const g=create({...level,seagrass:{cells:[0,1,2,3,5]}});flip(g,0,34);
 assert.equal(rule(g).current,6);assert.equal(rule(g).failed,true);assert.equal(g.state,'lost');assert.equal(g.failureReason,'conditions');assert.equal(g.pending,null);assert.equal(g.cards[0].status,'open');assert.equal(g.select(4,0),false);
 g.start(1000);assert.equal(rule(g).current,5);assert.equal(rule(g).failed,false);
});
test('the actual random-fixed layout loses when a grass mismatch spreads beyond five',()=>{
 const g=create(),source=g.cards.find(c=>c.tangled),other=g.cards.find(c=>c.value!==source.value&&!c.tangled);
 flip(g,source.index,other.index);assert.ok(rule(g).current>5);assert.equal(g.state,'lost');assert.equal(g.failureReason,'conditions');
});
test('open and purple-locked grass count while invalid clicks do not spread again',()=>{
 const g=create({...level,conditions:[{...level.conditions[0],limit:36}]});const a=g.cards.find(c=>c.tangled),b=g.cards.find(c=>!c.tangled&&c.value!==a.value);
 g.select(a.index,0);assert.equal(rule(g).current,5);g.select(b.index,0);const count=rule(g).current;assert.ok(count>5);assert.equal(g.select(35,0),false);assert.equal(rule(g).current,count);
 g.update(500);assert.equal(g.isGrassLocked(g.cards[a.index]),true);assert.equal(rule(g).current,count);g.update(10000);assert.equal(g.isGrassLocked(g.cards[a.index]),false);assert.equal(rule(g).current,count);
});
test('matching reduces the initial five and can complete the board without exceeding the cap',()=>{
 const g=create();for(const kind of [0,1,2,4,5])for(const c of g.cards.filter(c=>c.value===kind)){assert.equal(g.select(c.index,1000),true);assert.ok(rule(g).current<=5);}
 assert.equal(g.state,'won');assert.equal(g.pairs,18);assert.equal(rule(g).current,0);assert.equal(rule(g).completed,true);
});
test('pause/retry preserve the fixed layout; the five-grass limit remains local to this level',()=>{
 const g=create();g.select(level.seagrass.cells[0],100);g.pause(200);const remaining=g.remaining;g.update(50000);assert.equal(g.remaining,remaining);assert.equal(rule(g).current,5);g.resume(60000);g.start(70000);assert.equal(g.remaining,60000);assert.ok(g.cards.every(c=>c.status==='hidden'&&!g.isGrassLocked(c)));assert.equal(rule(g).current,5);
 const other=create(levels.find(l=>l.id===22));assert.deepEqual(other.conditionStates,[]);assert.equal(other.cards.filter(c=>c.tangled).length,12);
});
