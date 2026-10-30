const { chromium } = require('C:/Users/29781/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
  const errors = [];
  const requests = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  const capture = path.resolve(__dirname, '../preview');
  fs.mkdirSync(capture, { recursive: true });
  async function screenshot(name) {
    await page.screenshot({ path: path.join(capture, name), animations: 'disabled' });
  }
  const url = pathToFileURL(path.resolve(process.env.BEACH_GAME_DIR || path.resolve(__dirname, '..'), 'index.html')).href;
  await page.goto(url);
  await page.locator('#start-button').waitFor();
  assert.equal(await page.locator('#menu-screen').isVisible(), true);
  assert.equal((await page.locator('#menu-screen').innerText()).replace(/\s+/g, ' ').trim(), '游戏名称 开始游戏 选择关卡 设置');
  assert.equal(await page.locator('#menu-screen button').count(), 3);
  const settingsOffset = await page.locator('#settings-button').evaluate(button => {
    const bounds = button.getBoundingClientRect();
    const menu = document.getElementById('menu-screen').getBoundingClientRect();
    return Math.abs((bounds.left + bounds.right) / 2 - (menu.left + menu.right) / 2);
  });
  assert.ok(settingsOffset < 1, 'Settings must be horizontally centered.');
  await screenshot('01-menu.png');
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.locator('#settings-screen').waitFor({ state: 'visible' });
  await page.locator('#settings-screen [data-menu]').click();
  await page.locator('#select-level-button').click();
  await screenshot('02-level.png');
  await page.locator('#level-screen [data-menu]').click();
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  await page.getByRole('button', { name: '跳过教程', exact: true }).click();
  assert.equal(await page.locator('.tile').count(), 16);
  assert.equal(await page.locator('#board').getAttribute('aria-label'), '4行4列赶海配对棋盘');
  assert.equal((await page.locator('#pairs-total').innerText()).trim(), '/ 8 对');
  assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().duration), 60000);
  assert.equal(await page.locator('#play-screen h1').count(), 0);
  await screenshot('03-game.png');
  const values = await page.locator('.tile .shell-art').evaluateAll(elements => elements.map(el => el.querySelector('linearGradient').id.match(/^s(\d+)-/)[1]));
  assert.equal(new Set(values).size, 3);
  assert.deepEqual([...new Set(values)].map(value => values.filter(v => v === value).length).sort((a, b) => a - b), [4, 6, 6]);
  const a = 0, b = values.findIndex(value => value !== values[a]);
  await page.locator('.tile').nth(a).click();
  await page.locator('.tile').nth(b).click();
  assert.equal(await page.locator('.tile[data-status="open"]').count(), 2);
  await page.waitForTimeout(180);
  await screenshot('04-revealed.png');
  await page.locator('.tile[data-status="open"]').first().waitFor({ state: 'detached' }).catch(() => {});
  assert.equal(await page.locator('.tile[data-status="open"]').count(), 0);
  // Reopen immediately while the closing sand animation is still running.
  await page.locator('.tile').nth(a).click();
  assert.equal(await page.locator('.tile').nth(a).getAttribute('data-status'), 'open');
  await page.locator('.tile').nth(b).click();
  await page.locator('.tile[data-status="open"]').first().waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '暂停游戏' }).click();
  const elapsed = await page.evaluate(() => beachDiagnostics.snapshot().elapsed);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().elapsed), elapsed);
  await page.getByRole('button', { name: '继续赶海', exact: true }).click();
  await page.waitForTimeout(2400);
  const fps = await page.evaluate(() => beachDiagnostics.snapshot().fps);
  console.log('Measured rendering FPS (headless):', fps.toFixed(1));

  const byValue = new Map();
  values.forEach((value, index) => { if (!byValue.has(value)) byValue.set(value, []); byValue.get(value).push(index); });
  for (const indices of byValue.values()) {
    for (const i of indices) await page.locator('.tile').nth(i).click();
  }
  assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().state), 'won');
  await page.locator('#modal-layer').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#bucket-contents .bucket-find').count(), 8);
  assert.equal(await page.locator('.catch-flight').count(), 0);
  assert.ok(await page.evaluate(() => beachDiagnostics.snapshot().bonusTime) <= 40000);
  await screenshot('05-win.png');
  assert.deepEqual(await page.locator('#modal-art .bucket-find').evaluateAll(items => items.map(item => item.dataset.kind)),
    await page.locator('#bucket-contents .bucket-find').evaluateAll(items => items.map(item => item.dataset.kind)));
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(element => element.id));
  assert.equal(new Set(ids).size, ids.length, 'The result bucket snapshot must not duplicate SVG/DOM IDs.');
  await page.getByRole('button', { name: '下一关', exact: true }).click();
  assert.equal(await page.locator('#play-number').innerText(), '02');
  assert.equal(await page.locator('#modal-layer').isVisible(), false);
  assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().state), 'playing');
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: '返回选关', exact: true }).click();
  await page.locator('#level-one').click();
  await page.getByRole('button', { name: '跳过教程', exact: true }).click();
  assert.equal(await page.locator('.tile[data-status="hidden"]').count(), 16);
  assert.equal(await page.locator('#bucket-contents .bucket-find').count(), 0);
  assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().bonusTime), 0);
  const restartedValues = await page.locator('.tile .shell-art').evaluateAll(elements => elements.map(el => el.querySelector('linearGradient').id.match(/^s(\d+)-/)[1]));
  assert.deepEqual(restartedValues, values);
  // Browser virtual clock advances the actual elapsed-time loop, without a production cheat mode.
  await page.clock.install();
  // Reload so the first requestAnimationFrame is also scheduled by the virtual clock.
  await page.reload();
  await page.getByRole('button', { name: '开始游戏', exact: true }).click();
  await page.getByRole('button', { name: '跳过教程', exact: true }).click();
  const reloadedValues = await page.locator('.tile .shell-art').evaluateAll(elements => elements.map(el => el.querySelector('linearGradient').id.match(/^s(\d+)-/)[1]));
  assert.deepEqual(reloadedValues, values);
  await page.clock.runFor(1000);
  await page.clock.fastForward(30000);
  await page.clock.runFor(64);
  const tideState = await page.evaluate(() => beachDiagnostics.snapshot());
  console.log('Mid-tide state:', tideState.progress.toFixed(3), tideState.state);
  assert.ok(tideState.progress > .5 && tideState.progress < .85);
  await screenshot('06-tide.png');
  // Earn time with a visible waterline, then observe the animated retreat.
  await page.locator('.tile').nth(0).click();
  await page.locator('.tile').nth(3).click();
  const justMatched = await page.evaluate(() => beachDiagnostics.snapshot());
  assert.equal(justMatched.bonusTime, 5000);
  assert.ok(justMatched.remaining > tideState.remaining + 4000);
  assert.ok(justMatched.progress < tideState.progress);
  assert.ok(justMatched.flights > 0);
  await page.clock.runFor(100);
  await screenshot('09-catch-flight.png');
  await page.clock.runFor(550);
  const retreated = await page.evaluate(() => beachDiagnostics.snapshot());
  assert.ok(retreated.displayedTide < tideState.displayedTide - .05);
  assert.equal(retreated.bucketPairs, 1);
  assert.equal(retreated.flights, 0);
  // Further matches remain available while earlier catches are in flight.
  for (const i of [1, 6, 2, 4]) await page.locator('.tile').nth(i).click();
  assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().pairs), 3);
  assert.ok(await page.evaluate(() => beachDiagnostics.snapshot().flights) > 0);
  await page.getByRole('button', { name: '暂停游戏' }).click();
  const pausedCatch = await page.evaluate(() => ({ state: beachDiagnostics.snapshot(), transforms: [...document.querySelectorAll('.catch-flight')].map(el => el.style.transform) }));
  await page.clock.runFor(1000);
  const stillPausedCatch = await page.evaluate(() => ({ state: beachDiagnostics.snapshot(), transforms: [...document.querySelectorAll('.catch-flight')].map(el => el.style.transform) }));
  assert.deepEqual(stillPausedCatch.transforms, pausedCatch.transforms);
  assert.equal(stillPausedCatch.state.remaining, pausedCatch.state.remaining);
  await page.getByRole('button', { name: '继续赶海', exact: true }).click();
  await page.clock.runFor(650);
  assert.equal(await page.locator('#bucket-contents .bucket-find').count(), 3);
  await screenshot('10-bucket-filling.png');
  // Fill most of the bucket for a visual check without finishing the level.
  const remainingGroups = new Map();
  for (const i of await page.locator('.tile[data-status="hidden"]').evaluateAll(tiles => tiles.map(tile => Number(tile.dataset.index)))) {
    const value = values[i];
    if (!remainingGroups.has(value)) remainingGroups.set(value, []);
    remainingGroups.get(value).push(i);
  }
  for (const indices of remainingGroups.values()) {
    for (let i = 0; i + 1 < indices.length && (await page.evaluate(() => beachDiagnostics.snapshot().pairs)) < 6; i += 2) {
      await page.locator('.tile').nth(indices[i]).click();
      await page.locator('.tile').nth(indices[i + 1]).click();
    }
  }
  await page.clock.runFor(650);
  assert.equal(await page.locator('#bucket-contents .bucket-find').count(), 6);
  await screenshot('11-bucket-fuller.png');
  // Covered tiles remain interactive while water is above the board bottom.
  const nextHidden = page.locator('.tile[data-status="hidden"]').first();
  const nextIndex = await nextHidden.getAttribute('data-index');
  await nextHidden.click();
  assert.equal(await page.locator('.tile').nth(Number(nextIndex)).getAttribute('data-status'), 'open');
  await page.clock.fastForward(200000);
  await page.clock.runFor(64);
  assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().state), 'lost');
  await screenshot('07-timeout.png');
  await page.getByRole('button', { name: '返回主菜单', exact: true }).click();
  assert.equal(await page.locator('#menu-screen').isVisible(), true);
  await page.clock.resume();

  for (const viewport of [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    await page.getByRole('button', { name: '开始游戏', exact: true }).click();
    await page.getByRole('button', { name: '跳过教程', exact: true }).click();
    // Direct start now has an entry animation; measure after that animation settles.
    await page.clock.runFor(400);
    const layout = await page.evaluate(() => {
      const shell = document.getElementById('app').getBoundingClientRect();
      const board = document.getElementById('board').getBoundingClientRect();
      const footer = document.querySelector('.collection').getBoundingClientRect();
      const header = document.querySelector('.play-header').getBoundingClientRect();
      return { shell: { left: shell.left, right: shell.right, bottom: shell.bottom }, board: { top: board.top, bottom: board.bottom, left: board.left, right: board.right }, footer: { top: footer.top, bottom: footer.bottom }, header: { bottom: header.bottom }, tileWidth: document.querySelector('.tile').getBoundingClientRect().width, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    console.log('Layout', viewport, layout);
    assert.equal(layout.overflow, false);
    assert.ok(layout.board.top >= layout.header.bottom - 1);
    assert.ok(layout.board.bottom <= layout.footer.top + 1);
    assert.ok(layout.footer.bottom <= layout.shell.bottom + 1);
    assert.ok(layout.board.left >= layout.shell.left && layout.board.right <= layout.shell.right);
    await screenshot(`08-layout-${viewport.width}x${viewport.height}.png`);
    await page.getByRole('button', { name: '暂停游戏' }).click();
    await page.getByRole('button', { name: '返回选关', exact: true }).click();
    await page.getByRole('button', { name: '返回主菜单', exact: true }).click();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  console.log('PASS: file:// offline, menus, 16 tiles, mismatch, pause, win/retry, tide interaction, timeout, five viewport layouts, zero external requests, zero JS errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
