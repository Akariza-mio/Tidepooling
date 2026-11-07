// Optional local development server. The submitted game remains static HTML/CSS/JS.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.md': 'text/markdown', '.mp3': 'audio/mpeg' };
function createServer(root = path.resolve(__dirname, '..')) {
  root = path.resolve(root);
  return http.createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch (_) { response.writeHead(400); response.end('Bad request'); return; }
    if (pathname.includes('\0') || pathname.includes('\\')) { response.writeHead(400); response.end('Bad request'); return; }
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const relative = path.relative(root, target);
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) || relative.split(path.sep).some(part => part.startsWith('.'))) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    fs.stat(target, (error, stat) => {
      if (error || !stat.isFile()) { response.writeHead(404); response.end('Not found'); return; }
      response.writeHead(200, { 'Content-Type': (mime[path.extname(target).toLowerCase()] || 'application/octet-stream') + (['.html','.js','.css','.svg','.json','.md'].includes(path.extname(target).toLowerCase()) ? '; charset=utf-8' : ''), 'Cache-Control': 'no-store' });
      if (request.method === 'HEAD') { response.end(); return; }
      const stream = fs.createReadStream(target);
      stream.on('error', () => response.destroy()); stream.pipe(response);
    });
  });
}
if (require.main === module) {
  const index = process.argv.indexOf('--port');
  const port = index === -1 ? 4173 : Number(process.argv[index + 1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('Use --port followed by a number between 1 and 65535.'); process.exitCode = 1; }
  else {
    const server = createServer();
    server.on('error', error => { console.error(error.message); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => console.log(`Game: http://127.0.0.1:${port}/\nPress Ctrl+C to stop.`));
  }
}
module.exports = { createServer };
