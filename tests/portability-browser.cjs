// Exercises file:// and HTTP. No screenshots or previews are generated.
const { chromium, loadPlaywright } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createServer } = require('../scripts/serve.cjs');
(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    const engine = process.env.BEACH_SMOKE_BROWSER || 'chromium';
    if (!['chromium','webkit'].includes(engine)) throw new Error('BEACH_SMOKE_BROWSER must be chromium or webkit.');
    browser = await (engine === 'webkit' ? loadPlaywright().webkit.launch({headless:true}) : chromium.launch());
    const urls = [pathToFileURL(path.resolve(__dirname,'..','index.html')).href, `http://127.0.0.1:${server.address().port}/`];
    for (const url of urls) {
      const page = await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}), errors=[], external=[], failed=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('request',request=>{if(/^https?:/.test(request.url()) && new URL(request.url()).hostname!=='127.0.0.1')external.push(request.url());});
      page.on('requestfailed',request=>failed.push(request.url()));
      await page.clock.install({time:new Date('2026-11-01T00:00:00Z')});
      await page.clock.pauseAt(new Date('2026-11-01T00:00:01Z'));
      await page.goto(url);
      const state=()=>page.evaluate(()=>beachDiagnostics.snapshot());
      const action=name=>page.getByRole('button',{name,exact:true}).click();
      const back=async()=>{await page.locator('#pause-button').click();await action('返回选关');};
      assert.equal(await page.locator('#menu-screen').isVisible(),true);
      await page.locator('#start-button').click(); await action('跳过教程');
      await page.locator('.tile').nth(0).click();await page.locator('.tile').nth(3).click();
      assert.equal((await state()).pairs,1);
      await back();await page.locator('#level-screen [data-menu]').click();
      await page.locator('#settings-button').click();await page.locator('#unlock-switch').click();
      await page.locator('#settings-screen [data-menu]').click();await page.locator('#select-level-button').click();
      assert.equal(await page.locator('.chapter-level:enabled').count(),32);
      assert.equal(await page.locator('#level-33').isDisabled(),true);
      await page.locator('#level-5').click(); await action('我知道了');
      assert.equal((await state()).mode,'diagonalPuzzle');
      await page.locator('.puzzle-cell').nth(1).click();assert.equal((await state()).filledCount,3);
      await back();await page.locator('#chapter-next').click();
      await page.locator('#level-11').click();await action('我知道了');
      assert.equal((await state()).fog.filter(Boolean).length,12);
      await page.locator('.tile').nth(0).click();assert.equal((await state()).fog[0].covered,false);
      await page.locator('.tile').nth(0).click();assert.equal((await state()).statuses[0],'open');
      await back();await page.locator('#level-15').click();await action('我知道了');
      assert.equal((await state()).journey.phase,'preview');await page.clock.runFor(5020);
      assert.equal((await state()).journey.phase,'exploring');
      await back();await page.locator('#chapter-next').click();
      await page.locator('#level-21').click();await action('我知道了');
      assert.equal((await state()).seagrass.filter(card=>card.grass).length,8);
      await back();await page.locator('#level-25').click();await action('我知道了');
      for(const index of [0,4,5,7,10,11,12,15,18,23])await page.locator('.grass-cell').nth(index).click();
      assert.equal((await state()).state,'won');assert.equal((await state()).grassPuzzle.remaining,0);
      await page.clock.runFor(1000);await action('返回选关');await page.locator('#chapter-next').click();await page.locator('#level-31').click();
      assert.equal((await state()).levelId,31);assert.equal((await state()).surf.time,0);
      await action('我知道了');await page.clock.runFor(17100);
      assert.equal((await state()).surf.phase,'warning');await page.clock.runFor(3000);
      assert.equal((await state()).surf.phase,'arriving');assert.equal((await state()).surf.count,1);
      assert.equal((await state()).surf.covered.filter(Boolean).length,6);
      await back();await page.locator('#level-32').click();
      assert.equal((await state()).levelId,32);assert.equal((await state()).conditions[0].type,'timedPairs');
      assert.equal(await page.locator('#modal-conditions').innerText(),'在5秒内完成3次配对');
      assert.equal((await state()).timerRunning,false);await action('我知道了');
      const secondDeck=await page.locator('.tile .seaside-item').evaluateAll(items=>items.map(item=>Number(item.dataset.kind)));
      assert.deepEqual([0,1,2,3,4,5].map(kind=>secondDeck.filter(value=>value===kind).length),[6,6,6,6,6,6]);
      for(const kind of [0,1,2]) {
        const indices=secondDeck.flatMap((value,i)=>value===kind?[i]:[]).slice(0,2);
        for(const index of indices)await page.locator('.tile').nth(index).click();
      }
      assert.equal((await state()).conditions[0].completed,true);


      assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(failed,[]);
      assert.equal(await page.evaluate(()=>localStorage.getItem('beach-pairs-completed-levels')),null);
      await page.close();
      console.log(`PASS ${engine}: ${new URL(url).protocol} entry, matching, settings/unlock, picture puzzle, fog, journey, grass matching, grass puzzle victory and surf row/column warning/arrival and surf-two timed-pair condition; no external dependencies.`);
    }
  } finally {
    if(browser)await browser.close();
    await new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
