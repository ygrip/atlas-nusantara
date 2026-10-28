import { appendFile, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { PREFIXED_LOCALES } from '../src/lib/i18n/paths.js';

const SITE = 'https://nusantara.readynaz.com';
const ROUTES = ['', 'terms', 'privacy'];
const RIGHT_TO_LEFT = new Set(['ar', 'he', 'fa', 'ur']);

// Known client routes receive a normal 200 shell. Unknown URLs receive the same router
// with HTTP 404, which renders the illustrated +error page after hydration.
await copyFile('build/200.html', 'build/index.html');
await copyFile('build/200.html', 'build/404.html');
for (const route of ROUTES.filter(Boolean)) {
  await mkdir('build/' + route, { recursive: true });
  await copyFile('build/200.html', 'build/' + route + '/index.html');
}

// Every language owns a path (/id, /id/terms, ...). Each shell carries its own lang, canonical
// and og:url so crawlers and link previews see the right language before the app starts.
const shell = await readFile('build/200.html', 'utf8');
const messages = {};
for (const locale of PREFIXED_LOCALES) messages[locale] = JSON.parse(await readFile('messages/' + locale + '.json', 'utf8'));
const attributeValue = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** Replace the content of one <meta> tag, found by its name or property. */
function setMeta(html, key, value) {
  const tag = new RegExp('(<meta (?:name|property)="' + key + '" content=")[^"]*(")');
  if (!tag.test(html)) throw new Error('app.html has no <meta> for ' + key);
  return html.replace(tag, (_match, open, close) => open + attributeValue(value) + close);
}

function localizeShell(locale, route, text) {
  let path = '/' + locale;
  if (route) path += '/' + route;
  const url = SITE + path;
  const direction = RIGHT_TO_LEFT.has(locale) ? 'rtl' : 'ltr';
  const title = text.site_title + ' — ' + text.og_headline;
  const image = SITE + '/og/nusantara-' + locale + '.png';
  const imageAlt = text.site_title + ': ' + text.og_headline + ' ' + text.og_tagline;
  let html = shell
    .replace('<html lang="en"', '<html lang="' + locale + '" dir="' + direction + '"')
    .replace('<link rel="canonical" href="' + SITE + '/" />', '<link rel="canonical" href="' + url + '" />')
    .replace(/<title>[^<]*<\/title>/, '<title>' + title + '</title>')
    .replace('"inLanguage":"en"', '"inLanguage":"' + locale + '"');
  const meta = {
    description: text.og_description, 'og:url': url, 'og:title': title, 'og:description': text.og_description,
    'og:image': image, 'og:image:alt': imageAlt, 'twitter:title': title, 'twitter:description': text.og_description,
    'twitter:image': image, 'twitter:image:alt': imageAlt
  };
  for (const [key, value] of Object.entries(meta)) html = setMeta(html, key, value);
  return html;
}
for (const locale of PREFIXED_LOCALES) {
  for (const route of ROUTES) {
    const folder = ['build', locale, route].filter(Boolean).join('/');
    await mkdir(folder, { recursive: true });
    await writeFile(folder + '/index.html', localizeShell(locale, route, messages[locale]));
  }
}

// Shells must never be served stale, or they would reference deleted hashed assets.
const noStore = PREFIXED_LOCALES.map(locale => '/' + locale + '\n  Cache-Control: no-store\n/' + locale + '/*\n  Cache-Control: no-store\n').join('');
await appendFile('build/_headers', '\n' + noStore);

// Sitemap: one entry per language and route, each linking its alternates.
const everyLocale = ['en', ...PREFIXED_LOCALES];
function urlFor(locale, route) {
  let path = '';
  if (locale !== 'en') path += '/' + locale;
  if (route) path += '/' + route;
  if (path === '') path = '/';
  return SITE + path;
}
const entries = [];
for (const route of ROUTES) {
  const alternates = everyLocale
    .map(locale => '<xhtml:link rel="alternate" hreflang="' + locale + '" href="' + urlFor(locale, route) + '"/>').join('');
  for (const locale of everyLocale) entries.push('<url><loc>' + urlFor(locale, route) + '</loc>' + alternates + '</url>');
}
await writeFile('build/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' + entries.join('') + '</urlset>\n');
