// Functional and layout checks only. No screenshot or preview files.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.clock.install();
    await page.addInitScript(() => localStorage.setItem('beach-pairs-unlock-all', 'on'));
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    const state = () => page.evaluate(() => beachDiagnostics.snapshot());
    const action = name => page.getByRole('button', { name, exact: true }).click();
    const tile = index => page.locator('.tile').nth(index);
    const finishTransition = async () => {
      // The browser's native animation timeline is independent of the mocked JS clock.
      await page.evaluate(() => Promise.all(document.getAnimations().filter(animation =>
        /^(chapter-[1-5]|chapter-(day|night|reef|surf)-scene|chapter-surf-bridge)$/.test(animation.effect?.target.id || ''))
        .map(animation => animation.finished.catch(() => {}))));
      await page.locator('#chapter-pages:not(.is-sliding)').waitFor({ state: 'attached' });
    };
    const turn = async direction => {
      await page.locator('#chapter-' + direction).click(); await page.clock.runFor(850);
      await finishTransition();
    };
    await page.locator('#select-level-button').click(); await turn('next');
    await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#chapter-pages').getAttribute('aria-busy'), 'true');
    assert.equal(await page.locator('#chapter-next').isDisabled(), true);
    assert.equal(await page.locator('#chapter-previous').isDisabled(), true);
    assert.equal(await page.locator('#chapter-3').evaluate(element => element.inert), true);
    await page.clock.runFor(230);
    for (const id of ['chapter-night-scene', 'chapter-reef-scene']) {
      const frame = await page.locator('#' + id).evaluate(element => ({ opacity: Number(getComputedStyle(element).opacity), transform: getComputedStyle(element).transform }));
      assert.ok(frame.opacity > 0 && frame.opacity < 1, JSON.stringify({ id, ...frame }));
      assert.notEqual(frame.transform, 'none');
    }
    await page.clock.runFor(600);
    await finishTransition();
    assert.equal(await page.locator('.chapter-page:visible h1').innerText(), '礁间寻宝');
    assert.equal(await page.locator('#chapter-night-scene').isVisible(), false);
    assert.equal(await page.locator('#chapter-reef-scene').isVisible(), true);
    assert.equal(await page.locator('#chapter-3 .reef-emblem-art').count(), 1);
    assert.equal(await page.locator('#chapter-indicators [aria-current="page"]').innerText(), '三');
    assert.equal(await page.locator('#level-21').isEnabled(), true);
    assert.equal(await page.locator('#level-41').isDisabled(), true);
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport); await page.clock.runFor(60);
      const fits = await page.evaluate(() => {
        const scene = document.getElementById('chapter-reef-scene');
        const art = scene.firstElementChild.getBoundingClientRect(), app = document.getElementById('app').getBoundingClientRect();
        const pager = document.querySelector('.chapter-pagination').getBoundingClientRect();
        return art.top <= app.top + 1 && art.bottom >= app.bottom - 1 && art.left <= app.left + 1 && art.right >= app.right - 1
          && pager.bottom <= app.bottom && getComputedStyle(scene).pointerEvents === 'none' && document.documentElement.scrollWidth <= innerWidth;
      });
      assert.equal(fits, true, JSON.stringify(viewport));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    // Inspect the actual animation midpoint without creating screenshots.
    const surfCrossing = async direction => {
      await page.locator('#chapter-' + direction).click();
      assert.equal(await page.locator('#chapter-pages').getAttribute('aria-busy'), 'true');
      assert.equal(await page.locator('#chapter-next').isDisabled(), true);
      assert.equal(await page.locator('#chapter-previous').isDisabled(), true);
      assert.equal(await page.locator('#chapter-3').evaluate(el => el.inert), true);
      assert.equal(await page.locator('#chapter-4').evaluate(el => el.inert), true);
      const middle = await page.evaluate(() => {
        const ids = ['chapter-3', 'chapter-4', 'chapter-reef-scene', 'chapter-surf-scene', 'chapter-surf-bridge'];
        const animations = document.getAnimations().filter(a => ids.includes(a.effect?.target.id));
        for (const animation of animations) { animation.pause(); animation.currentTime = 450; }
        return ['chapter-reef-scene', 'chapter-surf-scene', 'chapter-surf-bridge'].map(id => {
          const element = document.getElementById(id), style = getComputedStyle(element);
          return { id, opacity: Number(style.opacity), transform: style.transform, hidden: element.hidden };
        });
      });
      for (const frame of middle) {
        assert.equal(frame.hidden, false);
        assert.ok(frame.opacity > 0 && frame.opacity < 1, JSON.stringify(frame));
        assert.notEqual(frame.transform, 'none');
      }
      await page.evaluate(() => {
        const ids = ['chapter-3', 'chapter-4', 'chapter-reef-scene', 'chapter-surf-scene', 'chapter-surf-bridge'];
        for (const animation of document.getAnimations().filter(a => ids.includes(a.effect?.target.id))) animation.finish();
      });
      await finishTransition();
      assert.equal(await page.locator('#chapter-surf-bridge').isVisible(), false);
      assert.equal(await page.locator('.chapter-page:visible').count(), 1);
      assert.equal(await page.locator('#chapter-3').evaluate(el => el.inert), false);
      assert.equal(await page.locator('#chapter-4').evaluate(el => el.inert), false);
    };
    await surfCrossing('next');
    assert.equal(await page.locator('.chapter-page:visible h1').innerText(), '踏浪而寻');
    assert.equal(await page.locator('#chapter-4 .surf-emblem-art').count(), 1);
    assert.equal(await page.locator('#chapter-surf-scene').isVisible(), true);
    assert.equal(await page.locator('#chapter-reef-scene').isVisible(), false);
    assert.equal(await page.locator('#chapter-indicators [aria-current="page"]').innerText(), '四');
    assert.equal(await page.locator('#chapter-4 .chapter-level:enabled').count(), 10);
    assert.equal(await page.locator('#chapter-4 .is-minigame').count(), 2);
    assert.equal(await page.evaluate(() => BeachLevels.length), 40);
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => {
        const scene = document.getElementById('chapter-surf-scene');
        const art = scene.firstElementChild.getBoundingClientRect(), app = document.getElementById('app').getBoundingClientRect();
        const pager = document.querySelector('.chapter-pagination').getBoundingClientRect();
        const next = document.getElementById('chapter-next'), button = next.getBoundingClientRect();
        return art.top <= app.top + 1 && art.bottom >= app.bottom - 1 && art.left <= app.left + 1 && art.right >= app.right - 1
          && pager.bottom <= app.bottom && getComputedStyle(scene).pointerEvents === 'none' && document.documentElement.scrollWidth <= innerWidth
          && next.contains(document.elementFromPoint(button.x + button.width / 2, button.y + button.height / 2));
      }), true, JSON.stringify(viewport));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await surfCrossing('previous');
    assert.equal(await page.locator('#chapter-reef-scene').isVisible(), true);
    assert.equal(await page.locator('#chapter-surf-scene').isVisible(), false);
    await turn('next'); await turn('next');
    assert.equal(await page.locator('.chapter-page:visible h1').innerText(), '挑战EX');
    assert.equal(await page.locator('#chapter-surf-scene').isVisible(), false);
    await turn('previous');
    assert.equal(await page.locator('#chapter-surf-scene').isVisible(), true);
    // Leaving either direction mid-transition must clear the decorative wash and locks.
    for (const direction of ['previous', 'next']) {
      if (direction === 'next') await turn('previous');
      await page.locator('#chapter-' + direction).click();
      await page.locator('#level-screen [data-menu]').click();
      assert.equal(await page.locator('#chapter-surf-bridge').isVisible(), false);
      assert.equal(await page.locator('#chapter-pages').getAttribute('aria-busy'), null);
      assert.equal(await page.locator('.chapter-page[inert]').count(), 0);
      await page.locator('#select-level-button').click();
      assert.equal(await page.locator('.chapter-page:visible').count(), 1);
      assert.equal(await page.locator('#chapter-surf-scene').isVisible(), false);
      await turn('next'); await turn('next');
      if (direction === 'previous') await turn('next');
    }
    // Start at reef, check accessible motion settings, then restore the original test flow.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#chapter-pages').getAttribute('aria-busy'), null);
    assert.equal(await page.locator('#chapter-surf-scene').isVisible(), true);
    assert.equal(await page.locator('#chapter-surf-bridge').isVisible(), false);
    assert.equal(await page.locator('#chapter-surf-scene .surf-wash').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.locator('#chapter-previous').click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await turn('previous'); assert.equal(await page.locator('#chapter-night-scene').isVisible(), true);
    assert.equal(await page.locator('#chapter-reef-scene').isVisible(), false);
    // Interrupt the second-to-third transition and confirm a clean menu/re-entry.
    await page.locator('#chapter-next').click(); await page.clock.runFor(120);
    await page.locator('#level-screen [data-menu]').click();
    assert.equal(await page.locator('#chapter-pages').getAttribute('aria-busy'), null);
    await page.locator('#select-level-button').click();
    assert.equal(await page.locator('#chapter-reef-scene').isVisible(), false);
    assert.equal(await page.locator('.chapter-page:visible').count(), 1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#chapter-next').click(); await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#chapter-pages').getAttribute('aria-busy'), null);
    assert.equal(await page.locator('#chapter-reef-scene').isVisible(), true);
    assert.equal(await page.locator('#chapter-3 .chapter-level:enabled').count(), 10);
    await page.locator('#chapter-previous').click(); await page.locator('#level-20').click();
    assert.equal(await page.locator('#play-night-scene').isVisible(), true);
    assert.equal(await page.locator('#play-reef-scene').isVisible(), false);
    assert.equal(await page.locator('.seagrass-cover').count(), 0);
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    console.log('PASS: reef and surf scenery/emblems, five viewport layouts, bidirectional night/reef/surf transitions and wave bridge, input locks/cancellation/reduced motion, chapter-four/five boundary, 40 levels with chapter four completed, no chapter-two UI leaks. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
