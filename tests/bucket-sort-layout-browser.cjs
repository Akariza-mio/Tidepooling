// Geometry only: no screenshots; includes a shrink-to-content button layout case.
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { pathToFileURL } = require('node:url'), { chromium } = require('./browser-support.cjs');
const root = path.resolve(__dirname, '..');
const viewports = [{ width: 400, height: 730 }, { width: 320, height: 568 }, { width: 390, height: 844 }, { width: 412, height: 780 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }];
(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'beach-bucket-layout-'));
  fs.copyFileSync(path.join(root, 'release/index1.html'), path.join(temp, 'index.html'));
  const browser = await chromium.launch();
  try {
    for (const single of [false, true]) {
      const context = await browser.newContext({ viewport: viewports[0], hasTouch: true, isMobile: true, deviceScaleFactor: 3, reducedMotion: 'reduce', offline: true });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem('beach-pairs-unlock-all', 'on'));
      await page.goto(pathToFileURL(single ? path.join(temp, 'index.html') : path.join(root, 'index.html')).href);
      await page.locator('#select-level-button').click();
      for (let chapter = 0; chapter < 3; chapter++) await page.locator('#chapter-next').click();
      for (const id of [35, 36]) {
        await page.locator(`#level-${id}`).click();
        if (await page.locator('#modal-layer').isVisible()) await page.getByRole('button', { name: '我知道了', exact: true }).click();
        for (const shrink of [true, false]) {
          const style = await page.addStyleTag({ content: shrink ? '.sort-bucket { align-items: flex-start; }' : '/* Native button alignment. */' });
          for (const viewport of viewports) {
            await page.setViewportSize(viewport);
            const geometry = await page.evaluate(() => {
              const r = node => node.getBoundingClientRect();
              const measurements = [...document.querySelectorAll('.sort-bucket')].map(bucket => {
                const stack = bucket.querySelector('.sort-stack'), b = r(bucket), s = r(stack), css = getComputedStyle(bucket);
                const left = b.left + parseFloat(css.borderLeftWidth) + parseFloat(css.paddingLeft);
                const width = b.width - parseFloat(css.borderLeftWidth) - parseFloat(css.borderRightWidth) - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
                return { filledWidth: Math.abs(s.width - width) < 1 && Math.abs(s.left - left) < 1,
                  slots: [...stack.children].every(slot => {
                    const box = r(slot), svg = slot.querySelector('svg');
                    if (Math.abs(box.width - s.width) > 1 || Math.abs(box.left - s.left) > 1 || box.height <= 0) return false;
                    if (!svg) return true;
                    const icon = r(svg), center = rectangle => [rectangle.left + rectangle.width / 2, rectangle.top + rectangle.height / 2];
                    return Math.abs(center(icon)[0] - center(box)[0]) < 1 && Math.abs(center(icon)[1] - center(box)[1]) < 1
                      && Math.min(icon.width, icon.height) >= Math.min(box.width, box.height) - 3;
                  }), stackWidth: s.width, expectedWidth: width };
              });
              const screen = r(document.getElementById('play-screen'));
              return { measurements, contained: [...document.querySelectorAll('.sort-bucket,.sort-slot,#sort-panel')].every(node => {
                const box = r(node); return box.left >= screen.left - 1 && box.right <= screen.right + 1 && box.top >= screen.top - 1 && box.bottom <= screen.bottom + 1;
              }), overflow: document.documentElement.scrollWidth > innerWidth };
            });
            assert.ok(geometry.measurements.every(m => m.filledWidth && m.slots), JSON.stringify({ id, shrink, viewport, ...geometry }));
            assert.ok(geometry.contained && !geometry.overflow, JSON.stringify({ id, viewport, ...geometry }));
          }
          await style.evaluate(node => node.remove());
        }
        await page.setViewportSize(viewports[0]);
        const before = await page.evaluate(() => beachDiagnostics.snapshot().bucketSort.buckets);
        const empty = before.findIndex(bucket => !bucket.length);
        await page.locator('.sort-bucket').nth(0).click(); await page.locator('.sort-bucket').nth(empty).click();
        const after = await page.evaluate(() => beachDiagnostics.snapshot());
        assert.equal(after.turns, 1); assert.equal(after.bucketSort.buckets[empty].length, 1);
        await page.locator('#pause-button').click(); await page.getByRole('button', { name: '返回选关', exact: true }).click();
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${single ? 'standalone offline' : 'source'}: 4-5 and 4-6, seven viewports, full-width centered items including shrink-to-content alignment; transfers and containment preserved.`);
      await context.close();
    }
  } finally { await browser.close(); fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(String(error.message).slice(0, 2500)); process.exitCode = 1; });
