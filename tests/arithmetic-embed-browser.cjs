// Hosted-play regression: scripting allowed, native form submission forbidden.
const assert = require('node:assert/strict'), http = require('node:http'), path = require('node:path');
const { chromium } = require('./browser-support.cjs'), { createServer } = require('../scripts/serve.cjs');
const { buildSingleHtml } = require('../scripts/build-single.cjs');
const ArithmeticGame = require('../arithmetic.js'), level = require('../levels.js').find(l => l.id === 46);
const answers = level.rounds.map(round => ArithmeticGame.evaluate(round.target, round.values));
(async () => {
  const assets = createServer(path.resolve(__dirname, '..'));
  const bundle = buildSingleHtml().html;
  const server = http.createServer((request, response) => {
    if (request.url.startsWith('/embed')) {
      const sameOrigin = new URL(request.url, 'http://localhost').searchParams.has('same');
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><html><body style="margin:0"><iframe id="game" title="游戏试玩" sandbox="allow-scripts${sameOrigin ? ' allow-same-origin' : ''}" src="/game.html" style="width:390px;height:844px;border:0"></iframe></body></html>`);
    } else if (request.url === '/game.html') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(bundle);
    } else assets.emit('request', request, response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    for (const sameOrigin of [true, false]) {
      const context = await browser.newContext({ viewport: { width: 430, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = [], blockedForms = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (/Blocked form submission/i.test(message.text())) blockedForms.push(message.text().slice(0, 350)); });
      await page.clock.install({ time: new Date('2026-11-08T00:00:00Z') });
      await page.clock.pauseAt(new Date('2026-11-08T00:00:01Z'));
      await page.goto(`http://127.0.0.1:${server.address().port}/embed${sameOrigin ? '?same' : ''}`);
      const frame = page.frameLocator('#game');
      const state = () => frame.locator('#app').evaluate(() => beachDiagnostics.snapshot());
      const action = name => frame.getByRole('button', { name, exact: true }).click();
      const answer = frame.locator('#arithmetic-answer'), confirm = frame.locator('#arithmetic-submit');
      await frame.locator('#settings-button').click(); await frame.locator('#settings-screen [data-menu]').click(); await frame.locator('#select-level-button').click();
      for (let chapter = 0; chapter < 4; chapter++) await frame.locator('#chapter-next').click();
      await frame.locator('#level-46').click();
      assert.equal((await state()).duration, 90000);
      await answer.fill(String(answers[0])); await confirm.click();
      assert.equal((await state()).arithmetic.completed, 1, `Confirm must work inside a sandbox without allow-forms. Browser messages: ${blockedForms.join(' | ')}`);
      await page.clock.runFor(1000);
      const beforeWrong = await state();
      await answer.fill('0'); await confirm.click();
      assert.equal((await state()).arithmetic.wrongAnswers, 1); assert.equal((await state()).arithmetic.completed, 1);
      const timeSpent = beforeWrong.remaining - (await state()).remaining;
      assert.ok(timeSpent >= 5000 && timeSpent <= 5034, 'The five-second penalty is independent of at most one pending render frame');
      assert.match(await frame.locator('#arithmetic-feedback').innerText(), /扣除5秒/);
      await confirm.click(); assert.equal((await state()).arithmetic.wrongAnswers, 1);
      assert.match(await frame.locator('#arithmetic-feedback').innerText(), /整数/);
      await answer.fill(String(answers[1])); await answer.press('Enter');
      assert.equal((await state()).arithmetic.completed, 2, 'Enter must judge exactly one answer');
      await answer.fill(String(answers[2]));
      await answer.dispatchEvent('keydown', { key: 'Enter', repeat: true });
      await answer.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
      assert.equal((await state()).arithmetic.completed, 2, 'Held Enter and composition confirmation must not judge another answer');
      await confirm.focus(); await page.keyboard.press('Space');
      assert.equal((await state()).arithmetic.completed, 3, 'Keyboard activation of the button remains available');
      await answer.fill('12'); await frame.locator('#pause-button').click();
      const paused = await state(); await confirm.dispatchEvent('click');
      await answer.dispatchEvent('keydown', { key: 'Enter' });
      assert.equal((await state()).arithmetic.completed, paused.arithmetic.completed); assert.equal(await answer.inputValue(), '12');
      await action('继续赶海');
      for (let round = 3; round < answers.length; round++) {
        await answer.fill(String(answers[round]));
        if (round % 2) await confirm.click(); else await answer.press('Enter');
        assert.equal((await state()).arithmetic.completed, round + 1);
      }
      assert.equal((await state()).state, 'won');
      assert.equal((await state()).arithmetic.wrongAnswers, 1);
      assert.deepEqual(blockedForms, []); assert.deepEqual(errors, []);
      await page.clock.runFor(1000); await action('下一关');
      assert.equal((await state()).levelId, 47);
      console.log(`PASS ${sameOrigin ? 'same-origin' : 'opaque-origin'} sandbox without allow-forms: confirm, wrong penalty, empty input, Enter/Space, pause, all ten rounds, next level and no native form submission.`);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(String(error.message).slice(0, 2200)); process.exitCode = 1; });
