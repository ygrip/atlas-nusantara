import { appendFile, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { PREFIXED_LOCALES } from '../src/lib/i18n/paths.js';
import { execFileSync } from 'node:child_process';

const SITE = 'https://nusantara.readynaz.com';
const ROUTES = ['', 'terms', 'privacy'];
const RIGHT_TO_LEFT = new Set(['ar', 'he', 'fa', 'ur']);

// Keep the real prerendered pages. Only unknown routes use the client error fallback.
await copyFile('build/200.html', 'build/404.html');
const everyLocale = ['en', ...PREFIXED_LOCALES];
const revisionDate = execFileSync('git', ['log', '-1', '--format=%cI'], { encoding: 'utf8' }).trim();
const ogLocales = { en: 'en_US', id: 'id_ID', ms: 'ms_MY', fil: 'fil_PH', th: 'th_TH', vi: 'vi_VN', my: 'my_MM', km: 'km_KH', lo: 'lo_LA', 'zh-SG': 'zh_SG', ta: 'ta_SG', tet: 'tet_TL', 'pt-TL': 'pt_TL' };
const shellAssets = new Set(['/200.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/brand/logo-256.png', '/brand/favicon-64.png', '/illustrations/atlas-anatomy.svg', '/data/admin-2025/provinces.json']);
const messages = {};
for (const locale of everyLocale) messages[locale] = JSON.parse(await readFile('messages/' + locale + '.json', 'utf8'));

async function prerenderedPage(locale, route) {
  const path = urlFor(locale, route).slice(SITE.length);
  if (path === '/') return { path: 'build/index.html', html: await readFile('build/index.html', 'utf8') };
  try {
    return { path: 'build' + path + '.html', html: await readFile('build' + path + '.html', 'utf8') };
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return { path: 'build' + path + '/index.html', html: await readFile('build' + path + '/index.html', 'utf8') };
  }
}
const attributeValue = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** Replace the content of one <meta> tag, found by its name or property. */
function setMeta(html, key, value) {
  const tag = new RegExp('(<meta (?:name|property)="' + key + '" content=")[^"]*(")');
  if (!tag.test(html)) throw new Error('app.html has no <meta> for ' + key);
  return html.replace(tag, (_match, open, close) => open + attributeValue(value) + close);
}

function localizeShell(source, locale, route, text) {
  const url = urlFor(locale, route);
  const direction = RIGHT_TO_LEFT.has(locale) ? 'rtl' : 'ltr';
  let title = text.site_title + ' — ' + text.og_headline;
  let description = text.og_description;
  if (route) {
    title = text[route + '_title'] + ' · ' + text.site_title;
    description = text[route + '_description'];
  }
  const image = SITE + '/og/nusantara-' + locale + '.png?v=clay-discovery-2';
  const imageAlt = text.site_title + ': ' + text.og_headline + ' ' + text.og_tagline;
  let html = source
    .replace(/<html lang="[^"]+"/, '<html lang="' + locale + '" dir="' + direction + '"')
    .replace('<link rel="canonical" href="' + SITE + '/" />', '<link rel="canonical" href="' + url + '" />')
    .replace(/<title>[^<]*<\/title>/, '<title>' + title + '</title>')
    .replace('"inLanguage":"en"', '"inLanguage":"' + locale + '"');
  // LegalLayout owns an SSR description tag; discard only the unmanaged app-shell duplicate.
  const descriptionTags = html.match(/<meta name="description"[^>]*>/g) ?? [];
  if (descriptionTags.length > 1) html = html.replace(descriptionTags[0], '');
  const meta = {
    description, 'og:url': url, 'og:title': title, 'og:description': description,
    'og:image': image, 'og:image:alt': imageAlt, 'twitter:title': title, 'twitter:description': description,
    'twitter:image': image, 'twitter:image:alt': imageAlt, 'og:locale': ogLocales[locale]
  };
  if (locale === 'en') meta['og:image'] = meta['twitter:image'] = SITE + '/og/nusantara.png?v=clay-discovery-2';
  for (const [key, value] of Object.entries(meta)) html = setMeta(html, key, value);
  const alternates = everyLocale.map(language => '<link rel="alternate" hreflang="' + language + '" href="' + urlFor(language, route) + '"/>').join('');
  const ogAlternates = everyLocale.filter(language => language !== locale).map(language => '<meta property="og:locale:alternate" content="' + ogLocales[language] + '"/>').join('');
  html = html.replace('</head>', alternates + ogAlternates + '</head>');
  html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/, (_match, json) => {
    const data = JSON.parse(json);
    data.inLanguage = locale;
    data.url = urlFor(locale, '');
    data.description = text.og_description;
    data.author = { '@type': 'Person', name: 'ygrip', url: 'https://github.com/ygrip' };
    data.dateModified = revisionDate;
    return '<script type="application/ld+json">' + JSON.stringify(data).replaceAll('<', '\\u003c') + '</script>';
  });
  return html;
}
function collectShellAssets(html, pageUrl) {
  for (const [tag] of html.matchAll(/<(?:link|img)\b[^>]*>/g)) {
    const isModuleOrStyle = tag.includes('rel="modulepreload"') || tag.includes('rel="stylesheet"');
    const isVisibleImage = tag.startsWith('<img') && !tag.includes('loading="lazy"');
    if (!isModuleOrStyle && !isVisibleImage) continue;
    const reference = tag.match(/(?:href|src)="([^"]+)"/)?.[1];
    if (!reference) continue;
    const url = new URL(reference, pageUrl);
    if (url.origin === SITE) shellAssets.add(url.pathname);
    if (isVisibleImage) {
      const sourceSet = tag.match(/srcset="([^"]+)"/)?.[1] ?? '';
      for (const candidate of sourceSet.split(',')) {
        const source = candidate.trim().split(/\s+/)[0];
        if (!source) continue;
        const responsiveUrl = new URL(source, pageUrl);
        if (responsiveUrl.origin === SITE) shellAssets.add(responsiveUrl.pathname);
      }
    }
  }
}

