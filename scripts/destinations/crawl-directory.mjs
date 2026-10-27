import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CrawlClient } from './crawl-http.mjs';
import { parseBrowsePage, parseDirectoryDetail } from './directory-source.mjs';

const ORIGIN = 'https://www.direktoripariwisata.id';

async function save(filename, value) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename + '.partial', JSON.stringify(value) + '\n');
  await rename(filename + '.partial', filename);
}

export async function crawlDirectory({ outputDirectory, delayMs = 1000, maxPages = 600, fetcher = fetch }) {
  const client = new CrawlClient({ origin: ORIGIN, cacheDirectory: path.join(outputDirectory, 'http-cache'), delayMs, fetcher });
  const robots = await client.get('/robots.txt');
  if (/^\s*Disallow:\s*\/(?:\s*$|browse|unit|sitemap)/im.test(robots.body)) throw Error('robots.txt restricts the requested crawl paths');
  const first = await client.get('/browse?cat=0');
  const root = parseBrowsePage(first.body);
  const records = new Map(root.records.map(record => [record.officialId, record]));
  const report = { source: 'Direktori Pariwisata', sourceUrl: ORIGIN + '/browse?cat=0',
    startedAt: first.fetchedAt, expectedRecords: root.expectedRecords, complete: false,
    contentLicense: null, publicationScope: 'factual source-linked records only; no copied descriptions or photo bytes',
    listingPages: 1, regionPages: 0, failures: [] };
  const output = path.join(outputDirectory, 'inventory.json');
  const checkpoint = () => save(output, { ...report, fetchedAt: new Date().toISOString(),
    records: [...records.values()].sort((a, b) => Number(a.officialId) - Number(b.officialId)) });
  await checkpoint();
  const pages = Math.ceil(root.expectedRecords / root.pageSize);
  if (pages > maxPages) throw Error('Advertised page count exceeds configured crawl bound');
  for (let page = 1; page < pages; page++) {
    const url = '/browse/pg-' + page + '?cat=0';
    try {
      const response = await client.get(url);
      const parsed = parseBrowsePage(response.body);
      if (parsed.expectedRecords !== root.expectedRecords) throw Error('Source record count changed during crawl');
      const newRecords = parsed.records.filter(record => !records.has(record.officialId));
      if (!newRecords.length) throw Error('Pagination repeated a previously collected page');
      for (const record of newRecords) records.set(record.officialId, record);
      report.listingPages++;
      await checkpoint();
    } catch (error) {
      report.failures.push({ url: ORIGIN + url, message: error.message });
      console.warn('Directory listing stopped:', error.message);
      if (/HTTP (401|403|429)/.test(error.message)) {
        await checkpoint();
        throw error;
      }
      break;
    }
  }
  // The source embeds factual province inventories in its detail pages. Reuse one
  // page per source province rather than sending a request for every destination.
  // The current detail is omitted from its own related-category tabs. The four
  // public category landing pages recover explicit memberships for those seeds.
  for (const [category, kind] of [[1, 'natural'], [2, 'built'], [3, 'built'], [4, 'natural']]) {
    const response = await client.get('/browse?cat=' + category);
    const parsed = parseBrowsePage(response.body);
    for (const record of parsed.records) {
      records.set(record.officialId, { ...records.get(record.officialId), ...record, kind, sourceCategory: category });
    }
  }
  const sitemap = await client.get('/sitemap.xml');
  const seeds = [...new Set([...sitemap.body.matchAll(/<loc>[^<]*\/unit\/(\d+)<\/loc>/g)].map(match => match[1]))];
  const provinces = new Set();
  for (const id of seeds) {
    const known = records.get(id);
    if (known?.sourceProvince) continue;
    const url = '/unit/' + id;
    try {
      const response = await client.get(url);
      const detail = parseDirectoryDetail(response.body);
      if (!detail.sourceProvince) throw Error('Directory detail has no source province');
      records.set(id, { ...records.get(id), officialId: id, name: detail.name, sourceUrl: ORIGIN + url,
        sourceProvince: detail.sourceProvince, provenanceUrl: ORIGIN + url, retrievedAt: response.fetchedAt });
      if (provinces.has(detail.sourceProvince)) continue;
      provinces.add(detail.sourceProvince);
      report.regionPages++;
      for (const record of detail.records) {
        const existing = records.get(record.officialId);
        records.set(record.officialId, { ...existing, ...record, sourceProvince: detail.sourceProvince,
          provenanceUrl: ORIGIN + url, retrievedAt: response.fetchedAt });
      }
      console.log('Directory source province:', detail.sourceProvince, detail.records.length, 'collected:', records.size);
      await checkpoint();
    } catch (error) {
      report.failures.push({ url: ORIGIN + url, message: error.message });
      console.warn('Directory detail unavailable:', id, error.message);
      if (/HTTP (401|403|429)/.test(error.message)) break;
    }
  }
  report.complete = records.size === root.expectedRecords && report.failures.length === 0;
  report.sourceProvinces = [...provinces].sort();
  await checkpoint();
  console.log(JSON.stringify({ output, collected: records.size, expected: root.expectedRecords,
    complete: report.complete, failures: report.failures.length, regionPages: report.regionPages }));
  return { ...report, records: [...records.values()] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputDirectory = process.argv[2];
  if (!outputDirectory) throw Error('Usage: node scripts/destinations/crawl-directory.mjs <output-directory>');
  try {
    const result = await crawlDirectory({ outputDirectory });
    if (!result.complete) process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
