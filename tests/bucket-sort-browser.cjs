// Real input and DOM checks only. Never takes screenshots or changes a user profile.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createServer } = require('../scripts/serve.cjs');
const solution = require('./bucket-sort-solution.cjs');
const sixthSolution = require('./bucket-sort-six-solution.cjs');
(async () => {
  const root=path.resolve(__dirname,'..'), server=createServer(root);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch();
    for (const url of [pathToFileURL(path.join(root,'index.html')).href,`http://127.0.0.1:${server.address().port}/`]) {
      const context=await browser.newContext({ viewport:{width:390,height:844},reducedMotion:'reduce' });
      const page=await context.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.clock.install({time:new Date('2026-11-03T00:00:00Z')});
      await page.clock.pauseAt(new Date('2026-11-03T00:00:01Z'));
      await page.addInitScript(()=>localStorage.setItem('beach-pairs-unlock-all','on'));
      await page.goto(url);
      const state=()=>page.evaluate(()=>beachDiagnostics.snapshot());
      const action=name=>page.getByRole('button',{name,exact:true}).click();
      const bucket=i=>page.locator('.sort-bucket').nth(i);
      await page.locator('#select-level-button').click();
      for(let i=0;i<3;i++)await page.locator('#chapter-next').click();
      assert.equal(await page.locator('#chapter-4 .chapter-level:enabled').count(),10);
      assert.equal(await page.locator('#level-50').isDisabled(),false);
      assert.equal(await page.locator('#level-35').evaluate(el=>el.classList.contains('is-minigame')),true);
      await page.locator('#level-35').click();
      assert.equal((await state()).levelId,35);assert.equal((await state()).mode,'bucketSort');assert.equal((await state()).surf,null);
      assert.equal(await page.locator('#modal-heading').innerText(),'把收获分好类吧！');
      assert.equal(await page.locator('.sort-bucket').count(),6);assert.equal(await page.locator('.sort-slot .seaside-item').count(),16);
      assert.equal(await page.locator('.board-surf').count(),0);assert.equal(await page.locator('.collection').isVisible(),false);
      const initial=(await state()).bucketSort.buckets;
      await page.clock.fastForward(90000);assert.equal((await state()).remaining,60000);
      await bucket(0).dispatchEvent('click');assert.equal((await state()).bucketSort.source,null);
      await action('我知道了');
      for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:1280,height:720},{width:844,height:390}]) {
        await page.setViewportSize(viewport);await page.clock.runFor(30);
        const fit=await page.evaluate(()=>{
          const screen=document.querySelector('#play-screen').getBoundingClientRect();
          const nodes=[...document.querySelectorAll('.sort-bucket,.sort-slot,#sort-panel,#sort-rules,#pause-button')];
          return {overflow:document.documentElement.scrollWidth>innerWidth, outside:nodes.filter(el=>{const r=el.getBoundingClientRect();return r.width<=0||r.height<=0||r.left<screen.left-1||r.right>screen.right+1||r.top<screen.top-1||r.bottom>screen.bottom+1;}).map(el=>el.className||el.id)};
        });
        assert.equal(fit.overflow,false,JSON.stringify(viewport));assert.deepEqual(fit.outside,[],JSON.stringify(viewport));
      }
      await page.setViewportSize({width:390,height:844});await page.clock.runFor(30);
      await bucket(0).click();assert.equal((await state()).bucketSort.source,0);
      assert.equal(await page.locator('.sort-bucket.can-receive').count(),2);
      await bucket(1).click();assert.deepEqual((await state()).bucketSort.buckets,initial);assert.equal((await state()).bucketSort.source,1);assert.equal((await state()).turns,0);
      await bucket(0).click();assert.equal((await state()).bucketSort.source,0);
      await bucket(0).click();assert.equal((await state()).bucketSort.source,null);
      await bucket(0).focus();await page.keyboard.press('Enter');await bucket(4).focus();await page.keyboard.press('Enter');
      assert.deepEqual((await state()).bucketSort.buckets[4],[4]);assert.equal((await state()).turns,1);
      await page.clock.runFor(1000);const beforeUndo=await state();await action('撤回一步');
      assert.deepEqual((await state()).bucketSort.buckets,initial);assert.ok((await state()).remaining <= beforeUndo.remaining && (await state()).remaining >= beforeUndo.remaining - 30);assert.equal((await state()).bonusTime,0);
      await bucket(0).click();await page.locator('#pause-button').click();const paused=await state();
      assert.match(await page.locator('#modal-description').innerText(),/已整理 0 \/ 4 桶/);
      await page.clock.fastForward(30000);assert.equal((await state()).remaining,paused.remaining);
      await bucket(4).dispatchEvent('click');assert.deepEqual((await state()).bucketSort.buckets,initial);
      await action('继续赶海');assert.equal((await state()).bucketSort.source,0);await bucket(0).click();
      // Background switching freezes the same timer.
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
      assert.equal((await state()).state,'paused');await page.clock.fastForward(30000);
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
      await action('继续赶海');
      // A full timeout, then retry, returns to the fixed opening and reading state.
      await page.clock.fastForward(61000);assert.equal((await state()).state,'lost');
      assert.equal(await page.locator('#modal-heading').innerText(),'潮水先到了一步');await action('重新挑战');
      assert.deepEqual((await state()).bucketSort.buckets,initial);assert.equal((await state()).remaining,60000);assert.equal((await state()).turns,0);
      await action('我知道了');
      for(const [from,to]of solution){await bucket(from).click();await bucket(to).click();await page.clock.runFor(200);}
      await page.clock.runFor(1000);assert.equal((await state()).state,'won');assert.equal((await state()).bucketSort.sorted,4);
      assert.equal(await page.locator('#sort-count').innerText(),'4 / 4');assert.equal(await page.locator('.sort-check:visible').count(),4);
      assert.equal(await page.locator('#modal-heading').innerText(),'收获都分好类啦！');assert.equal(await page.locator('.sort-result .seaside-item').count(),16);
      assert.equal(await page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels')) ,'[35]');
      await action('下一关');assert.equal((await state()).levelId,36);assert.equal((await state()).modalOpen,false);
      assert.equal(await page.locator('.sort-bucket').count(),7);
      assert.equal((await state()).timerRunning,true);assert.equal(await page.locator('#modal-layer').isVisible(),false);
      assert.equal(await page.locator('#play-number').innerText(),'06');assert.equal(await page.locator('#sort-count').innerText(),'0 / 6');
      const sixth=(await state()).bucketSort.buckets;
      assert.deepEqual([0,1,2,3,4,5].map(kind=>sixth.flat().filter(value=>value===kind).length),[4,4,4,4,4,4]);
      assert.equal(await page.locator('.sort-slot .seaside-item').count(),24);
      await page.clock.runFor(1000);assert.ok((await state()).remaining<60000);
      for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:1280,height:720},{width:844,height:390}]) {
        await page.setViewportSize(viewport);await page.clock.runFor(30);
        assert.equal(await page.evaluate(()=>{
          const screen=document.querySelector('#play-screen').getBoundingClientRect();
          return document.documentElement.scrollWidth<=innerWidth && [...document.querySelectorAll('.sort-bucket,.sort-slot,#sort-panel')].every(el=>{
            const r=el.getBoundingClientRect();return r.width>0 && r.height>0 && r.left>=screen.left-1 && r.right<=screen.right+1 && r.top>=screen.top-1 && r.bottom<=screen.bottom+1;
          });
        }),true,JSON.stringify(viewport));
      }
      await page.setViewportSize({width:390,height:844});await page.clock.runFor(30);
      await bucket(0).click();await bucket(1).click();assert.equal((await state()).bucketSort.source,1);assert.deepEqual((await state()).bucketSort.buckets,sixth);assert.equal((await state()).turns,0);
      await bucket(0).click();assert.equal((await state()).bucketSort.source,0);await bucket(6).click();assert.deepEqual((await state()).bucketSort.buckets[6],[5]);
      await page.locator('#pause-button').click();const sixthPaused=await state();
      await page.clock.fastForward(30000);assert.equal((await state()).remaining,sixthPaused.remaining);
      await action('继续赶海');await action('撤回一步');assert.deepEqual((await state()).bucketSort.buckets,sixth);
      await page.locator('#pause-button').click();await action('重新开始');
      assert.equal((await state()).modalOpen,false);assert.equal((await state()).timerRunning,true);assert.equal((await state()).turns,0);
      assert.equal((await state()).bucketSort.history,0);assert.deepEqual((await state()).bucketSort.buckets,sixth);
      await page.clock.fastForward(61000);assert.equal((await state()).failureReason,'timeout');await action('重新挑战');
      assert.equal((await state()).modalOpen,false);assert.equal((await state()).state,'playing');assert.deepEqual((await state()).bucketSort.buckets,sixth);
      for(const [from,to]of sixthSolution){await bucket(from).click();await bucket(to).click();await page.clock.runFor(150);}
      await page.clock.runFor(1000);assert.equal((await state()).state,'won');assert.equal((await state()).bucketSort.sorted,6);
      assert.equal(await page.locator('#sort-count').innerText(),'6 / 6');assert.equal(await page.locator('.sort-result .seaside-item').count(),24);
      assert.equal(await page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels')) ,'[35,36]');
      await action('下一关');assert.equal((await state()).levelId,37);assert.equal((await state()).conditions.length,2);
      assert.equal(await page.locator('#modal-heading').innerText(),'本关胜利条件');assert.equal(await page.locator('.sort-bucket').count(),0);
      await action('我知道了');await page.locator('#pause-button').click();await action('返回选关');
      await page.locator('#level-36').click();assert.equal((await state()).modalOpen,false);assert.equal((await state()).timerRunning,true);
      assert.deepEqual((await state()).bucketSort.buckets,sixth);await page.locator('#pause-button').click();await action('返回选关');await page.locator('#level-34').click();
      assert.equal(await page.locator('#sort-panel').isVisible(),false);assert.equal(await page.locator('.sort-bucket').count(),0);assert.equal(await page.locator('.board-surf').count(),2);
      assert.deepEqual(errors,[]);await context.close();
    }
    // Normal play reaches the new minigame from level 34 and saves a genuine win.
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
    await page.clock.install();await page.addInitScript(()=>localStorage.setItem('beach-pairs-completed-levels','[34]'));
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.locator('#select-level-button').click();for(let i=0;i<3;i++)await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#level-35').isDisabled(),false);await page.locator('#level-34').click();await page.getByRole('button',{name:'我知道了',exact:true}).click();
    const deck=await page.locator('.tile .seaside-item').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.kind)));
    for(const kind of [0,1,2,3,4,5])for(let i=0;i<deck.length;i++)if(deck[i]===kind)await page.locator('.tile').nth(i).click();
    await page.clock.runFor(1200);await page.getByRole('button',{name:'下一关',exact:true}).click();
    assert.equal((await page.evaluate(()=>beachDiagnostics.snapshot())).levelId,35);await page.getByRole('button',{name:'我知道了',exact:true}).click();
    for(const [from,to]of solution){await page.locator('.sort-bucket').nth(from).click();await page.locator('.sort-bucket').nth(to).click();}
    await page.clock.runFor(1000);assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels'))),[34,35]);
    await page.getByRole('button',{name:'下一关',exact:true}).click();
    assert.equal((await page.evaluate(()=>beachDiagnostics.snapshot())).levelId,36);
    assert.equal((await page.evaluate(()=>beachDiagnostics.snapshot())).modalOpen,false);
    for(const [from,to]of sixthSolution){await page.locator('.sort-bucket').nth(from).click();await page.locator('.sort-bucket').nth(to).click();}
    await page.clock.runFor(1000);assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels'))),[34,35,36]);
    await page.getByRole('button',{name:'返回选关',exact:true}).click();assert.equal(await page.locator('#level-35').isDisabled(),false);assert.equal(await page.locator('#level-36').isDisabled(),false);
    await context.close();
    console.log('PASS: file/HTTP entry, four/six-kind sorting, sixth starts/retries without popup, sixth pause/undo/timeout/win and five viewports, legal/illegal and keyboard inputs, undo, five viewport sizes, intro/pause/background/retry/timeout, complete win, fourth-to-fifth transition, normal save and test progress isolation. No screenshots.');
  } finally { if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
