// A published revision resets both kinds of progress once; ordinary reloads preserve play.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{chromium}=require('./browser-support.cjs');
const Achievements=require('../achievements.js'),MathGame=require('../arithmetic.js'),level=require('../levels.js').find(l=>l.id===46);
const answers=level.rounds.map(r=>MathGame.evaluate(r.target,r.values));
(async()=>{
 const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'beach-release-reset-'));let browser;
 fs.copyFileSync(path.join(root,'release/index1.html'),path.join(temp,'index.html'));
 try{
  browser=await chromium.launch();
  for(const single of [false,true]){
   const context=await browser.newContext({viewport:{width:390,height:844},offline:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.clock.install({time:new Date('2026-11-12T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-12T00:00:01Z'));
   await page.addInitScript(()=>{
    if(localStorage.getItem('reset-test-seeded'))return;
    localStorage.setItem('reset-test-seeded','done');localStorage.setItem('beach-pairs-progress-version','previous-release');
    localStorage.setItem('beach-pairs-completed-levels','[1,21,22,45]');localStorage.setItem('beach-pairs-level-one','won');
    localStorage.setItem('beach-pairs-achievements-version','previous-release');localStorage.setItem('beach-pairs-achievements-v2','["first-clear","no-lever-clear"]');
   });
   const action=name=>page.getByRole('button',{name,exact:true}).click();
   const wins=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('beach-pairs-completed-levels')||'[]'));
   const awards=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('beach-pairs-achievements-v2')||'[]'));
   await page.goto(pathToFileURL(single?path.join(temp,'index.html'):path.join(root,'index.html')).href);
   assert.deepEqual(await wins(),[]);assert.deepEqual(await awards(),[]);
   assert.equal(await page.evaluate(()=>localStorage.getItem('beach-pairs-level-one')),null);
   assert.equal(await page.evaluate(()=>localStorage.getItem('beach-pairs-progress-version')),Achievements.revision);
   await page.locator('#select-level-button').click();assert.equal(await page.locator('.chapter-level:enabled').count(),50);
   assert.equal(await page.locator('.chapter-level.is-completed').count(),0);
   assert.deepEqual(await page.locator('.chapter-progress').allTextContents(),Array(5).fill('已通关 0 / 10'));
   for(let i=0;i<4;i++)await page.locator('#chapter-next').click();await page.locator('#level-46').click();
   for(const answer of answers){await page.locator('#arithmetic-answer').fill(String(answer));await page.locator('#arithmetic-submit').click();}
   await page.clock.runFor(1200);assert.equal(await page.locator('#modal-heading').innerText(),'挑战成功！');
   assert.equal(await page.locator('#modal-description').innerText(),'你在涨潮前答出了所有题目！');
   assert.equal(await page.locator('#modal-eyebrow').textContent(),'');assert.equal(await page.locator('#modal-eyebrow').isHidden(),true);
   assert.equal(await page.locator('#modal-art .notice-board-art').count(),0);
   assert.equal(await page.locator('#modal-art .perfect-score-art text').textContent(),'100');
   assert.equal(await page.locator('#modal-art .perfect-score-art text').evaluate(n=>getComputedStyle(n).fill),'rgb(211, 92, 82)');
   for(const [width,height]of [[320,568],[390,844],[844,390]]){
    await page.setViewportSize({width,height});assert.equal(await page.locator('#modal-art .perfect-score-art').evaluate(svg=>{const b=svg.getBoundingClientRect(),t=svg.querySelector('text').getBoundingClientRect();return t.width>0&&t.left>=b.left&&t.right<=b.right&&t.top>=b.top&&t.bottom<=b.bottom;}),true);
   }
   assert.deepEqual(await wins(),[46]);assert.equal((await awards()).includes('open-book'),true);
   await page.reload();assert.deepEqual(await wins(),[46]);assert.equal((await awards()).includes('open-book'),true);
   await page.locator('#select-level-button').click();assert.equal(await page.locator('.chapter-level.is-completed').count(),1);
   assert.equal(await page.locator('#level-46 .chapter-level-status').innerText(),'已通关');assert.equal(await page.locator('.chapter-level:enabled').count(),50);
   // Simulate an old save encountered by the next published revision, including legacy first-win data.
   await page.evaluate(()=>{localStorage.setItem('beach-pairs-progress-version','old');localStorage.setItem('beach-pairs-achievements-version','old');localStorage.setItem('beach-pairs-level-one','won');});
   await page.reload();assert.deepEqual(await wins(),[]);assert.deepEqual(await awards(),[]);
   await page.reload();assert.deepEqual(await wins(),[]);await page.locator('#select-level-button').click();assert.equal(await page.locator('.chapter-level:enabled').count(),50);
   for(let i=0;i<4;i++)await page.locator('#chapter-next').click();await page.locator('#level-46').click();
   await page.clock.fastForward(90000);await page.clock.runFor(100);
   assert.equal(await page.locator('#modal-heading').innerText(),'潮水先到了一步');
   assert.equal(await page.locator('#modal-eyebrow').textContent(),'');assert.equal(await page.locator('#modal-eyebrow').isHidden(),true);
   assert.equal(await page.locator('#modal-art .washed-bucket-art').count(),1);
   assert.deepEqual(errors,[]);await context.close();
   console.log(`PASS ${single?'isolated offline HTML':'source'}: both progress types reset once, legacy win cleared, all 50 open, actual 5-6 score-paper win, same-version reload retained.`);
  }
 }finally{if(browser)await browser.close();fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
