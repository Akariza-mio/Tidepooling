// Functional checks only; no screenshots or archives.
const { chromium } = require('C:/Users/29781/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true });
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({time:new Date('2026-10-30T00:00:00Z')});
    await page.clock.pauseAt(new Date('2026-10-30T00:00:01Z'));
    await page.addInitScript(() => localStorage.setItem('beach-pairs-unlock-all','on'));
    await page.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);
    await page.emulateMedia({reducedMotion:'reduce'});
    const state = () => page.evaluate(() => beachDiagnostics.snapshot());
    const action = name => page.getByRole('button',{name,exact:true}).click();
    const label = '在5秒内完成3次配对';
    const initialGrass = [2,8,12,13,14,15,16,17,20,26,32];
    const checked = container => page.locator('#'+container+' .condition-item').getAttribute('data-completed');
    await page.locator('#select-level-button').click();
    await page.locator('#chapter-next').click(); await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#level-23').isEnabled(),true);
    assert.equal(await page.locator('#level-31').isDisabled(),true);
    await page.locator('#level-23').click();
    assert.equal(await page.locator('#play-number').innerText(),'03');
    assert.equal(await page.locator('#modal-art .notice-board-art').count(),1);
    assert.equal(await page.locator('#modal-conditions').innerText(),label);
    assert.deepEqual((await state()).seagrass.flatMap((cell,i)=>cell.grass?[i]:[]),initialGrass);
    const deck = await page.locator('.tile .seaside-item').evaluateAll(items=>items.map(item=>Number(item.dataset.kind)));
    const pairs = [0,1,2,4,5].flatMap(kind => {
      const indices = deck.flatMap((value,i)=>value===kind?[i]:[]);
      return Array.from({length:indices.length/2},(_,i)=>indices.slice(i*2,i*2+2));
    });
    const match = async n => { for(const index of pairs[n]) await page.locator('.tile').nth(index).click(); };
    await page.clock.fastForward(30000); assert.equal((await state()).remaining,60000);
    await action('我知道了'); await page.clock.fastForward(6000);
    await match(0); await page.clock.fastForward(1000); await match(1);
    assert.equal(await checked('play-conditions'),'false');
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-conditions').innerText(),label);
    const paused = await state(); await page.clock.fastForward(30000);
    assert.equal((await state()).activeTime,paused.activeTime);
    await action('继续赶海'); await page.clock.fastForward(1000); await match(2);
    assert.equal(await checked('play-conditions'),'true');
    await page.locator('#pause-button').click(); assert.equal(await checked('modal-conditions'),'true');
    await action('重新开始'); assert.equal(await checked('play-conditions'),'false');
    assert.deepEqual((await state()).seagrass.flatMap((cell,i)=>cell.grass?[i]:[]),initialGrass);
    assert.deepEqual(await page.locator('.tile .seaside-item').evaluateAll(items=>items.map(item=>Number(item.dataset.kind))),deck);
    await action('我知道了');
    for(let i=0;i<pairs.length;i++) { if(i) await page.clock.fastForward(3100); await match(i); }
    await page.clock.runFor(800);
    assert.equal((await state()).state,'lost'); assert.equal((await state()).failureReason,'conditions');
    assert.equal(await page.locator('#modal-heading').innerText(),'未完成全部的条件');
    assert.equal(await page.locator('#modal-art .condition-failure-art').count(),1);
    await action('重新挑战'); await action('我知道了');
    for(let i=0;i<pairs.length;i++) await match(i);
    await page.clock.runFor(800);
    assert.equal((await state()).state,'won'); assert.equal((await state()).pairs,18);
    assert.ok((await state()).remaining<=60000); assert.deepEqual(errors,[]);
    await action('下一关');
    assert.equal((await state()).levelId,24);
    assert.equal(await page.locator('#modal-conditions').innerText(),'海草覆盖的格子不能超过10格');
    assert.deepEqual((await state()).seagrass.flatMap((cell,i)=>cell.grass?[i]:[]),[7,16,26]);
    console.log('PASS: reef-third eleven-cell grass cross, all three condition displays, untimed entry, rolling window with pause exclusion, checkmarks, fixed retry, unmet-condition red cross and full victory. No images captured.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
