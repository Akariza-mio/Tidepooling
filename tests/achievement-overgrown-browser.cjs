// Real seaweed propagation, list order, persistence and offline delivery. No screenshots.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('./browser-support.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'beach-overgrown-'));let browser;
 fs.copyFileSync(path.join(root,'release/index1.html'),path.join(temp,'index.html'));
 try{
  browser=await chromium.launch();
  for(const single of [false,true]){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',offline:true}),page=await context.newPage(),errors=[],external=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!/^(file:|data:)/.test(r.url()))external.push(r.url());});
   await page.clock.install({time:new Date('2026-11-11T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-11T00:00:01Z'));
   await page.goto(pathToFileURL(single?path.join(temp,'index.html'):path.join(root,'index.html')).href);
   const state=()=>page.evaluate(()=>beachDiagnostics.snapshot()),earned=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('beach-pairs-achievements-v2')||'[]'));
   const action=name=>page.getByRole('button',{name,exact:true}).click();
   await page.locator('#select-level-button').click();for(let i=0;i<2;i++)await page.locator('#chapter-next').click();await page.locator('#level-22').click();
   for(const [index,pair] of [[7,10],[20,28],[1,25],[2,11],[12,26],[0,29]].entries()){
    assert.equal((await earned()).includes('overgrown'),false);if(index)await page.clock.runFor(500);
    for(const at of pair)await page.locator('#board .tile').nth(at).click();
   }
   assert.equal((await state()).pairs,0);assert.equal((await state()).seagrass.filter(c=>c.grass).length,36);assert.equal((await state()).state,'playing');
   assert.equal((await earned()).includes('overgrown'),true);assert.equal(await page.locator('#achievement-toast-name').innerText(),'寸步难行');
   assert.equal(await page.locator('#achievement-toast-icon .achievement-grass-sprig').count(),4);
   await page.locator('#pause-button').click();await action('重新开始');assert.equal((await state()).seagrass.filter(c=>c.grass).length,12);
   await page.reload();await page.locator('#achievements-button').click();
   assert.equal(await page.locator('.achievement-card').count(),20);assert.equal(await page.locator('#achievement-summary').innerText(),'已完成1 / 20');
   assert.equal(await page.locator('.achievement-card').last().getAttribute('data-achievement'),'one-sided-love');
   assert.equal(await page.locator('.achievement-card').nth(18).getAttribute('data-achievement'),'overgrown');
   assert.equal(await page.locator('[data-achievement="overgrown"] p').innerText(),'让一关内全部格子都被海草覆盖');
   assert.equal(await page.locator('[data-achievement="overgrown"]').getAttribute('class').then(s=>s.includes('is-earned')),true);
   assert.equal(await page.locator('#achievement-toast').isVisible(),false);
   for(const [width,height] of [[320,480],[320,568],[390,844],[430,932],[844,390],[1280,720]]){
    await page.setViewportSize({width,height});assert.equal(await page.locator('.achievement-list').evaluate(list=>{
     const cards=[...list.children],boxes=cards.map(c=>c.getBoundingClientRect()),ids=[...list.querySelectorAll('[id]')].map(n=>n.id);
     return new Set(ids).size===ids.length&&boxes[0].right<boxes[1].left&&boxes.every(b=>Math.abs(b.height-boxes[0].height)<1)&&cards.every(c=>[...c.querySelector('.achievement-copy').children].every(el=>el.scrollWidth<=el.clientWidth+1&&el.getBoundingClientRect().height/parseFloat(getComputedStyle(el).lineHeight)<=(el.tagName==='H2'?1.05:3.05)));
    }),true,`${width}x${height}`);await page.locator('.achievement-card').last().scrollIntoViewIfNeeded();
   }
   await page.reload();await page.locator('#select-level-button').click();for(let i=0;i<4;i++)await page.locator('#chapter-next').click();await page.locator('#level-50').click();
   await page.clock.fastForward(30000);await page.clock.runFor(100);assert.equal((await earned()).includes('one-sided-love'),true);assert.equal((await state()).state,'playing');
   assert.equal(await page.locator('#achievement-toast-name').innerText(),'单相思');assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await context.close();
   console.log(`PASS ${single?'isolated offline HTML':'source'}: real full-grass zero-pair award, four-cell icon, retry, persistence, 20 cards, final hidden achievement, six layouts.`);
  }
 }finally{if(browser)await browser.close();fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
