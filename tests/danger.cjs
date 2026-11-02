const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    const root = process.env.BEACH_GAME_DIR || path.resolve(__dirname, '..');
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    const glow = page.locator('#tide-danger');
    assert.equal(await glow.isHidden(), true);
    assert.equal(await page.locator('#tide-warning').count(), 0);
    assert.equal(await page.getByText('潮水快要漫过沙滩了', { exact: true }).count(), 0);
    await page.locator('#start-button').click();
    await page.getByRole('button', { name: '跳过教程', exact: true }).click();
    await page.clock.runFor(1000);
    await page.clock.fastForward(47000);
    await page.clock.runFor(80);
    assert.equal(await glow.isHidden(), true);

    await page.clock.fastForward(8000);
    await page.clock.runFor(400);
    assert.equal(await glow.isVisible(), true);
    assert.equal(await glow.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    if (process.env.BEACH_CAPTURE_PREVIEWS === '1') fs.mkdirSync(path.resolve(__dirname, '../preview'), { recursive: true });
    if (process.env.BEACH_CAPTURE_PREVIEWS === '1') await page.screenshot({ path: path.resolve(__dirname, '../preview/12-danger-glow.png'), animations: 'disabled' });
    const samples = [];
    for (let i = 0; i < 4; i++) {
      samples.push(Number(await glow.evaluate(el => getComputedStyle(el).opacity)));
      await page.clock.runFor(150);
    }
    assert.ok(Math.max(...samples) - Math.min(...samples) > .04, 'Danger glow must visibly pulse.');

    // Low-time warning must allow taps through it. One bonus still leaves danger.
    await page.locator('.tile').nth(0).click();
    await page.locator('.tile').nth(3).click();
    await page.clock.runFor(250);
    assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().pairs), 1);
    assert.equal(await glow.isVisible(), true);
    // Another bonus restores safety; the glow fades out with the retreating tide.
    await page.locator('.tile').nth(1).click();
    await page.locator('.tile').nth(6).click();
    await page.clock.runFor(1000);
    assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().bonusTime), 10000);
    assert.equal(await glow.isHidden(), true);
    if (process.env.BEACH_CAPTURE_PREVIEWS === '1') await page.screenshot({ path: path.resolve(__dirname, '../preview/13-danger-cleared.png'), animations: 'disabled' });

    await page.clock.fastForward(5000);
    await page.clock.runFor(400);
    assert.equal(await glow.isVisible(), true);
    await page.locator('#pause-button').click();
    assert.equal(await glow.isHidden(), true);
    await page.clock.runFor(1000);
    assert.equal(await glow.isHidden(), true);
    await page.getByRole('button', { name: '继续赶海', exact: true }).click();
    await page.clock.runFor(400);
    assert.equal(await glow.isVisible(), true);
    await page.locator('#pause-button').click();
    await page.getByRole('button', { name: '重新开始', exact: true }).click();
    await page.getByRole('button', { name: '跳过教程', exact: true }).click();
    assert.equal(await glow.isHidden(), true);
    await page.clock.fastForward(70000);
    await page.clock.runFor(64);
    assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().state), 'lost');
    assert.equal(await glow.isHidden(), true);
    await page.getByRole('button', { name: '返回主菜单', exact: true }).click();
    assert.equal(await glow.isHidden(), true);
    assert.deepEqual(errors, []);
    console.log('PASS: safe time, pulsing danger, tap-through, partial/full recovery, pause/resume, retry, timeout, menu cleanup, no old warning text, zero JS errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
