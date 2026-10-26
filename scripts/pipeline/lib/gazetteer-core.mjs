// Pure place-name matcher over plain region records. Ambiguity downgrades precision instead of guessing.
// Shared by the Node pipeline and the Cloudflare Worker; it performs no I/O.
import { normalizeForMatching } from './text.mjs';

const PREFIX = /^(kabupaten administrasi|kota administrasi|kabupaten|kota|kab)\s+/i;
/** Common words that are also regency names; these match only with an explicit "Kota"/"Kabupaten" prefix. */
const EXPLICIT_PREFIX_ONLY = new Set(['batu', 'banjar', 'pati', 'tengah', 'barat', 'timur', 'utara', 'selatan', 'raya', 'baru', 'lama', 'sawah', 'kuning']);
const PROVINCE_ALIASES = {
  '31': ['jakarta', 'dki jakarta'], '34': ['yogyakarta', 'jogja', 'diy', 'di yogyakarta'], '52': ['ntb'], '53': ['ntt'],
  '21': ['kepri'], '19': ['babel', 'bangka belitung'], '91': ['papua'], '92': ['papua barat']
};

function baseName(name) {
  return name.replace(PREFIX, '').trim();
}

function aliasEntries(region) {
  const base = normalizeForMatching(baseName(region.name)).trim();
  const normalizedFull = normalizeForMatching(region.name).trim();
  const entries = [{ alias: normalizedFull, code: region.code, explicit: true }];
  if (region.level === 'province') {
    entries.push({ alias: base, code: region.code, explicit: false });
    for (const extra of PROVINCE_ALIASES[region.code] ?? []) entries.push({ alias: extra, code: region.code, explicit: false });
    return entries;
  }
  const isCity = /^kota\b/i.test(region.name);
  const prefixes = isCity ? ['kota'] : ['kabupaten', 'kab'];
  for (const prefix of prefixes) entries.push({ alias: prefix + ' ' + base, code: region.code, explicit: true });
  const bareAllowed = base.length >= 5 && !EXPLICIT_PREFIX_ONLY.has(base.toLowerCase());
  if (bareAllowed) entries.push({ alias: normalizeForMatching(base).trim(), code: region.code, explicit: false });
  return entries;
}

function groupAliases(regions) {
  const byAlias = new Map();
  for (const region of regions) {
    for (const entry of aliasEntries(region)) {
      const codes = byAlias.get(entry.alias) ?? new Set();
      codes.add(entry.code);
      byAlias.set(entry.alias, codes);
    }
  }
  return [...byAlias.entries()].sort((a, b) => b[0].length - a[0].length);
}

/**
 * Pure gazetteer over plain region records, so Node scripts and Cloudflare Workers share one implementation.
 * @param {{ code: string, name: string, level: 'province' | 'city-regency', parentCode: string | null, lon?: number, lat?: number }[]} regionList
 */
export function createGazetteer(regionList) {
  const regions = new Map(regionList.map(region => [region.code, region]));
  const points = new Map(regionList.filter(region => Number.isFinite(region.lon) && Number.isFinite(region.lat)).map(region => [region.code, { lon: region.lon, lat: region.lat }]));
  const aliases = groupAliases(regionList);

  function describe(code, precision) {
    const region = regions.get(code);
    const point = points.get(code);
    const result = { code, name: region.name, level: region.level, precision };
    if (point && precision === 'regency') return { ...result, lon: point.lon, lat: point.lat };
    return result;
  }

  function parentOf(code) {
    return regions.get(code)?.parentCode ?? undefined;
  }

  /** Resolves matched region codes to the most precise location that is still unambiguous. */
  function resolve(matchedCodes) {
    const cityCodes = [...new Set(matchedCodes.filter(code => regions.get(code)?.level === 'city-regency'))];
    const provinceCodes = [...new Set(matchedCodes.filter(code => regions.get(code)?.level === 'province'))];
    if (cityCodes.length === 1) return describe(cityCodes[0], 'regency');
    if (cityCodes.length > 1) {
      const parents = new Set(cityCodes.map(parentOf));
      if (parents.size === 1) return describe([...parents][0], 'province');
      return undefined;
    }
    if (provinceCodes.length === 1) return describe(provinceCodes[0], 'province');
    return undefined;
  }

  return {
    regions,
    point(code) {
      return points.get(code);
    },
    /** Looks up a regency/province by code and returns its representative point. */
    byCode(code) {
      if (!regions.has(code)) return undefined;
      const region = regions.get(code);
      if (region.level === 'city-regency') return describe(code, 'regency');
      return describe(code, 'province');
    },
    /** Finds the most precise unambiguous place named in the text. */
    findInText(text) {
      let remaining = normalizeForMatching(text);
      const matched = [];
      for (const [alias, codes] of aliases) {
        const needle = ' ' + alias + ' ';
        if (!remaining.includes(needle)) continue;
        remaining = remaining.split(needle).join(' ');
        const candidates = [...codes];
        if (candidates.length === 1) { matched.push(candidates[0]); continue; }
        const parents = new Set(candidates.map(parentOf));
        if (parents.size === 1 && !parents.has(undefined)) matched.push([...parents][0]);
      }
      return resolve(matched);
    }
  };
}
