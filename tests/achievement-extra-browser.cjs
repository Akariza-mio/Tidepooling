// First-visit persistence and real timed wins. No screenshots or user-profile changes.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url'), { chromium } = require('./browser-support.cjs');
const levels = require('../levels.js'), key = 'beach-pairs-achievements-v2';
function routeToTarget(level, state) {
  const goal = state.targetIndex, blocked = new Set(level.treasures.filter(t => !state.collected.includes(t.index) && t.index !== goal).map(t => t.index));
  const queue = [[state.position]], seen = new Set([state.position]);
  for (const route of queue) {
    const at = route.at(-1); if (at === goal) return route.slice(1);
    for (const next of [at - level.columns, at + level.columns, at - 1, at + 1]) {
      if (next < 0 || next >= level.layout.length || level.layout[next] !== 0 || seen.has(next) || blocked.has(next)
        || Math.abs(Math.floor(next / level.columns) - Math.floor(at / level.columns)) + Math.abs(next % level.columns - at % level.columns) !== 1) continue;
      seen.add(next); queue.push([...route, next]);
    }
  }
  throw Error('No safe route to target');
}
(async () => {
  const root = path.resolve(__dirname, '..'), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'beach-achievement-extra-'));
  fs.copyFileSync(path.join(root, 'release/index1.html'), path.join(temp, 'index.html'));
  let browser;
  try {
    browser = await chromium.launch();
    for (const single of [false, true]) for (const scenario of ['skip', 'teach', 'abandon', 'clutch', 'too-early', 'eye', 'too-late', 'weed', 'weed-over']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', offline: true }), page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.clock.install({ time: new Date('2026-11-10T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-11-10T00:00:01Z'));
      const url = pathToFileURL(single ? path.join(temp, 'index.html') : path.join(root, 'index.html')).href;
      await page.goto(url);
      const action = name => page.getByRole('button', { name, exact: true }).click();
      const earned = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]'), key);
      const snapshot = () => page.evaluate(() => beachDiagnostics.snapshot());
      if (['skip', 'teach', 'abandon'].includes(scenario)) {
        await page.evaluate(() => localStorage.setItem('beach-pairs-completed-levels', '[1]'));
        await page.locator('#start-button').click();
        if (scenario === 'skip') {
          await action('跳过教程');
          assert.deepEqual(await earned(), ['first-tutorial-skip']);
          assert.equal(await page.locator('#achievement-toast-name').innerText(), '我只是点错了');
          assert.equal(await page.locator('#achievement-toast-icon .achievement-fast-forward-art polygon').count(), 2);
          const equilateral = await page.locator('#achievement-toast-icon polygon').evaluateAll(polygons => polygons.every(polygon => {
            const p = [...polygon.points], sides = p.map((point, i) => Math.hypot(point.x - p[(i + 1) % 3].x, point.y - p[(i + 1) % 3].y));
            return Math.max(...sides) - Math.min(...sides) < .001;
          }));
          assert.equal(equilateral, true);
        } else if (scenario === 'teach') await action('开始教学');
        await page.reload(); await page.locator('#start-button').click(); await action('跳过教程');
        assert.equal(await page.locator('#achievement-toast').isVisible(), false);
        assert.equal((await earned()).includes('first-tutorial-skip'), scenario === 'skip');
        assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-completed-levels')), '[1]');
        // Simulate entering a new release generation, without clearing level progress.
        await page.evaluate(() => {
          localStorage.setItem('beach-pairs-achievements-version', 'old-release');
          localStorage.setItem('beach-pairs-achievements-first-tutorial', 'old-release');
        });
        await page.reload(); await page.locator('#start-button').click(); await action('跳过教程');
        assert.deepEqual(await earned(), ['first-tutorial-skip']);
        assert.equal(await page.locator('#achievement-toast-name').innerText(), '我只是点错了');
      } else if (scenario.startsWith('weed')) {
        const solution = [0,4,5,7,10,11,12,15,18,23], moves = scenario === 'weed' ? solution : [0,0,...solution];
        await page.locator('#select-level-button').click(); await page.locator('#chapter-next').click(); await page.locator('#chapter-next').click();
        await page.locator('#level-25').click(); await action('我知道了');
        for (let i = 0; i < moves.length; i++) {
          if (i === moves.length - 1) assert.equal((await earned()).includes('weed-master'), false);
          await page.locator('#board .tile').nth(moves[i]).click();
        }
        assert.equal((await snapshot()).state, 'won'); assert.equal((await snapshot()).turns, moves.length);
        await page.clock.runFor(1200);
        assert.equal((await earned()).includes('weed-master'), scenario === 'weed');
        assert.equal((await earned()).includes('flawless-clear'), false);
        if (scenario === 'weed') {
          assert.equal(await page.locator('#achievement-toast-name').innerText(), '除草技');
          assert.equal(await page.locator('#achievement-toast-icon .achievement-spray-art').count(), 1);
        } else assert.equal(await page.locator('#achievement-toast').isVisible(), false);
      } else if (scenario === 'clutch' || scenario === 'too-early') {
        await page.locator('#select-level-button').click(); await page.locator('#level-2').click();
        const tiles = page.locator('#board .tile'), cards = await tiles.evaluateAll(tiles => tiles.map((tile, index) => ({ index, kind: Number(tile.querySelector('.seaside-item').dataset.kind) })));
        const held = cards.filter(c => c.kind === cards[0].kind).slice(0, 2).map(c => c.index);
        for (const kind of new Set(cards.map(c => c.kind))) for (const card of cards.filter(c => c.kind === kind && !held.includes(c.index))) await tiles.nth(card.index).click();
        const remaining = scenario === 'clutch' ? 3000 : 3001;
        await page.clock.fastForward(60000 - remaining);
        for (const index of held) await tiles.nth(index).click();
        assert.equal((await snapshot()).state, 'won'); assert.equal((await snapshot()).remaining, remaining + 5000);
        await page.clock.runFor(1200);
        assert.equal((await earned()).includes('last-second-clear'), scenario === 'clutch');
        await page.clock.runFor(3500);
        if (scenario === 'clutch') {
          assert.equal(await page.locator('#achievement-toast-name').innerText(), '力挽狂澜');
          assert.equal(await page.locator('#achievement-toast-icon .achievement-clock-art').count(), 1);
        }
      } else {
        const level = levels.find(l => l.id === 15), total = scenario === 'eye' ? 20000 : 20001;
        await page.locator('#select-level-button').click(); await page.locator('#chapter-next').click(); await page.locator('#level-15').click(); await action('我知道了');
        await page.clock.fastForward(level.previewDuration);
        await page.locator('#pause-button').click(); await page.clock.fastForward(90000); await action('继续赶海');
        let prior = 0;
        for (let round = 0; round < 5; round++) {
          const now = Math.floor((round + 1) * total / 5); await page.clock.fastForward(now - prior); prior = now;
          const state = (await snapshot()).journey;
          for (const index of routeToTarget(level, state)) await page.locator('.journey-cell').nth(index).click();
        }
        assert.equal((await snapshot()).state, 'won'); assert.equal((await snapshot()).activeTime, total + level.previewDuration);
        await page.clock.runFor(1200);
        assert.equal((await earned()).includes('quick-fog-search'), scenario === 'eye');
        assert.equal((await earned()).includes('flawless-clear'), false);
        if (scenario === 'eye') {
          assert.equal(await page.locator('#achievement-toast-name').innerText(), '眼疾手快');
          assert.equal(await page.locator('#achievement-toast-icon .achievement-eye-art').count(), 1);
        }
        await page.clock.runFor(3500);
        assert.equal(await page.locator('#achievement-toast').isVisible(), false);
      }
      const saved = await earned(); await page.reload(); await page.locator('#achievements-button').click();
      assert.equal(await page.locator('.achievement-card').count(), 20);
      assert.equal(await page.locator('.achievement-card.is-earned').count(), saved.length);
      assert.equal(await page.locator('[data-achievement="flawless-clear"] p').innerText(), '在没有配对失败的情况下通关任意一关');
      assert.equal(await page.locator('#achievement-toast').isVisible(), false);
      assert.deepEqual(errors, []); await context.close();
      console.log(`PASS ${single ? 'isolated offline HTML' : 'source'}: ${scenario}, correct award/denial, icons, persistence and no replay.`);
    }
  } finally { if (browser) await browser.close(); fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
