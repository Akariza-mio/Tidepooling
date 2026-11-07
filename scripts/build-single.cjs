// Optional export tool. The generated HTML plays without Node or sibling files.
const fs = require('node:fs');
const path = require('node:path');

function buildSingleHtml(root = path.resolve(__dirname, '..')) {
  const scripts = [], resources = [];
  const read = name => {
    if (path.isAbsolute(name) || name.includes('..') || /[?#:]|^\//.test(name)) {
      throw new Error(`Only local relative resources can be embedded: ${name}`);
    }
    resources.push(name);
    return fs.readFileSync(path.join(root, name), 'utf8');
  };
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  html = html.replace(/(<audio\b[^>]*\bsrc=")([^"]+)(")/g, (_, before, name, after) => {
    if (path.isAbsolute(name) || name.includes('..') || /[?#:]|^\//.test(name) || path.extname(name).toLowerCase() !== '.mp3') {
      throw new Error(`Only local MP3 audio can be embedded: ${name}`);
    }
    resources.push(name);
    return before + 'data:audio/mpeg;base64,' + fs.readFileSync(path.join(root, name)).toString('base64') + after;
  });
  html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*>/g, (_, name) => {
    const css = read(name);
    for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)/g)) {
      if (!match[1].startsWith('data:') && !match[1].startsWith('#')) {
        throw new Error(`External CSS asset must be embedded first: ${name}: ${match[1]}`);
      }
    }
    return `<style data-source="${name}">\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`;
  });
  html = html.replace(/<script\s+src="([^"]+)"\s+defer\s*><\/script>/g, (_, name) => {
    scripts.push(`<script data-source="${name}">\n${read(name).replace(/<\/script/gi, '<\\/script')}\n</script>`);
    return '';
  });
  if (/<script\b[^>]*\bsrc\s*=|<link\b[^>]*rel="stylesheet"/i.test(html)) {
    throw new Error('Unembedded script or stylesheet remains.');
  }
  if (!html.includes('</body>')) throw new Error('Missing body end tag.');
  // Inline scripts ignore defer: run them after the DOM, in original file order.
  html = html.replace('</body>', `${scripts.join('\n')}\n</body>`);
  return { html, resources };
}

if (require.main === module) {
  const output = path.resolve(process.argv[2] || path.join(__dirname, '../release/index1.html'));
  const { html, resources } = buildSingleHtml();
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, html);
  console.log(`Exported ${output}: ${resources.length} embedded resources, ${Buffer.byteLength(html)} bytes.`);
}

module.exports = { buildSingleHtml };
