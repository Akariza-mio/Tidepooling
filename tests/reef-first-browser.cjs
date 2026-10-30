// Functional checks only; no screenshots, previews or archives.
const { chromium } = require('C:/Users/29781/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.addInitScript(() => localStorage.setItem('beach-pairs-unlock-all', 'on'));
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const state = () => page.evaluate(() => beachDiagnostics.snapshot());
    const action = name => page.getByRole('button', { name, exact: true }).click();
    const tile = index => page.locator('.tile').nth(index);
    const initialGrass = [2,5,7,10,12,15,20,23,25,28,30,33];
    await page.locator('#select-level-button').click();
    await page.locator('#chapter-next').click(); await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#level-21').isEnabled(), true);
    assert.equal(await page.locator('#level-22').isDisabled(), true);
    await page.locator('#level-21').click();
    assert.equal(await page.locator('#play-chapter').innerText(), '礁间寻宝');
    assert.equal(await page.locator('#play-number').innerText(), '01');
    assert.equal(await page.locator('#modal-heading').innerText(), '当太阳升起，你发现自己到了礁石岸边！');
    assert.match(await page.locator('#modal-description').innerText(), /被海草覆盖的格子可以直接翻开，如果配对成功则会正常消除/);
    assert.match(await page.locator('#modal-description').innerText(), /如果配对失败，一段时间内该格将被海草缠绕，不可再翻开，且四面相邻的格子都会被海草覆盖/);
    assert.equal(await page.locator('#modal-art svg').count(), 1);
    assert.equal(await page.locator('.tile').count(), 36);
    assert.deepEqual((await state()).seagrass.flatMap((card, i) => card.grass ? [i] : []), initialGrass);
    const deck = await page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => Number(icon.dataset.kind)));
    for (const viewport of [{width:320,height:568}, {width:390,height:844}]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.locator('#modal-card').evaluate(element => {
        const box = element.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight && element.scrollWidth <= element.clientWidth;
      }), true, JSON.stringify(viewport));
    }
    await page.clock.fastForward(30000); assert.equal((await state()).remaining, 60000);
    await action('我知道了');
    await tile(2).click(); await tile(3).click();
    assert.equal((await state()).seagrass[3].grass, false);
    assert.equal((await state()).seagrass[1].grass, true);
    assert.equal((await state()).seagrass[8].grass, true);
    await page.clock.runFor(520);
    assert.equal(await tile(2).isDisabled(), true);
    assert.match(await tile(2).getAttribute('aria-label'), /紫色交叉海草/);
    await page.locator('#pause-button').click(); await action('重新开始');
    assert.deepEqual((await state()).seagrass.flatMap((card, i) => card.grass ? [i] : []), initialGrass);
    assert.deepEqual(await page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => Number(icon.dataset.kind))), deck);
    assert.equal((await state()).remaining, 60000);
    await action('我知道了');
    for (const kind of [0,1,2,4,5]) for (let i = 0; i < deck.length; i++) if (deck[i] === kind) await tile(i).click();
    await page.clock.runFor(800);
    assert.equal((await state()).state, 'won'); assert.equal((await state()).pairs, 18);
    assert.equal(await page.locator('#modal-art .bucket-find').count(), 18);
    assert.deepEqual(errors, []);
    console.log('PASS: authored reef-first board, twelve marked grass cells, readable untimed entry popup, restricted propagation, purple lock, fixed retry and full victory. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
