// Standard local Playwright first; an explicit path or a Codex installation is optional.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
function loadPlaywright() {
  const candidates = [process.env.BEACH_PLAYWRIGHT_PATH, 'playwright', path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright')].filter(Boolean);
  for (const candidate of candidates) {
    let resolved;
    try { resolved = require.resolve(candidate); }
    catch (error) { if (error.code === 'MODULE_NOT_FOUND') continue; throw error; }
    return require(resolved);
  }
  throw new Error('Playwright is needed only for browser tests. Run npm install, then npx playwright install chromium.');
}
function localChrome() {
  const candidates = process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', path.join(os.homedir(), 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome')]
    : process.platform === 'win32'
      ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean).map(base => path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe')) : [];
  return candidates.find(file => fs.existsSync(file));
}
function launch(options = {}) {
  const { chromium } = loadPlaywright();
  const defaults = {};
  if (process.env.BEACH_BROWSER_EXECUTABLE) defaults.executablePath = process.env.BEACH_BROWSER_EXECUTABLE;
  else if (process.env.BEACH_BROWSER_CHANNEL) defaults.channel = process.env.BEACH_BROWSER_CHANNEL;
  else if (!fs.existsSync(chromium.executablePath())) {
    const chrome = localChrome();
    if (chrome) defaults.executablePath = chrome;
  }
  return chromium.launch({ headless: true, ...defaults, ...options });
}
module.exports = { chromium: { launch }, loadPlaywright };
