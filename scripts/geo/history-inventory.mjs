/** Extract visible alphabetical source occurrences, not distinct historical entities. */
export function parseInventory(wikitext, revision, sourceUrl) {
  const text = wikitext.replace(/<!--[\s\S]*?-->/g, '');
  const features = [];
  let letter;
  for (const line of text.split('\n')) {
    const section = line.match(/^==\s*([A-Z])\s*==\s*$/);
    if (section) { letter = section[1]; continue; }
    if (/^==/.test(line)) { letter = undefined; continue; }
    if (!letter || !/^\*(?!\*)\s*/.test(line)) continue;
    const heading = leadingHeading(line.replace(/^\*\s*/, ''));
    const sourceLabel = plainName(heading);
    let names = [];
    if (heading.startsWith("'''")) {
      names = [...heading.matchAll(/'''(.*?)'''/g)].map(match => plainName(match[1])).filter(Boolean);
      // The pinned source has an unclosed bold lead for Mataram Kuno.
      if (!names.length) names = [sourceLabel];
    } else {
      // Non-bold leads must never acquire names from bold text later in the description.
      names = [sourceLabel];
    }
    if (!names[0] || /\[\[|\]\]|\{\{/.test(sourceLabel)) throw new Error(`Cannot parse inventory heading: ${heading}`);
    const target = heading.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/)?.[1];
    let articleUrl = null;
    if (target) articleUrl = `https://id.wikipedia.org/wiki/${encodeURIComponent(target.replaceAll(' ', '_'))}`;
    const ordinal = features.length + 1;
    features.push({
      type: 'Feature', id: `idwiki-${revision}-${String(ordinal).padStart(4, '0')}`, geometry: null,
      properties: {
        name: names[0], aliases: names.slice(1), source_label: sourceLabel, letter,
        source_entry: ordinal, review_status: 'unreviewed_inventory',
        period: null, summary: null, rulers: [],
        article_url: articleUrl, source_url: `${sourceUrl}#${letter}`
      }
    });
  }
  return features;
}

function leadingHeading(markup) {
  let linkDepth = 0;
  let parenthesisDepth = 0;
  for (let index = 0; index < markup.length; index++) {
    if (markup.startsWith('[[', index)) { linkDepth++; index++; continue; }
    if (markup.startsWith(']]', index)) { linkDepth = Math.max(0, linkDepth - 1); index++; continue; }
    if (linkDepth > 0) continue;
    if (markup[index] === '(') parenthesisDepth++;
    if (markup[index] === ')') parenthesisDepth = Math.max(0, parenthesisDepth - 1);
    if (parenthesisDepth > 0) continue;
    const startsProse = /^,\s*(?:sebuah|di|berada|terletak|adalah|merupakan)\b/i.test(markup.slice(index));
    if (markup[index] === ':' || startsProse) return markup.slice(0, index).trim();
  }
  return markup.trim();
}

function plainName(markup) {
  return markup.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, label) => label ?? target)
    .replace(/'{2,}/g, '').replace(/<[^>]*>/g, '').trim();
}
