// Actual counter updates, continued ending play, and cleaned minigame layouts. No screenshots.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url'), { chromium } = require('./browser-support.cjs');
(async () => {
  const root = path.resolve(__dirname, '..'), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'beach-ui-cleanup-'));
  fs.copyFileSync(path.join(root, 'release/index1.html'), path.join(temp, 'index.html'));
  let browser;
  try {
    browser = await chromium.launch();
    for (const single of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', offline: true }), page = await context.newPage(), errors = [], external = [];
      page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (!/^(file:|data:)/.test(r.url())) external.push(r.url()); });
      await page.clock.install({ time: new Date('2026-11-11T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-11-11T00:00:01Z'));
      await page.goto(pathToFileURL(single ? path.join(temp, 'index.html') : path.join(root, 'index.html')).href);
      const action = name => page.getByRole('button', { name, exact: true }).click(), state = () => page.evaluate(() => beachDiagnostics.snapshot());
      const enter = async id => {
        await page.locator('#select-level-button').click();
        for (let i = 0; i < Math.floor((id - 1) / 10); i++) await page.locator('#chapter-next').click();
        await page.locator(`#level-${id}`).click();
        if (await page.getByRole('button', { name: '我知道了', exact: true }).isVisible()) await action('我知道了');
      };
      await page.locator('#achievements-button').click(); assert.equal(await page.locator('#achievement-summary').innerText(), '已完成0 / 20');
      await page.locator('#achievements-back').click(); await page.locator('#start-button').click(); await action('跳过教程');
      const tiles = page.locator('#board .tile'), kinds = await tiles.evaluateAll(items => items.map(tile => Number(tile.querySelector('.seaside-item').dataset.kind)));
      for (const kind of new Set(kinds)) for (let i = 0; i < kinds.length; i++) if (kinds[i] === kind) await tiles.nth(i).click();
      await page.clock.runFor(1200); await action('返回主菜单'); await page.locator('#achievements-button').click();
      assert.equal(await page.locator('#achievement-summary').innerText(), '已完成3 / 20'); assert.equal(await page.locator('.achievement-card.is-earned').count(), 3);
      await page.reload(); await page.locator('#achievements-button').click(); assert.equal(await page.locator('#achievement-summary').innerText(), '已完成3 / 20');
      for (const [width,height] of [[320,480],[390,844],[844,390],[1280,720]]) {
        await page.setViewportSize({ width,height });
        assert.equal(await page.locator('#achievement-summary').evaluate(el => {
          const r = el.getBoundingClientRect(), h = document.getElementById('achievements-heading').getBoundingClientRect(), a = document.getElementById('app').getBoundingClientRect();
          return r.top >= h.bottom && Math.abs((r.left + r.right - h.left - h.right) / 2) < 1 && r.left >= a.left && r.right <= a.right;
        }), true);
      }
      await page.setViewportSize({ width:390,height:844 }); await page.locator('#achievements-back').click(); await enter(50);
      await page.clock.fastForward(29999); assert.equal((await state()).state, 'playing');
      await page.clock.runFor(101); assert.equal((await state()).state, 'playing'); assert.equal((await state()).modalOpen, false); assert.equal((await state()).failureReason, null);
      assert.equal(await page.locator('#achievement-toast-name').innerText(), '单相思');
      assert.equal(await page.locator('#achievement-toast-icon .heartbreak-half').count(), 2);
      const halves = await page.locator('#achievement-toast-icon .heartbreak-half').evaluateAll(groups => groups.map(g => ({ transform:g.getAttribute('transform'), d:g.firstElementChild.getAttribute('d') })));
      assert.deepEqual(halves.map(g=>g.transform), ['translate(-4 0)','translate(4 0)']);
      assert.match(halves[0].d, /L64 92 77 74 64 58 70 40Z$/); assert.match(halves[1].d, /^M70 40 64 58 77 74 64 92 70 122C/);
      await page.clock.fastForward(90000); assert.equal((await state()).state, 'playing'); assert.equal((await state()).progress, 0); assert.equal((await state()).displayedTide, 0);
      await page.locator('#board .tile').nth(0).click(); await page.locator('#board .tile').nth(1).click(); await page.clock.runFor(1200);
      assert.equal((await state()).state, 'won'); assert.equal(await page.locator('#modal-heading').innerText(), '感谢你的时间和精力！');
      await action('返回主菜单'); await page.locator('#achievements-button').click(); assert.equal(await page.locator('#achievement-summary').innerText(), '已完成4 / 20');
      assert.equal(await page.locator('[data-achievement="one-sided-love"] .achievement-copy p').count(), 0); await page.locator('#achievements-back').click();
      for (const id of [15,16,25,26,35,36]) {
        await enter(id);
        assert.equal(await page.locator('#journey-hint').count(), 0); assert.equal(await page.locator('#sort-feedback').count(), 0);
        assert.equal(await page.locator('#grass-puzzle-panel p').count(), 0);
        if (id < 20) {
          await page.clock.fastForward(5000); assert.equal((await state()).journey.phase, 'exploring');
          for (const [width,height] of [[320,480],[320,568],[390,844],[430,932],[844,390],[1280,720]]) {
            await page.setViewportSize({ width,height }); await page.clock.runFor(100);
            const fit = await page.evaluate(() => {
              const r = id => document.getElementById(id).getBoundingClientRect(), a = r('app'), target = r('journey-target'), board = r('board'), panel = r('journey-panel');
              return target.bottom <= board.top && board.bottom <= panel.top && panel.bottom <= a.bottom + 1 && board.left >= a.left && board.right <= a.right;
            });
            assert.equal(fit, true, JSON.stringify({id,width,height}));
          }
          await page.setViewportSize({width:390,height:844}); await page.clock.runFor(50);
          await page.locator('.journey-cell').nth(17).click(); assert.equal((await state()).journey.position, 17);
        } else if (id < 30) {
          await page.locator('#board .tile').nth(0).click(); assert.equal((await state()).turns, 1);
        } else {
          await page.locator('.sort-bucket').nth(0).click(); const empty = (await state()).bucketSort.buckets.findIndex(b => b.length === 0);
          await page.locator('.sort-bucket').nth(empty).click(); assert.equal((await state()).turns, 1);
          await page.locator('#sort-undo').click(); assert.equal(await page.locator('#sort-undo').isDisabled(), true);
        }
        await page.locator('#pause-button').click(); assert.equal(await page.locator('#modal-eyebrow').isHidden(), true); assert.equal(await page.locator('#modal-eyebrow').textContent(), '');
        assert.equal(await page.locator('#modal-heading').innerText(), '歇一歇，潮水等等'); assert.match(await page.locator('#modal-description').innerText(), /游戏已暂停/);
        if (id === 26) assert.match(await page.locator('#modal-conditions').innerText(), /15/);
        await action('返回选关'); await page.locator('#level-screen [data-menu]').click();
      }
      assert.deepEqual(errors, []); assert.deepEqual(external, []); await context.close();
      console.log(`PASS ${single ? 'isolated offline HTML' : 'source'}: 0/3/4 achievement counts, shared heart crack, waiting never fails, normal ending, six minigames cleaned, enlarged journey layout and actions, pause information preserved.`);
    }
  } finally { if (browser) await browser.close(); fs.rmSync(temp,{recursive:true,force:true}); }
})().catch(e=>{console.error(e);process.exitCode=1});