for (const locale of everyLocale) {
  for (const route of ROUTES) {
    const page = await prerenderedPage(locale, route);
    const html = localizeShell(page.html, locale, route, messages[locale]);
    collectShellAssets(html, urlFor(locale, route));
    const segments = ['build'];
    if (locale !== 'en') segments.push(locale);
    if (route) segments.push(route);
    const folder = segments.join('/');
    await mkdir(folder, { recursive: true });
    await writeFile(page.path, html);
    if (page.path !== folder + '/index.html') await writeFile(folder + '/index.html', html);
  }
}

for (const file of await readdir('build/_app/immutable/assets')) {
  if (!file.endsWith('.woff2')) continue;
  if (file.startsWith('nunito-') && (file.includes('-latin-') || file.includes('-vietnamese-'))) {
    shellAssets.add('/_app/immutable/assets/' + file);
  }
}
// Offline recovery also needs the catch-all and +error nodes, not only successful pages.
const clientManifest = JSON.parse(await readFile('.svelte-kit/output/client/.vite/manifest.json', 'utf8'));
const visitedEntries = new Set();
function collectRouteEntry(key) {
  if (visitedEntries.has(key)) return;
  visitedEntries.add(key);
  const entry = clientManifest[key];
  if (!entry) throw new Error('Missing client manifest dependency: ' + key);
  shellAssets.add('/' + entry.file);
  for (const css of entry.css ?? []) shellAssets.add('/' + css);
  for (const dependency of entry.imports ?? []) collectRouteEntry(dependency);
}
for (const [key, entry] of Object.entries(clientManifest)) {
  if (entry.file.startsWith('_app/immutable/nodes/')) collectRouteEntry(key);
}
await writeFile('build/pwa-shell.json', JSON.stringify({ assets: [...shellAssets].sort() }));

// Shells must never be served stale, or they would reference deleted hashed assets.
const noStore = PREFIXED_LOCALES.map(locale => '/' + locale + '\n  Cache-Control: no-store\n/' + locale + '/*\n  Cache-Control: no-store\n').join('');
await appendFile('build/_headers', '\n' + noStore);

// Sitemap: one entry per language and route, each linking its alternates.
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
