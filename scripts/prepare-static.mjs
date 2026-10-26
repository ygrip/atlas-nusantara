import { copyFile, mkdir } from 'node:fs/promises';
// Known client routes receive a normal 200 shell. Unknown URLs receive the same router
// with HTTP 404, which renders the illustrated +error page after hydration.
await copyFile('build/200.html', 'build/index.html');
await copyFile('build/200.html', 'build/404.html');
for (const route of ['terms', 'privacy']) {
  await mkdir('build/' + route, { recursive: true });
  await copyFile('build/200.html', 'build/' + route + '/index.html');
}
