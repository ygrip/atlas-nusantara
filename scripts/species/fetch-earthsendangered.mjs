// Earth's Endangered Creatures: species listed as endangered in Indonesia, with their listing status and other names.
// Usage: node scripts/species/fetch-earthsendangered.mjs
// Output: tmp/species-cache/earthsendangered.json  [{ id, group, commonName, scientificName, range, status, otherNames, profileUrl }]
// Only facts are kept (names, listing status). The Wikipedia-derived article text on the site is not copied.
import { fetchText, mapConcurrent, readCache, sleep, writeCache } from './common.mjs';

const ORIGIN = 'https://www.earthsendangered.com/';
const LIST_URL = ORIGIN + 'search-regions3.asp?mp=&search=1&sgroup=allgroups&ID=168';
const REQUEST_DELAY_MS = 250;
const CONCURRENCY = 3;

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/\s+/g, ' ').trim();
}

function parseList(html) {
  const rows = [...html.matchAll(/<tr>\s*<td style="vertical-align: top; width: 1%;">\d+\.<\/td>(.*?)<\/tr>/gs)];
  return rows.map(row => {
    const cells = [...row[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map(match => match[1]);
    const link = /profile\.asp\?gr=([A-Z]+)&(?:amp;)?sp=(\d+)/.exec(cells[0]);
    return {
      id: Number(link[2]), groupCode: link[1], commonName: stripTags(cells[0]), scientificName: stripTags(cells[1]),
      group: stripTags(cells[2]), range: stripTags(cells[3])
    };
  });
}

function fieldAfter(text, label, nextLabel) {
  const start = text.indexOf(label);
  if (start < 0) return '';
  const from = start + label.length;
  const end = text.indexOf(nextLabel, from);
  return text.slice(from, end < 0 ? from + 300 : end).trim();
}

function parseProfile(html) {
  const text = stripTags(html);
  return {
    status: fieldAfter(text, 'Status/Date Listed as Endangered:', 'Area(s) Where Listed As Endangered:'),
    otherNames: fieldAfter(text, 'Other Names and/or Listed subspecies:', 'Group:')
  };
}

async function main() {
  const list = parseList(await fetchText(LIST_URL));
  console.log('Listed species:', list.length);
  const previous = (await readCache('earthsendangered.json')) ?? [];
  const done = new Map(previous.map(item => [item.id, item]));
  const records = await mapConcurrent(list, CONCURRENCY, async item => {
    if (done.has(item.id)) return done.get(item.id);
    await sleep(REQUEST_DELAY_MS);
    const profileUrl = ORIGIN + 'profile.asp?gr=' + item.groupCode + '&sp=' + item.id;
    const html = await fetchText(profileUrl);
    const profile = html ? parseProfile(html) : { status: '', otherNames: '' };
    return { ...item, ...profile, profileUrl };
  }, { every: 100, label: 'profiles' });
  await writeCache('earthsendangered.json', records);
  const withStatus = records.filter(item => item.status).length;
  console.log('Profiles with status:', withStatus, 'sample:', JSON.stringify(records[5]));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
