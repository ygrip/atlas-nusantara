import { readFile, writeFile } from 'node:fs/promises';

// Static hosts need standalone 5xx fallbacks as well as SvelteKit's runtime error template.
const template = await readFile(new URL('../src/error.html', import.meta.url), 'utf8');
const en = JSON.parse(await readFile(new URL('../messages/en.json', import.meta.url), 'utf8'));
const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
for (const status of [500, 503]) {
  let html = template.replaceAll('%sveltekit.status%', String(status));
  // The static 503 page must have appropriate content even with scripts disabled.
  if (status === 503) {
    html = html.replace('<h1 id="fatal-heading">' + escapeHtml(en.error_500_title) + '</h1>',
      '<h1 id="fatal-heading">' + escapeHtml(en.error_503_title) + '</h1>');
    html = html.replace('<p id="fatal-description">' + escapeHtml(en.error_500_desc) + '</p>',
      '<p id="fatal-description">' + escapeHtml(en.error_503_desc) + '</p>');
  }
  await writeFile(new URL(`../build/${status}.html`, import.meta.url), html);
}
console.log('Exported independent 500.html and 503.html fallbacks. Configure matching HTTP status codes on your host.');
