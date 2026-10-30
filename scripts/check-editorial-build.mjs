import { readFile } from 'node:fs/promises';
import { PREFIXED_LOCALES } from '../src/lib/i18n/paths.js';

const SITE = 'https://nusantara.readynaz.com';
const locales = ['en', ...PREFIXED_LOCALES];
const routes = ['about', 'guides', 'guides/regions', 'guides/conditions', 'guides/nature'];

for (const locale of locales) {
  const messages = JSON.parse(await readFile('messages/' + locale + '.json', 'utf8'));
  for (const route of routes) {
    const path = (locale === 'en' ? '' : '/' + locale) + '/' + route;
    const url = SITE + path;
    let html;
    try { html = await readFile('build' + path + '.html', 'utf8'); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      html = await readFile('build' + path + '/index.html', 'utf8');
    }
    const section = route === 'guides' ? 'index' : route === 'about' ? 'about' : route.slice('guides/'.length);
    const title = messages['editorial_' + section + '_title'];
    if (!html.includes('<html lang="' + locale + '"')) throw new Error(path + ': HTML language not localized');
    if (!html.includes('<link rel="canonical" href="' + url + '"')) throw new Error(path + ': incorrect canonical');
    if (!html.includes('<meta property="og:url" content="' + url + '"')) throw new Error(path + ': incorrect social URL');
    if (!html.includes('hreflang="' + locale + '" href="' + url + '"')) throw new Error(path + ': missing locale alternate');
    if ((html.match(/<link rel="alternate" hreflang=/g) ?? []).length !== locales.length) throw new Error(path + ': incomplete hreflang alternates');
    if ((html.match(/<meta name="description"/g) ?? []).length !== 1) throw new Error(path + ': duplicate or missing description');
    if ((html.match(/<title>/g) ?? []).length !== 1) throw new Error(path + ': duplicate or missing title');
    const rawHeading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1];
    const heading = rawHeading?.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    if (heading !== title) throw new Error(path + ': incorrect translated heading ' + JSON.stringify(heading) + ', expected ' + JSON.stringify(title));
    const dataScript = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!dataScript) throw new Error(path + ': missing structured data');
    const structured = JSON.parse(dataScript[1]);
    if (structured.url !== url || structured.inLanguage !== locale) throw new Error(path + ': incorrect structured data URL/language');
  }
}

const sitemap = await readFile('build/sitemap.xml', 'utf8');
for (const locale of locales) for (const route of routes) {
  const url = SITE + (locale === 'en' ? '' : '/' + locale) + '/' + route;
  if (!sitemap.includes('<loc>' + url + '</loc>')) throw new Error('Missing sitemap entry: ' + url);
}
console.log('Verified localized HTML, metadata, structured data, hreflang and sitemap for ' + (locales.length * routes.length) + ' editorial pages.');
