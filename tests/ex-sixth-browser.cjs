// Verify real file/HTTP play without screenshots or user-profile writes.
const {chromium}=require('./browser-support.cjs'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{createServer}=require('../scripts/serve.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch();
  for(const [url,testing] of [[pathToFileURL(path.join(root,'index.html')).href,true],[`http://127.0.0.1:${server.address().port}/`,false]]){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],external=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).hostname!=='127.0.0.1')external.push(r.url());});
   await page.clock.install({time:new Date('2026-11-04T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-04T00:00:01Z'));
   await page.addInitScript(testing=>{localStorage.setItem('beach-pairs-completed-levels','[45]');if(testing)localStorage.setItem('beach-pairs-unlock-all','on');},testing);
   await page.goto(url);const state=()=>page.evaluate(()=>beachDiagnostics.snapshot()),action=name=>page.getByRole('button',{name,exact:true}).click(),tile=i=>page.locator('.tile').nth(i);
   const deck=()=>page.locator('.tile .shell-face > .seaside-item').evaluateAll(ns=>ns.map(n=>Number(n.dataset.kind)));
   const intro=async()=>{assert.equal(await page.locator('#modal-conditions').innerText(),'配对失败会使物品位置互换');await action('我知道了');};
   const restart=async()=>{await page.locator('#pause-button').click();await action('重新开始');assert.equal((await state()).remaining,60000);await intro();};
   await page.locator('#select-level-button').click();for(let i=0;i<4;i++)await page.locator('#chapter-next').click();
   assert.equal(await page.locator('#chapter-5 .chapter-level:enabled').count(),testing?10:1);assert.equal(await page.locator('#level-50').isDisabled(),!testing);
   if(testing) await page.locator('#level-46').click();
   else {
    assert.equal(await page.locator('#level-46').isDisabled(),true);await page.locator('#level-45').click();await action('我知道了');
    const previous=await deck();for(const kind of [0,1,2,4,5])for(let i=0;i<64;i++)if(previous[i]===kind)await tile(i).click();await page.clock.runFor(1000);await action('下一关');
   }
   let snap=await state();assert.equal(snap.levelId,46);assert.equal(snap.mode,'matching');assert.equal(snap.rows,6);assert.equal(snap.columns,6);
   assert.equal(snap.duration,60000);assert.equal(snap.totalPairs,18);assert.equal(snap.modalOpen,true);await page.clock.fastForward(30000);assert.equal((await state()).remaining,60000);await intro();
   const original=await deck();assert.equal(original.length,36);assert.deepEqual(Array.from({length:6},(_,k)=>original.filter(v=>v===k).length),[6,6,6,6,6,6]);
   assert.deepEqual((await state()).seagrass.flatMap((c,i)=>c.grass?[i]:[]),[2,8,14,20,26,32]);assert.equal((await state()).fog.every(v=>v===null),true);assert.equal((await state()).surf,null);assert.equal((await state()).slotMachine,null);
   assert.equal(await page.locator('#slot-machine-panel').isVisible(),false);assert.equal(await page.locator('#play-conditions').innerText(),'配对失败会使物品位置互换');
   await tile(0).click();await tile(1).click();await page.clock.runFor(400);assert.deepEqual(await deck(),original);await page.clock.runFor(150);
   let current=[...original];[current[0],current[1]]=[current[1],current[0]];assert.deepEqual(await deck(),current);assert.equal((await state()).mismatches,1);assert.equal((await state()).pairs,0);
   await tile(0).click();assert.match(await tile(0).getAttribute('aria-label'),/鱼儿/);await tile(4).click();assert.equal((await state()).pairs,1);assert.ok((await state()).bonusTime>0);
   await restart();assert.deepEqual(await deck(),original);await tile(2).click();await tile(0).click();await page.clock.runFor(200);
   await page.locator('#pause-button').click();assert.equal(await page.locator('#modal-conditions').innerText(),'配对失败会使物品位置互换');const paused=await state();await page.clock.fastForward(30000);assert.deepEqual(await deck(),original);assert.equal((await state()).activeTime,paused.activeTime);
   await action('继续赶海');await page.clock.runFor(350);current=[...original];[current[2],current[0]]=[current[0],current[2]];assert.deepEqual(await deck(),current);
   snap=await state();assert.equal(snap.seagrass[2].locked,true);assert.equal(snap.seagrass[0].grass,false);for(const i of [1,3,8])assert.equal(snap.seagrass[i].grass,true);
   assert.equal(await tile(2).isDisabled(),true);await page.clock.runFor(10000);assert.equal((await state()).seagrass[2].locked,false);
   await restart();assert.deepEqual(await deck(),original);assert.equal((await state()).mismatches,0);assert.deepEqual((await state()).seagrass.flatMap((c,i)=>c.grass?[i]:[]),[2,8,14,20,26,32]);
   for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:1280,height:720},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.clock.runFor(30);
    assert.deepEqual(await page.evaluate(()=>{const s=document.querySelector('#play-screen').getBoundingClientRect();return [...document.querySelectorAll('.tile,.collection,#level-objectives')].flatMap(n=>{const b=n.getBoundingClientRect();return b.width>0&&b.height>0&&b.left>=s.left-1&&b.right<=s.right+1&&b.top>=s.top-1&&b.bottom<=s.bottom+1?[]:[{node:n.className,box:b.toJSON(),screen:s.toJSON()}];});}),[],JSON.stringify(viewport));
   }
   await page.setViewportSize({width:390,height:844});
   for(let kind=0;kind<6;kind++)for(let i=0;i<36;i++)if(original[i]===kind)await tile(i).click();assert.equal((await state()).state,'won');assert.equal((await state()).pairs,18);assert.equal((await state()).conditions[0].completed,true);await page.clock.runFor(1000);
   assert.equal(await page.locator('#modal-heading').innerText(),'海的礼物，收好啦。');assert.equal(await page.locator('#modal-art .bucket-find').count(),18);assert.equal(await page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels')),testing?'[45]':'[45,46]');
   await action('下一关');assert.equal((await state()).levelId,47);assert.equal((await state()).mode,'arithmetic');assert.equal((await state()).modalOpen,false);assert.equal((await state()).timerRunning,true);await page.locator('#pause-button').click();await action('返回选关');assert.equal(await page.locator('#level-46').isEnabled(),true);assert.equal(await page.locator('#level-50').isDisabled(),!testing);
   await page.locator('#level-46').click();await intro();await page.clock.fastForward(60000);assert.equal((await state()).failureReason,'timeout');await action('重新挑战');assert.equal((await state()).remaining,60000);await intro();assert.deepEqual(await deck(),original);
   const ids=await page.locator('#board [id]').evaluateAll(ns=>ns.map(n=>n.id));assert.equal(ids.length,new Set(ids).size);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await context.close();
  }
  console.log('PASS: EX sixth file/HTTP, swap timing and rendered items, original-cell grass spread/lock, capped reward, entry/pause/retry/deadline, five viewports, victory/progress isolation, arithmetic transition and locked upcoming levels. No screenshots.');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
