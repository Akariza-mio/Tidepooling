// Functional checks only. No screenshots, previews or archives.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async()=>{
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await page.clock.install({time:new Date('2026-10-30T00:00:00Z')});
    await page.clock.pauseAt(new Date('2026-10-30T00:00:01Z'));
    await page.addInitScript(()=>localStorage.setItem('beach-pairs-unlock-all','on'));
    await page.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);
    await page.emulateMedia({reducedMotion:'reduce'});
    const state=()=>page.evaluate(()=>beachDiagnostics.snapshot());
    const action=name=>page.getByRole('button',{name,exact:true}).click();
    const flip=async(a,b)=>{await page.locator('.tile').nth(a).click();await page.locator('.tile').nth(b).click();};
    const label='海草覆盖的格子不能超过10格';
    const liveLabel=n=>`海草覆盖的格子不能超过 ${n} / 10 格`;
    const grass=async()=>(await state()).seagrass.flatMap((card,i)=>card.grass?[i]:[]);
    await page.locator('#select-level-button').click();
    await page.locator('#chapter-next').click();await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#level-24').isEnabled(),true);
    assert.equal(await page.locator('#level-35').isDisabled(),true);
    await page.locator('#level-24').click();
    assert.equal(await page.locator('#play-number').innerText(),'04');
    assert.equal(await page.locator('.tile').count(),36);
    assert.deepEqual(await grass(),[7,16,26]);
    assert.equal(await page.locator('#modal-art .notice-board-art').count(),1);
    assert.equal(await page.locator('#modal-conditions').innerText(),label);
    assert.equal(await page.locator('#play-conditions').innerText(),liveLabel(3));
    await page.clock.fastForward(30000);assert.equal((await state()).remaining,60000);
    const deck=await page.locator('.tile .seaside-item').evaluateAll(items=>items.map(item=>Number(item.dataset.kind)));
    await action('我知道了');
    for(const viewport of [{width:320,height:568},{width:390,height:844}]) {
      await page.setViewportSize(viewport);await page.clock.runFor(32);
      assert.equal(await page.evaluate(()=>{
        const rect=id=>document.getElementById(id).getBoundingClientRect();
        const app=rect('app'),rule=rect('level-objectives'),board=rect('board');
        const bucket=document.querySelector('.collection').getBoundingClientRect();
        return rule.bottom<=board.top && board.bottom<=bucket.top && bucket.bottom<=app.bottom+1 && document.documentElement.scrollWidth<=innerWidth;
      }),true,JSON.stringify(viewport));
    }
    await flip(7,35);assert.equal(await page.locator('#play-conditions').innerText(),liveLabel(7));
    await page.clock.runFor(520);
    assert.match(await page.locator('.tile').nth(7).getAttribute('aria-label'),/紫色交叉海草/);
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-conditions').innerText(),liveLabel(7));
    const paused=await state();await page.clock.fastForward(30000);
    assert.equal((await state()).activeTime,paused.activeTime);
    await action('继续赶海');await flip(16,35);
    assert.equal((await state()).state,'lost');assert.equal((await state()).failureReason,'conditions');
    assert.equal((await state()).conditions[0].current,11);
    assert.equal((await state()).statuses[16],'open');
    assert.equal(await page.locator('#modal-heading').innerText(),'未完成全部的条件');
    assert.equal(await page.locator('#modal-art .condition-failure-art').count(),1);
    assert.match(await page.locator('#modal-description').innerText(),/11 \/ 10 格/);
    assert.equal(await page.locator('#modal-card').evaluate(element=>element.classList.contains('immediate-result')),true);
    await action('重新挑战');assert.deepEqual(await grass(),[7,16,26]);
    assert.equal(await page.locator('#modal-conditions').innerText(),label);
    assert.deepEqual(await page.locator('.tile .seaside-item').evaluateAll(items=>items.map(item=>Number(item.dataset.kind))),deck);
    await action('我知道了');
    await flip(7,1);await page.clock.runFor(520);await flip(16,35);
    assert.equal((await state()).state,'playing');assert.equal((await state()).conditions[0].current,10);
    assert.equal(await page.locator('#play-conditions').innerText(),liveLabel(10));
    await page.clock.runFor(520);await flip(6,8);
    assert.equal(await page.locator('#play-conditions').innerText(),liveLabel(8));
    assert.equal(await page.locator('#play-conditions .condition-item').getAttribute('data-completed'),'false');
    await page.clock.fastForward(10000);
    for(const kind of [0,1,2,4,5]) for(let i=0;i<deck.length;i++) if(deck[i]===kind && (await state()).statuses[i]!=='matched') await page.locator('.tile').nth(i).click();
    await page.clock.runFor(800);
    assert.equal((await state()).state,'won');assert.equal((await state()).pairs,18);
    assert.equal((await state()).conditions[0].current,0);assert.equal((await state()).conditions[0].completed,true);
    assert.equal(await page.locator('#modal-art .bucket-find').count(),18);
    assert.ok((await state()).remaining<=60000);assert.deepEqual(errors,[]);
    console.log('PASS: reef-fourth exact three-cell pattern, all rule placements, live count, purple lock/pause, instant eleven-cell failure, ten-cell allowance, count reduction, fixed retry and full victory. No images captured.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
