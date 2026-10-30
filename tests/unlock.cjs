const { chromium } = require('C:/Users/29781/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    const root = process.env.BEACH_GAME_DIR || path.resolve(__dirname, '..');
    const url = pathToFileURL(path.join(root, 'index.html')).href;
    await page.clock.install();
    await page.goto(url);
    const progress = () => page.evaluate(() => ({ levels: localStorage.getItem('beach-pairs-completed-levels'), legacy: localStorage.getItem('beach-pairs-level-one') }));
    const select = async () => { await page.locator('#settings-screen [data-menu]').first().click(); await page.locator('#select-level-button').click(); };
    const settings = async () => { await page.locator('#level-screen [data-menu]').click(); await page.locator('#settings-button').click(); };
    async function winSecond() {
      await page.locator('#level-2').click();
      assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().levelId), 2);
      assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().duration), 60000);
      const groups = await page.locator('.tile .seaside-item').evaluateAll(icons => {
        const groups = {};
        icons.forEach((icon, index) => (groups[icon.dataset.kind] ||= []).push(index));
        return Object.values(groups);
      });
      assert.equal(groups.length, 3);
      assert.deepEqual(groups.map(group => group.length), [8, 8, 8]);
      for (const group of groups) for (const index of group) await page.locator('.tile').nth(index).click();
      await page.clock.runFor(700);
      assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().state), 'won');
      await page.getByRole('button', { name: '返回选关', exact: true }).click();
    }

    // A fresh player may test any implemented level without creating completion records.
    const initial = await progress();
    await page.locator('#settings-button').click();
    assert.equal(await page.locator('#unlock-switch').getAttribute('aria-checked'), 'false');
    await page.locator('#unlock-switch').click();
    await select();
    assert.equal(await page.locator('.chapter-level:enabled').count(), 30);
    assert.equal(await page.locator('#chapter-1 .chapter-progress').innerText(), '已通关 0 / 10');
    assert.equal(await page.locator('#level-2 .chapter-level-status').innerText(), '可挑战');
    assert.equal(await page.locator('#level-31').isDisabled(), true);
    if (process.env.BEACH_CAPTURE_PREVIEWS === '1') await page.screenshot({ path: path.resolve(__dirname, '../preview/36-unlocked-selection.png'), animations: 'disabled' });
    await winSecond();
    assert.deepEqual(await progress(), initial);
    assert.equal(await page.locator('#chapter-1 .chapter-progress').innerText(), '已通关 0 / 10');
    await settings();
    await page.locator('#unlock-switch').click();
    await select();
    assert.equal(await page.locator('.chapter-level:enabled').count(), 0);
    await page.reload();
    await page.locator('#settings-button').click();
    assert.equal(await page.locator('#unlock-switch').getAttribute('aria-checked'), 'false');

    // Existing real progress survives testing, including across a browser reload.
    await page.evaluate(() => {
      localStorage.setItem('beach-pairs-completed-levels', '[1]');
      localStorage.setItem('beach-pairs-level-one', 'won');
    });
    await page.reload();
    const genuine = await progress();
    await page.locator('#settings-button').click();
    await page.locator('#unlock-switch').click();
    await page.reload();
    await page.locator('#settings-button').click();
    assert.equal(await page.locator('#unlock-switch').getAttribute('aria-checked'), 'true');
    await select();
    assert.equal(await page.locator('.chapter-level:enabled').count(), 30);
    assert.equal(await page.locator('#chapter-1 .chapter-progress').innerText(), '已通关 1 / 10');
    await winSecond();
    assert.deepEqual(await progress(), genuine);
    await settings();
    await page.locator('#unlock-switch').click();
    await select();
    assert.equal(await page.locator('#level-one').isEnabled(), true);
    assert.equal(await page.locator('#level-2').isDisabled(), true);
    assert.equal(await page.locator('.chapter-level:enabled').count(), 1);
    assert.equal(await page.locator('#chapter-1 .chapter-progress').innerText(), '已通关 1 / 10');
    assert.deepEqual(await progress(), genuine);

    // With local storage blocked, the switch still operates within this session.
    const blocked = await browser.newPage();
    blocked.on('pageerror', error => errors.push(error.message));
    await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage unavailable'); } }));
    await blocked.goto(url);
    await blocked.locator('#settings-button').click();
    await blocked.locator('#unlock-switch').click();
    await blocked.locator('#settings-screen [data-menu]').click();
    await blocked.locator('#select-level-button').click();
    assert.equal(await blocked.locator('.chapter-level:enabled').count(), 30);
    await blocked.locator('#level-screen [data-menu]').click();
    await blocked.locator('#settings-button').click();
    await blocked.locator('#unlock-switch').click();
    await blocked.locator('#settings-screen [data-menu]').click();
    await blocked.locator('#select-level-button').click();
    assert.equal(await blocked.locator('.chapter-level:enabled').count(), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log('PASS: direct level-two testing, unlock without fake progress, ignored test wins, original permissions restored, persisted independent switch, blocked-storage fallback, second-level three kinds/60s, no external requests or JS errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
