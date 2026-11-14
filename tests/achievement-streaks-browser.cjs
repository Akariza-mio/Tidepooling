const enterArithmeticAnswer = require('./arithmetic-keypad.cjs');
// Real streak events and the hidden ending waiting milestone. No screenshots.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url'), { chromium } = require('./browser-support.cjs');
(async () => {
  const root = path.resolve(__dirname, '..'), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'beach-streak-achievements-'));
  fs.copyFileSync(path.join(root, 'release/index1.html'), path.join(temp, 'index.html'));
  let browser;
  try {
    browser = await chromium.launch();
    for (const single of [false, true]) for (const scenario of ['slots', 'wave', 'math', 'heart']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', offline: true }), page = await context.newPage(), errors = [], external = [];
      page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (!/^(file:|data:)/.test(r.url())) external.push(r.url()); });
      await page.clock.install({ time: new Date('2026-11-11T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-11-11T00:00:01Z'));
      await page.addInitScript(() => { window.slotDraws = []; Math.random = () => window.slotDraws.shift() ?? 0; });
      await page.goto(pathToFileURL(single ? path.join(temp, 'index.html') : path.join(root, 'index.html')).href);
      const action = name => page.getByRole('button', { name, exact: true }).click(), state = () => page.evaluate(() => beachDiagnostics.snapshot());
      const earned = () => page.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-achievements-v2') || '[]'));
      await page.locator('#select-level-button').click(); for (let i = 0; i < (scenario === 'wave' ? 3 : 4); i++) await page.locator('#chapter-next').click();
      await page.locator('#level-' + ({ slots: 45, wave: 31, math: 46, heart: 50 }[scenario])).click();
      if (await page.getByRole('button', { name: '我知道了', exact: true }).isVisible()) await action('我知道了');
      if (scenario === 'slots') {
        const tiles = page.locator('#board .tile');
        for (let i = 0; i < 5; i++) {
          const pair = await tiles.evaluateAll(tiles => tiles.filter(t => t.dataset.status === 'hidden' && t.querySelector('.seaside-item').dataset.kind === '1').slice(0,2).map(t => Number(t.dataset.index)));
          for (const index of pair) await tiles.nth(index).click();
          await page.evaluate(() => { window.slotDraws = [.01,.41,.61]; });
          await page.locator('#slot-lever').click(); await page.clock.runFor(1100);
          assert.equal((await state()).slotMachine.autoPairs, 0);
          assert.equal((await earned()).includes('thanks-for-playing'), i === 4);
        }
        assert.equal(await page.locator('#achievement-toast-name').innerText(), '谢谢参与');
        assert.equal(await page.locator('#achievement-toast-icon .achievement-handshake-art').count(), 1);
      } else if (scenario === 'wave') {
        await page.clock.fastForward(21000); assert.equal((await state()).surf.phase, 'washing');
        const tiles = page.locator('#board .tile');
        for (let i = 0; i < 3; i++) {
          const s = await state(), pair = await tiles.evaluateAll((tiles, s) => {
            const available = tiles.filter(t => s.statuses[Number(t.dataset.index)] === 'hidden' && !s.surf.covered[Number(t.dataset.index)]);
            const first = available.find(t => available.filter(v => v.querySelector('.seaside-item').dataset.kind === t.querySelector('.seaside-item').dataset.kind).length >= 2);
            return available.filter(t => t.querySelector('.seaside-item').dataset.kind === first.querySelector('.seaside-item').dataset.kind).slice(0,2).map(t => Number(t.dataset.index));
          }, s);
          for (const index of pair) await tiles.nth(index).click(); assert.equal((await earned()).includes('wave-rider'), i === 2);
        }
        assert.equal(await page.locator('#achievement-toast-name').innerText(), '浪里白条');
        assert.deepEqual(await page.locator('#achievement-toast-icon .seaside-item').evaluateAll(items => items.map(item => Number(item.dataset.kind))), [0,1,4]);
        assert.deepEqual(await page.locator('#achievement-toast-icon .seaside-item').evaluateAll(items => items.map(item => Number(item.getAttribute('y')))), [5,42,82]);
      } else if (scenario === 'math') {
        for (let i = 0; i < 3; i++) {
          await enterArithmeticAnswer(page, '999'); await page.locator('#arithmetic-submit').click();
          assert.equal((await earned()).includes('beyond-syllabus'), i === 2); assert.equal((await state()).arithmetic.completed, 0);
        }
        assert.equal((await state()).remaining, 75000); assert.equal(await page.locator('#achievement-toast-name').innerText(), '超纲');
        assert.equal(await page.locator('#achievement-toast-icon .achievement-book-cross-art').count(), 1);
      } else {
        await page.clock.fastForward(29999); assert.equal((await state()).state, 'playing'); assert.equal((await earned()).includes('one-sided-love'), false);
        await page.clock.runFor(101); assert.equal((await state()).state, 'playing'); assert.equal((await state()).failureReason, null);
        assert.equal((await state()).progress, 0); assert.equal((await state()).displayedTide, 0); assert.equal(await page.locator('#tide-danger').isVisible(), false);
        assert.equal(await page.locator('#achievement-toast-name').innerText(), '单相思'); assert.equal(await page.locator('#achievement-toast-icon .achievement-heartbreak-art').count(), 1);
        assert.equal((await state()).modalOpen, false);
        await page.locator('#pause-button').click(); await action('重新开始'); await page.clock.fastForward(25000); await page.locator('#board .tile').nth(0).click(); await page.clock.fastForward(25000);
        assert.equal((await state()).state, 'playing'); await page.locator('#pause-button').click(); await page.clock.fastForward(90000); await action('继续赶海');
        await page.locator('#board .tile').nth(1).click(); assert.equal((await state()).state, 'won'); await page.clock.runFor(1200);
        assert.equal(await page.locator('#modal-heading').innerText(), '感谢你的时间和精力！');
        await page.clock.fastForward(60000); assert.equal((await state()).state, 'won');
      }
      const saved = await earned(); await page.reload(); await page.locator('#achievements-button').click();
      assert.equal(await page.locator('.achievement-card').count(), 20); assert.equal(await page.locator('.achievement-card.is-earned').count(), saved.length);
      assert.equal(await page.locator('[data-achievement="one-sided-love"] .achievement-copy p').count(), 0);
      assert.equal(await page.locator('[data-achievement="one-sided-love"] h2').innerText(), '单相思');
      assert.equal(await page.locator('#achievement-toast').isVisible(), false);
      if (scenario === 'heart') for (const [width, height] of [[320,480],[320,568],[390,844],[430,932],[844,390],[1280,720]]) {
        await page.setViewportSize({ width, height });
        const fit = await page.locator('.achievement-list').evaluate(list => {
          const cards = [...list.children], boxes = cards.map(c => c.getBoundingClientRect()), ids = [...list.querySelectorAll('[id]')].map(n => n.id);
          return new Set(ids).size === ids.length && boxes[0].right < boxes[1].left && boxes.every(b => Math.abs(b.width - boxes[0].width) < 1 && Math.abs(b.height - boxes[0].height) < 1) && cards.every(c => {
            const v = c.querySelector('.achievement-visual').getBoundingClientRect(), status = c.querySelector('.achievement-status').getBoundingClientRect(), copy = c.querySelector('.achievement-copy'), r = copy.getBoundingClientRect();
            return status.bottom < v.top && v.right < r.left && copy.scrollHeight <= copy.clientHeight + 1 && [...copy.children].every(el => {
              const b = el.getBoundingClientRect(); return el.scrollWidth <= el.clientWidth + 1 && b.top >= r.top && b.bottom <= r.bottom && b.height / parseFloat(getComputedStyle(el).lineHeight) <= (el.tagName === 'H2' ? 1.05 : 3.05);
            });
          });
        });
        assert.equal(fit, true, JSON.stringify({ width, height })); await page.locator('[data-achievement="one-sided-love"]').scrollIntoViewIfNeeded();
      }
      assert.deepEqual(errors, []); assert.deepEqual(external, []); await context.close();
      console.log(`PASS ${single ? 'isolated offline HTML' : 'source'}: ${scenario}, real events, icons, state reset and persistence.`);
    }
  } finally { if (browser) await browser.close(); fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
