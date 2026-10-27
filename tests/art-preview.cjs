const { chromium } = require('C:/Users/29781/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 720, height: 230 }, deviceScaleFactor: 1 });
    await page.setContent('<html lang="zh-CN"><meta charset="utf-8"><style>body{margin:0;padding:22px;box-sizing:border-box;height:230px;background:#fff6e6;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;font-family:"Microsoft YaHei",sans-serif}figure{margin:0;display:flex;align-items:center;flex-direction:column;justify-content:center;background:linear-gradient(145deg,#fffaf0,#f4e6cd);border:1px solid #eadbbd;border-radius:18px}svg{width:126px;height:126px;filter:drop-shadow(1px 4px 3px #a78a5e25)}figcaption{font-size:13px;color:#678475;letter-spacing:1px;margin-top:8px}</style><body></body></html>');
    await page.addScriptTag({ path: path.resolve(__dirname, '../art.js') });
    await page.evaluate(() => { document.body.innerHTML = BeachArt.names.map((name, i) => `<figure>${BeachArt.item(i, 'preview')}<figcaption>${name}</figcaption></figure>`).join(''); });
    const output = path.resolve(__dirname, '../preview');
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'artwork-v0.5.png') });
    console.log('Artwork preview rendered.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
