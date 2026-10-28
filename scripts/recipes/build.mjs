/**
 * Offline/manual Indonesian culinary catalog builder.
 * Sources:
 *   Wikipedia id: Daftar_masakan_Indonesia (dish names + province associations)
 *   Hugging Face: LorthGyu/indonesian-recipes (MIT recipe ingredients + steps)
 *   Wikimedia Commons: file description and per-image license metadata.
 *
 * IMPORTANT: Never claim that a broad dataset region (e.g. "Jawa") is a province.
 * A missing recipe/photo remains explicitly null; do not guess.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = 'static/data/cuisine';
const SEED = 'scripts/recipes/seed.json';
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
const SOURCE = {wiki:WIKI,recipes:HF};
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
async function fetchWikipedia() {
  const url = new URL('https://id.wikipedia.org/w/api.php');
  for(const [k,v] of Object.entries({action:'parse',page:'Daftar_masakan_Indonesia',prop:'wikitext',format:'json',formatversion:'2'})) url.searchParams.set(k,v);
  const result = await fetchJSON(url.toString());
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
    const count = Math.min(split.num_rows??0,10000);
    for(let offset=0;offset<count;offset+=100) {
      const url = new URL(HF_API+'/rows');
      for(const [k,v] of Object.entries({dataset:'LorthGyu/indonesian-recipes',config:split.config,split:split.split,offset:String(offset),length:String(Math.min(100,count-offset))})) url.searchParams.set(k,v);
      const page=await fetchJSON(url.toString());
      for(const entry of page.rows??[]) {
        const r=entry.row??entry;
        if (typeof r.name !== 'string'||!Array.isArray(r.ingredients)||!Array.isArray(r.steps)||!r.ingredients.length||!r.steps.length) continue;
        if (!r.ingredients.every(x=>typeof x==='string') || !r.steps.every(x=>typeof x==='string')) continue;
        recipeRows.push({name:r.name,category:r.category??null,ingredients:r.ingredients,steps:r.steps,timeMinutes:Number.isFinite(r.time_minutes)?r.time_minutes:null,difficulty:r.difficulty??null,broadRegion:r.region??null,sourceUrl:HF});
      }
    }
  }
  if (recipeRows.length < 250) throw Error('Recipe source returned only '+recipeRows.length+' rows; refusing incomplete import');
  return recipeRows;
}
function merge(wiki, recipes, seed) {
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
  const ids=new Set();
  return [...byKey.values()].map(item=>{
    if(ids.has(item.id)) item.id=item.id+'-'+slug(item.name).slice(-12);
    ids.add(item.id);
    return item;
  }).sort((a,b)=>a.name.localeCompare(b.name,'id'));
}
async function enrichImages(records) {
  const candidates=records.filter(r=>r.articleUrl&&!r.image);
  // Exclude entries without a Wikipedia article; never match merely by similar filenames.
  for(let i=0;i<candidates.length;i+=25) {
    const batch=candidates.slice(i,i+25);
    const articleTitles=batch.map(r=>decodeURIComponent(r.articleUrl.split('/wiki/')[1]).replace(/_/g,' '));
    try {
      const articleUrl=new URL('https://id.wikipedia.org/w/api.php');
      for(const [k,v] of Object.entries({action:'query',format:'json',redirects:'1',prop:'pageimages',piprop:'name',titles:articleTitles.join('|')})) articleUrl.searchParams.set(k,v);
      const pages=Object.values((await fetchJSON(articleUrl.toString())).query?.pages??{});
      const files=[...new Set(pages.map(x=>x.pageimage).filter(Boolean))].map(x=>'File:'+x);
      if (!files.length) continue;
      const fileUrl=new URL('https://commons.wikimedia.org/w/api.php');
      for(const [k,v] of Object.entries({action:'query',format:'json',prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:'640',titles:files.join('|')})) fileUrl.searchParams.set(k,v);
      const filePages=Object.values((await fetchJSON(fileUrl.toString())).query?.pages??{});
      const imageByName=new Map(filePages.map(p=>[p.title?.replace(/^File:/,''),p.imageinfo?.[0]]));
      for (const page of pages) {
        if (!page.pageimage) continue;
        const info=imageByName.get(page.pageimage), metadata=info?.extmetadata;
        const license=stripTags(metadata?.LicenseShortName?.value);
        const credit=stripTags(metadata?.Artist?.value).slice(0,280);
        const pageTitle=page.title?.replace(/_/g,' ');
        const matched=batch.find(row=>canon(decodeURIComponent(row.articleUrl.split('/wiki/')[1]).replace(/_/g,' '))===canon(pageTitle));
        if(!matched||!info?.thumburl||!credit||!ACCEPTED_LICENSE.test(license)||!/^image\/(?:jpeg|png|webp)$/i.test(info.mime??'')) continue;
        matched.image={
          url:info.thumburl, descriptionUrl:info.descriptionurl??'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(page.pageimage),
          credit,license,licenseUrl:stripTags(metadata?.LicenseUrl?.value)||null,reviewedAt:new Date().toISOString(),source:'Wikimedia Commons'
        };
      }
    } catch(error) { console.warn('Image metadata batch skipped:',String(error)); }
  }
}
async function publish(records) {
  await mkdir(join(ROOT,'provinces'),{recursive:true});
  const timestamp=new Date().toISOString();
  const summaries=Object.entries(PROVINCES).map(([code,name])=>{
    const items=records.filter(r=>r.provinceCodes.includes(code));
    return {provinceCode:code,name,count:items.length,withRecipe:items.filter(r=>r.recipe).length,withImage:items.filter(r=>r.image).length,shard:'/data/cuisine/provinces/'+code+'.json'};
  });
  for(const summary of summaries) {
    const items=records.filter(r=>r.provinceCodes.includes(summary.provinceCode));
    await writeFile(join(ROOT,'provinces',summary.provinceCode+'.json'),JSON.stringify({schemaVersion:1,provinceCode:summary.provinceCode,items},null,2)+'\n');
  }
  const index={schemaVersion:1,generatedAt:timestamp,attribution:'Indonesian Wikipedia contributors; LorthGyu (MIT); Wikimedia Commons image authors (per file).',sources:SOURCE,totals:{dishes:records.length,withRecipe:records.filter(r=>r.recipe).length,withImage:records.filter(r=>r.image).length,unmapped:records.filter(r=>!r.provinceCodes.length).length},provinces:summaries,featured:records.filter(r=>r.recipe&&r.image).slice(0,12),national:'/data/cuisine/national.json'};
  await writeFile(join(ROOT,'index.json'),JSON.stringify(index,null,2)+'\n');
  await writeFile(join(ROOT,'national.json'),JSON.stringify({schemaVersion:1,generatedAt:timestamp,items:records},null,2)+'\n');
  console.log('Published '+records.length+' dishes, '+index.totals.withRecipe+' recipes, '+index.totals.withImage+' credited photos, '+index.totals.unmapped+' unassigned; 38 province shards.');
}
const seed=JSON.parse(await readFile(SEED,'utf8'));
const [wiki,recipes]=await Promise.all([fetchWikipedia(),fetchRecipes()]);
const merged=merge(wiki,recipes,seed);
if(!process.argv.includes('--skip-images')) await enrichImages(merged);
await publish(merged);
