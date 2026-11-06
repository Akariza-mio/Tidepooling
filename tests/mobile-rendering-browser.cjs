// Rendering cost/compatibility checks; viewport emulation is not Android certification.
const assert = require('node:assert/strict'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('./browser-support.cjs');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const touch of [true, false]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: touch, hasTouch: touch });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        window.waterPaints = [];
        const clear = CanvasRenderingContext2D.prototype.clearRect;
        CanvasRenderingContext2D.prototype.clearRect = function (x, y, width, height) {
          if (this.canvas.id === 'tide-canvas') window.waterPaints.push({ x, y, width, height });
          return clear.call(this, x, y, width, height);
        };
      });
      await page.clock.install({ time: new Date('2026-11-06T00:00:00Z') });
      await page.clock.pauseAt(new Date('2026-11-06T00:00:01Z'));
      await page.goto(pathToFileURL(path.join(__dirname, '../index.html')).href);
      for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(viewport);
        const style = await page.locator('#menu-title').evaluate(node => {
          node.style.paintOrder = 'normal'; // Simulate a browser without stroke-first painting.
          const s = getComputedStyle(node), r = node.getBoundingClientRect(), p = node.parentElement.getBoundingClientRect();
          return { color: s.color, fill: s.webkitTextFillColor, stroke: s.webkitTextStrokeWidth, contained: r.left >= p.left && r.right <= p.right };
        });
        assert.equal(style.color, 'rgb(49, 95, 85)'); assert.equal(style.fill, style.color);
        assert.equal(style.stroke, '0px'); assert.equal(style.contained, true);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('#start-button').click(); await page.getByRole('button', { name: '跳过教程', exact: true }).click();
      await page.clock.runFor(1000);
      const state = () => page.evaluate(() => beachDiagnostics.snapshot());
      const size = await page.locator('#tide-canvas').evaluate(n => ({ width: n.width, height: n.height, css: n.getBoundingClientRect().toJSON() }));
      const scale = touch ? 1 : 2;
      assert.ok(Math.abs(size.width - size.css.width * scale) <= 1); assert.ok(Math.abs(size.height - size.css.height * scale) <= 1);
      await page.evaluate(() => { window.waterPaints = []; });
      const before = (await state()).remaining; await page.clock.runFor(1000);
      assert.ok(Math.abs(before - (await state()).remaining - 1000) < 35);
      const paints = await page.evaluate(() => window.waterPaints);
      assert.ok(paints.length >= 50, 'Keep the 60 FPS scheduling target.');
      assert.ok(paints.every(p => p.y > 0 && p.width * p.height < size.css.width * size.css.height * .2), 'Do not clear the whole screen for low tide.');
      await page.locator('.tile').nth(0).click(); await page.locator('.tile').nth(3).click();
      assert.equal((await state()).pairs, 1); await page.clock.runFor(1000); assert.equal((await state()).bucketPairs, 1);
      await page.locator('#pause-button').click(); const paused = (await state()).remaining;
      await page.evaluate(() => { window.waterPaints = []; }); await page.clock.runFor(1000);
      assert.equal((await state()).remaining, paused); assert.equal(await page.evaluate(() => window.waterPaints.length), 0);
      const blur = await page.locator('#modal-layer').evaluate(n => getComputedStyle(n).backdropFilter);
      assert.equal(blur, touch ? 'none' : 'blur(6px)');
      await page.getByRole('button', { name: '继续赶海', exact: true }).click(); await page.clock.runFor(1000);
      assert.ok((await state()).remaining < paused);
      const pixels = await page.locator('#tide-canvas').evaluate(n => Array.from(n.getContext('2d').getImageData(0, 0, 1, 1).data));
      assert.equal(pixels[3], 0); assert.deepEqual(errors, []);
      console.log(`PASS ${touch ? 'touch DPR3' : 'desktop DPR3'}: readable title without paint-order, canvas scale ${scale}, partial clears, pause stops drawing, accurate time and collection. No screenshots.`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
