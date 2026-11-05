const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Game=require('../core.js'),levels=require('../levels.js'),level=levels.find(l=>l.id===50);
const message=['感谢你的时间和精力！','此游戏是一个大学生拷问AI半个月得出的成果','希望能让玩的人得到快乐，体会到一点我的小巧思','特别感谢：开发时的测试者和为我提出建议的人','and you.'];
const create=()=>{const game=new Game({level});game.start(0);return game;};
test('the fiftieth and final level has exactly two hearts and the exact five-line ending',()=>{
 assert.equal(levels.length,50);assert.equal(level.rows,1);assert.equal(level.columns,2);assert.deepEqual([...level.layout],[6,6]);assert.equal(level.untimed,true);assert.equal(level.pairBonus,0);assert.deepEqual([...level.endingMessage],message);
 for(const name of ['fog','seagrass','surf','conditions','startCountdown','intro'])assert.equal(level[name],undefined);
 const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../art.js'),'utf8'),context);assert.equal(context.BeachArt.names[6],'爱心');assert.match(context.BeachArt.item(6,'test'),/data-kind="6"/);assert.deepEqual(Array.from(context.BeachArt.names.slice(0,6)),['扇贝','螃蟹','小虾','八爪鱼','海螺','鱼儿']);
});
test('the tide remains still indefinitely while both heart tiles remain playable',()=>{
 const game=create(),remaining=game.remaining;assert.equal(game.timerRunning,false);assert.equal(game.totalPairs,1);
 game.update(86400000);assert.equal(game.state,'playing');assert.equal(game.elapsed,0);assert.equal(game.progress,0);assert.equal(game.remaining,remaining);
 game.setTimerRunning(true,86400000);assert.equal(game.timerRunning,false);game.update(172800000);assert.equal(game.elapsed,0);
 assert.equal(game.select(0,172800000),true);assert.equal(game.select(0,172800001),false);game.update(259200000);assert.equal(game.state,'playing');assert.equal(game.pairs,0);assert.equal(game.progress,0);
 assert.equal(game.select(1,259200000),true);assert.equal(game.state,'won');assert.equal(game.pairs,1);assert.equal(game.bonusTime,0);assert.equal(game.progress,0);assert.equal(game.failureReason,null);
});
test('pause and retry preserve the untimed ending, and a subsequent timed level still expires',()=>{
 const game=create();game.select(0,100);game.pause(200);game.update(100000);assert.equal(game.cards[0].status,'open');game.resume(200000);assert.equal(game.select(1,300000),true);assert.equal(game.state,'won');
 game.start(400000);assert.equal(game.timerRunning,false);assert.equal(game.pairs,0);assert.equal(game.countdownRemaining,0);assert.ok(game.cards.every(c=>c.status==='hidden'));assert.deepEqual(game.cards.map(c=>c.value),[6,6]);
 const ordinary=new Game({level:levels.find(l=>l.id===49)});ordinary.start(0);ordinary.update(3000);assert.equal(ordinary.timerRunning,true);ordinary.update(13000);assert.equal(ordinary.failureReason,'timeout');
});
