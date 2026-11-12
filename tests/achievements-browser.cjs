// Real wins and reloads in source/isolated single HTML. No screenshots.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url'), { chromium } = require('./browser-support.cjs');
const key = 'beach-pairs-achievements-v2';
(async () => {
  const root = path.resolve(__dirname, '..'), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'beach-achievements-'));
  fs.copyFileSync(path.join(root, 'release/index1.html'), path.join(temp, 'index.html'));
  let browser;
  try {
    browser = await chromium.launch();
    for (const single of [false, true]) {
      const url = pathToFileURL(single ? path.join(temp, 'index.html') : path.join(root, 'index.html')).href;
      for (const pulls of [1, 0]) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', offline: single });
        const page = await context.newPage(), errors = [], dependencies = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (single && request.resourceType() !== 'document' && !request.url().startsWith('data:')) dependencies.push(request.url()); });
        await page.clock.install({ time: new Date('2026-11-10T00:00:00Z') });
        await page.clock.pauseAt(new Date('2026-11-10T00:00:01Z'));
        await page.addInitScript(() => localStorage.setItem('beach-pairs-completed-levels', '[45]'));
        await page.addInitScript(() => localStorage.setItem('beach-pairs-achievements', '["first-clear","no-lever-clear"]'));
        await page.addInitScript(() => {
          if (!localStorage.getItem('achievement-reset-test-seeded')) {
            localStorage.setItem('beach-pairs-achievements-v2', '["first-clear","no-lever-clear"]');
            localStorage.setItem('beach-pairs-achievements-version', 'previous-release');
            localStorage.setItem('achievement-reset-test-seeded', 'done');
          }
        });
        await page.goto(url);
        const action = name => page.getByRole('button', { name, exact: true }).click();
        const card = page.locator('.achievement-card[data-achievement="no-lever-clear"]');
        await page.locator('#achievements-button').click();
        assert.equal(await card.count(), 1);
        assert.equal(await page.locator('.achievement-card').count(), 20);
        assert.equal(await page.locator('.achievement-card.is-locked').count(), 20);
        assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-achievements')), null);
        assert.equal(await card.locator('h2').innerText(), '反赌战士');
        assert.equal(await card.locator('p').innerText(), '不拉一次拉杆，通关5-5');
        assert.equal(await card.getAttribute('class'), 'achievement-card is-locked');
        assert.equal(await card.locator('.achievement-icon').evaluate(el => getComputedStyle(el).filter), 'none');
        assert.equal(await card.locator('.achievement-status').innerText(), '未达成');
        assert.equal(await card.locator('.slot-machine-emblem-art').count(), 1);
        assert.doesNotMatch(await card.innerText(), /成就名[：:]|达成方式[：:]/);
        for (const viewport of [{ width: 320, height: 480 }, { width: 320, height: 568 }, { width: 430, height: 932 }, { width: 844, height: 390 }, { width: 1280, height: 720 }]) {
          await page.setViewportSize(viewport);
          const fit = await card.evaluate(el => {
            const r = el.getBoundingClientRect(), app = document.getElementById('app').getBoundingClientRect();
            return r.left >= app.left && r.right <= app.right && r.top >= app.top && r.bottom <= app.bottom && el.scrollWidth <= el.clientWidth && document.documentElement.scrollWidth <= innerWidth;
          });
          assert.equal(fit, true, JSON.stringify(viewport));
          await page.locator('#achievements-back').click();
          const menu = await page.locator('#achievements-button').evaluate(el => {
            const r = el.getBoundingClientRect(), s = document.getElementById('select-level-button').getBoundingClientRect(), tools = document.querySelector('.menu-tools').getBoundingClientRect(), title = document.querySelector('.menu-title').getBoundingClientRect(), panel = document.querySelector('.menu-panel').getBoundingClientRect();
            return r.top >= s.bottom && r.bottom <= tools.top && title.bottom < panel.top && document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2)?.closest('button') === el;
          });
          assert.equal(menu, true, JSON.stringify(viewport));
          await page.locator('#achievements-button').click();
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().screen), 'menu');
        assert.equal(await page.locator('#achievements-button').evaluate(el => document.activeElement === el), true);
        await page.locator('#select-level-button').click();
        for (let chapter = 0; chapter < 4; chapter++) await page.locator('#chapter-next').click();
        await page.locator('#level-45').click(); await action('我知道了');
        const tiles = page.locator('#board .tile');
        if (pulls) {
          const pair = await tiles.evaluateAll(tiles => tiles.filter(tile => tile.querySelector('.seaside-item').dataset.kind === '1').slice(0, 2).map(tile => Number(tile.dataset.index)));
          for (const index of pair) await tiles.nth(index).click();
          await page.locator('#slot-lever').click(); await page.clock.runFor(1600);
        }
        const remaining = await tiles.evaluateAll(tiles => tiles.filter(tile => tile.dataset.status === 'hidden').map(tile => ({ index: Number(tile.dataset.index), kind: Number(tile.querySelector('.seaside-item').dataset.kind) })));
        for (const kind of new Set(remaining.map(card => card.kind))) for (const card of remaining.filter(card => card.kind === kind)) await tiles.nth(card.index).click();
        await page.clock.runFor(1200);
        assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().state), 'won');
        assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().slotMachine.hasSpun), Boolean(pulls));
        const toast = page.locator('#achievement-toast');
        assert.equal(await toast.isVisible(), true);
        assert.equal(await page.locator('#achievement-toast-name').innerText(), '挑食');
        await page.clock.runFor(3500);
        assert.equal(await page.locator('#achievement-toast-name').innerText(), pulls ? '噫！我中了！' : '反赌战士');
        if (!pulls) {
          assert.equal(await page.locator('#achievement-toast-name').innerText(), '反赌战士');
          assert.equal(await page.locator('#achievement-toast-icon > .slot-machine-emblem-art').count(), 1);
          assert.equal(await page.locator('#achievement-toast-icon > .seaside-item').count(), 0);
          assert.equal(await toast.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
          const focus = await page.evaluate(() => document.activeElement.id);
          for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
            await page.setViewportSize(viewport);
            const fit = await toast.evaluate(el => {
              const r = el.getBoundingClientRect(), a = document.getElementById('app').getBoundingClientRect();
              return r.left >= a.left && r.right <= a.right && r.top >= a.top && r.bottom <= a.bottom && Number(getComputedStyle(el).zIndex) > Number(getComputedStyle(document.getElementById('modal-layer')).zIndex) && !document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2)?.closest('#achievement-toast');
            });
            assert.equal(fit, true, JSON.stringify(viewport));
          }
          if (!single) {
            await page.clock.runFor(7000);
            assert.equal(await toast.isVisible(), false);
            assert.equal(await page.evaluate(() => document.activeElement.id), focus);
          }
        }
        await action('返回主菜单'); await page.locator('#achievements-button').click();
        assert.equal(await toast.isVisible(), false);
        assert.equal(await card.getAttribute('class'), pulls ? 'achievement-card is-locked' : 'achievement-card is-earned');
        assert.equal(await card.locator('.achievement-status').innerText(), pulls ? '未达成' : '已达成');
        assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]').length, key), pulls ? 2 : 3);
        await page.reload(); await page.locator('#achievements-button').click();
        assert.equal(await toast.isVisible(), false);
        assert.equal(await card.getAttribute('class'), pulls ? 'achievement-card is-locked' : 'achievement-card is-earned');
        assert.deepEqual(errors, []); assert.deepEqual(dependencies, []);
        await context.close();
      }
      // A fresh first-level win awards normally; old progress alone must not restore reset awards.
      {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', offline: single });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.clock.install({ time: new Date('2026-11-10T00:00:00Z') });
        await page.clock.pauseAt(new Date('2026-11-10T00:00:01Z'));
        await page.goto(url);
        const crab = page.locator('.achievement-card[data-achievement="first-clear"]');
        await page.locator('#achievements-button').click();
        assert.equal(await crab.locator('h2').innerText(), '初出茅庐');
        assert.equal(await crab.locator('p').innerText(), '通关1-1');
        assert.equal(await crab.locator('.achievement-icon > .seaside-item[data-kind="1"]').count(), 1);
        assert.equal(await crab.getAttribute('class'), 'achievement-card is-locked');
        await page.locator('#achievements-back').click(); await page.locator('#start-button').click();
        await page.getByRole('button', { name: '跳过教程', exact: true }).click();
        assert.equal(await page.locator('#achievement-toast-name').innerText(), '我只是点错了');
        assert.equal(await page.locator('#achievement-toast-icon .achievement-fast-forward-art polygon').count(), 2);
        const tiles = page.locator('#board .tile');
        const kinds = await tiles.evaluateAll(tiles => tiles.map(tile => Number(tile.querySelector('.seaside-item').dataset.kind)));
        for (const kind of new Set(kinds)) for (let index = 0; index < kinds.length; index++) if (kinds[index] === kind) await tiles.nth(index).click();
        await page.clock.runFor(1200);
        assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().state), 'won');
        await page.clock.runFor(3500);
        assert.equal(await page.locator('#achievement-toast-name').innerText(), '初出茅庐');
        assert.equal(await page.locator('#achievement-toast-icon > .seaside-item[data-kind="1"]').count(), 1);
        assert.equal(await page.locator('#achievement-toast-icon > .slot-machine-emblem-art').count(), 0);
        await page.getByRole('button', { name: '返回主菜单', exact: true }).click(); await page.locator('#achievements-button').click();
        assert.equal(await crab.getAttribute('class'), 'achievement-card is-earned');
        assert.equal(await page.locator('.achievement-card[data-achievement="no-lever-clear"]').getAttribute('class'), 'achievement-card is-locked');
        await page.reload(); await page.locator('#achievements-button').click();
        assert.equal(await crab.getAttribute('class'), 'achievement-card is-earned');
        assert.equal(await page.locator('#achievement-toast').isVisible(), false);
        assert.deepEqual(errors, []); await context.close();
      }
      for (const legacy of [false, true]) {
        const context = await browser.newContext({ reducedMotion: 'reduce', offline: single }), page = await context.newPage();
        await page.addInitScript(legacy => localStorage.setItem(legacy ? 'beach-pairs-level-one' : 'beach-pairs-completed-levels', legacy ? 'won' : '[1,45]'), legacy);
        await page.addInitScript(() => localStorage.setItem('beach-pairs-achievements', '["first-clear","no-lever-clear"]'));
        await page.goto(url); await page.locator('#achievements-button').click();
        assert.equal(await page.locator('.achievement-card.is-locked').count(), 20);
        assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-achievements')), null);
        assert.equal(await page.locator('#achievement-toast').isVisible(), false);
        await page.locator('#achievements-back').click(); await page.locator('#select-level-button').click();
        assert.equal(await page.locator('.chapter-level.is-completed').count(), 0);
        assert.deepEqual(await page.locator('.chapter-level-status').allTextContents(), Array(50).fill('可挑战'));
        await context.close();
      }
      // A platform without storage still keeps the earned state while the document remains open.
      const context = await browser.newContext({ reducedMotion: 'reduce', offline: single }), page = await context.newPage();
      await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw Error('storage blocked'); } }));
      await page.goto(url); await page.locator('#achievements-button').click();
      assert.equal(await page.locator('.achievement-card.is-locked').count(), 20);
      await context.close();
      console.log(`PASS ${single ? 'isolated offline HTML' : 'source file'}: old awards reset, no progress-based regrant, uniform challenge cards, twenty definitions, original achievements re-earned with queued notification and persisted after reload, prior layout/pull/blocked-storage checks, no errors.`);
    }
  } finally {
    if (browser) await browser.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
