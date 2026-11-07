// Normal progression and free-testing isolation, including the offline deliverable.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('./browser-support.cjs'),{createServer}=require('../scripts/serve.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'beach-progress-'));
 fs.copyFileSync(path.join(root,'release/index1.html'),path.join(temp,'index.html'));
 const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch();
  for(const single of [false,true]){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',offline:single});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.clock.install({time:new Date('2026-11-07T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-07T00:00:01Z'));
   const url=single?pathToFileURL(path.join(temp,'index.html')).href:`http://127.0.0.1:${server.address().port}/`;
   await page.goto(url);
   const action=name=>page.getByRole('button',{name,exact:true}).click();
   const enabled=()=>page.locator('.chapter-level:enabled').evaluateAll(ns=>ns.map(n=>Number(n.dataset.level)));
   const stored=()=>page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels'));
   const state=()=>page.evaluate(()=>beachDiagnostics.snapshot());
   const win=async()=>{const values=await page.locator('.tile .seaside-item').evaluateAll(ns=>ns.map(n=>Number(n.dataset.kind)));for(const kind of [...new Set(values)])for(let i=0;i<values.length;i++)if(values[i]===kind)await page.locator('.tile').nth(i).click();await page.clock.runFor(1000);assert.equal((await state()).state,'won');await action('返回选关');};
   const toggle=async()=>{await page.locator('#level-screen [data-menu]').click();await page.locator('#settings-button').click();await page.locator('#unlock-switch').click();await page.locator('#settings-screen [data-menu]').click();await page.locator('#select-level-button').click();};
   await page.locator('#start-button').click();await action('跳过教程');await win();
   assert.equal(await stored(),'[1]');assert.deepEqual(await enabled(),[1,2]);
   assert.equal(await page.locator('#level-2 .chapter-level-status').innerText(),'已解锁 · 可挑战');
   assert.equal(await page.locator('#level-2').evaluate(n=>n.classList.contains('is-completed')),false);
   assert.equal(await page.locator('#chapter-1 .chapter-progress').innerText(),'已通关 1 / 10');
   await page.reload();await page.locator('#select-level-button').click();assert.deepEqual(await enabled(),[1,2]);
   await page.locator('#level-3').dispatchEvent('click');assert.equal((await state()).screen,'level');
   await page.locator('#level-2').click();assert.equal((await state()).levelId,2);await win();
   assert.equal(await stored(),'[1,2]');assert.deepEqual(await enabled(),[1,2,3]);
   const genuine=await stored();await toggle();assert.equal((await enabled()).length,50);
   await page.reload();await page.locator('#select-level-button').click();assert.equal((await enabled()).length,50);
   await page.locator('#level-3').click();await action('我知道了');await win();
   assert.equal(await stored(),genuine);assert.equal(await page.locator('#chapter-1 .chapter-progress').innerText(),'已通关 2 / 10');
   await toggle();assert.deepEqual(await enabled(),[1,2,3]);assert.equal(await stored(),genuine);
   await page.reload();await page.locator('#select-level-button').click();assert.deepEqual(await enabled(),[1,2,3]);
   // Saved completion derives the next unlock without saving a false completion.
   for(const completed of [10,20,30,40,49,50]){
    await page.evaluate(id=>{localStorage.clear();localStorage.setItem('beach-pairs-reef-reset-v1','done');localStorage.setItem('beach-pairs-completed-levels',JSON.stringify([id]));},completed);
    await page.reload();await page.locator('#select-level-button').click();
    assert.deepEqual(await enabled(),completed===50?[50]:[completed,completed+1]);assert.equal(await stored(),JSON.stringify([completed]));
    const target=Math.min(50,completed+1);for(let i=0;i<Math.floor((target-1)/10);i++)await page.locator('#chapter-next').click();
    await page.locator('#level-'+target).click();assert.equal((await state()).levelId,target);
   }
   assert.deepEqual(errors,[]);await context.close();
   console.log(`PASS ${single?'offline single HTML':'HTTP source'}: real wins unlock next, reload/click guards/status/counts, chapter boundaries and 49→50, free-testing persists and never changes real progress.`);
  }
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(String(e.message).slice(0,1500));process.exitCode=1;});
