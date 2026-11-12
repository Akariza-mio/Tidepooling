const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { buildSingleHtml } = require('../scripts/build-single.cjs');
test('single HTML contains byte-identical MP3 tracks with no sibling audio references', () => {
  const { html, resources } = buildSingleHtml();
  assert.equal(resources.length, 31);
  for (const name of ['theme', 'level']) {
    const match = html.match(new RegExp(`<audio id="${name}-music" src="data:audio/mpeg;base64,([^"]+)" preload="none" loop hidden>`));
    assert.ok(match, name);
    assert.ok(Buffer.from(match[1], 'base64').equals(fs.readFileSync(path.join(__dirname, '..', name + '.mp3'))));
  }
  assert.doesNotMatch(html, /src="(?:theme|level)\.mp3"/);
});
