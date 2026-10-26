import { copyFile } from 'node:fs/promises';
// Workers SPA fallback requires index.html; keep 200.html for offline navigation too.
await copyFile('build/200.html', 'build/index.html');
