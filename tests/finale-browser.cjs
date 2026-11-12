// Final hearts and exact thanks, isolated file/HTTP profiles; no screenshots.
const {chromium}=require('./browser-support.cjs'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{createServer}=require('../scripts/serve.cjs');
const message=['感谢你的时间和精力！','此游戏是一个大学生拷问AI半个月得出的成果','希望能让玩的人得到快乐，体会到一点我的小巧思','特别感谢：开发时的测试者和为我提出建议的人','and you.'];
(async()=>{
 const root=path.resolve(__dirname,'..'),server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch();
  for(const [url,testing]of [[pathToFileURL(path.join(root,'index.html')).href,true],[`http://127.0.0.1:${server.address().port}/`,false]]){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],external=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).hostname!=='127.0.0.1')external.push(r.url());});
   await page.clock.install({time:new Date('2026-11-05T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-05T00:00:01Z'));
   await page.addInitScript(testing=>{localStorage.setItem('beach-pairs-completed-levels','[49]');if(testing)localStorage.setItem('beach-pairs-unlock-all','on');},testing);
   await page.goto(url);const state=()=>page.evaluate(()=>beachDiagnostics.snapshot()),action=name=>page.getByRole('button',{name,exact:true}).click(),tile=i=>page.locator('.tile').nth(i);
   const viewports=[{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:1280,height:720},{width:844,height:390}];
   await page.locator('#select-level-button').click();for(let i=0;i<4;i++)await page.locator('#chapter-next').click();assert.equal(await page.locator('#chapter-5 .chapter-level:enabled').count(),10);assert.equal(await page.evaluate(()=>BeachLevels.length),50);
   if(testing)await page.locator('#level-50').click();else{
    assert.equal(await page.locator('#level-50').isDisabled(),false);await page.locator('#level-49').click();await page.clock.fastForward(3000);const deck=await page.locator('.tile .seaside-item').evaluateAll(ns=>ns.map(n=>Number(n.dataset.kind)));
    for(const kind of new Set(deck))for(let i=0;i<36;i++)if(deck[i]===kind)await tile(i).click();await page.clock.runFor(1000);await action('下一关');
   }
   let snap=await state();assert.equal(snap.levelId,50);assert.equal(snap.rows,1);assert.equal(snap.columns,2);assert.equal(snap.totalPairs,1);assert.equal(snap.timerRunning,false);assert.equal(snap.modalOpen,false);assert.equal(snap.countdownRemaining,0);assert.equal(await page.locator('.tile').count(),2);assert.deepEqual(await page.locator('.tile .seaside-item').evaluateAll(ns=>ns.map(n=>Number(n.dataset.kind))),[6,6]);
   const remaining=snap.remaining;await page.clock.fastForward(29000);snap=await state();assert.equal(snap.state,'playing');assert.equal(snap.elapsed,0);assert.equal(snap.remaining,remaining);assert.equal(snap.progress,0);assert.equal(snap.displayedTide,0);assert.equal(await page.locator('#tide-danger').isVisible(),false);
   await tile(0).click();assert.equal((await state()).statuses[0],'open');assert.match(await tile(0).getAttribute('aria-label'),/爱心/);await tile(0).dispatchEvent('click');assert.equal((await state()).pairs,0);
   await page.locator('#pause-button').click();await page.clock.fastForward(90000);await action('继续赶海');assert.equal((await state()).statuses[0],'open');assert.equal((await state()).progress,0);await page.locator('#pause-button').click();await action('重新开始');assert.deepEqual((await state()).statuses,['hidden','hidden']);assert.equal((await state()).timerRunning,false);
   for(const viewport of viewports){await page.setViewportSize(viewport);await page.clock.runFor(30);assert.deepEqual(await page.evaluate(()=>{const s=document.querySelector('#play-screen').getBoundingClientRect();return [...document.querySelectorAll('.tile,.collection')].flatMap(n=>{const b=n.getBoundingClientRect();return b.width>0&&b.height>0&&b.left>=s.left-1&&b.right<=s.right+1&&b.top>=s.top-1&&b.bottom<=s.bottom+1?[]:[{node:n.className,box:b.toJSON(),screen:s.toJSON()}];});}),[],JSON.stringify(viewport));}
   await page.setViewportSize({width:390,height:844});await tile(0).click();await tile(1).click();assert.equal((await state()).state,'won');assert.equal((await state()).pairs,1);await page.clock.runFor(1000);
   assert.equal(await page.locator('#modal-heading').innerText(),message[0]);assert.equal(await page.locator('#modal-description').innerText(),message.slice(1).join('\n'));assert.equal(await page.locator('#modal-art .seaside-item[data-kind="6"]').count(),1);assert.equal(await page.getByRole('button',{name:'下一关',exact:true}).count(),0);assert.equal(await page.locator('#modal-actions button').count(),2);assert.equal(await page.locator('#modal-card').evaluate(n=>n.classList.contains('ending-card')),true);
   assert.equal(await page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels')),'[49,50]');
   for(const viewport of viewports){
    await page.setViewportSize(viewport);await page.clock.runFor(30);assert.equal(await page.locator('#modal-card').evaluate(n=>{const a=document.querySelector('#app').getBoundingClientRect(),b=n.getBoundingClientRect();return b.top>=a.top-1&&b.bottom<=a.bottom+1&&b.left>=a.left-1&&b.right<=a.right+1;}),true,JSON.stringify(viewport));
    for(const button of await page.locator('#modal-actions button').all()){await button.scrollIntoViewIfNeeded();assert.equal(await button.evaluate(n=>{const a=document.querySelector('#modal-card').getBoundingClientRect(),b=n.getBoundingClientRect();return b.top>=a.top-1&&b.bottom<=a.bottom+1;}),true);}
   }
   await page.setViewportSize({width:390,height:844});await action('返回选关');assert.equal(await page.locator('#level-50').isEnabled(),true);await page.locator('#level-50').click();await tile(0).click();await tile(1).click();await page.clock.runFor(1000);assert.equal(await page.locator('#modal-description').innerText(),message.slice(1).join('\n'));await action('返回主菜单');assert.equal(await page.locator('#menu-screen').isVisible(),true);
   await page.locator('#select-level-button').click();for(let i=0;i<4;i++)await page.locator('#chapter-next').click();await page.locator('#level-49').click();assert.equal((await state()).countdownRemaining,3000);await page.clock.fastForward(3000);assert.equal((await state()).timerRunning,true);await page.clock.runFor(1000);assert.ok((await state()).progress>0);await page.locator('#pause-button').click();assert.equal(await page.locator('#modal-card').evaluate(n=>n.classList.contains('ending-card')),false);
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await context.close();
  }
  console.log('PASS: finale file/HTTP, 49→50, two hearts, untimed tide/no danger, pause/retry, exact five-line thanks, no next-level action, five-view board/modal access, completion isolation, replay/menu and return to timed play. No screenshots.');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
