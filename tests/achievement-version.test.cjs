const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { buildSingleHtml, refreshAchievementVersion } = require('../scripts/build-single.cjs');
test('each release can rotate the achievement revision, while read-only single-HTML checks never rotate it', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'beach-revision-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'achievements.js'), "const saveRevision = 'old-release';\n");
  fs.writeFileSync(path.join(root, 'index.html'), '<html><head><script src="achievements.js" defer></script></head><body></body></html>');
  refreshAchievementVersion(root, 'release-a');
  assert.ok(buildSingleHtml(root).html.includes("const saveRevision = 'release-a'"));
  buildSingleHtml(root);
  assert.ok(fs.readFileSync(path.join(root, 'achievements.js'), 'utf8').includes("'release-a'"));
  refreshAchievementVersion(root, 'release-b');
  assert.ok(buildSingleHtml(root).html.includes("const saveRevision = 'release-b'"));
  assert.throws(() => refreshAchievementVersion(root, "invalid'code"));
});
