// Functional and layout checks only. No screenshot or preview files.
const { chromium } = require('C:/Users/29781/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
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
        /^(chapter-[1-3]|chapter-(day|night|reef)-scene)$/.test(animation.effect?.target.id || ''))
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
    assert.equal(await page.locator('#level-22').isDisabled(), true);
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
    assert.equal(await page.locator('#chapter-3 .chapter-level:enabled').count(), 1);
    await page.locator('#chapter-previous').click(); await page.locator('#level-20').click();
    assert.equal(await page.locator('#play-night-scene').isVisible(), true);
    assert.equal(await page.locator('#play-reef-scene').isVisible(), false);
    assert.equal(await page.locator('.seagrass-cover').count(), 0);
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    console.log('PASS: reef art and emblem, five viewport layouts, bidirectional night/reef fade and slide, transition locks/cancellation/reduced motion, only the remade first reef level is available, no grass UI leaks into chapter two. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
