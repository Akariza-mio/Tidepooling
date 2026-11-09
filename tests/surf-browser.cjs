// Functional/DOM checks only; uses existing Chrome and never captures images.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.clock.install({ time: new Date('2026-11-02T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-11-02T00:00:01Z'));
    await page.addInitScript(() => {
      localStorage.setItem('beach-pairs-unlock-all', 'on');
      window.surfTestRandom = 0;
      Math.random = () => window.surfTestRandom;
    });
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const action = name => page.getByRole('button', { name, exact: true }).click();
    const state = () => page.evaluate(() => beachDiagnostics.snapshot());
    const tile = index => page.locator('.tile').nth(index);
    const advanceTo = async time => {
      const before = await state();
      await page.clock.runFor(Math.max(0, time - before.surf.time) + 20);
    };
    const pair = async (a, b) => { await tile(a).click(); await tile(b).click(); };
    await page.locator('#select-level-button').click();
    for (let i = 0; i < 3; i++) await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#chapter-4 .chapter-level:enabled').count(), 10);
    assert.equal(await page.locator('#level-35').isDisabled(), false);
    await page.locator('#level-31').click();
    assert.equal(await page.locator('#play-chapter').innerText(), '踏浪而寻');
    assert.equal(await page.locator('#play-number').innerText(), '01');
    assert.equal(await page.locator('#play-surf-scene').isVisible(), true);
    assert.equal(await page.locator('#play-reef-scene').isVisible(), false);
    assert.equal(await page.locator('#modal-art .surf-emblem-art').count(), 1);
    assert.equal(await page.locator('#modal-heading').innerText(), '你来到了风浪更大的海湾！');
    assert.equal(await page.locator('#modal-description').innerText(), '海浪每隔一定时间会随机冲刷某些行或列\n在海浪冲刷时，你不能对被冲刷的行或列进行操作！\n并且，海浪还会使潮水略微上涨。');
    const deck = await page.locator('.tile .seaside-item').evaluateAll(items => items.map(item => Number(item.dataset.kind)));
    assert.deepEqual([0,1,2,4,5].map(kind => deck.filter(value => value === kind).length), [8,8,8,6,6]);
    assert.equal(deck.includes(3), false);
    await page.clock.fastForward(60000);
    assert.equal((await state()).remaining, 60000); assert.equal((await state()).surf.time, 0);
    await action('我知道了');
    await pair(2,5); // Already collected holes must be masked by the first row wave.
    await advanceTo(16900); assert.equal((await state()).surf.phase, 'calm');
    await advanceTo(17100); assert.equal((await state()).surf.phase, 'warning');
    assert.deepEqual((await state()).surf.target, { axis: 'row', index: 0 });
    assert.equal(await page.locator('.surf-warning').isVisible(), true);
    assert.equal(await page.locator('.surf-band').isVisible(), false);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const flash = await page.locator('.surf-warning').evaluate(el => {
      const animation = el.getAnimations()[0];
      animation.pause(); animation.currentTime = 0;
      const bright = Number(getComputedStyle(el).opacity);
      animation.currentTime = 470;
      const dim = Number(getComputedStyle(el).opacity);
      animation.play();
      return { bright, dim };
    });
    assert.equal(flash.bright, 1); assert.ok(flash.dim < .2);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Warning is decorative: a still-hidden tile in the target row can be opened.
    await tile(0).click(); assert.equal((await state()).statuses[0], 'open');
    await page.locator('#pause-button').click(); const warningPause = await state();
    await page.clock.fastForward(30000); assert.equal((await state()).surf.time, warningPause.surf.time);
    assert.equal((await state()).surf.phase, 'warning'); await action('继续赶海');
    await advanceTo(19900); const beforeWave = await state();
    await advanceTo(20100); const wave = await state();
    assert.equal(wave.surf.phase, 'arriving'); assert.equal(wave.surf.count, 1);
    assert.equal(beforeWave.remaining - wave.remaining - (wave.surf.time - beforeWave.surf.time), 3000);
    assert.equal(wave.surf.covered.filter(Boolean).length, 6);
    assert.equal(await page.locator('.surf-band').isVisible(), true);
    assert.equal(await page.locator('.surf-warning').isVisible(), false);
    // The incoming water moves gently while every cell is already uniformly masked.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.clock.runFor(20);
    const arriving = await page.locator('.surf-band').evaluate(el => ({ opacity: Number(el.style.opacity), transform: el.style.transform }));
    assert.ok(arriving.opacity > 0 && arriving.opacity < .3);
    assert.match(arriving.transform, /translateX\(-/);
    for (const index of [0,1,2,3,4,5]) {
      assert.match(await tile(index).getAttribute('aria-label'), /海浪冲刷中/);
      assert.doesNotMatch(await tile(index).getAttribute('aria-label'), /已收集|扇贝|螃蟹|小虾|海螺|鱼儿/);
      assert.equal(await tile(index).getAttribute('aria-disabled'), 'true');
      const box = await tile(index).boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    const blocked = await state();
    assert.deepEqual(blocked.statuses, wave.statuses); assert.equal(blocked.turns, wave.turns);
    assert.equal(blocked.pairs, wave.pairs); assert.equal(blocked.surf.count, 1);
    assert.equal(await tile(0).locator('.shell-face').evaluate(el => getComputedStyle(el).visibility), 'hidden');
    // An accessible partner may still match the already-open card under the wave.
    await tile(10).click(); assert.equal((await state()).pairs, 2);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('#pause-button').click(); const washPause = await state();
    const pausedEnvelope = await page.locator('.surf-band').getAttribute('style');
    assert.equal(await page.locator('.surf-band-flow').evaluate(el => getComputedStyle(el).animationPlayState), 'paused');
    await page.clock.fastForward(30000); assert.equal((await state()).surf.time, washPause.surf.time);
    assert.equal((await state()).remaining, washPause.remaining);
    assert.equal(await page.locator('.surf-band').getAttribute('style'), pausedEnvelope);
    await action('继续赶海');
    assert.equal(await page.locator('.surf-band-flow').evaluate(el => getComputedStyle(el).animationPlayState), 'running');
    // The band must still cover its six complete cells after each resize.
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport); await page.clock.runFor(40);
      assert.equal(await page.evaluate(() => {
        const band = document.querySelector('.board-surf').getBoundingClientRect();
        const first = document.querySelectorAll('.tile')[0].getBoundingClientRect();
        const last = document.querySelectorAll('.tile')[5].getBoundingClientRect();
        return band.left <= first.left && band.right >= last.right && band.top <= first.top && band.bottom >= first.bottom
          && document.documentElement.scrollWidth <= innerWidth;
      }), true, JSON.stringify(viewport));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await advanceTo(21200);
    assert.equal(await page.locator('.surf-band').evaluate(el => Number(el.style.opacity)), 1);
    assert.equal(await page.evaluate(() => {
      const wave = document.querySelector('.surf-visual').getBoundingClientRect();
      const board = document.querySelector('.board').getBoundingClientRect();
      return wave.left < board.left - 40 && wave.right > board.right + 40;
    }), true);
    await advanceTo(25900);
    assert.equal((await state()).surf.phase, 'washing');
    assert.equal(await page.locator('.surf-band').evaluate(el => Number(el.style.opacity)), 1);
    await advanceTo(26800);
    assert.equal((await state()).surf.phase, 'retreating');
    const retreating = await page.locator('.surf-band').evaluate(el => ({ opacity: Number(el.style.opacity), transform: el.style.transform }));
    assert.ok(retreating.opacity > 0 && retreating.opacity < .5);
    assert.match(retreating.transform, /translateX\([0-9]/);
    assert.equal((await state()).surf.covered.filter(Boolean).length, 6);
    await advanceTo(27300); assert.equal((await state()).surf.phase, 'calm');
    assert.equal(await page.locator('.is-surf-covered').count(), 0);
    assert.equal((await state()).statuses[2], 'matched'); assert.equal((await state()).statuses[0], 'matched');
    assert.equal(await tile(2).isDisabled(), true);
    await page.evaluate(() => { window.surfTestRandom = .99; });
    await advanceTo(37100); assert.deepEqual((await state()).surf.target, { axis: 'column', index: 5 });
    assert.equal(await page.locator('.board-surf').evaluate(el => el.classList.contains('is-column')), true);
    await advanceTo(40100); assert.equal((await state()).surf.count, 2);
    assert.deepEqual((await state()).surf.covered.flatMap((covered,i) => covered ? [i] : []), [5,11,17,23,29,35]);
    const columnBounds = await page.evaluate(() => {
      const band = document.querySelector('.board-surf').getBoundingClientRect();
      const first = document.querySelectorAll('.tile')[5].getBoundingClientRect();
      const last = document.querySelectorAll('.tile')[35].getBoundingClientRect();
      return band.top <= first.top && band.bottom >= last.bottom && band.left <= first.left && band.right >= first.right;
    });
    assert.equal(columnBounds, true);
    assert.equal(await page.evaluate(() => {
      const wave = document.querySelector('.surf-visual').getBoundingClientRect();
      const board = document.querySelector('.board').getBoundingClientRect();
      return wave.top < board.top - 40 && wave.bottom > board.bottom + 40;
    }), true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.surf-band-flow').evaluate(el => getComputedStyle(el).animationName), 'none');
    // A visibility-change pause freezes the column just like a manual pause.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
    });
    assert.equal((await state()).state, 'paused'); const backgroundPause = await state();
    await page.clock.fastForward(30000); assert.equal((await state()).surf.time, backgroundPause.surf.time);
    await action('重新开始'); assert.equal((await state()).surf.time, 0); assert.equal((await state()).surf.count, 0);
    assert.equal((await state()).remaining, 60000); assert.equal((await state()).surf.phase, 'calm');
    assert.deepEqual(await page.locator('.tile .seaside-item').evaluateAll(items => items.map(item => Number(item.dataset.kind))), deck);
    await action('我知道了'); await page.clock.fastForward(60000);
    assert.equal((await state()).failureReason, 'timeout'); assert.equal((await state()).surf.count, 2);
    assert.equal(await page.locator('#modal-heading').innerText(), '潮水先到了一步');
    await action('重新挑战'); await action('我知道了');
    await advanceTo(17100); assert.equal((await state()).surf.target.axis, 'column');
    await page.evaluate(() => { window.surfTestRandom = 0; });
    // Skipping a whole wave must still position the following warning correctly.
    await page.clock.fastForward(20000);
    assert.equal((await state()).surf.phase, 'warning'); assert.equal((await state()).surf.target.axis, 'row');
    assert.equal(await page.locator('.board-surf').evaluate(el => el.style.gridRow), '1 / span 1');
    assert.equal(await page.locator('.board-surf').evaluate(el => el.classList.contains('is-column')), false);
    await page.locator('#pause-button').click(); await action('重新开始'); await action('我知道了');
    for (const kind of [0,1,2,4,5]) for (let i = 0; i < deck.length; i++) if (deck[i] === kind) await tile(i).click();
    await page.clock.runFor(1000); assert.equal((await state()).state, 'won');
    assert.equal((await state()).pairs, 18); assert.equal(await page.locator('#modal-art .bucket-find').count(), 18);
    assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-completed-levels')) ,'[31]');
    await action('下一关'); assert.equal((await state()).levelId, 32);
    const label = '在5秒内完成3次配对';
    assert.equal(await page.locator('#play-number').innerText(), '02');
    assert.equal(await page.locator('#modal-conditions').innerText(), label);
    assert.equal(await page.locator('#play-conditions').innerText(), label);
    assert.equal(await page.locator('#modal-art .notice-board-art').count(), 1);
    const secondDeck = await page.locator('.tile .seaside-item').evaluateAll(items => items.map(item => Number(item.dataset.kind)));
    assert.deepEqual([0,1,2,3,4,5].map(kind => secondDeck.filter(value => value === kind).length), [6,6,6,6,6,6]);
    await page.clock.fastForward(90000);
    assert.equal((await state()).remaining, 60000); assert.equal((await state()).surf.time, 0);
    const condition = page.locator('#play-conditions .condition-item');
    const secondPair = async () => {
      let current = await state();
      const find = () => {
        for (let a = 0; a < secondDeck.length; a++) {
          if (current.statuses[a] !== 'hidden' || current.surf.covered[a]) continue;
          const b = secondDeck.findIndex((kind,index) => index !== a && kind === secondDeck[a] && current.statuses[index] === 'hidden' && !current.surf.covered[index]);
          if (b !== -1) return [a,b];
        }
        return null;
      };
      let available = find();
      if (!available) {
        assert.ok(current.surf.retreatUntil);
        await advanceTo(current.surf.retreatUntil + 20); current = await state(); available = find();
      }
      assert.ok(available); await pair(...available);
    };
    await action('我知道了'); await page.clock.runFor(8000); await secondPair();
    await page.clock.runFor(1000); await secondPair();
    assert.equal(await condition.getAttribute('data-completed'), 'false');
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-conditions').innerText(), label);
    const secondPaused = await state(); await page.clock.fastForward(30000);
    assert.equal((await state()).activeTime, secondPaused.activeTime);
    await action('继续赶海'); await page.clock.runFor(1000); await secondPair();
    assert.equal(await condition.getAttribute('data-completed'), 'true');
    await advanceTo(22100); assert.equal((await state()).surf.count, 1);
    assert.equal((await state()).surf.phase, 'washing'); assert.equal((await state()).surf.covered.filter(Boolean).length, 6);
    assert.equal(await condition.getAttribute('data-completed'), 'true');
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-conditions .condition-item').getAttribute('data-completed'), 'true');
    await action('继续赶海');
    while ((await state()).pairs < 18) await secondPair();
    await page.clock.runFor(1000); assert.equal((await state()).state, 'won');
    assert.equal(await page.locator('#modal-art .bucket-find').count(), 18);
    assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-completed-levels')) ,'[31,32]');
    await action('下一关'); assert.equal((await state()).levelId, 33);
    assert.equal((await state()).conditions[0].type, 'maxMismatches');
    await action('我知道了'); await page.locator('#pause-button').click(); await action('返回选关'); await page.locator('#level-32').click();
    assert.equal(await condition.getAttribute('data-completed'), 'false'); assert.equal((await state()).surf.count, 0);
    assert.deepEqual(await page.locator('.tile .seaside-item').evaluateAll(items => items.map(item => Number(item.dataset.kind))), secondDeck);
    await action('我知道了');
    for (let i = 0; i < 18; i++) { if (i) await page.clock.runFor(3100); await secondPair(); }
    await page.clock.runFor(1000);
    assert.equal((await state()).pairs, 18); assert.equal((await state()).failureReason, 'conditions');
    assert.equal(await page.locator('#modal-heading').innerText(), '未完成全部的条件');
    assert.equal(await page.locator('#modal-art .condition-failure-art').count(), 1);
    assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-completed-levels')) ,'[31,32]');
    await action('重新挑战'); assert.equal((await state()).pairs, 0);
    assert.equal((await state()).conditions[0].completed, false); assert.equal((await state()).surf.time, 0);
    await action('我知道了'); await page.locator('#pause-button').click(); await action('返回选关'); await page.locator('#chapter-previous').click(); await page.locator('#level-30').click();
    assert.equal((await state()).surf, null); assert.equal(await page.locator('.board-surf').count(), 0);
    assert.equal(await page.locator('#play-surf-scene').isVisible(), false);
    assert.equal(await page.locator('#play-reef-scene').isVisible(), true);
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log('PASS: surf-one/two five/six-kind fixed boards, rolling-window condition/three placements, delayed completion, checked/unchecked result and retry, intro freeze, row/column warnings and opaque collection masking, exact penalty, ignored clicks, other-cell pairing, pause/background/retry, five viewport resizes, reduced motion, timeout/win, progress isolation and chapter-three cleanup. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
