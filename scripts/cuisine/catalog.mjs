/**
 * Aggregate Wikipedia's provincial dish index with the MIT-licensed LorthGyu
 * recipe corpus. Public lists are evidence of mentions, not recipe instructions
 * or proof that a dish originates exclusively in a particular province.
 */
export const WIKI_INDEX = 'https://id.wikipedia.org/wiki/Daftar_masakan_Indonesia';
export const RECIPE_SOURCE = 'https://huggingface.co/datasets/LorthGyu/indonesian-recipes';
export const LOCALES = ['en','id','ms','fil','th','vi','my','km','lo','zh-SG','ta','tet','pt-TL'];

export const PROVINCES = new Map(Object.entries({
  'aceh':'11','sumatera utara':'12','sumatra utara':'12','sumatera barat':'13','sumatra barat':'13',
  'riau':'14','jambi':'15','sumatera selatan':'16','sumatra selatan':'16','bengkulu':'17',
  'lampung':'18','kepulauan bangka belitung':'19','bangka belitung':'19',
  'kepulauan riau':'21','dki jakarta':'31','jakarta':'31','daerah khusus ibukota jakarta':'31',
  'jawa barat':'32','jawa tengah':'33','yogyakarta':'34','daerah istimewa yogyakarta':'34',
  'jawa timur':'35','banten':'36','bali':'51','nusa tenggara barat':'52',
  'nusa tenggara timur':'53','kalimantan barat':'61','kalimantan tengah':'62',
  'kalimantan selatan':'63','kalimantan timur':'64','kalimantan utara':'65',
  'sulawesi utara':'71','sulawesi tengah':'72','sulawesi selatan':'73',
  'sulawesi tenggara':'74','gorontalo':'75','sulawesi barat':'76',
  'maluku':'81','maluku utara':'82','papua':'91','papua barat':'92',
  'papua selatan':'93','papua tengah':'94','papua pegunungan':'95','papua barat daya':'96'
}));
export function normalizeName(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('id')
    .replace(/['’]/g, '').replace(/[^a-z0-9\u00c0-\u024f]+/g,' ').trim().replace(/\s+/g,' ');
}
export function slug(value) {
  return normalizeName(value).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
}
function plainWiki(value) {
  return value.replace(/<!--[\s\S]*?-->/g,'')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g,'$2')
    .replace(/\[\[([^\]]+)\]\]/g,'$1')
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi,'')
    .replace(/<[^>]+>/g,'')
    .replace(/'{2,}/g,'')
    .replace(/\{\{[^{}]*\}\}/g,'')
    .replace(/\[[^\]]*https?:\/\/[^\]]+\]/g,'')
    .replace(/\s+/g,' ').trim();
}
/** Parse only list bullets under named province headings in the food index. */
export function parseWikiIndex(wikitext) {
  const entries = new Map();
  let province = null, category = 'food', enabled = true;
  for (const line of String(wikitext).split(/\r?\n/)) {
    const heading = line.match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
    if (heading) {
      const level = heading[1].length;
      const title = normalizeName(plainWiki(heading[2]));
      if (level === 2) {
        enabled = !/^(referensi|rujukan|pranala luar|lihat pula|catatan|daftar pustaka)$/.test(title);
        province = null;
        category = title.includes('minum') ? 'drink' : 'food';
      } else if (level === 3) {
        province = PROVINCES.get(title) ?? null;
        if (title.includes('minum')) category = 'drink';
      } else if (level > 3 && /minum|penganan|jajanan|makanan|kue/.test(title)) {
        category = title.includes('minum') ? 'drink' : title.includes('penganan') || title.includes('jajanan') || title.includes('kue') ? 'snack' : 'food';
      }
      continue;
    }
    if (!enabled || !province || !/^\s*\*+(?![:*])/.test(line)) continue;
    const value = plainWiki(line.replace(/^\s*\*+\s*/, '').replace(/\s*<ref\b.*$/, ''));
    const name = value.replace(/\s*\([^)]{45,}\)/g,'').trim();
    if (!name || name.length > 110 || /^(lihat|rujukan|sumber|artikel utama)\b/i.test(name)) continue;
    const key = normalizeName(name);
    if (key.length < 3) continue;
    let record = entries.get(key);
    if (!record) {
      record = { id: slug(name), name, provinceCodes: [], category, wikipediaListed: true };
      entries.set(key, record);
    }
    if (!record.provinceCodes.includes(province)) record.provinceCodes.push(province);
  }
  return [...entries.values()].map(item=>({...item,provinceCodes:item.provinceCodes.sort()}))
    .sort((a,b)=>a.name.localeCompare(b.name,'id'));
}
const VALID_CATEGORIES = new Map([['makanan_utama','food'],['pembuka','food'],['kue_camilan','snack'],['minuman','drink']]);
function validRecipe(value) {
  return value && typeof value.name === 'string'
    && value.name.length < 120 && Array.isArray(value.ingredients)
    && Array.isArray(value.steps) && value.ingredients.length >= 2
    && value.ingredients.every(v=>typeof v==='string' && v.length>2 && v.length<500)
    && value.steps.length >= 2 && value.steps.every(v=>typeof v==='string' && v.length>2 && v.length<1200);
}
/**
 * Prefer exact matches. A recipe title such as "Rendang Sapi" can extend an
 * indexed base title, but never use a generic 1-word prefix (e.g. "Sate").
 * Ambiguous matches are deliberately left without provincial assignment.
 */
