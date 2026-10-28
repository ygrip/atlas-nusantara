/**
 * Offline/manual Indonesian culinary catalog builder (schema 2, like the flora and fauna layers).
 * Sources:
 *   Wikipedia id: Daftar_masakan_Indonesia (dish names + province associations)
 *   Hugging Face: LorthGyu/indonesian-recipes (MIT recipe ingredients + steps)
 *   tmp/recipes-cache/cookpad: recipes crawled by crawl-cookpad.mjs (optional, resumable stage)
 *   tmp/recipes-cache/wikipedia: summaries and Commons photos fetched by fetch-wikipedia.mjs (optional, resumable stage)
 *
 * IMPORTANT: Never claim that a broad dataset region (e.g. "Jawa") is a province.
 * A missing recipe/photo remains explicitly null; do not guess.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isLikelyDish } from './classify.mjs';
import { assembleDish } from './assemble.mjs';
import { isCuisineDish } from '../../src/lib/data/cuisine-validation.js';

const ROOT = 'static/data/cuisine';
const SEED = 'scripts/recipes/seed.json';
const REGIONAL = 'scripts/recipes/regional-evidence.json';
const WIKI = 'https://id.wikipedia.org/wiki/Daftar_masakan_Indonesia';
const HF = 'https://huggingface.co/datasets/LorthGyu/indonesian-recipes';
const HF_API = 'https://datasets-server.huggingface.co';
const UA = 'AtlasNusantaraCuisineBuilder/0.1 (https://github.com/ygrip/atlas-nusantara)';
const PROVINCES = Object.fromEntries([
  ['11','Aceh'],['12','Sumatera Utara'],['13','Sumatera Barat'],['14','Riau'],['15','Jambi'],['16','Sumatera Selatan'],['17','Bengkulu'],['18','Lampung'],['19','Kepulauan Bangka Belitung'],['21','Kepulauan Riau'],
  ['31','DKI Jakarta'],['32','Jawa Barat'],['33','Jawa Tengah'],['34','DI Yogyakarta'],['35','Jawa Timur'],['36','Banten'],['51','Bali'],['52','Nusa Tenggara Barat'],['53','Nusa Tenggara Timur'],['61','Kalimantan Barat'],['62','Kalimantan Tengah'],['63','Kalimantan Selatan'],['64','Kalimantan Timur'],['65','Kalimantan Utara'],['71','Sulawesi Utara'],['72','Sulawesi Tengah'],['73','Sulawesi Selatan'],['74','Sulawesi Tenggara'],['75','Gorontalo'],['76','Sulawesi Barat'],['81','Maluku'],['82','Maluku Utara'],['91','Papua'],['92','Papua Barat'],['93','Papua Selatan'],['94','Papua Tengah'],['95','Papua Pegunungan'],['96','Papua Barat Daya']
]);
const ALIASES = new Map(Object.entries({
  'jakarta':'31','dki jakarta':'31','daerah khusus jakarta':'31','daerah khusus ibukota jakarta':'31',
  'yogyakarta':'34','daerah istimewa yogyakarta':'34',
  'kep bangka belitung':'19','bangka belitung':'19','kepulauan bangkabelitung':'19',
  'kep riau':'21','sumatra utara':'12','sumatra barat':'13','sumatra selatan':'16',
  'papua pegunungan':'95','papua pegunungan tengah':'95'
}));
for(const [code,name] of Object.entries(PROVINCES)) ALIASES.set(name.toLowerCase(),code);
const NAME_ALIASES = new Map([
  ['rendang sapi','rendang'],['rawon daging sapi','rawon'],
  ['pempek palembang','pempek'],['soto ayam banjar','soto banjar'],
  ['papeda kuah kuning','papeda']
]);
const ACCEPTED_LICENSE = /^(?:CC0|CC BY(?:-SA)?(?:\s|\-|$)|Public domain)/i;
const stripTags = text => String(text??'').replace(/<[^>]*>/g,'').replace(/&(?:nbsp|amp|quot|lt|gt);/g, x => ({'&nbsp;':' ','&amp;':'&','&quot;':'"','&lt;':'<','&gt;':'>'}[x])).trim();
const key = s => String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const canon = s => NAME_ALIASES.get(key(s)) ?? key(s);
const slug = s => key(s).replace(/\s+/g,'-').slice(0,90);
function cleanWiki(s) {
  return stripTags(String(s).replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/g,'').replace(/<ref\b[^>]*\/>/g,'')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g,'$2').replace(/\[\[([^\]]+)\]\]/g,'$1')
    .replace(/{{[^{}]*}}/g,'').replace(/'''?/g,'').replace(/\[[^\]]*https?:[^\]]*\]/g,'')).replace(/\s+/g,' ').trim();
}
async function fetchJSON(url) {
  const response = await fetch(url, { headers:{'User-Agent':UA,'Accept':'application/json'}, signal:AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(response.status+' '+url);
  return response.json();
}
function htmlText(value) {
  return stripTags(value)
    .replace(/&#(x[0-9a-f]+|\d+);/gi,(_,code)=>String.fromCodePoint(code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code)))
    .replace(/\s+/g,' ').trim();
}
async function fetchWikipediaHTML() {
  // Wikimedia frequently returns 503 for /w/api.php from hosted runners,
  // while the article itself responds 200. Use only ordinary article text and links.
  const response=await fetch(WIKI,{headers:{'User-Agent':UA,'Accept':'text/html'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Wikipedia HTML unavailable: '+response.status);
  const html=await response.text();
  if(html.length<10000)throw Error('Wikipedia HTML unexpectedly short');
  const entries=new Map();
  let provinceCode=null;
  // Exclude Wikipedia's navigation/sidebar/footer lists from regional dish records.
  const start = html.indexOf('id="mw-content-text"');
  const stop = html.indexOf('id="catlinks"', start);
  if (start < 0 || stop <= start) throw Error('Wikipedia article content markers are missing');
  const article = html.slice(start, stop);
  const tokens=article.match(/<h3\b[^>]*>[\s\S]*?<\/h3>|<li\b[^>]*>[\s\S]*?<\/li>/gi)??[];
  for(const token of tokens) {
    if(/^<h3\b/i.test(token)) {
      const heading=htmlText(token).replace(/\[sunting\].*/i,'').replace(/^provinsi\s+/i,'').toLowerCase();
      provinceCode=ALIASES.get(heading)??null;
      continue;
    }
    if(!provinceCode)continue;
    const anchors=[...token.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    const anchor=anchors.find(match=>!/(?:#|Special:|Bantuan:|Kategori:|File:|Berkas:)/i.test(match[1]) && !/sunting/i.test(htmlText(match[2])));
    const name=htmlText(token).replace(/\[\d+\]\s*$/,'').trim();
    if(!name||name.length>100||/^(?:referensi|lihat juga|catatan|daftar)/i.test(name))continue;
    const k=key(name);
    if(k.length<3)continue;
    const existing=entries.get(k)??{name,provinces:new Set(),articleTitle:null};
    existing.provinces.add(provinceCode);
    if(anchor&&!existing.articleTitle) {
      try{
        const link=new URL(anchor[1].replace(/&amp;/g,'&'),WIKI);
        if(link.hostname.endsWith('wikipedia.org')&&link.pathname.startsWith('/wiki/'))
          existing.articleTitle=decodeURIComponent(link.pathname.slice(6)).replace(/_/g,' ');
      }catch{}
    }
    entries.set(k,existing);
  }
  if(entries.size<200)throw Error('Wikipedia HTML parser found only '+entries.size+' dishes. Refusing incomplete publication.');
  console.log('Wikipedia API unavailable; HTML fallback found '+entries.size+' dish names.');
  return [...entries.values()].map(e=>({...e,provinces:[...e.provinces].sort()}));
}

async function fetchWikipedia() {
  const url = new URL('https://id.wikipedia.org/w/api.php');
  for(const [k,v] of Object.entries({action:'parse',page:'Daftar_masakan_Indonesia',prop:'wikitext',format:'json',formatversion:'2'})) url.searchParams.set(k,v);
  let result;
  try { result = await fetchJSON(url.toString()); }
  catch(error) { console.warn('Wikipedia API unavailable, trying the article HTML:',String(error)); return fetchWikipediaHTML(); }
  const wikiText = result.parse?.wikitext;
  const raw = typeof wikiText === 'string' ? wikiText : wikiText?.['*'];
  if (typeof raw !== 'string' || raw.length < 2000) throw Error('Wikipedia recipe list unavailable or too short');
  const records = new Map();
  let provinceCode = null, headingLevel = 0;
  for (const line of raw.split(/\r?\n/)) {
    const heading = line.match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
    if (heading) {
      const level = heading[1].length;
      const title = cleanWiki(heading[2]).toLowerCase().replace(/\s+/g,' ').replace(/^provinsi /,'');
      const code = ALIASES.get(title);
      if (code) { provinceCode = code; headingLevel = level; }
      else if (provinceCode && level <= headingLevel) provinceCode = null;
      continue;
    }
    if (!provinceCode || !/^\s*\*+\s*[^*:]/.test(line)) continue;
    const content = line.replace(/^\s*\*+\s*/,'').split(/<ref\b/i)[0];
    const wikiLink = content.match(/\[\[([^|\]#]+)(?:#[^|\]]*)?(?:\|[^\]]+)?\]\]/);
    let name = cleanWiki(content).replace(/\s*\([^)]{60,}\).*/,'').trim();
    if (name.includes(' · ')) name = name.split(' · ')[0];
    if (!name || name.length > 100 || /^(?:lihat|baca|referensi|catatan)\b/i.test(name)) continue;
    const normalized = key(name);
    if (!normalized || normalized.length < 3) continue;
    const item = records.get(normalized) ?? {name, provinces:new Set(), articleTitle:null};
    item.provinces.add(provinceCode);
    if (!item.articleTitle && wikiLink && !/^(?:Berkas|File|Kategori|Category):/i.test(wikiLink[1])) item.articleTitle = wikiLink[1].replace(/_/g,' ');
    records.set(normalized,item);
  }
  if (records.size < 200) throw Error('Wikipedia parse returned only '+records.size+' dishes. Refusing to publish partial scrape.');
  return [...records.values()].map(item=>({...item,provinces:[...item.provinces].sort()}));
}
async function fetchRecipes() {
  const splits = await fetchJSON(HF_API+'/splits?dataset='+encodeURIComponent('LorthGyu/indonesian-recipes'));
  const recipeRows=[];
  for(const split of splits.splits??[]) {
    if (!['train','test','validation'].includes(split.split)) continue;
    // /splits does not reliably include row counts. Page /rows until exhausted.
    for(let offset=0;offset<10000;offset+=100) {
      const url = new URL(HF_API+'/rows');
      for(const [k,v] of Object.entries({dataset:'LorthGyu/indonesian-recipes',config:split.config,split:split.split,offset:String(offset),length:'100'})) url.searchParams.set(k,v);
      const page=await fetchJSON(url.toString());
      if (!Array.isArray(page.rows)||!page.rows.length) break;
      for(const entry of page.rows) {
        const r=entry.row??entry;
        if (typeof r.name !== 'string'||!Array.isArray(r.ingredients)||!Array.isArray(r.steps)||!r.ingredients.length||!r.steps.length) continue;
        if (!r.ingredients.every(x=>typeof x==='string') || !r.steps.every(x=>typeof x==='string')) continue;
        recipeRows.push({name:r.name,category:r.category??null,ingredients:r.ingredients,steps:r.steps,timeMinutes:Number.isFinite(r.time_minutes)?r.time_minutes:null,difficulty:r.difficulty??null,broadRegion:r.region??null,sourceUrl:HF});
      }
      if (page.rows.length < 100 || offset + 100 >= page.num_rows_total) break;
    }
  }
  if (recipeRows.length < 250) throw Error('Recipe source returned only '+recipeRows.length+' rows; refusing incomplete import');
  return recipeRows;
}
function merge(wiki, recipes, seed, regionalEvidence) {
  const byKey=new Map();
  for(const row of wiki) {
    const id=slug(row.name);
    byKey.set(canon(row.name),{id,name:row.name,provinceCodes:row.provinces,originStatus:'wikipedia-listed',articleUrl:row.articleTitle?'https://id.wikipedia.org/wiki/'+encodeURIComponent(row.articleTitle.replace(/ /g,'_')):null,recipe:null,image:null,sources:[{url:WIKI,role:'province-list'}]});
  }
  for (const r of recipes) {
    const normalized=canon(r.name);
    const item=byKey.get(normalized)??{id:slug(r.name),name:r.name,provinceCodes:[],originStatus:'unmapped',articleUrl:null,recipe:null,image:null,sources:[]};
    if (item.recipe) continue; // Multiple versions are not silently merged.
    item.recipe={ingredients:r.ingredients,steps:r.steps,category:r.category,difficulty:r.difficulty,timeMinutes:r.timeMinutes,language:'id',status:'source',sourceUrl:r.sourceUrl};
    item.broadRegion=r.broadRegion;
    item.sources.push({url:HF,role:'recipe',license:'MIT'});
    byKey.set(normalized,item);
  }
  for(const r of seed) {
    const normalized=canon(r.name);
    const item=byKey.get(normalized)??{id:r.id??slug(r.name),name:r.name,provinceCodes:[],originStatus:'unmapped',articleUrl:null,recipe:null,image:null,sources:[]};
    // Reviewed seed entries override only fields explicitly provided; do not lose wiki multi-province evidence.
    if (r.recipe) item.recipe=r.recipe;
    if (r.image) item.image=r.image;
    if (r.provinceCodes?.length) {
      item.provinceCodes=[...new Set([...item.provinceCodes,...r.provinceCodes])].sort();
      if(item.originStatus==='unmapped') item.originStatus='seed-reviewed';
    }
    if(r.articleUrl&&!item.articleUrl) item.articleUrl=r.articleUrl;
    item.sources.push(...(r.sources??[]));
    byKey.set(normalized,item);
  }
  // Manual regional references supplement the Wikipedia list, notably for newly formed provinces.
  // These prove a documented association, not exclusive origin or the existence of a recipe.
  for (const [code, groups] of Object.entries(regionalEvidence)) {
    if (!PROVINCES[code] || !Array.isArray(groups)) throw Error('Invalid regional cuisine province: ' + code);
    for (const group of groups) {
      if (!group || typeof group.source !== 'string' || !group.source.startsWith('https://') || !Array.isArray(group.dishes))
        throw Error('Invalid regional cuisine source for ' + code);
      for (const name of group.dishes) {
        if (typeof name !== 'string' || !name.trim() || name.length > 160) throw Error('Invalid regional cuisine dish for ' + code);
        const normalized=canon(name);
        const item=byKey.get(normalized)??{
          id:slug(name),name,provinceCodes:[],originStatus:'regional-source',articleUrl:null,recipe:null,image:null,sources:[]
        };
        item.provinceCodes=[...new Set([...item.provinceCodes,code])].sort();
        item.sources.push({url:group.source,role:'regional-reference'});
        byKey.set(normalized,item);
      }
    }
  }
  const ids=new Set();
  return [...byKey.values()].map(item=>{
    if(ids.has(item.id)) item.id=item.id+'-'+slug(item.name).slice(-12);
    ids.add(item.id);
    return item;
  }).sort((a,b)=>a.name.localeCompare(b.name,'id'));
}
const SOURCES = [
  {name:'Wikipedia · Daftar masakan Indonesia',url:WIKI},
  {name:'Cookpad Indonesia',url:'https://cookpad.com/id'},
  {name:'LorthGyu/indonesian-recipes (MIT)',url:HF},
  {name:'Wikimedia Commons',url:'https://commons.wikimedia.org/wiki/Category:Cuisine_of_Indonesia'},
  {name:'Regional culinary references',url:'https://www.indonesia.travel/id/id'}
];
const CACHE=join('tmp','recipes-cache');
async function readCache(path) {
  try { return JSON.parse(await readFile(path,'utf8')); }
  catch(error) { if(error.code==='ENOENT') return undefined; throw error; }
}
/** Recipes the Cookpad crawl kept for one dish, best liked first. */
async function readCookpad(dishId) {
  const search=await readCache(join(CACHE,'cookpad','search',dishId+'.json'));
  const recipes=[];
  for(const recipeId of search?.recipeIds??[]) {
    const recipe=await readCache(join(CACHE,'cookpad','recipes',recipeId+'.json'));
    if(recipe&&!recipe.missing) recipes.push(recipe);
  }
  return recipes.sort((a,b)=>((b.likes??0)+(b.bookmarks??0))-((a.likes??0)+(a.bookmarks??0)));
}
async function assemble(records) {
  const dishes=[], dropped=[];
  for(const item of records) {
    const cookpad=await readCookpad(item.id);
    const wikipedia=await readCache(join(CACHE,'wikipedia','summary',item.id+'.json'));
    const hasRecipe=Boolean(item.recipe)||cookpad.length>0;
    const likely=isLikelyDish({description:wikipedia?.description,summary:wikipedia?.summary,hasRecipe,hasArticle:Boolean(item.articleUrl)});
    if(!likely) { dropped.push(item.name); continue; }
    const dish=assembleDish({item,cookpad,wikipedia});
    if(!isCuisineDish(dish)) { console.warn('Dropping invalid dish record',item.id); continue; }
    dishes.push(dish);
  }
  console.log('Dropped '+dropped.length+' entries that are not dishes, e.g. '+dropped.slice(0,12).join(', '));
  return dishes;
}
function richness(dish) {
  return (dish.recipes?.length??0)*4+(dish.images?.length??0)*2+(dish.summary?1:0);
}
async function publish(dishes) {
  await mkdir(join(ROOT,'provinces'),{recursive:true});
  const fetchedAt=new Date().toISOString();
  const rank=(a,b)=>richness(b)-richness(a)||a.name.localeCompare(b.name,'id');
  const summaries=[];
  for(const [code] of Object.entries(PROVINCES)) {
    const items=dishes.filter(d=>d.provinceCodes.includes(code)).sort(rank);
    summaries.push({provinceCode:code,count:items.length,withRecipe:items.filter(d=>d.recipes).length,withImage:items.filter(d=>d.images).length,shard:'/data/cuisine/provinces/'+code+'.json'});
    await writeFile(join(ROOT,'provinces',code+'.json'),JSON.stringify({schemaVersion:2,fetchedAt,provinceCode:code,dishes:items})+'\n');
  }
  const national=[...dishes].sort(rank);
  const groupCounts={};
  for(const dish of dishes) groupCounts[dish.group]=(groupCounts[dish.group]??0)+1;
  const index={
    schemaVersion:2,fetchedAt,
    scope:'Indonesian dishes from the Wikipedia regional list and separately sourced provincial culinary references, with recipes where available from Cookpad and LorthGyu. Associations do not prove exclusive origin. A missing recipe, image or dish is not evidence of absence.',
    license:'Wikipedia summaries: CC BY-SA 4.0; regional dish associations are linked to their original reference pages. Recipes retain their author attribution and source links. Photos are linked, never copied, with per-file credit and licence.',
    attribution:'Indonesian Wikipedia contributors; regional culinary publications (linked per dish); Cookpad Indonesia recipe authors; LorthGyu (MIT); Wikimedia Commons photographers (per file).',
    national:'/data/cuisine/national.json',
    sources:SOURCES,
    coverage:{
      totalDishes:dishes.length,withoutProvince:dishes.filter(d=>!d.provinceCodes.length).length,
      withRecipe:dishes.filter(d=>d.recipes).length,withImage:dishes.filter(d=>d.images).length,withSummary:dishes.filter(d=>d.summary).length,
      recipes:dishes.reduce((total,d)=>total+(d.recipes?.length??0),0)
    },
    groupCounts,provinces:summaries
  };
  await writeFile(join(ROOT,'index.json'),JSON.stringify(index,null,2)+'\n');
  await writeFile(join(ROOT,'national.json'),JSON.stringify({schemaVersion:2,fetchedAt,provinceCode:null,dishes:national})+'\n');
  const c=index.coverage;
  console.log('Published '+c.totalDishes+' dishes, '+c.withRecipe+' with recipes ('+c.recipes+' recipes), '+c.withImage+' with photos, '+c.withoutProvince+' unassigned; 38 province shards.');
}
const seed=JSON.parse(await readFile(SEED,'utf8'));
const regionalEvidence=JSON.parse(await readFile(REGIONAL,'utf8'));
const [wiki,recipes]=await Promise.all([fetchWikipedia(),fetchRecipes()]);
const merged=merge(wiki,recipes,seed,regionalEvidence);
await publish(await assemble(merged));
