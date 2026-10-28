// KSDAE (Kementerian Kehutanan) protected flora and fauna lists: scientific name, local name, IUCN status, CITES appendix, GBIF key.
// Usage: node scripts/species/fetch-ksdae.mjs
// Output: tmp/species-cache/ksdae.json  [{ kind, scientificName, localName, iucn, cites, gbifKey }]
import { fetchText, writeCache } from './common.mjs';

const LISTS = [
  { kind: 'flora', url: 'https://ksdae.kehutanan.go.id/spesies/flora/' },
  { kind: 'fauna', url: 'https://ksdae.kehutanan.go.id/spesies/fauna/' }
];

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

/** "N/A" in the source means no value. */
function valueOf(cell) {
  const text = stripTags(cell);
  if (text === 'N/A' || text === '-') return '';
  return text;
}

function parseRows(kind, html) {
  const body = html.slice(html.indexOf('id="species-body"'));
  const rows = [...body.matchAll(/<tr>\s*<td class="text-center w-12">[^<]*<\/td>(.*?)<\/tr>/gs)];
  return rows.map(row => {
    const cells = [...row[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map(match => match[1]);
    const gbif = /gbif\.org\/species\/(\d+)/.exec(cells[4] ?? '');
    return {
      kind, scientificName: stripTags(cells[0]), localName: valueOf(cells[1]), iucn: valueOf(cells[2]), cites: valueOf(cells[3]),
      gbifKey: gbif ? Number(gbif[1]) : undefined
    };
  });
}

async function main() {
  const all = [];
  for (const list of LISTS) {
    const rows = parseRows(list.kind, await fetchText(list.url));
    console.log(list.kind, rows.length, 'with GBIF key:', rows.filter(row => row.gbifKey).length, JSON.stringify(rows[0]));
    all.push(...rows);
  }
  await writeCache('ksdae.json', all);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
