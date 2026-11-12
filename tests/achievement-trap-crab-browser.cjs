// Real route trapping, near-complete timeout and formal ten-second completion. No screenshots.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url'), { chromium } = require('./browser-support.cjs');
(async () => {
  const root = path.resolve(__dirname, '..'), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'beach-trap-crab-'));
  fs.copyFileSync(path.join(root, 'release/index1.html'), path.join(temp, 'index.html'));
  let browser;
  try {
    browser = await chromium.launch();
    for (const single of [false, true]) for (const scenario of ['trap', 'almost', 'rush', 'late']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', offline: true }), page = await context.newPage(), errors = [], external = [];
      page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (!/^(file:|data:)/.test(r.url())) external.push(r.url()); });
      await page.clock.install({ time: new Date('2026-11-11T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-11-11T00:00:01Z'));
      await page.addInitScript(() => { Math.random = () => 0; });
      await page.goto(pathToFileURL(single ? path.join(temp, 'index.html') : path.join(root, 'index.html')).href);
      const action = name => page.getByRole('button', { name, exact: true }).click(), state = () => page.evaluate(() => beachDiagnostics.snapshot());
      const earned = () => page.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-achievements-v2') || '[]'));
      const id = scenario === 'trap' ? 16 : scenario === 'almost' ? 8 : 42;
      await page.locator('#select-level-button').click(); for (let i = 0; i < Math.floor((id - 1) / 10); i++) await page.locator('#chapter-next').click();
      await page.locator('#level-' + id).click();
      if (scenario === 'rush' || scenario === 'late') await page.clock.fastForward(60000);
      if (await page.getByRole('button', { name: '我知道了', exact: true }).isVisible()) await action('我知道了');
      if (scenario === 'trap') {
        await page.clock.fastForward(5000);
        for (const at of [17,10,3,4,11,18,19,20,27,34,33]) { await page.locator('.journey-cell').nth(at).click(); assert.equal((await earned()).includes('boxed-in'), false); }
        await page.locator('.journey-cell').nth(26).click();
        assert.equal((await state()).state, 'playing'); assert.equal((await state()).journey.collectedCount, 0);
        assert.equal((await earned()).includes('boxed-in'), true);
        assert.equal(await page.locator('#achievement-toast-name').innerText(), '回头是岸');
        assert.equal(await page.locator('#achievement-toast-icon .achievement-cage-art').count(), 1);
        await page.locator('.journey-cell').nth(25).click(); assert.equal((await state()).journey.position, 25);
      } else if (scenario === 'almost') {
        const tiles = page.locator('#board .tile'), values = await tiles.locator('.seaside-item').evaluateAll(nodes => nodes.map(n => Number(n.dataset.kind)));
        const held = values.map((kind,index) => ({kind,index})).filter(v => v.kind === values[0]).slice(0,2).map(v => v.index);
        for (const kind of new Set(values)) for (let i = 0; i < values.length; i++) if (values[i] === kind && !held.includes(i)) await tiles.nth(i).click();
        assert.equal((await state()).pairs, 17); await page.clock.fastForward(60000); await page.clock.runFor(100);
        assert.equal((await state()).state, 'lost'); assert.equal((await earned()).includes('one-pair-short'), true);
        assert.equal(await page.locator('#achievement-toast-name').innerText(), '差亿点');
        assert.equal(await page.locator('#achievement-toast-icon text').textContent(), '17/18');
      } else {
        for (let i = 0; i < 34; i++) await page.locator('#board .tile').nth(i).click();
        await page.locator('#pause-button').click(); await page.clock.fastForward(90000); await action('继续赶海');
        await page.clock.fastForward(scenario === 'rush' ? 10000 : 10001);
        await page.locator('#board .tile').nth(34).click(); await page.locator('#board .tile').nth(35).click();
        assert.equal((await state()).state, 'won'); await page.clock.runFor(1200);
        assert.equal((await earned()).includes('crab-rush'), scenario === 'rush', JSON.stringify(await state()));
        if (scenario === 'rush') {
          for (let i = 0; i < 70 && await page.locator('#achievement-toast-name').innerText() !== '横行霸道'; i++) await page.clock.runFor(200);
          assert.equal(await page.locator('#achievement-toast-name').innerText(), '横行霸道');
          assert.equal(await page.locator('#achievement-toast-icon .achievement-crab-crowd-art .seaside-item[data-kind="1"]').count(), 8);
        }
      }
      const saved = await earned(); await page.reload(); await page.locator('#achievements-button').click();
      assert.equal(await page.locator('.achievement-card').count(), 20); assert.equal(await page.locator('#achievement-summary').innerText(), `已完成${saved.length} / 20`);
      assert.equal(await page.locator('.achievement-card.is-earned').count(), saved.length); assert.equal(await page.locator('#achievement-toast').isVisible(), false);
      assert.equal(await page.locator('[data-achievement="boxed-in"] p').innerText(), '在2-6中把自己困住');
      if (scenario === 'trap') for (const [width,height] of [[320,480],[320,568],[390,844],[430,932],[844,390],[1280,720]]) {
        await page.setViewportSize({width,height});
        assert.equal(await page.locator('.achievement-list').evaluate(list => {
          const cards = [...list.children], boxes = cards.map(c => c.getBoundingClientRect()), ids = [...list.querySelectorAll('[id]')].map(n => n.id);
          return new Set(ids).size === ids.length && boxes[0].right < boxes[1].left && boxes.every(b => Math.abs(b.height - boxes[0].height) < 1) && cards.every(c => [...c.querySelector('.achievement-copy').children].every(el => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight) <= (el.tagName === 'H2' ? 1.05 : 3.05)));
        }), true, `${width}x${height}`);
        await page.locator('[data-achievement="crab-rush"]').scrollIntoViewIfNeeded();
      }
      assert.deepEqual(errors, []); assert.deepEqual(external, []); await context.close();
      console.log(`PASS ${single ? 'isolated offline HTML' : 'source'}: ${scenario}, actual play, achievement icon, persistence and count.`);
    }
  } finally { if (browser) await browser.close(); fs.rmSync(temp, {recursive:true,force:true}); }
})().catch(e => { console.error(e); process.exitCode = 1; });