export function matchWikiRecipe(name, list) {
  const key = normalizeName(name);
  const exact = list.find(item => normalizeName(item.name) === key);
  if (exact) return exact;
  const candidates = list.filter(item => {
    const label = normalizeName(item.name);
    return label.split(' ').length >= 2 && key.startsWith(label+' ');
  }).sort((a,b)=>b.name.length-a.name.length);
  return candidates.length && (candidates.length===1 || normalizeName(candidates[0].name).length>normalizeName(candidates[1].name).length) ? candidates[0] : undefined;
}
export function mergeCatalog(list, recipes) {
  const records = new Map(list.map(item => [normalizeName(item.name), {
    ...item, recipe: null, image: null, sourceUrls: [WIKI_INDEX], localization: { id: 'original' }
  }]));
  for (const raw of recipes) {
    if (!validRecipe(raw)) continue;
    const key = normalizeName(raw.name);
    const wiki = matchWikiRecipe(raw.name,list);
    const existing = records.get(key);
    const base = existing ?? {
      id: slug(raw.name), name: raw.name, category: VALID_CATEGORIES.get(raw.category) ?? 'food',
      provinceCodes: wiki?.provinceCodes ?? [], wikipediaListed: Boolean(wiki),
      image: null, sourceUrls: wiki ? [WIKI_INDEX,RECIPE_SOURCE] : [RECIPE_SOURCE], localization: { id:'original' }
    };
    const candidate = {
      ingredients: [...raw.ingredients], steps: [...raw.steps],
      timeMinutes: Number.isInteger(raw.time_minutes) && raw.time_minutes>0 ? raw.time_minutes : null,
      difficulty: ['mudah','sedang','sulit'].includes(raw.difficulty) ? raw.difficulty : null,
      sourceRegion: typeof raw.region==='string' ? raw.region : null,
      language: 'id', sourceUrl: RECIPE_SOURCE, license: 'MIT', translationStatus: 'original'
    };
    // Deterministic best recipe for repeated titles; not the longest title match.
    if (!base.recipe || candidate.steps.join('').length > base.recipe.steps.join('').length) base.recipe = candidate;
    if (wiki && !base.provinceCodes.length) base.provinceCodes = [...wiki.provinceCodes];
    if (wiki && !base.sourceUrls.includes(WIKI_INDEX)) base.sourceUrls.unshift(WIKI_INDEX);
    records.set(key,base);
  }
  return [...records.values()].sort((a,b)=>a.name.localeCompare(b.name,'id'));
}
export function catalogSummary(records) {
  const counts={ dishes: records.length, recipes:0, images:0, listedOnly:0 };
  for (const item of records) {if(item.recipe) counts.recipes++;if(item.image) counts.images++;if(!item.recipe) counts.listedOnly++;}
  return counts;
}
