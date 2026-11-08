// Real Web Audio sources, accelerated game clocks; no screenshots or installs.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('./browser-support.cjs');
const levels = require('../levels.js').filter(level => level.surf);
(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'beach-surf-sound-'));
  fs.copyFileSync(path.resolve('release/index1.html'), path.join(temp, 'index.html'));
  const browser = await chromium.launch();
  try {
    for (const single of [false, true]) {
      const context = await browser.newContext({ offline: true, reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
      for (const level of levels) {
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.clock.install({ time: new Date('2026-11-08T00:00:00Z') });
        await page.clock.pauseAt(new Date('2026-11-08T00:00:01Z'));
        await page.addInitScript(() => {
          localStorage.setItem('beach-pairs-unlock-all', 'on');
          window.waveSounds = [];
          const make = AudioContext.prototype.createBufferSource;
          AudioContext.prototype.createBufferSource = function () {
            const source = make.call(this), start = source.start;
            source.start = function (...args) {
              if (source.buffer.duration > 1) window.waveSounds.push(source.buffer.duration);
              return start.apply(source, args);
            };
            return source;
          };
        });
        await page.goto(pathToFileURL(single ? path.join(temp, 'index.html') : path.resolve('index.html')).href);
        const state = () => page.evaluate(() => beachDiagnostics.snapshot());
        const sounds = () => page.evaluate(() => window.waveSounds.length);
        const action = name => page.getByRole('button', { name, exact: true }).click();
        const enter = async () => {
          await page.locator('#select-level-button').click();
          for (let chapter = 0; chapter < Math.floor((level.id - 1) / 10); chapter++) await page.locator('#chapter-next').click();
          await page.locator(`#level-${level.id}`).click();
          if ((await state()).modalOpen) await action('我知道了');
        };
        const advance = async time => page.clock.fastForward(Math.max(0, time - (await state()).surf.time) + 20);
        await enter();
        const first = level.surf.firstWaveAt ?? level.surf.interval;
        await advance(first - 200);
        assert.equal((await state()).surf.phase, 'warning');
        assert.equal(await sounds(), 0, `Level ${level.id}: warning is silent`);
        await advance(first + 30);
        assert.equal((await state()).surf.count, 1);
        assert.equal(await sounds(), 1, `Level ${level.id}: one arrival sound, irrespective of line count`);
        const duration = (await page.evaluate(() => window.waveSounds))[0];
        assert.ok(duration >= 2.59 && duration <= 2.61, 'A sustained arrival swell, shorter than the five-second wash');
        await page.clock.runFor(300);
        assert.equal(await sounds(), 1, 'Repeated rendering must not retrigger');
        await page.locator('#pause-button').click();
        await page.clock.fastForward(30000);
        await action('继续赶海');
        assert.equal(await sounds(), 1, 'Resume must not replay the same wave');
        await advance(first + level.surf.arrival + level.surf.duration + level.surf.departure + 30);
        assert.equal((await state()).surf.phase, 'calm');
        assert.equal(await sounds(), 1, 'Washing and retreat stay silent');
        await advance(first + level.surf.interval + 30);
        assert.equal((await state()).surf.count, 2);
        assert.equal(await sounds(), 2, 'Next round plays once again');
        await page.locator('#pause-button').click();
        await action('重新开始');
        if ((await state()).modalOpen) await action('我知道了');
        await advance(first + 30);
        assert.equal(await sounds(), 3, 'Retry resets the round marker');
        assert.deepEqual(errors, []);
        await page.close();
      }
      // The general effects switch also mutes scheduled, non-click sounds.
      const page = await context.newPage();
      await page.clock.install();
      await page.addInitScript(() => localStorage.setItem('beach-pairs-unlock-all', 'on'));
      await page.goto(pathToFileURL(single ? path.join(temp, 'index.html') : path.resolve('index.html')).href);
      await page.locator('#settings-button').click();
      await page.locator('#sound-switch').click();
      await page.evaluate(() => {
        window.mutedWaves = 0;
        const make = AudioContext.prototype.createBufferSource;
        AudioContext.prototype.createBufferSource = function () { window.mutedWaves++; return make.call(this); };
      });
      await page.locator('#settings-screen [data-menu]').click();
      await page.locator('#select-level-button').click();
      for (let chapter = 0; chapter < 4; chapter++) await page.locator('#chapter-next').click();
      await page.locator('#level-44').click();
      await page.clock.fastForward(3100);
      assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().surf.count), 1);
      assert.equal(await page.evaluate(() => window.mutedWaves), 0);
      await page.close();
      console.log(`PASS ${single ? 'standalone offline' : 'source'}: all ${levels.length} surf levels, one short arrival sound per round; silent warning/wash/retreat, pause/resume, retry and mute.`);
      await context.close();
    }
  } finally { await browser.close(); fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(String(error.message).slice(0, 1800)); process.exitCode = 1; });
