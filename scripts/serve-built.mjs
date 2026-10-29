import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const directory = resolve('build');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    let status = 200;
    let file = resolve(directory, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(directory + sep) && file !== directory) throw Error('Invalid path');
    try {
      const information = await stat(file);
      if (!information.isFile()) file = resolve(file, 'index.html');
      await stat(file);
    } catch {
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/data/') || !request.headers.accept?.includes('text/html')) {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'Unavailable' }));
        return;
      }
      file = resolve(directory, '404.html');
      status = 404;
    }
    response.writeHead(status, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    response.end(await readFile(file));
  } catch {
    response.writeHead(400); response.end('Bad request');
  }
}).listen(4173, '127.0.0.1', () => console.log('Built SPA ready on http://127.0.0.1:4173'));
