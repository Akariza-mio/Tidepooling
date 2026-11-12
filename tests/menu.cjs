const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.clock.install();
    const root = process.env.BEACH_GAME_DIR || path.resolve(__dirname, '..');
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await page.locator('#start-button').waitFor();
    await page.clock.runFor(60);
    assert.equal(await page.locator('#menu-art').count(), 0);
    assert.equal(await page.locator('#settings-button,#settings-screen').count(), 0);
    assert.equal((await page.locator('#menu-screen').innerText()).replace(/\s+/g, ' ').trim(), '赶赶嗨嗨！ 开始游戏 选择关卡 成就 音乐 ON 音效 ON 图鉴');
    const pattern = await page.locator('#menu-pattern-scroll').evaluate(el => decodeURIComponent(el.style.backgroundImage));
    for (let kind = 0; kind < 6; kind++) assert.ok(pattern.includes(`data-kind="${kind}"`));
    assert.equal(await page.locator('.menu-panel').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 248, 233)');
    const offset = () => page.locator('#menu-pattern-scroll').evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42);
    const initial = await offset();
    await page.clock.runFor(1000);
    const afterSecond = await offset();
    assert.ok(Math.abs(afterSecond - initial + 16) < .5, 'Pattern must move upward at a steady pace.');
    // 328px / 16px per second = 20.5s. A full period returns to identical pattern placement.
    await page.clock.runFor(19500);
    const afterPeriod = await offset();
    assert.ok(Math.abs(afterPeriod - initial) < .5, 'The pattern period must align without a jump.');
    const preview = path.resolve(__dirname, '../preview');
    if (process.env.BEACH_CAPTURE_PREVIEWS === '1') fs.mkdirSync(preview, { recursive: true });
    if (process.env.BEACH_CAPTURE_PREVIEWS === '1') await page.screenshot({ path: path.join(preview, '14-menu-pattern.png'), animations: 'disabled' });
    for (const viewport of [{ width: 320, height: 568 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      const layout = await page.evaluate(() => {
        const menu = document.getElementById('menu-screen').getBoundingClientRect();
        const panel = document.querySelector('.menu-panel').getBoundingClientRect();
        const settings = document.querySelector('.menu-tools').getBoundingClientRect();
        const start = document.getElementById('start-button').getBoundingClientRect();
        const title = document.getElementById('menu-title').getBoundingClientRect();
        return { contained: panel.left >= menu.left && panel.right <= menu.right && panel.top >= menu.top && panel.bottom <= menu.bottom,
          titleContained: title.left >= menu.left && title.right <= menu.right && title.top >= menu.top && title.bottom < panel.top,
          centered: Math.abs((settings.left + settings.right) / 2 - (menu.left + menu.right) / 2) < 1,
          toolsReachable: [...document.querySelectorAll('.menu-tool')].every(button => {
            const r = button.getBoundingClientRect();
            return r.width >= 44 && r.height >= 44 && document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2)?.closest('button') === button;
          }),
          hit: document.elementFromPoint((start.left + start.right) / 2, (start.top + start.bottom) / 2).closest('button')?.id,
          overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(layout.contained, true);
      assert.equal(layout.titleContained, true);
      assert.equal(layout.centered, true);
      assert.equal(layout.toolsReachable, true);
      assert.equal(layout.hit, 'start-button');
      assert.equal(layout.overflow, false);
      if (process.env.BEACH_CAPTURE_PREVIEWS === '1') await page.screenshot({ path: path.join(preview, `15-menu-${viewport.width}x${viewport.height}.png`), animations: 'disabled' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#guide-button').click(); await page.keyboard.press('Escape');

    await page.locator('#start-button').click();
    await page.getByRole('button', { name: '跳过教程', exact: true }).click();
    assert.equal(await page.locator('.tile').count(), 16);
    const kinds = await page.locator('.tile .seaside-item').evaluateAll(icons => [...new Set(icons.map(icon => icon.dataset.kind))]);
    assert.equal(kinds.length, 3);
    await page.locator('#pause-button').click();
    await page.getByRole('button', { name: '返回选关', exact: true }).click();
    await page.getByRole('button', { name: '返回主菜单', exact: true }).click();
    const returned = await offset();
    await page.clock.runFor(500);
    assert.notEqual(await offset(), returned);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('PASS: all six finds, upward motion, seamless 20.5s period, opaque raised panel, five screen sizes, centered menu tools, working buttons, three-kind gameplay, no external requests or JS errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
