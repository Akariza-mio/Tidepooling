// Every level is playable; only genuine wins are recorded. File/HTTP and blocked storage.
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
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
   const url=single?pathToFileURL(path.join(temp,'index.html')).href:'http://127.0.0.1:'+server.address().port+'/';await page.goto(url);
   const action=name=>page.getByRole('button',{name,exact:true}).click(),enabled=()=>page.locator('.chapter-level:enabled').count();
   const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('beach-pairs-completed-levels')||'[]'));
   const win=async()=>{const values=await page.locator('.tile .seaside-item').evaluateAll(ns=>ns.map(n=>Number(n.dataset.kind)));for(const kind of new Set(values))for(let i=0;i<values.length;i++)if(values[i]===kind)await page.locator('.tile').nth(i).click();await page.clock.runFor(1000);assert.equal(await page.evaluate(()=>beachDiagnostics.snapshot().state),'won');await action('返回选关');};
   await page.locator('#guide-button').click(); await page.keyboard.press('Escape');assert.equal(await page.locator('#unlock-switch,#unlock-label').count(),0);assert.equal(await page.locator('.setting-switch').count(),2);
   for(const id of ['music-switch','sound-switch']){await page.locator('#'+id).click();assert.equal(await page.locator('#'+id).getAttribute('aria-checked'),'false');await page.locator('#'+id).click();assert.equal(await page.locator('#'+id).getAttribute('aria-checked'),'true');}
   await page.locator('#select-level-button').click();
   assert.equal(await enabled(),50);assert.deepEqual(await stored(),[]);assert.equal(await page.locator('.chapter-level.is-completed').count(),0);assert.equal(await page.locator('#chapter-1 .chapter-progress').innerText(),'已通关 0 / 10');assert.equal(await page.locator('#level-2 .chapter-level-status').innerText(),'可挑战');
   await page.locator('#level-2').click();await win();assert.deepEqual(await stored(),[2]);assert.equal(await enabled(),50);assert.equal(await page.locator('#level-2 .chapter-level-status').innerText(),'已通关');assert.equal(await page.locator('#level-2 .level-clear-mark').isVisible(),true);assert.equal(await page.locator('.chapter-level.is-completed').count(),1);assert.equal(await page.locator('#chapter-1 .chapter-progress').innerText(),'已通关 1 / 10');
   await page.reload();await page.locator('#select-level-button').click();assert.equal(await enabled(),50);assert.deepEqual(await stored(),[2]);assert.equal(await page.locator('#level-2 .chapter-level-status').innerText(),'已通关');assert.equal(await page.locator('#level-2 .level-clear-mark').isVisible(),true);
   await page.locator('#level-screen [data-menu]').click();await page.locator('#start-button').click();assert.equal(await page.evaluate(()=>beachDiagnostics.snapshot().levelId),1);await action('跳过教程');await win();assert.deepEqual((await stored()).sort((a,b)=>a-b),[1,2]);
   for(const flag of ['on','off']){
    await page.evaluate(({value,revision})=>{localStorage.clear();localStorage.setItem('beach-pairs-progress-version',revision);localStorage.setItem('beach-pairs-completed-levels','[10]');localStorage.setItem('beach-pairs-unlock-all',value);},{value:flag,revision:require('../achievements.js').revision});
    await page.reload();await page.locator('#select-level-button').click();assert.equal(await enabled(),50);assert.deepEqual(await stored(),[10]);
    for(let chapter=0;chapter<4;chapter++)await page.locator('#chapter-next').click();await page.locator('#level-50').click();await win();assert.deepEqual(await stored(),[10,50]);assert.equal(await enabled(),50);assert.equal(await page.locator('#chapter-5 .chapter-progress').innerText(),'已通关 1 / 10');
   }
   for(let chapter=0;chapter<4;chapter++)await page.locator('#chapter-previous').click();assert.equal(await page.locator('#level-10 .chapter-level-status').innerText(),'已通关');assert.equal(await page.locator('#level-10 .level-clear-mark').isVisible(),true);assert.equal(await page.locator('#level-one .chapter-level-status').innerText(),'可挑战');assert.deepEqual(errors,[]);
   const blocked=await context.newPage(),blockedErrors=[];blocked.on('pageerror',e=>blockedErrors.push(e.message));await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('Storage unavailable');}}));
   await blocked.goto(url);await blocked.locator('#select-level-button').click();assert.equal(await blocked.locator('.chapter-level:enabled').count(),50);for(let chapter=0;chapter<4;chapter++)await blocked.locator('#chapter-next').click();await blocked.locator('#level-50').click();await blocked.locator('.tile').nth(0).click();await blocked.locator('.tile').nth(1).click();await blocked.getByRole('button',{name:'返回选关',exact:true}).click();assert.equal(await blocked.locator('.chapter-level:enabled').count(),50);assert.equal(await blocked.locator('#chapter-5 .chapter-progress').innerText(),'已通关 1 / 10');assert.deepEqual(blockedErrors,[]);
   await context.close();console.log('PASS '+(single?'offline single HTML':'HTTP source')+': all 50 unlocked by default, two audio switches, real wins only, reload, legacy on/off ignored and blocked-storage session progress.');
  }
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(String(e.message).slice(0,1700));process.exitCode=1;});
