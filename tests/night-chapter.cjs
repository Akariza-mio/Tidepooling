// Theme/navigation checks only; no screenshots or generated previews.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.clock.install();
    const changeChapter = async direction => {
      await page.locator('#chapter-' + direction).click();
      await page.locator('#chapter-pages:not(.is-sliding)').waitFor({ state: 'attached' });
    };
    await page.goto(pathToFileURL(path.join(process.env.BEACH_GAME_DIR || path.resolve(__dirname, '..'), 'index.html')).href);
    await page.locator('#select-level-button').click();
    const dayBackground = await page.locator('#level-screen').evaluate(screen => getComputedStyle(screen).backgroundImage);
    await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#chapter-pages').evaluate(stage => stage.classList.contains('is-sliding')), true);
    assert.equal(await page.locator('#chapter-previous').isDisabled(), true);
    assert.equal(await page.locator('#chapter-next').isDisabled(), true);
    await page.clock.runFor(250);
    const middle = await page.locator('#chapter-night-scene').evaluate(scene => ({ opacity: Number(getComputedStyle(scene).opacity), transform: getComputedStyle(scene).transform }));
    assert.ok(middle.opacity > 0 && middle.opacity < 1, JSON.stringify(middle));
    assert.notEqual(middle.transform, 'none');
    await page.clock.runFor(600);
    await page.locator('#chapter-pages:not(.is-sliding)').waitFor({ state: 'attached' });
    assert.equal(await page.locator('.chapter-page:visible h1').innerText(), '月下独捉');
    assert.equal(await page.locator('#chapter-tabs').count(), 0);
    assert.equal(await page.locator('.chapter-pagination button').count(), 2);
    assert.deepEqual(await page.locator('#chapter-indicators .chapter-indicator-art > svg').count(), 5);
    assert.equal(await page.locator('#chapter-indicators [aria-current="page"]').getAttribute('aria-label'), '第二大关，月下独捉');
    assert.equal(await page.locator('#chapter-indicators button, #chapter-indicators a, #chapter-indicators [tabindex]').count(), 0);
    await page.locator('#chapter-indicators .chapter-indicator').last().evaluate(indicator => indicator.click());
    assert.equal(await page.locator('.chapter-page:visible h1').innerText(), '月下独捉');
    assert.equal(await page.locator('#chapter-2 .chapter-emblem .moon-art').count(), 1);
    assert.equal(await page.locator('#chapter-2 .chapter-emblem .seaside-item').count(), 0);
    assert.equal(await page.locator('#chapter-night-scene').isVisible(), true);
    assert.equal(await page.locator('#chapter-night-scene').evaluate(scene => getComputedStyle(scene).pointerEvents), 'none');
    assert.equal(await page.locator('#chapter-2 .chapter-level:disabled').count(), 10);
    assert.equal(await page.locator('#chapter-2 .is-minigame').count(), 2);
    const fogStart = await page.locator('.night-fog span').first().evaluate(span => getComputedStyle(span).transform);
    await page.clock.runFor(1000);
    const fogEnd = await page.locator('.night-fog span').first().evaluate(span => getComputedStyle(span).transform);
    assert.notEqual(fogStart, fogEnd);
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.clock.runFor(400);
      const valid = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        const app = rect('#app'), scene = rect('#chapter-night-scene'), title = rect('#chapter-2 h1'), pagination = rect('.chapter-pagination');
        const fog = rect('.night-fog'), sea = rect('.night-sea');
        const active = document.querySelector('#chapter-previous');
        const tab = active.getBoundingClientRect();
        const hit = document.elementFromPoint(tab.left + tab.width / 2, tab.top + tab.height / 2);
        return scene.top <= app.top + 1 && scene.bottom >= app.bottom - 1 && title.width <= app.width && pagination.bottom <= app.bottom && fog.top < sea.bottom && fog.bottom > sea.top && (hit === active || active.contains(hit)) && document.documentElement.scrollWidth <= innerWidth;
      });
      assert.equal(valid, true, JSON.stringify(viewport));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await changeChapter('next');
    assert.equal(await page.locator('#chapter-night-scene').isVisible(), false);
    assert.equal(await page.locator('#chapter-reef-scene').isVisible(), true);
    assert.equal(await page.locator('.chapter-page:visible h1').innerText(), '礁间寻宝');
    await changeChapter('previous');
    await page.locator('#chapter-previous').click();
    await page.clock.runFor(250);
    const reversing = await page.locator('#chapter-night-scene').evaluate(scene => Number(getComputedStyle(scene).opacity));
    assert.ok(reversing > 0 && reversing < 1);
    await page.clock.runFor(600);
    await page.locator('#chapter-pages:not(.is-sliding)').waitFor({ state: 'attached' });
    assert.equal(await page.locator('#chapter-1 .chapter-emblem .seaside-item').count(), 1);
    assert.equal(await page.locator('#chapter-night-scene').isVisible(), false);
    await changeChapter('next');
    assert.equal(await page.locator('#chapter-indicators [aria-current="page"]').getAttribute('aria-label'), '第二大关，月下独捉');
    assert.equal(await page.locator('#chapter-night-scene').isVisible(), true);
    await page.locator('#level-screen [data-menu]').click();
    assert.equal(await page.locator('#chapter-night-scene').isVisible(), false);
    await page.locator('#guide-button').click(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('.settings-drift,#settings-screen').count(), 0);

    await page.locator('#select-level-button').click();
    assert.equal(await page.locator('#chapter-night-scene').isVisible(), false);
    assert.equal(await page.locator('#chapter-help').isVisible(), false);
    assert.equal(await page.locator('.chapter-note:visible').count(), 0);
    assert.equal(await page.locator('#level-screen').innerText().then(text => text.includes('自由测试')), false);
    // Leaving during a transition must cancel it without stale transforms/locks.
    await page.locator('#chapter-next').click();
    await page.clock.runFor(120);
    await page.locator('#chapter-next').evaluate(button => button.click());
    assert.equal(await page.locator('#chapter-3').isVisible(), false, 'A disabled arrow must not skip an adjacent chapter.');
    await page.locator('#level-screen [data-menu]').click();
    assert.equal(await page.locator('#chapter-pages').getAttribute('aria-busy'), null);
    await page.locator('#select-level-button').click();
    assert.equal(await page.locator('.chapter-page:visible').count(), 1);
    assert.equal(await page.locator('#chapter-previous').isDisabled(), true);
    assert.equal(await page.locator('#chapter-night-scene').isVisible(), false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#chapter-2 .chapter-level:enabled').count(), 10);
    assert.equal(await page.locator('#level-35').isEnabled(), true, 'Testing unlock includes every implemented chapter.');
    assert.equal(await page.locator('#chapter-pages').evaluate(stage => stage.classList.contains('is-sliding')), false);
    assert.equal(await page.locator('.night-fog span').first().evaluate(span => getComputedStyle(span).animationName), 'none');
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log('PASS: adjacent arrows only, no unlock-mode footer text, bidirectional day/night sliding/parallax/fade, transition locks and cancellation, second-chapter moon/fog, five viewports, reduced motion and unchanged unopened levels; offline/no browser errors. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
