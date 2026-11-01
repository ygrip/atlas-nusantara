import { appendFile, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { PREFIXED_LOCALES } from '../src/lib/i18n/paths.js';
import { execFileSync } from 'node:child_process';

const SITE = 'https://nusantara.readynaz.com';
const ROUTES = ['', 'terms', 'privacy', 'about', 'guides', 'guides/regions', 'guides/conditions', 'guides/nature'];
const RIGHT_TO_LEFT = new Set(['ar', 'he', 'fa', 'ur']);

// Keep the real prerendered pages. Only unknown routes use the client error fallback.
await copyFile('build/200.html', 'build/404.html');
const everyLocale = ['en', ...PREFIXED_LOCALES];
const revisionDate = execFileSync('git', ['log', '-1', '--format=%cI'], { encoding: 'utf8' }).trim();
const ogLocales = { en: 'en_US', id: 'id_ID', ms: 'ms_MY', fil: 'fil_PH', th: 'th_TH', vi: 'vi_VN', my: 'my_MM', km: 'km_KH', lo: 'lo_LA', 'zh-SG': 'zh_SG', ta: 'ta_SG', tet: 'tet_TL', 'pt-TL': 'pt_TL', ja: 'ja_JP' };
const shellAssets = new Set(['/200.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/brand/logo-96.webp', '/brand/logo-256.png', '/brand/favicon-64.png', '/illustrations/atlas-anatomy.svg', '/data/admin-2025/provinces.json', '/data/admin-2025/cities.json']);
// Stylesheets of lazily imported components (layer panels, the share dialog) are listed in every page head by SvelteKit,
// which makes the browser fetch them before the first paint. Vite's dynamic import loads them together with the component,
// so they are dropped from the head and downloaded only when the component is. Keep this list in step with the
// `import('...Panel.svelte')` calls in src/routes/+page.svelte and RegionAtlas.svelte.
const LAZY_COMPONENT_STYLES = ['SharePanel', 'DestinationsPanel', 'SpeciesPanel', 'CuisinePanel', 'EarthquakePanel', 'HazardPanel', 'PopulationPanel', 'LanguagePanel', 'WeatherPanel', 'HistoryPanel'];
const clientManifest = JSON.parse(await readFile('.svelte-kit/output/client/.vite/manifest.json', 'utf8'));
function isLazyStylesheet(href) {
  const file = href.split('/').pop() ?? '';
  return LAZY_COMPONENT_STYLES.some(name => file.startsWith(name + '.') && file.endsWith('.css'));
}
function pruneLazyStylesheets(html) {
  return html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, tag => {
    const href = tag.match(/href="([^"]+)"/)?.[1];
    if (href && isLazyStylesheet(href)) return '';
    return tag;
  });
}
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
const textValue = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
    const section = route.startsWith('guides/') ? route.slice('guides/'.length) : route === 'guides' ? 'index' : route;
    const prefix = route === 'terms' || route === 'privacy' ? route : 'editorial_' + section;
    title = text[prefix + '_title'] + ' · ' + text.site_title;
    description = text[prefix + '_description'];
    if (!title || !description) throw new Error('Missing metadata for ' + locale + '/' + route);
  }
  // Japanese social art needs a freshly generated screenshot; use the existing English preview until that asset is reviewed.
  const image = SITE + '/og/nusantara-' + (locale === 'ja' ? 'en' : locale) + '.png?v=clay-discovery-2';
  const imageAlt = text.site_title + ': ' + text.og_headline + ' ' + text.og_tagline;
  let html = source
    .replace(/<html lang="[^"]+"/, '<html lang="' + locale + '" dir="' + direction + '"')
    .replace('<link rel="canonical" href="' + SITE + '/" />', '<link rel="canonical" href="' + url + '" />')
    .replace(/<title>[^<]*<\/title>/, '<title>' + textValue(title) + '</title>')
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
    if (!route) {
      data.inLanguage = locale;
      data.url = url;
      data.description = description;
      data.dateModified = revisionDate;
    } else {
      const type = route === 'about' ? 'AboutPage' : route === 'guides' ? 'CollectionPage' : route.startsWith('guides/') ? 'Article' : 'WebPage';
      const details = { '@context': 'https://schema.org', '@type': type, name: title, description, inLanguage: locale, url, isPartOf: { '@type': 'WebSite', name: 'Atlas Nusantara', url: SITE + '/' } };
      if (type === 'Article') details.headline = title.replace(' · ' + text.site_title, '');
      Object.assign(data, details);
      for (const key of Object.keys(data)) if (!(key in details)) delete data[key];
    }
    return '<script type="application/ld+json">' + JSON.stringify(data).replaceAll('<', '\\u003c') + '</script>';
  });

  // A second, separately valid JSON-LD block mirrors the visible breadcrumb trail.
  // All names and URLs use the same dictionary and locale routing as the article.
  if (route === 'about' || route === 'guides' || route.startsWith('guides/')) {
    const trail = [{ name: 'Atlas Nusantara', item: urlFor(locale, '') }];
    if (route.startsWith('guides/')) trail.push({ name: text.editorial_index_title, item: urlFor(locale, 'guides') });
    const section = route === 'guides' ? 'index' : route.replace('guides/', '');
    trail.push({ name: text['editorial_' + section + '_title'], item: url });
    const breadcrumb = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: trail.map((entry, index) => ({
        '@type': 'ListItem', position: index + 1, name: entry.name, item: entry.item
      }))
    };
    html = html.replace('</head>', '<script type="application/ld+json">' + JSON.stringify(breadcrumb).replaceAll('<', '\\u003c') + '</script></head>');
  }
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
    const html = pruneLazyStylesheets(localizeShell(page.html, locale, route, messages[locale]));
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
// Message dictionaries are downloaded per language; without them an installed shell could not render offline.
for (const [key, entry] of Object.entries(clientManifest)) {
  if (/^messages\/[^/]+\.json$/.test(key)) collectRouteEntry(key);
}
// Fetch these lazy UI chunks in the service worker's background install, not
// the render path. They were previously in the route bundle and must remain
// available offline even if their tab or a saved place has not been opened yet.
const OFFLINE_LAZY_COMPONENTS = ['RegionAtlas', 'AggregateSummary', 'WeatherPanel', 'WeatherPlaceCard', 'ProvinceTable', 'WeatherHistoryChart'];
for (const [key, entry] of Object.entries(clientManifest)) {
  // Rollup names some lazy chunks (for example RegionAtlas) without a source path, so match either form.
  if (OFFLINE_LAZY_COMPONENTS.some(name => entry.src?.endsWith('/' + name + '.svelte') || entry.name === name)) collectRouteEntry(key);
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
