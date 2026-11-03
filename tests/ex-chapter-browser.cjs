// Native animation/DOM validation; no images or persistent user-profile changes.
const {chromium}=require('./browser-support.cjs');
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{createServer}=require('../scripts/serve.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch();
  for(const url of [pathToFileURL(path.join(root,'index.html')).href,`http://127.0.0.1:${server.address().port}/`]){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{localStorage.setItem('beach-pairs-unlock-all','on');localStorage.setItem('beach-pairs-completed-levels','[1]');});await page.goto(url);
   const action=name=>page.getByRole('button',{name,exact:true}).click();
   const go=direction=>page.locator('#chapter-'+direction).click();
   const settle=()=>page.evaluate(async()=>{const ids=['chapter-4','chapter-5','chapter-surf-scene','chapter-day-scene','chapter-surf-bridge'];for(const a of document.getAnimations().filter(a=>ids.includes(a.effect?.target.id)))a.finish();await Promise.resolve();});
   const middle=()=>page.evaluate(()=>{const ids=['chapter-4','chapter-5','chapter-surf-scene','chapter-day-scene','chapter-surf-bridge'];const animations=document.getAnimations().filter(a=>ids.includes(a.effect?.target.id));for(const a of animations){a.pause();a.currentTime=500;}return animations.map(a=>({id:a.effect.target.id,duration:a.effect.getTiming().duration,opacity:Number(getComputedStyle(a.effect.target).opacity),transform:getComputedStyle(a.effect.target).transform}));});
   await page.locator('#select-level-button').click();const day=await page.locator('#chapter-day-scene').innerHTML();for(let i=0;i<3;i++)await go('next');
   assert.equal(await page.locator('.chapter-page:visible h1').innerText(),'踏浪而寻');await page.emulateMedia({reducedMotion:'no-preference'});
   for(const direction of ['next','previous']){
    await go(direction);assert.equal(await page.locator('#chapter-pages').getAttribute('aria-busy'),'true');assert.equal(await page.locator('#chapter-next').isDisabled(),true);assert.equal(await page.locator('#chapter-previous').isDisabled(),true);
    for(const id of ['chapter-4','chapter-5'])assert.equal(await page.locator('#'+id).evaluate(n=>n.inert),true);
    const frames=await middle();assert.equal(frames.length,5);assert.ok(frames.every(frame=>frame.duration===1000));
    for(const id of ['chapter-surf-scene','chapter-day-scene','chapter-surf-bridge']){const frame=frames.find(f=>f.id===id);assert.ok(frame.opacity>0&&frame.opacity<1,JSON.stringify(frame));assert.notEqual(frame.transform,'none');}
    const from=await page.locator('#chapter-'+(direction==='next'?4:5)).evaluate(n=>getComputedStyle(n).transform),to=await page.locator('#chapter-'+(direction==='next'?5:4)).evaluate(n=>getComputedStyle(n).transform);assert.notEqual(from,to);
    await settle();await page.locator('#chapter-pages:not(.is-sliding)').waitFor({state:'attached'});assert.equal(await page.locator('#chapter-surf-bridge').isVisible(),false);
    assert.equal(await page.locator('.chapter-page:visible').count(),1);assert.equal(await page.locator('.chapter-page[inert]').count(),0);
    assert.equal(await page.locator('.chapter-page:visible h1').innerText(),direction==='next'?'挑战EX':'踏浪而寻');
   }
   await go('next');await settle();await page.locator('#chapter-pages:not(.is-sliding)').waitFor({state:'attached'});
   assert.equal(await page.locator('#chapter-heading-4').innerText(),'挑战EX');assert.match(await page.locator('#chapter-indicators [aria-current="page"]').getAttribute('aria-label'),/挑战EX/);
   assert.equal(await page.locator('#chapter-next').isDisabled(),true);assert.equal(await page.locator('#chapter-previous').isEnabled(),true);
   assert.equal(await page.locator('#chapter-day-scene').isVisible(),true);assert.equal(await page.locator('#chapter-surf-scene').isVisible(),false);assert.equal(await page.locator('#chapter-day-scene').innerHTML(),day);
   assert.equal(await page.locator('#chapter-5 .harvest-emblem-art').count(),1);assert.equal(await page.locator('#chapter-5 .harvest-emblem-art .seaside-item').count(),4);
   const ids=await page.locator('#chapter-5 [id]').evaluateAll(ns=>ns.map(n=>n.id));assert.equal(ids.length,new Set(ids).size);
   assert.equal(await page.locator('#chapter-5 .chapter-level').count(),10);assert.equal(await page.locator('#chapter-5 .chapter-level:enabled').count(),0);assert.equal(await page.locator('#chapter-5 .is-minigame').count(),2);
   assert.equal(await page.evaluate(()=>BeachLevels.length),40);assert.equal(await page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels')),'[1]');
   for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:1280,height:720},{width:844,height:390}]){
    await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>{
     const app=document.querySelector('#app').getBoundingClientRect(),scene=document.querySelector('#chapter-day-scene').getBoundingClientRect(),pager=document.querySelector('.chapter-pagination').getBoundingClientRect();
     return scene.left<=app.left+1&&scene.top<=app.top+1&&scene.right>=app.right-1&&scene.bottom>=app.bottom-1&&pager.bottom<=app.bottom&&getComputedStyle(document.querySelector('#chapter-day-scene')).pointerEvents==='none'&&document.documentElement.scrollWidth<=innerWidth;
    }),true,JSON.stringify(viewport));await page.locator('#level-50').scrollIntoViewIfNeeded();assert.equal(await page.locator('#level-50').isVisible(),true);
   }
   await page.setViewportSize({width:390,height:844});
   // Cancel each direction midway and verify clean, unlocked re-entry.
   for(const direction of ['previous','next']){
    if(direction==='next'){await page.emulateMedia({reducedMotion:'reduce'});await go('next');await go('next');await go('next');await page.emulateMedia({reducedMotion:'no-preference'});}
    await go(direction);await middle();await page.locator('#level-screen [data-menu]').click();
    assert.equal(await page.locator('#chapter-pages').getAttribute('aria-busy'),null);assert.equal(await page.locator('.chapter-page[inert]').count(),0);assert.equal(await page.locator('#chapter-surf-bridge').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>['chapter-4','chapter-5','chapter-day-scene','chapter-surf-scene','chapter-surf-bridge'].includes(a.effect?.target.id)).length),0);
    await page.locator('#select-level-button').click();assert.equal(await page.locator('.chapter-page:visible h1').innerText(),'初入浅滩');assert.equal(await page.locator('#chapter-day-scene').isVisible(),true);
   }
   await page.emulateMedia({reducedMotion:'reduce'});for(let i=0;i<4;i++)await go('next');
   assert.equal(await page.locator('.chapter-page:visible h1').innerText(),'挑战EX');assert.equal(await page.locator('#chapter-pages').getAttribute('aria-busy'),null);assert.equal(await page.locator('#chapter-surf-bridge').isVisible(),false);
   await go('previous');assert.equal(await page.locator('#chapter-surf-scene').isVisible(),true);await go('next');
   // Turning testing off never opens the unimplemented EX levels.
   await page.locator('#level-screen [data-menu]').click();await page.locator('#settings-button').click();await page.locator('#unlock-switch').click();await page.locator('#settings-screen [data-menu]').click();await page.locator('#select-level-button').click();for(let i=0;i<4;i++)await go('next');
   assert.equal(await page.locator('#chapter-5 .chapter-level:enabled').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels')),'[1]');
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: file/HTTP, Challenge EX name/indicator and filled-bucket art, reused daylight, both 1s wave-bridged transitions and midpoint/input locks, cleanup in both directions, reduced motion, five viewports, 40 implemented levels and all EX placeholders locked, unchanged progress. No screenshots.');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
