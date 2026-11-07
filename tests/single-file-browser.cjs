// Verify the delivered export with no sibling assets, including an opaque origin.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('./browser-support.cjs');

(async () => {
  const html = fs.readFileSync(path.join(__dirname, '../release/index1.html'), 'utf8');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'beach-single-'));
  const entry = path.join(directory, 'index.html');
  fs.writeFileSync(entry, html);
  const browser = await chromium.launch();
  try {
    for (const opaque of process.env.BEACH_SINGLE_OPAQUE_ONLY === '1' ? [true] : [false, true]) {
      const context = await browser.newContext({ offline: true, reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
      const page = await context.newPage(), errors = [], dependencies = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.resourceType() !== 'document' && !request.url().startsWith('data:')) dependencies.push(request.url()); });
      await page.clock.install({ time: new Date('2026-11-06T00:00:00Z') });
      await page.clock.pauseAt(new Date('2026-11-06T00:00:01Z'));
      if (opaque) {
        // Keep the navigation URL small even when embedded music makes HTML >10MB.
        await page.goto('data:text/html,<script>addEventListener("message",e=>{document.open();document.write(e.data);document.close()},{once:true})</script>');
        await page.evaluate(contents => window.postMessage(contents, '*'), html);
        await page.locator('#start-button').waitFor();
      } else await page.goto(pathToFileURL(entry).href);
      assert.equal(await page.title(), '赶赶嗨嗨！');
      assert.equal(await page.locator('.menu-panel').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 248, 233)');
      assert.equal(await page.locator('.beach-grass').first().evaluate(node => getComputedStyle(node).position), 'absolute');
      assert.ok((await page.locator('.beach-grass').first().boundingBox()).width < 200);
      const action = name => page.getByRole('button', { name, exact: true }).click();
      const state = () => page.evaluate(() => beachDiagnostics.snapshot());
      await page.locator('#start-button').click(); await action('跳过教程');
      await page.locator('.tile').nth(0).click(); await page.locator('.tile').nth(3).click();
      assert.equal((await state()).pairs, 1);
      await page.locator('#pause-button').click(); await action('返回选关');
      await page.locator('#level-screen [data-menu]').click();
      await page.locator('#settings-button').click(); await page.locator('#unlock-switch').click();
      await page.locator('#settings-screen [data-menu]').click(); await page.locator('#select-level-button').click();
      assert.equal(await page.locator('.chapter-level:enabled').count(), 50);
      let chapter = 1;
      for (const id of opaque ? [46, 47, 50] : Array.from({ length: 50 }, (_, i) => i + 1)) {
        while (chapter < Math.ceil(id / 10)) { await page.locator('#chapter-next').click(); chapter++; }
        await page.locator(id === 1 ? '#level-one' : `#level-${id}`).click();
        const skip = page.getByRole('button', { name: '跳过教程', exact: true });
        if (await skip.isVisible()) await skip.click();
        const confirm = page.getByRole('button', { name: '我知道了', exact: true });
        if (await confirm.isVisible()) await confirm.click();
        assert.equal((await state()).levelId, id);
        if (id === 46) { assert.equal((await state()).mode, 'arithmetic'); assert.equal((await state()).duration, 120000); }
        if (id === 47) { assert.equal((await state()).conditions[0].type, 'mismatchSwap'); assert.deepEqual((await state()).seagrass.flatMap((c, i) => c.grass ? [i] : []), [2, 8, 14, 20, 26, 32]); }
        if (id === 50) {
          await page.clock.fastForward(180000); assert.equal((await state()).progress, 0);
          await page.locator('.tile').nth(0).click(); await page.locator('.tile').nth(1).click();
          await page.clock.runFor(1000);
          assert.equal(await page.locator('#modal-heading').innerText(), '感谢你的时间和精力！');
          assert.match(await page.locator('#modal-description').innerText(), /拷问AI半个月/);
          await action('返回选关');
        } else { await page.locator('#pause-button').click(); await action('返回选关'); }
      }
      assert.deepEqual(dependencies, []); assert.deepEqual(errors, []);
      console.log(`PASS ${opaque ? 'opaque data origin (storage unavailable)' : 'isolated file with all 50 entries'}: offline inline CSS/JS, styled menu/grass, matching, EX6/7, hearts, no sibling requests. No screenshots.`);
      await context.close();
    }
  } finally { await browser.close(); fs.rmSync(directory, { recursive: true, force: true }); }
})().catch(error => { console.error(String(error.message).slice(0, 1500)); process.exitCode = 1; });
