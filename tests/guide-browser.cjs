// Read-only field-guide navigation and responsive layout; never captures screenshots.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require('./browser-support.cjs');
const { createServer } = require('../scripts/serve.cjs');
const titles = ['基本玩法', '迷雾', '海草', '海浪', '填图挑战', '迷雾寻物', '海草翻转', '分类装桶', '老虎机', '数学而已'];
const viewports = [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }, { width: 1280, height: 720 }];

(async () => {
  const root = path.resolve(__dirname, '..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'beach-guide-'));
  fs.copyFileSync(path.join(root, 'release/index1.html'), path.join(temp, 'index.html'));
  const server = createServer(root);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    for (const kind of ['file', 'http', 'single']) {
      const context = await browser.newContext({ reducedMotion: 'reduce', offline: kind === 'single' });
      for (const viewport of viewports) {
        const page = await context.newPage(), errors = [], requests = [];
        await page.setViewportSize(viewport);
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => {
          if (request.resourceType() === 'document' || request.url().startsWith('data:')) return;
          if (kind === 'single' || (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1')) requests.push(request.url());
        });
        await page.clock.install();
        await page.goto(kind === 'single' ? pathToFileURL(path.join(temp, 'index.html')).href : kind === 'http' ? `http://127.0.0.1:${server.address().port}/` : pathToFileURL(path.join(root, 'index.html')).href);
        const state = () => page.evaluate(() => {
          const s = beachDiagnostics.snapshot();
          return { levelId: s.levelId, state: s.state, pairs: s.pairs, elapsed: s.elapsed, turns: s.turns };
        });
        const before = await state();
        const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
        assert.equal(await page.locator('#settings-button,#settings-screen').count(), 0);
        assert.equal(await page.locator('#menu-screen .menu-tool:visible').count(), 3);
        await page.locator('#guide-button').click(); await page.keyboard.press('Escape');
        assert.equal(await page.locator('.setting-switch').count(), 2);
        await page.locator('#music-switch').click();
        await page.locator('#sound-switch').click();
        await page.locator('#guide-button').click();
        assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().screen), 'guide');
        const previous = page.locator('#guide-previous'), next = page.locator('#guide-next');
        for (let i = 0; i < titles.length; i++) {
          assert.equal(await page.locator('#guide-title').innerText(), titles[i]);
          assert.equal(await page.locator('#guide-page-count').innerText(), `${i + 1} / 10`);
          assert.equal(await previous.isDisabled(), i === 0);
          assert.equal(await next.isDisabled(), i === 9);
          assert.equal(await page.locator('#guide-copy section').count(), i === 6 || i === 9 ? 1 : [1, 2, 7, 8].includes(i) ? 2 : 3);
          assert.ok(await page.locator('#guide-art svg').count() > 0);
          const layout = await page.evaluate(() => {
            const article = document.getElementById('guide-page'), nav = document.querySelector('.guide-nav');
            const a = article.getBoundingClientRect(), n = nav.getBoundingClientRect(), app = document.getElementById('app').getBoundingClientRect();
            const art = document.getElementById('guide-art').getBoundingClientRect();
            article.scrollTop = article.scrollHeight;
            const last = document.querySelector('#guide-copy section:last-child').getBoundingClientRect();
            const out = { page: article.dataset.page, viewport: [innerWidth, innerHeight], readable: a.height > 80 && last.bottom <= a.bottom + 1, contained: n.left >= app.left && n.right <= app.right && n.bottom <= app.bottom && n.top >= a.bottom - 1, fits: article.scrollWidth <= article.clientWidth + 1 && art.left >= a.left && art.right <= a.right, scroll: document.documentElement.scrollWidth <= innerWidth };
            article.scrollTop = 0;
            return out;
          });
          assert.ok(layout.readable && layout.contained && layout.fits && layout.scroll, JSON.stringify(layout));
          // Each newly selected page starts at its top, even after reading a long page.
          await page.locator('#guide-page').evaluate(node => { node.scrollTop = node.scrollHeight; });
          if (i !== 9) { await next.click(); assert.equal(await page.locator('#guide-page').evaluate(node => node.scrollTop), 0); }
        }
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.locator('#guide-title').innerText(), titles[9]);
        await previous.click();
        assert.equal(await page.locator('#guide-title').innerText(), titles[8]);
        for (let i = 7; i >= 0; i--) { await page.keyboard.press('ArrowLeft'); assert.equal(await page.locator('#guide-title').innerText(), titles[i]); }
        await page.keyboard.press('ArrowLeft');
        assert.equal(await page.locator('#guide-title').innerText(), titles[0]);
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().screen), 'menu');
        assert.equal(await page.locator('#guide-button').evaluate(node => node === document.activeElement), true);
        for (const id of ['music-switch', 'sound-switch']) assert.equal(await page.locator('#' + id).getAttribute('aria-checked'), 'false');
        await page.locator('#guide-button').click();
        assert.equal(await page.locator('#guide-title').innerText(), titles[0]);
        // Large text stays readable by scrolling without moving paging controls off-screen.
        await page.addStyleTag({ content: '.guide-copy p { font-size: 24px; }' });
        await page.locator('#guide-page').evaluate(node => { node.scrollTop = node.scrollHeight; });
        await next.click();
        assert.equal(await page.locator('#guide-page').evaluate(node => node.scrollTop), 0);
        await page.locator('#guide-back').click();
        assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().screen), 'menu');
        assert.deepEqual(await state(), before);
        assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage })), storage);
        assert.equal(await page.locator('#level-music').evaluate(node => node.paused), true);

        await page.locator('#select-level-button').click();
        assert.equal(await page.locator('.chapter-level:enabled').count(), 50);
        await page.locator('#level-2').click();
        assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().state), 'playing');
        assert.deepEqual(errors, []);
        assert.deepEqual(requests, []);
        await page.close();
      }
      await context.close();
      console.log(`PASS ${kind}: ten guide pages, button/keyboard boundaries, four viewports, readable scrolling and large text, menu return/focus, audio state and progress unchanged, gameplay entry, no errors or external dependencies.`);
    }
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
