// Animal World Map: 93 IUCN-assessed mammals recorded in Indonesia, with a written profile (habitat, range, description).
// Usage: node scripts/species/fetch-awm.mjs
// Output: tmp/species-cache/awm.json  [{ slug, commonName, scientificName, iucn, family, order, about, range, habitat, url }]
// Text is stored as facts for matching and as a short summary only; see docs/SPECIES.md for the licensing caution.
import { fetchText, mapConcurrent, sleep, writeCache } from './common.mjs';

const ORIGIN = 'https://animalworldmap.com';
const LIST_PATHS = ['/animals/in/indonesia', '/animals/in/indonesia/page/2'];
const STATUS_CODES = { Extinct: 'EX', 'Critically Endangered': 'CR', Endangered: 'EN', Vulnerable: 'VU', 'Near Threatened': 'NT', 'Least Concern': 'LC', 'Data Deficient': 'DD' };
const REQUEST_DELAY_MS = 500;

function flatten(html) {
  const withoutCode = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  return withoutCode.replace(/<[^>]+>/g, '|').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').replace(/(\|\s*)+/g, '|');
}

function parseListing(html) {
  const found = new Map();
  for (const match of html.matchAll(/<a [^>]*href="\/animals\/([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const parts = flatten(match[2]).split('|').map(part => part.trim()).filter(Boolean);
    if (parts.length < 3 || !STATUS_CODES[parts[2]]) continue;
    found.set(match[1], { slug: match[1], commonName: parts[0], scientificName: parts[1], iucn: STATUS_CODES[parts[2]] });
  }
  return [...found.values()];
}

/** Text that follows a heading and runs to the next heading, in the flattened "|a|b|c|" form. */
function sectionAfter(text, headingPattern) {
  const match = headingPattern.exec(text);
  if (!match) return '';
  const rest = text.slice(match.index + match[0].length).replace(/^\|/, '');
  return rest.split('|')[0].trim();
}

function parseSpecies(entry, html) {
  const text = flatten(html);
  return {
    ...entry,
    family: sectionAfter(text, /\|Family\|/), order: sectionAfter(text, /\|Order\|/),
    about: sectionAfter(text, /\|What is (?:the )?[^|]*\?\|/),
    range: sectionAfter(text, /\|Where does (?:the )?[^|]*live\?\|/),
    habitat: sectionAfter(text, /\|Habitat of (?:the )?[^|]*\|/),
    url: ORIGIN + '/animals/' + entry.slug
  };
}

async function main() {
  const entries = [];
  for (const path of LIST_PATHS) entries.push(...parseListing(await fetchText(ORIGIN + path)));
  console.log('Listed mammals:', entries.length);
  const species = await mapConcurrent(entries, 2, async entry => {
    await sleep(REQUEST_DELAY_MS);
    const html = await fetchText(ORIGIN + '/animals/' + entry.slug);
    return html ? parseSpecies(entry, html) : entry;
  }, { every: 20, label: 'profiles' });
  await writeCache('awm.json', species);
  console.log('With habitat text:', species.filter(item => item.habitat).length, JSON.stringify(species[0]).slice(0, 700));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
