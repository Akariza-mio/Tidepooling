// Actual optimal sorting and timed arithmetic. No screenshots or user-profile writes.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url'), { chromium } = require('./browser-support.cjs');
const solution = require('./bucket-sort-six-solution.cjs'), MathGame = require('../arithmetic.js'), mathLevel = require('../levels.js').find(l => l.id === 46);
const answers = mathLevel.rounds.map(round => MathGame.evaluate(round.target, round.values));
(async () => {
  const root = path.resolve(__dirname, '..'), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'beach-achievement-sort-math-'));
  fs.copyFileSync(path.join(root, 'release/index1.html'), path.join(temp, 'index.html'));
  let browser;
  try {
    browser = await chromium.launch();
    for (const single of [false, true]) for (const scenario of ['optimal', 'undo', 'books', 'late']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', offline: true }), page = await context.newPage(), errors = [], external = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', request => { if (!/^(file:|data:)/.test(request.url())) external.push(request.url()); });
      await page.clock.install({ time: new Date('2026-11-11T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-11-11T00:00:01Z'));
      await page.goto(pathToFileURL(single ? path.join(temp, 'index.html') : path.join(root, 'index.html')).href);
      const action = name => page.getByRole('button', { name, exact: true }).click();
      const earned = () => page.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-achievements-v2') || '[]'));
      const state = () => page.evaluate(() => beachDiagnostics.snapshot());
      await page.locator('#select-level-button').click();
      const sorting = ['optimal', 'undo'].includes(scenario);
      for (let i = 0; i < (sorting ? 3 : 4); i++) await page.locator('#chapter-next').click();
      await page.locator(sorting ? '#level-36' : '#level-46').click();
      if (sorting) {
        const move = async (from, to) => { await page.locator('.sort-bucket').nth(from).click(); await page.locator('.sort-bucket').nth(to).click(); };
        if (scenario === 'undo') { await move(0, 6); await page.locator('#sort-undo').click(); }
        for (const [from, to] of solution) await move(from, to);
        assert.equal((await state()).state, 'won'); assert.equal((await state()).turns, scenario === 'optimal' ? 34 : 35);
        await page.clock.runFor(1200);
        assert.equal((await earned()).includes('optimal-sort'), scenario === 'optimal');
        if (scenario === 'optimal') {
          assert.equal(await page.locator('#achievement-toast-name').innerText(), '物以类聚');
          assert.equal(await page.locator('#achievement-toast-icon .achievement-crab-bucket-art .seaside-item[data-kind="1"]').count(), 3);
        }
      } else {
        const input = page.locator('#arithmetic-answer'), submit = page.locator('#arithmetic-submit');
        await input.fill('999'); await submit.click();
        for (const answer of answers.slice(0, 9)) { await input.fill(String(answer)); await submit.click(); }
        assert.equal((await state()).arithmetic.completed, 9);
        await page.locator('#pause-button').click(); await page.clock.fastForward(90000); await action('继续赶海');
        const time = scenario === 'books' ? 30000 : 30001; await page.clock.fastForward(time);
        await input.fill(String(answers.at(-1))); await submit.click();
        assert.equal((await state()).state, 'won'); assert.equal((await state()).activeTime, time);
        await page.clock.runFor(1200);
        assert.equal((await earned()).includes('open-book'), scenario === 'books');
        if (scenario === 'books') {
          assert.equal(await page.locator('#achievement-toast-name').innerText(), '开卷考试');
          assert.equal(await page.locator('#achievement-toast-icon .achievement-book').count(), 3);
        }
      }
      assert.equal((await earned()).includes('flawless-clear'), false);
      const saved = await earned(); await page.reload(); await page.locator('#achievements-button').click();
      assert.equal(await page.locator('.achievement-card').count(), 20); assert.equal(await page.locator('.achievement-card.is-earned').count(), saved.length);
      assert.equal(await page.locator('[data-achievement="optimal-sort"] p').innerText(), '在4-6中走出最优解');
      assert.equal(await page.locator('[data-achievement="open-book"] p').innerText(), '30s内通关5-6');
      assert.equal(await page.locator('#achievement-toast').isVisible(), false);
      if (scenario === 'optimal') for (const [width, height] of [[320,480],[320,568],[390,844],[430,932],[844,390],[1280,720]]) {
        await page.setViewportSize({ width, height });
        const fit = await page.locator('.achievement-list').evaluate(list => {
          const cards = [...list.children], boxes = cards.map(c => c.getBoundingClientRect());
          const ids = [...list.querySelectorAll('[id]')].map(el => el.id);
          return new Set(ids).size === ids.length && boxes[0].right < boxes[1].left && boxes.every(b => Math.abs(b.width - boxes[0].width) < 1 && Math.abs(b.height - boxes[0].height) < 1) && cards.every(c => {
            const v = c.querySelector('.achievement-visual').getBoundingClientRect(), badge = c.querySelector('.achievement-status').getBoundingClientRect(), copy = c.querySelector('.achievement-copy'), r = copy.getBoundingClientRect();
            return badge.bottom < v.top && v.right < r.left && copy.scrollHeight <= copy.clientHeight + 1 && [...copy.children].every(el => {
              const b = el.getBoundingClientRect(), lines = b.height / parseFloat(getComputedStyle(el).lineHeight);
              return el.scrollWidth <= el.clientWidth + 1 && b.top >= r.top && b.bottom <= r.bottom && lines <= (el.tagName === 'H2' ? 1.05 : 3.05);
            });
          });
        });
        assert.equal(fit, true, JSON.stringify({ width, height })); await page.locator('[data-achievement="open-book"]').scrollIntoViewIfNeeded();
      }
      assert.deepEqual(errors, []); assert.deepEqual(external, []); await context.close();
      console.log(`PASS ${single ? 'isolated offline HTML' : 'source'}: ${scenario}, real win, exact boundary, icon, persistence, pairing isolation.`);
    }
  } finally { if (browser) await browser.close(); fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
