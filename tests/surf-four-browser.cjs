// Functional/DOM validation with existing Chrome; no screenshots or archives.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.clock.install({ time: new Date('2026-11-02T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-11-02T00:00:01Z'));
    await page.addInitScript(() => {
      localStorage.setItem('beach-pairs-unlock-all', 'on');
      window.surfDraws = [];
      Math.random = () => window.surfDraws.length ? window.surfDraws.shift() : 0;
    });
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    const state = () => page.evaluate(() => beachDiagnostics.snapshot());
    const action = name => page.getByRole('button', { name, exact: true }).click();
    const tile = i => page.locator('.tile').nth(i);
    const pair = async (a,b) => { await tile(a).click(); await tile(b).click(); };
    const advance = async time => { await page.clock.runFor(Math.max(0, time - (await state()).surf.time) + 20); };
    const setDraws = values => page.evaluate(values => { window.surfDraws = values; }, values);
    await page.locator('#select-level-button').click();
    for (let i = 0; i < 3; i++) await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#chapter-4 .chapter-level:enabled').count(), 10);
    assert.equal(await page.locator('#level-49').isDisabled(), true);
    await page.locator('#level-33').click(); await action('我知道了');
    const third = await page.locator('.tile .seaside-item').evaluateAll(items => items.map(item => Number(item.dataset.kind)));
    for (const kind of [0,1,2,3,4,5]) for (let i = 0; i < third.length; i++) if (third[i] === kind) await tile(i).click();
    await page.clock.runFor(1000); await action('下一关');
    assert.equal((await state()).levelId, 34); assert.equal(await page.locator('#play-number').innerText(), '04');
    assert.equal(await page.locator('#modal-heading').innerText(), '海浪会同时冲刷两处！');
    assert.deepEqual((await state()).conditions, []); assert.equal(await page.locator('#level-objectives').isVisible(), false);
    const deck = await page.locator('.tile .seaside-item').evaluateAll(items => items.map(item => Number(item.dataset.kind)));
    assert.deepEqual([0,1,2,3,4,5].map(kind => deck.filter(value => value === kind).length), [6,6,6,6,6,6]);
    assert.notDeepEqual(deck, third);
    await page.clock.fastForward(60000); assert.equal((await state()).surf.time, 0); assert.equal((await state()).remaining, 60000);
    const cases = [
      { name:'rows', draws:[0,0], targets:[{axis:'row',index:0},{axis:'row',index:1}], count:12 },
      { name:'columns', draws:[.99,.99], targets:[{axis:'column',index:5},{axis:'column',index:4}], count:12 },
      { name:'mixed', draws:[0,.99], targets:[{axis:'row',index:0},{axis:'column',index:5}], count:11 }
    ];
    for (const fixture of cases) {
      await setDraws(fixture.draws); await action('我知道了'); await page.emulateMedia({ reducedMotion:'no-preference' });
      if (fixture.name === 'rows') await pair(0,2);
      // Pair particles use randomness too, so pin draws just before the warning.
      await setDraws(fixture.draws); await advance(12100);
      assert.equal((await state()).surf.phase, 'warning'); assert.deepEqual((await state()).surf.targets, fixture.targets);
      assert.equal(await page.locator('.surf-warning:visible').count(), 2);
      assert.equal(await page.locator('.board-surf:visible').count(), 2);
      const uniqueIds = await page.locator('.board-surf [id]').evaluateAll(nodes => nodes.map(node => node.id));
      assert.equal(new Set(uniqueIds).size, uniqueIds.length);
      await advance(14900); const before = await state(); await advance(15100); const active = await state();
      assert.equal(active.surf.phase, 'arriving'); assert.equal(active.surf.covered.filter(Boolean).length, fixture.count);
      assert.equal(before.remaining - active.remaining - (active.surf.time - before.surf.time), 6000);
      assert.equal(await page.locator('.surf-visual:visible').count(), 2);
      for (const index of active.surf.covered.flatMap((covered,i) => covered ? [i] : [])) {
        assert.match(await tile(index).getAttribute('aria-label'), /海浪冲刷中/);
        assert.doesNotMatch(await tile(index).getAttribute('aria-label'), /已收集|螃蟹|扇贝|八爪鱼/);
        await tile(index).dispatchEvent('click');
      }
      assert.deepEqual((await state()).statuses, active.statuses); assert.equal((await state()).mismatches, active.mismatches);
      assert.equal((await state()).surf.count, 1);
      const a = deck.findIndex((kind,i) => active.statuses[i] === 'hidden' && !active.surf.covered[i] && deck.some((other,j) => j !== i && kind === other && active.statuses[j] === 'hidden' && !active.surf.covered[j]));
      const b = deck.findIndex((kind,i) => i !== a && kind === deck[a] && active.statuses[i] === 'hidden' && !active.surf.covered[i]);
      await pair(a,b); assert.equal((await state()).pairs, active.pairs + 1);
      await page.locator('#pause-button').click(); const paused = await state();
      const styles = await page.locator('.surf-band').evaluateAll(nodes => nodes.map(node => node.getAttribute('style')));
      assert.deepEqual(await page.locator('.surf-band-flow').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).animationPlayState)), ['paused','paused']);
      await page.clock.fastForward(30000); assert.equal((await state()).surf.time, paused.surf.time);
      assert.deepEqual((await state()).surf.targets, fixture.targets);
      assert.deepEqual(await page.locator('.surf-band').evaluateAll(nodes => nodes.map(node => node.getAttribute('style'))), styles);
      await action('继续赶海');
      if (fixture.name === 'mixed') for (const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:1280,height:720},{width:844,height:390}]) {
        await page.setViewportSize(viewport); await page.clock.runFor(30);
        const fits = await page.evaluate(() => {
          const tiles = [...document.querySelectorAll('.tile')];
          return [...document.querySelectorAll('.board-surf')].every((layer,targetIndex) => {
            const target = beachDiagnostics.snapshot().surf.targets[targetIndex];
            const first = target.axis === 'row' ? target.index * 6 : target.index;
            const last = target.axis === 'row' ? first + 5 : first + 30;
            const a = tiles[first].getBoundingClientRect(), b = tiles[last].getBoundingClientRect(), wave = layer.getBoundingClientRect();
            return wave.left <= a.left && wave.right >= b.right && wave.top <= a.top && wave.bottom >= b.bottom;
          }) && document.documentElement.scrollWidth <= innerWidth;
        });
        assert.equal(fits, true, JSON.stringify(viewport));
      }
      await page.setViewportSize({width:390,height:844}); await advance(16100);
      assert.equal((await state()).surf.phase, 'washing');
      assert.deepEqual(await page.locator('.surf-band').evaluateAll(nodes => nodes.map(node => Number(node.style.opacity))), [1,1]);
      await advance(20900); assert.equal((await state()).surf.phase, 'washing');
      await advance(21100); assert.equal((await state()).surf.phase, 'retreating');
      assert.equal((await state()).surf.covered.filter(Boolean).length, fixture.count);
      await advance(22300); assert.deepEqual((await state()).surf.targets, []); assert.equal(await page.locator('.board-surf:visible').count(), 0);
      if (fixture.name === 'rows') {
        assert.equal((await state()).statuses[0], 'matched'); assert.equal((await state()).statuses[2], 'matched');
        await setDraws([0,.99]); await advance(27100);
        assert.deepEqual((await state()).surf.targets, cases[2].targets);
        assert.deepEqual(await page.locator('.board-surf').evaluateAll(nodes => nodes.map(node => node.classList.contains('is-column'))), [false,true]);
      }
      await page.locator('#pause-button').click(); await action('重新开始');
      assert.deepEqual((await state()).surf.targets, []); assert.equal((await state()).surf.count, 0); assert.equal((await state()).remaining, 60000);
      assert.deepEqual(await page.locator('.tile .seaside-item').evaluateAll(items => items.map(item => Number(item.dataset.kind))), deck);
    }
    // The new level has no twenty-mistake restriction.
    await action('我知道了');
    for (let i = 0; i < 21; i++) { await pair(0,1); await page.clock.runFor(520); }
    assert.equal((await state()).state, 'playing'); assert.equal((await state()).mismatches, 21);
    for (const kind of [0,1,2,3,4,5]) for (let i = 0; i < deck.length; i++) if (deck[i] === kind) await tile(i).click();
    await page.clock.runFor(1000); assert.equal((await state()).state, 'won'); assert.equal((await state()).pairs, 18);
    assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-completed-levels')), null);
    await action('下一关'); assert.equal((await state()).levelId, 35);
    assert.equal(await page.locator('.sort-bucket').count(), 6);
    assert.equal(await page.locator('.board-surf').count(), 0);
    await action('我知道了'); await page.locator('#pause-button').click(); await action('返回选关'); await page.locator('#level-33').click();
    assert.equal(await page.locator('.board-surf').count(), 1); assert.equal((await state()).conditions[0].type, 'maxMismatches');
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log('PASS: third-to-fourth entry, two-row/two-column/mixed warnings and simultaneous waves, unique SVG IDs, intersection/collected masking, one penalty per wave, pause/retry/five viewport sizes, next-wave orientation changes, no inherited mistake limit, victory/progress isolation and single-wave cleanup. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
