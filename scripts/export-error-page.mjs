import { readFile, writeFile } from 'node:fs/promises';

// Static hosts need standalone 5xx fallbacks as well as SvelteKit's runtime error template.
const template = await readFile(new URL('../src/error.html', import.meta.url), 'utf8');
for (const status of [500, 503]) {
  const html = template.replaceAll('%sveltekit.status%', String(status));
  await writeFile(new URL(`../build/${status}.html`, import.meta.url), html);
}
console.log('Exported independent 500.html and 503.html fallbacks. Configure matching HTTP status codes on your host.');
