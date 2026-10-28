const { chromium } = require('C:/Users/29781/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.clock.install();
    const root = process.env.BEACH_GAME_DIR || path.resolve(__dirname, '..');
    const url = pathToFileURL(path.join(root, 'index.html')).href;
    const preview = path.resolve(__dirname, '../preview');
    if (process.env.BEACH_CAPTURE_PREVIEWS === '1') fs.mkdirSync(preview, { recursive: true });
    await page.goto(url);
    await page.clock.runFor(400);
    if (process.env.BEACH_CAPTURE_PREVIEWS === '1') await page.screenshot({ path: path.join(preview, '16-menu-selection.png'), animations: 'disabled' });
    const order = await page.locator('.menu-actions > button').evaluateAll(buttons => buttons.map(button => button.textContent.trim()));
    assert.deepEqual(order, ['开始游戏', '选择关卡']);
    await page.locator('#select-level-button').click();
    assert.equal(await page.locator('.chapter-page').count(), 5);
    assert.equal(await page.locator('.chapter-level').count(), 50);
    assert.equal(await page.locator('.chapter-page:visible').count(), 1);
    assert.equal(await page.locator('#level-one').isDisabled(), true);
    assert.equal(await page.locator('#chapter-previous').isDisabled(), true);
    const names = ['初入浅滩', '月下独捉', '第三大关', '第四大关', '第五大关'];
    for (let index = 0; index < 5; index++) {
      const chapter = page.locator('.chapter-page:visible');
      assert.equal(await chapter.locator('h1').innerText(), names[index]);
      assert.equal(await chapter.locator('button').count(), 10);
      const ids = await chapter.locator('button').evaluateAll(buttons => buttons.map(button => Number(button.dataset.level)));
      assert.deepEqual(ids, Array.from({ length: 10 }, (_, slot) => index * 10 + slot + 1));
      assert.equal(await chapter.locator('button:enabled').count(), 0);
      assert.equal(await chapter.getAttribute('id'), 'chapter-' + (index + 1));
      assert.equal(await page.locator('#chapter-indicators [aria-current="page"]').innerText(), ['一', '二', '三', '四', '五'][index]);
      if (index === 0 || index === 4) {
        if (process.env.BEACH_CAPTURE_PREVIEWS === '1') await page.screenshot({ path: path.join(preview, `17-chapter-${index + 1}.png`), animations: 'disabled' });
      }
      if (index < 4) { await page.locator('#chapter-next').click(); await page.locator('#chapter-pages:not(.is-sliding)').waitFor({ state: 'attached' }); }
    }
    assert.equal(await page.locator('#chapter-next').isDisabled(), true);
    await page.locator('#chapter-previous').click();
    assert.equal(await page.locator('.chapter-page:visible h1').innerText(), '第四大关');
    for (let i = 0; i < 3; i++) { await page.locator('#chapter-previous').click(); await page.locator('#chapter-pages:not(.is-sliding)').waitFor({ state: 'attached' }); }
    assert.equal(await page.locator('#chapter-tabs').count(), 0);
    assert.equal(await page.locator('.chapter-pagination button').count(), 2);

    // All ten entries and pagination must remain reachable on compact phones.
    for (const viewport of [{ width: 320, height: 568 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      const nav = await page.locator('.chapter-pagination').boundingBox();
      assert.ok(nav.y >= 0 && nav.y + nav.height <= viewport.height);
      await page.locator('#chapter-1 .chapter-level').last().scrollIntoViewIfNeeded();
      const accessible = await page.locator('#chapter-1 .chapter-level').last().evaluate(button => {
        const rect = button.getBoundingClientRect();
        const container = document.getElementById('chapter-pages').getBoundingClientRect();
        return rect.top >= container.top - 1 && rect.bottom <= container.bottom + 1;
      });
      assert.equal(accessible, true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (process.env.BEACH_CAPTURE_PREVIEWS === '1') await page.screenshot({ path: path.join(preview, `18-chapter-${viewport.width}x${viewport.height}.png`), animations: 'disabled' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#level-screen [data-menu]').click();
    await page.locator('#start-button').click();
    await page.getByRole('button', { name: '跳过教程', exact: true }).click();
    assert.equal(await page.locator('#play-screen').isVisible(), true);
    assert.equal(await page.locator('.tile').count(), 16);
    await page.locator('#pause-button').click();
    await page.getByRole('button', { name: '返回选关', exact: true }).click();
    assert.equal(await page.locator('#level-one').isDisabled(), true, 'Starting or pausing must not award completion.');
    await page.locator('#level-screen [data-menu]').click();
    await page.locator('#start-button').click();
    await page.getByRole('button', { name: '跳过教程', exact: true }).click();
    const byKind = await page.locator('.tile .seaside-item').evaluateAll(icons => {
      const groups = {};
      icons.forEach((icon, index) => (groups[icon.dataset.kind] ||= []).push(index));
      return Object.values(groups);
    });
    for (const group of byKind) for (const index of group) await page.locator('.tile').nth(index).click();
    await page.clock.runFor(700);
    assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().state), 'won');
    await page.getByRole('button', { name: '返回选关', exact: true }).click();
    assert.equal(await page.locator('#level-one').isEnabled(), true);
    assert.equal(await page.locator('.chapter-level:enabled').count(), 1);
    assert.equal(await page.locator('#chapter-1 .chapter-progress').innerText(), '已通关 1 / 10');
    if (process.env.BEACH_CAPTURE_PREVIEWS === '1') await page.screenshot({ path: path.join(preview, '19-chapter-completed.png'), animations: 'disabled' });
    await page.reload();
    await page.locator('#select-level-button').click();
    assert.equal(await page.locator('#level-one').isEnabled(), true, 'Completion persists after reload.');
    await page.locator('#level-one').click();
    await page.getByRole('button', { name: '跳过教程', exact: true }).click();
    assert.equal(await page.locator('.tile[data-status="hidden"]').count(), 16);
    assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().bonusTime), 0);

    // Existing v0.10 completion is retained, even if the new storage entry is malformed.
    await page.evaluate(() => { localStorage.setItem('beach-pairs-completed-levels', '{broken'); });
    await page.reload();
    await page.locator('#select-level-button').click();
    assert.equal(await page.locator('#level-one').isEnabled(), true);

    // Storage-denied browsers can still start, win, and replay during the session.
    const noStorage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    noStorage.on('pageerror', error => errors.push(error.message));
    await noStorage.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage unavailable'); } });
    });
    await noStorage.goto(url);
    await noStorage.locator('#start-button').click();
    await noStorage.getByRole('button', { name: '跳过教程', exact: true }).click();
    for (const group of byKind) for (const index of group) await noStorage.locator('.tile').nth(index).click();
    await noStorage.getByRole('button', { name: '返回选关', exact: true }).waitFor();
    await noStorage.getByRole('button', { name: '返回选关', exact: true }).click();
    assert.equal(await noStorage.locator('#level-one').isEnabled(), true);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log('PASS: direct first-level start; five separate ten-level chapter pages; names, page boundaries and mobile access; completion-only replay; persistence, legacy migration, malformed/blocked storage; zero errors or external requests.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
