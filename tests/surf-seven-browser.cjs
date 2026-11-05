// Functional checks only; isolated browser contexts, no screenshots.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createServer } = require('../scripts/serve.cjs');
const sixthSolution = require('./bucket-sort-six-solution.cjs');
const labels=['倒数第三对配对必须是八爪鱼','倒数第二对配对必须是海螺'];
(async()=>{
  const root=path.resolve(__dirname,'..'),server=createServer(root);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try {
    browser=await chromium.launch();
    for(const [url,testing] of [[pathToFileURL(path.join(root,'index.html')).href,true],[`http://127.0.0.1:${server.address().port}/`,false]]) {
      const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.clock.install({time:new Date('2026-11-03T00:00:00Z')});await page.clock.pauseAt(new Date('2026-11-03T00:00:01Z'));
      await page.addInitScript(testing=>{
        if(testing)localStorage.setItem('beach-pairs-unlock-all','on');else localStorage.setItem('beach-pairs-completed-levels','[36]');
        window.surfDraws=[];Math.random=()=>window.surfDraws.length?window.surfDraws.shift():0;
      },testing);
      await page.goto(url);
      const state=()=>page.evaluate(()=>beachDiagnostics.snapshot()),action=name=>page.getByRole('button',{name,exact:true}).click();
      const tile=i=>page.locator('.tile').nth(i);
      const checked=()=>page.locator('#play-conditions .condition-item').evaluateAll(nodes=>nodes.map(node=>node.dataset.completed==='true'));
      const checkConditions=async id=>{
        assert.deepEqual(await page.locator(`#${id} .condition-item`).allInnerTexts(),labels);
        assert.deepEqual(await page.locator(`#${id} .condition-item-icon .seaside-item`).evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.kind))),[3,4]);
      };
      await page.locator('#select-level-button').click();for(let i=0;i<3;i++)await page.locator('#chapter-next').click();
      assert.equal(await page.locator('#level-50').isDisabled(),!testing);
      assert.equal(await page.locator('#chapter-4 .chapter-level:enabled').count(),testing?10:1);
      assert.equal(await page.locator('#level-37').evaluate(node=>node.classList.contains('is-minigame')),false);
      await page.locator('#level-36').click();assert.equal((await state()).modalOpen,false);
      for(const [from,to]of sixthSolution){await page.locator('.sort-bucket').nth(from).click();await page.locator('.sort-bucket').nth(to).click();}
      await page.clock.runFor(1000);await action('下一关');
      assert.equal((await state()).levelId,37);assert.equal((await state()).bucketSort,null);assert.equal(await page.locator('#play-number').innerText(),'07');
      assert.equal(await page.locator('.tile').count(),36);assert.equal(await page.locator('.board-surf').count(),2);assert.equal(await page.locator('.sort-bucket').count(),0);
      assert.equal(await page.locator('#sort-panel').isVisible(),false);assert.equal(await page.locator('.collection').isVisible(),true);
      assert.equal(await page.locator('#modal-heading').innerText(),'本关胜利条件');await checkConditions('modal-conditions');await checkConditions('play-conditions');
      const deck=await page.locator('.tile .seaside-item').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.kind)));
      assert.deepEqual([0,1,2,3,4,5].map(kind=>deck.filter(value=>value===kind).length),[6,6,6,6,6,6]);
      const pairs=[0,1,2,3,4,5].flatMap(kind=>{const cells=deck.flatMap((value,i)=>value===kind?[i]:[]);return [0,2,4].map(i=>({kind,cells:cells.slice(i,i+2)}));});
      const octopus=pairs.find(pair=>pair.kind===3),conch=pairs.find(pair=>pair.kind===4),last=pairs.find(pair=>pair.kind===5);
      const order=[...pairs.filter(pair=>![octopus,conch,last].includes(pair)),octopus,conch,last];
      const match=async pair=>{for(const index of pair.cells)await tile(index).click();};
      await page.clock.fastForward(90000);assert.equal((await state()).remaining,60000);assert.equal((await state()).surf.time,0);
      await action('我知道了');await page.locator('#pause-button').click();await checkConditions('modal-conditions');await action('继续赶海');
      const advance=async time=>page.clock.runFor(Math.max(0,time-(await state()).surf.time)+20);
      await page.evaluate(()=>window.surfDraws=[0,.99]);await advance(12100);assert.equal((await state()).surf.phase,'warning');assert.equal(await page.locator('.surf-warning:visible').count(),2);
      await advance(14900);const before=await state();await advance(15100);const wave=await state();
      assert.equal(wave.surf.phase,'arriving');assert.deepEqual(wave.surf.targets,[{axis:'row',index:0},{axis:'column',index:5}]);
      assert.equal(before.remaining-wave.remaining-(wave.surf.time-before.surf.time),6000);assert.equal(wave.surf.covered.filter(Boolean).length,11);
      for(let i=0;i<36;i++)if(wave.surf.covered[i])await tile(i).dispatchEvent('click');
      assert.equal((await state()).pairs,0);assert.equal((await state()).mismatches,0);assert.deepEqual(await checked(),[false,false]);
      await page.locator('#pause-button').click();const paused=await state();await page.clock.fastForward(30000);
      assert.equal((await state()).remaining,paused.remaining);assert.deepEqual((await state()).surf.targets,paused.surf.targets);await action('继续赶海');
      for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:1280,height:720},{width:844,height:390}]) {
        await page.setViewportSize(viewport);await page.clock.runFor(30);
        const outside=await page.evaluate(()=>{
          const screen=document.querySelector('#play-screen').getBoundingClientRect();
          return [...document.querySelectorAll('.tile,#level-objectives,.collection,#pause-button')].filter(node=>{const r=node.getBoundingClientRect();return r.width<=0||r.height<=0||r.left<screen.left-1||r.right>screen.right+1||r.top<screen.top-1||r.bottom>screen.bottom+1;}).map(node=>node.id||node.className);
        });assert.deepEqual(outside,[],JSON.stringify(viewport));
      }
      await page.setViewportSize({width:390,height:844});await page.clock.runFor(30);await advance(22250);
      assert.equal((await state()).surf.phase,'calm');
      // Wrong order is reported after collection, not as a timeout or a premature failure.
      const swapped=[...order.slice(0,15),conch,octopus,last];for(const pair of swapped)await match(pair);
      await page.clock.runFor(1000);assert.equal((await state()).failureReason,'conditions');assert.equal((await state()).pairs,18);
      assert.equal(await page.locator('#modal-heading').innerText(),'未完成全部的条件');assert.match(await page.locator('#modal-description').innerText(),/八爪鱼/);assert.match(await page.locator('#modal-description').innerText(),/海螺/);
      await action('重新挑战');await checkConditions('modal-conditions');assert.equal((await state()).remaining,60000);assert.equal((await state()).surf.count,0);assert.deepEqual(await checked(),[false,false]);
      assert.deepEqual(await page.locator('.tile .seaside-item').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.kind))),deck);await action('我知道了');
      for(const pair of order.slice(0,15))await match(pair);assert.equal((await state()).pairs,15);assert.deepEqual(await checked(),[false,false]);
      await match(octopus);assert.equal((await state()).pairs,16);assert.deepEqual(await checked(),[true,false]);
      await page.locator('#pause-button').click();await checkConditions('modal-conditions');
      assert.deepEqual(await page.locator('#modal-conditions .condition-item').evaluateAll(nodes=>nodes.map(node=>node.dataset.completed)),['true','false']);
      await page.clock.fastForward(30000);await action('继续赶海');await match(conch);assert.equal((await state()).pairs,17);assert.deepEqual(await checked(),[true,true]);
      await match(last);await page.clock.runFor(1000);assert.equal((await state()).state,'won');
      assert.equal(await page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels')),testing?null:'[36,37]');
      await action('下一关');assert.equal((await state()).levelId,38);assert.equal((await state()).conditions.length,1);
      assert.equal(await page.locator('#modal-heading').innerText(),'本关胜利条件');assert.equal((await state()).conditions[0].label,'在2秒内完成2次配对');
      await action('我知道了');await page.locator('#pause-button').click();await action('返回选关');
      await page.locator('#level-37').click();await checkConditions('modal-conditions');assert.equal((await state()).remaining,60000);
      assert.deepEqual(errors,[]);await context.close();
    }
    console.log('PASS: file/HTTP, sixth-to-seventh transition and matching cleanup, 6x6 six-kind deck, both condition texts/icons in entry/play/pause, frozen reading, double surf and 6s penalty, covered invalid clicks, five viewport sizes, incorrect-order failure, independent ticks at pairs 16/17, retry and correct win, normal/test progress isolation. No screenshots.');
  } finally {if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
