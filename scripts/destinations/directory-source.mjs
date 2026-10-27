const ORIGIN = 'https://www.direktoripariwisata.id';
const KINDS = new Map([[1, 'natural'], [2, 'built'], [3, 'built'], [4, 'natural']]);

export function decodeText(value) {
  return value.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#(?:0?39|x27);/gi, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ').trim();
}

function cards(html) {
  const results = new Map();
  const pattern = /<a\b[^>]*href=["'][^"']*\bunit\/(\d+)["'][^>]*>\s*<img\b[^>]*>\s*<br\s*\/?>\s*([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const name = decodeText(match[2]);
    if (!name) throw Error('Destination listing has an empty name');
    results.set(match[1], { officialId: match[1], name, sourceUrl: ORIGIN + '/unit/' + match[1] });
  }
  return [...results.values()];
}

/** Parse the actual listing, never the repeated navigation links. */
export function parseBrowsePage(html) {
  const count = html.match(/id=["']numdest["'][^>]*>\s*([\d,.]+)\s+Destinasi/i);
  const start = html.search(/data-tabs-id=["']cont-a2tabs2["'][^>]*class=["']container-tabs/);
  if (!count || start < 0) throw Error('Unrecognized directory browse page');
  const expectedRecords = Number(count[1].replace(/[,.]/g, ''));
  const records = cards(html.slice(start));
  if (!Number.isSafeInteger(expectedRecords) || expectedRecords < 0 || records.length > 16) throw Error('Invalid browse count or page size');
  if (expectedRecords > 0 && records.length === 0) throw Error('Directory returned no listing cards');
  return { expectedRecords, pageSize: 16, records };
}

/** Factual coordinates from the source's own embedded map; no script evaluation. */
export function parseDirectoryDetail(html) {
  const heading = html.match(/class=["']wrapa_project_fdetails["'][^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!heading) throw Error('Unrecognized directory detail page');
  const regions = decodeText(heading[2]).split(',').map(text => text.trim());
  const sourceProvince = regions.pop();
  const categoryRecords = new Map();
  const tabPattern = /<div\s+data-tabs-id=["']cont-a2tabs([1-4])["']\s+class=["']container-tabs[^"']*["'][^>]*>/g;
  const tabs = [...html.matchAll(tabPattern)];
  for (let index = 0; index < tabs.length; index++) {
    const start = tabs[index].index + tabs[index][0].length;
    let end = html.length;
    if (tabs[index + 1]) end = tabs[index + 1].index;
    const category = Number(tabs[index][1]);
    for (const record of cards(html.slice(start, end))) {
      if (categoryRecords.has(record.officialId)) throw Error('Conflicting directory category membership: ' + record.officialId);
      categoryRecords.set(record.officialId, { ...record, kind: KINDS.get(category), sourceCategory: category });
    }
  }
  const points = new Map();
  for (const match of html.matchAll(/map1\.addMarker\s*\(\s*\{([\s\S]*?)\}\s*\);/g)) {
    const body = match[1];
    const lat = body.match(/\blat:\s*(-?\d+(?:\.\d+)?)/);
    const lon = body.match(/\blng:\s*(-?\d+(?:\.\d+)?)/);
    const link = body.match(/href=["']\/unit\/(\d+)["'][^>]*>([^<]*)<\/a>/);
    if (!lat || !lon || !link) continue;
    const latitude = Number(lat[1]);
    const longitude = Number(lon[1]);
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw Error('Invalid directory map coordinates');
    points.set(link[1], { officialId: link[1], name: decodeText(link[2]), lat: latitude, lon: longitude,
      sourceUrl: ORIGIN + '/unit/' + link[1] });
  }
  const records = new Map(categoryRecords);
  for (const [id, point] of points) records.set(id, { ...categoryRecords.get(id), ...point });
  return { name: decodeText(heading[1]), sourceProvince, sourceDistrict: regions.join(', '), records: [...records.values()] };
}
