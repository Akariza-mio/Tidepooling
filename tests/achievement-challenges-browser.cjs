// Actual timed play and layout checks; no screenshots or user-profile changes.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url'), { chromium } = require('./browser-support.cjs');
const solution = [0,2,5,1,4,1,4,0,2,5,2,5,1,4,0,4,0,2,5,1,5,1,4,0,2];
(async () => {
  const root = path.resolve(__dirname, '..'), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'beach-achievement-challenges-'));
  fs.copyFileSync(path.join(root, 'release/index1.html'), path.join(temp, 'index.html'));
  let browser;
  try {
    browser = await chromium.launch();
    for (const single of [false, true]) for (const scenario of ['quick', 'late', 'zen-matching', 'zen-puzzle', 'zen-first-puzzle']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', offline: true });
      const page = await context.newPage(), errors = [], external = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (!/^(file:|data:)/.test(request.url())) external.push(request.url()); });
      await page.clock.install({ time: new Date('2026-11-10T00:00:00Z') });
      await page.clock.pauseAt(new Date('2026-11-10T00:00:01Z'));
      await page.goto(pathToFileURL(single ? path.join(temp, 'index.html') : path.join(root, 'index.html')).href);
      const earned = () => page.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-achievements-v2') || '[]'));
      const action = name => page.getByRole('button', { name, exact: true }).click();
      if (scenario === 'quick') {
        await page.locator('#achievements-button').click();
        assert.deepEqual(await page.locator('.achievement-card h2').allTextContents(), ['反赌战士', '初出茅庐', '噫！我中了！', '揣度优先搜索', '挑食', '禅模式', '我只是点错了', '力挽狂澜', '眼疾手快', '除草技', '物以类聚', '开卷考试', '谢谢参与', '浪里白条', '超纲', '回头是岸', '差亿点', '横行霸道', '寸步难行', '单相思']);
        assert.equal(await page.locator('[data-achievement="picky-eater"] p').innerText(), '在同一关内连续配对6组相同的物品');
        assert.equal(await page.locator('[data-achievement="zen-mode"] p').innerText(), '在涨潮时仍未完成任何一组配对');
        for (const [width, height] of [[320,480],[320,568],[390,844],[430,932],[844,390],[1280,720]]) {
          await page.setViewportSize({ width, height });
          const fits = await page.locator('.achievement-list').evaluate(list => {
            const cards = [...list.children], bounds = cards.map(card => card.getBoundingClientRect());
            return bounds[0].right < bounds[1].left && Math.abs(bounds[0].top - bounds[1].top) < 1 && bounds.every(r => Math.abs(r.height - bounds[0].height) < 1 && Math.abs(r.width - bounds[0].width) < 1) && cards.every(card => {
              const v = card.querySelector('.achievement-visual').getBoundingClientRect(), p = card.querySelector('.achievement-copy').getBoundingClientRect();
              return v.right < p.left && card.scrollWidth <= card.clientWidth && card.querySelector('.achievement-status').parentElement.classList.contains('achievement-identity') && !card.querySelector('.achievement-copy .achievement-status') && [...card.querySelectorAll('h2,p')].every(text => {
                const r = text.getBoundingClientRect(); return text.scrollWidth <= text.clientWidth + 1 && r.left >= p.left && r.right <= p.right && r.top >= p.top && r.bottom <= p.bottom;
              });
            });
          });
          assert.equal(fits, true, JSON.stringify({ width, height }));
          await page.locator('[data-achievement="zen-mode"]').scrollIntoViewIfNeeded();
          assert.equal(await page.locator('[data-achievement="zen-mode"]').isVisible(), true);
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('#achievements-back').click();
      }
      await page.locator('#select-level-button').click();
      const level = scenario === 'zen-matching' ? 2 : scenario === 'zen-first-puzzle' ? 5 : 6;
      await page.locator(`#level-${level}`).click();
      if (scenario.startsWith('zen') && await page.getByRole('button', { name: '我知道了', exact: true }).isVisible()) await action('我知道了');
      if (scenario.startsWith('zen')) {
        const duration = await page.evaluate(() => beachDiagnostics.snapshot().duration);
        await page.clock.fastForward(duration - 1);
        assert.equal((await earned()).includes('zen-mode'), false);
        await page.clock.runFor(101);
        assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().state), 'lost');
        if (scenario === 'zen-matching') {
          assert.equal(await page.locator('#achievement-toast-name').innerText(), '禅模式');
          assert.deepEqual(await earned(), ['zen-mode']);
          assert.equal(await page.locator('#achievement-toast-icon .achievement-zen-art').count(), 1);
        } else {
          assert.deepEqual(await earned(), []);
          assert.equal(await page.locator('#achievement-toast').isVisible(), false);
        }
      } else {
        const beforeIntro = await page.evaluate(() => beachDiagnostics.snapshot().remaining);
        await page.clock.fastForward(60000);
        assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().remaining), beforeIntro);
        await action('我知道了');
        await page.clock.fastForward(1000);
        await page.locator('#pause-button').click();
        await page.clock.fastForward(90000);
        await action('继续赶海');
        const active = scenario === 'quick' ? 30000 : 30001;
        await page.clock.fastForward(active - 1000);
        const fixed = await page.evaluate(() => beachDiagnostics.snapshot().fixed);
        for (const kind of new Set(solution)) {
          await page.locator(`.puzzle-tool[data-kind="${kind}"]`).click();
          for (let i = 0; i < solution.length; i++) if (solution[i] === kind && !fixed[i]) await page.locator('.puzzle-cell').nth(i).click();
        }
        assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().state), 'won');
        assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().activeTime), active + 60000);
        await page.clock.runFor(1200); // Let the normal collection/settlement finish without adding play time.
        assert.deepEqual(await earned(), scenario === 'quick' ? ['quick-search'] : []);
        if (scenario === 'quick') {
          assert.equal(await page.locator('#achievement-toast-name').innerText(), '揣度优先搜索');
          assert.equal(await page.locator('#achievement-toast-icon .achievement-search-art').count(), 1);
        } else assert.equal(await page.locator('#achievement-toast').isVisible(), false);
        await page.clock.runFor(3500);
        assert.equal(await page.locator('#achievement-toast').isVisible(), false);
      }
      const saved = await earned();
      await page.reload(); await page.locator('#achievements-button').click();
      assert.equal(await page.locator('.achievement-card.is-earned').count(), saved.length);
      assert.equal(await page.locator('#achievement-toast').isVisible(), false);
      assert.deepEqual(errors, []); assert.deepEqual(external, []);
      await context.close();
      console.log(`PASS ${single ? 'isolated offline HTML' : 'source'}: ${scenario}, exact time/pause behavior, toast queue, icons and persistence.`);
    }
  } finally {
    if (browser) await browser.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
