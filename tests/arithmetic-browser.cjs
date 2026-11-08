// File/HTTP arithmetic and mode transitions; no screenshots or user-profile writes.
const {chromium}=require('./browser-support.cjs'),assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{createServer}=require('../scripts/serve.cjs');
const ArithmeticGame=require('../arithmetic.js'),level=require('../levels.js').find(l=>l.id===46);
const answers=level.rounds.map(r=>ArithmeticGame.evaluate(r.target,r.values));
(async()=>{
 const root=path.resolve(__dirname,'..'),server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch();
  for(const [url,testing]of [[pathToFileURL(path.join(root,'index.html')).href,true],[`http://127.0.0.1:${server.address().port}/`,false]]){
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],external=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).hostname!=='127.0.0.1')external.push(r.url());});
   await page.clock.install({time:new Date('2026-11-04T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-04T00:00:01Z'));
   await page.addInitScript(testing=>{localStorage.setItem('beach-pairs-completed-levels','[45]');if(testing)localStorage.setItem('beach-pairs-unlock-all','on');},testing);
   await page.goto(url);const state=()=>page.evaluate(()=>beachDiagnostics.snapshot()),action=name=>page.getByRole('button',{name,exact:true}).click(),input=page.locator('#arithmetic-answer'),submit=page.locator('#arithmetic-submit');
   const solve=async number=>{await input.fill(String(number));await input.press('Enter');};
   const ready=async()=>{assert.equal((await state()).modalOpen,false);assert.equal((await state()).timerRunning,true);assert.equal(await page.locator('#arithmetic-panel h2').count(),0);};
   const restart=async()=>{await page.locator('#pause-button').click();await action('重新开始');assert.equal((await state()).remaining,90000);await ready();};
   await page.locator('#select-level-button').click();for(let i=0;i<4;i++)await page.locator('#chapter-next').click();assert.equal(await page.locator('#chapter-5 .chapter-level:enabled').count(),testing?10:2);assert.equal(await page.locator('#level-50').isDisabled(),!testing);
   if(testing)await page.locator('#level-46').click();else{
    assert.equal(await page.locator('#level-46').isDisabled(),false);await page.locator('#level-45').click();await action('我知道了');
    const deck=await page.locator('.tile .seaside-item').evaluateAll(ns=>ns.map(n=>Number(n.dataset.kind)));for(let kind=0;kind<6;kind++)for(let i=0;i<64;i++)if(deck[i]===kind)await page.locator('.tile').nth(i).click();await page.clock.runFor(1000);await action('下一关');
   }
   let snap=await state();assert.equal(snap.levelId,46);assert.equal(snap.mode,'arithmetic');assert.equal(snap.duration,90000);assert.equal(snap.arithmetic.total,10);assert.equal(snap.arithmetic.completed,0);assert.equal(snap.modalOpen,false);
   await ready();await page.clock.runFor(1000);assert.ok((await state()).remaining<90000);await restart();
   assert.equal(await page.locator('.tile').count(),0);assert.equal(await page.locator('.board-wrap').isVisible(),false);assert.equal(await page.locator('.collection').isVisible(),false);assert.equal(await page.locator('#slot-machine-panel').isVisible(),false);
   assert.equal(await page.locator('#arithmetic-clues .arithmetic-equation').count(),1);assert.equal(await page.locator('.arithmetic-key').count(),12);assert.match(await page.locator('#arithmetic-question').innerText(),/= \?/);
   await submit.click();assert.match(await page.locator('#arithmetic-feedback').innerText(),/整数/);assert.equal((await state()).arithmetic.completed,0);assert.equal((await state()).remaining,90000);
   await solve(9);assert.equal((await state()).arithmetic.completed,0);assert.match(await page.locator('#arithmetic-feedback').innerText(),/扣除5秒/);assert.equal((await state()).arithmetic.wrongAnswers,1);assert.equal((await state()).remaining,85000);
   await page.clock.runFor(1200);const before=(await state()).remaining;await page.locator('.arithmetic-key[data-value="5"]').click();assert.equal(await input.inputValue(),'5');await submit.click();assert.equal((await state()).arithmetic.completed,1);assert.equal((await state()).arithmetic.round,2);assert.ok((await state()).remaining<=before&&(await state()).remaining>=before-34);assert.equal((await state()).bonusTime,0);assert.equal(await input.inputValue(),'');
   await submit.dispatchEvent('click');assert.equal((await state()).arithmetic.completed,1);
   await page.locator('.arithmetic-key[data-value="2"]').click();await page.locator('.arithmetic-key[data-value="3"]').click();await page.locator('.arithmetic-key[data-value="delete"]').click();assert.equal(await input.inputValue(),'2');await page.locator('.arithmetic-key[data-value="clear"]').click();assert.equal(await input.inputValue(),'');
   await input.fill('8');await page.locator('#pause-button').click();assert.match(await page.locator('#modal-description').innerText(),/已完成 1 \/ 10 轮/);const paused=await state();await page.clock.fastForward(30000);assert.equal((await state()).remaining,paused.remaining);assert.equal((await state()).arithmetic.completed,1);await action('继续赶海');assert.equal(await input.inputValue(),'8');
   await restart();assert.equal((await state()).arithmetic.completed,0);assert.equal((await state()).arithmetic.wrongAnswers,0);assert.equal((await state()).remaining,90000);assert.equal(await input.inputValue(),'');
   for(let i=0;i<9;i++){assert.equal((await state()).arithmetic.round,i+1);await solve(answers[i]);assert.equal((await state()).arithmetic.completed,i+1);}
   assert.equal((await state()).state,'playing');assert.equal(await page.locator('#arithmetic-clues .arithmetic-equation').count(),3);assert.match(await page.locator('#arithmetic-question').innerText(),/\(/);assert.match(await page.locator('#arithmetic-question').innerText(),/×/);
   for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:1280,height:720},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.clock.runFor(30);
    assert.deepEqual(await page.evaluate(()=>{const s=document.querySelector('#play-screen').getBoundingClientRect();return [...document.querySelectorAll('.arithmetic-heading,.arithmetic-equation,.arithmetic-answer-row,.arithmetic-key,.arithmetic-feedback')].flatMap(n=>{const b=n.getBoundingClientRect();return b.width>0&&b.height>0&&b.left>=s.left-1&&b.right<=s.right+1&&b.top>=s.top-1&&b.bottom<=s.bottom+1?[]:[{class:n.className,box:b.toJSON(),screen:s.toJSON()}];});}),[],JSON.stringify(viewport));
   }
   await page.setViewportSize({width:390,height:844});await solve(answers[9]);assert.equal((await state()).state,'won');assert.equal((await state()).arithmetic.completed,10);await page.clock.runFor(1000);assert.equal(await page.locator('#modal-heading').innerText(),'挑战成功！');assert.equal(await page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels')),testing?'[45]':'[45,46]');
   await action('下一关');assert.equal((await state()).levelId,47);assert.equal(await page.locator('#modal-conditions').innerText(),'配对失败会使物品位置互换');await action('我知道了');await page.locator('#pause-button').click();await action('返回选关');assert.equal(await page.locator('#level-50').isDisabled(),!testing);
   await page.locator('#level-46').click();await ready();await page.clock.fastForward(85000);await solve(9);assert.equal((await state()).failureReason,'timeout');assert.equal((await state()).remaining,0);assert.equal((await state()).arithmetic.wrongAnswers,1);assert.equal((await state()).arithmetic.completed,0);await action('重新挑战');await ready();assert.equal((await state()).remaining,90000);
   await page.locator('#pause-button').click();await action('返回选关');await page.locator('#level-46').click();await ready();for(const answer of answers)await solve(answer);await page.clock.runFor(1000);await action('下一关');await action('我知道了');assert.equal((await state()).arithmetic,null);assert.equal(await page.locator('#arithmetic-panel').isVisible(),false);assert.equal(await page.locator('.tile').count(),36);assert.equal(await page.locator('.board-wrap').isVisible(),true);
   const ids=await page.locator('#board [id],#arithmetic-panel [id]').evaluateAll(ns=>ns.map(n=>n.id));assert.equal(ids.length,new Set(ids).size);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await context.close();
  }
  console.log('PASS: arithmetic file/HTTP, fifth→sixth→seventh, ten rounds and operators, five-second wrong-answer penalty and immediate penalty timeout, invalid retries, keypad/keyboard, no extra time, direct timed entry/pause/retry/timeout, five viewports, victory/progress isolation and return to matching. No screenshots.');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
