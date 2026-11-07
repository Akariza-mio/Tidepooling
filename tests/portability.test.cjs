const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('../scripts/serve.cjs');
const root = path.resolve(__dirname, '..');

test('all static runtime references exist with exact case and have no Windows-only paths', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]).filter(value => !value.startsWith('data:'));
  assert.equal(assets.length,27);
  for (const name of ['index.html', ...assets]) {
    assert.ok(fs.readdirSync(root).includes(name), `Missing or mismatched filename case: ${name}`);
    if (name.endsWith('.mp3')) continue;
    const source = fs.readFileSync(path.join(root,name),'utf8');
    assert.doesNotMatch(source, /[CD]:[\\/]|file:\/\/\/[A-Z]:/);
  }
});

test('optional local server serves the unchanged game with UTF-8 and correct asset types', async t => {
  const server = createServer(root);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const html = await fetch(url);
  assert.equal(html.status,200); assert.match(html.headers.get('content-type'),/text\/html; charset=utf-8/);
  assert.equal(await html.text(),fs.readFileSync(path.join(root,'index.html'),'utf8'));
  const script = await fetch(url+'/game.js'); assert.equal(script.status,200);
  assert.match(script.headers.get('content-type'),/text\/javascript/);
  assert.equal(await script.text(),fs.readFileSync(path.join(root,'game.js'),'utf8'));
  const css = await fetch(url+'/styles.css',{method:'HEAD'}); assert.equal(css.status,200);
  assert.match(css.headers.get('content-type'),/text\/css/); assert.equal(await css.text(),'');
  const audio = await fetch(url+'/theme.mp3',{method:'HEAD'});
  assert.equal(audio.status,200); assert.equal(audio.headers.get('content-type'),'audio/mpeg');
});

test('optional local server rejects invalid, missing, hidden and parent-directory requests', async t => {
  const server = createServer(root);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  for (const [route,status] of [['/missing-game-file.js',404],['/tests/',404],['/.git/config',403],['/..%2foutside.txt',403],['/%GG',400],['/%00',400]]) {
    const response = await fetch(url+route); assert.equal(response.status,status,route); await response.text();
  }
  const response = await fetch(url,{method:'POST'}); assert.equal(response.status,405); await response.text();
});
