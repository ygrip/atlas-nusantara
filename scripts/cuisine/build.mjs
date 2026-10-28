import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { isReusablePhotoMetadata } from '../../src/lib/data/photo-license.js';
import { WIKI_INDEX, RECIPE_SOURCE, parseWikiIndex, mergeCatalog, catalogSummary } from './catalog.mjs';

const API = 'https://id.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const OUT = 'static/data/cuisine/catalog.json';
const HEADERS = { 'User-Agent': 'AtlasNusantaraCuisine/0.1 (https://github.com/ygrip/atlas-nusantara; offline dataset maintenance)', Accept: 'application/json' };
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));

async function request(url, type='json') {
  let last;
  for (let attempt=0;attempt<3;attempt++) {
    const response = await fetch(url, {headers: HEADERS,signal: AbortSignal.timeout(20000)});
    if (response.ok) return type==='json' ? response.json() : response.text();
    last = Error('HTTP '+response.status+' from '+new URL(url).hostname);
    if (response.status!==429 && response.status<500) break;
    await delay(1000*(attempt+1));
  }
  throw last;
}
function apiUrl(host, args) {
  const url = new URL(host);
  for (const [key,value] of Object.entries({...args, format:'json', formatversion:2})) url.searchParams.set(key,String(value));
  return url.toString();
}
async function loadWiki() {
  const data = await request(apiUrl(API,{action:'parse',page:'Daftar_masakan_Indonesia',prop:'wikitext'}));
  const wiki = data.parse?.wikitext;
  if (typeof wiki!=='string' || wiki.length<5000) throw Error('Unexpected Wikipedia source content');
  const entries = parseWikiIndex(wiki);
  if (entries.length<150) throw Error('Wikipedia parser found too few provincial dishes ('+entries.length+'); aborting publication');
  return entries;
}
async function loadRecipes() {
  const rows=[];
  for (const filename of ['train.jsonl','train_split.jsonl','val.jsonl']) {
    const url=RECIPE_SOURCE+'/resolve/main/data/'+filename;
    const body=await request(url,'text');
    for (const line of body.split(/\r?\n/).filter(Boolean)) {
      try { rows.push(JSON.parse(line)); }
      catch { throw Error('Invalid JSONL from '+filename); }
    }
  }
  if (rows.length<150) throw Error('Too few licensed recipe rows ('+rows.length+')');
  return rows;
}
function cleanCredit(value) {
  return String(value??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&')
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ')
    .replace(/\s+/g,' ').trim().slice(0,500);
}
const LICENSE_URLS = new Map([
  ['CC BY 4.0','CC-BY-4.0'],['CC BY 3.0','CC-BY-3.0'],
  ['CC BY 2.0','CC-BY-2.0'],['CC BY-SA 4.0','CC-BY-SA-4.0'],
  ['CC BY-SA 3.0','CC-BY-SA-3.0'],['CC BY-SA 2.0','CC-BY-SA-2.0'],
  ['CC0','CC0-1.0'],['Public domain','Public-domain']
]);
const CANON = new Map([
  ['CC-BY-4.0','https://creativecommons.org/licenses/by/4.0/'],
  ['CC-BY-3.0','https://creativecommons.org/licenses/by/3.0/'],
  ['CC-BY-2.0','https://creativecommons.org/licenses/by/2.0/'],
  ['CC-BY-SA-4.0','https://creativecommons.org/licenses/by-sa/4.0/'],
  ['CC-BY-SA-3.0','https://creativecommons.org/licenses/by-sa/3.0/'],
  ['CC-BY-SA-2.0','https://creativecommons.org/licenses/by-sa/2.0/'],
  ['CC0-1.0','https://creativecommons.org/publicdomain/zero/1.0/'],
  ['Public-domain','https://creativecommons.org/publicdomain/mark/1.0/']
]);
function normalizeLicense(value) {
  const raw=String(value??'').trim();
  return LICENSE_URLS.get(raw)||LICENSE_URLS.get(raw.toUpperCase()) || null;
}
export function commonsPhoto(info, reviewedAt) {
  const fields=info?.extmetadata;
  const license=normalizeLicense(fields?.LicenseShortName?.value);
  if (!license || !fields?.Artist?.value || !info?.thumburl || !info?.descriptionurl) return null;
  const photo={ url:info.thumburl, descriptionUrl:info.descriptionurl,
    credit:cleanCredit(fields.Artist.value), license, licenseUrl:CANON.get(license), reviewedAt };
  return isReusablePhotoMetadata(photo) ? photo : null;
}
async function photoTitles(names) {
  const results=new Map();
  for(let start=0;start<names.length;start+=30) {
    const batch=names.slice(start,start+30);
    const res=await request(apiUrl(API,{action:'query',prop:'pageimages',piprop:'name',
      titles:batch.join('|'),redirects:'1'}));
    for(const page of res.query?.pages??[]) if(page.pageimage) results.set(page.title.replace(/_/g,' ').toLocaleLowerCase('id'),page.pageimage);
    await delay(140);
  }
  return results;
}
async function enrichImages(items, budget, reviewedAt) {
  const considered=items.filter(item=>item.recipe).concat(items.filter(item=>!item.recipe));
  const targets=considered.slice(0,budget);
  const index=await photoTitles(targets.map(item=>item.name));
  const files=new Map();
  for(const item of targets) {
    const filename=index.get(item.name.toLocaleLowerCase('id'));
    if(filename && !files.has(filename)) files.set(filename,[]);
    if(filename) files.get(filename).push(item);
  }
  const names=[...files.keys()];
  let count=0, failures=0;
  for(let start=0;start<names.length;start+=20){
    const batch=names.slice(start,start+20);
    try{
      const data=await request(apiUrl(COMMONS,{action:'query',prop:'imageinfo',iiprop:'url|extmetadata',
        iiurlwidth:'700',titles:batch.map(name=>'File:'+name).join('|')}));
      for(const page of data.query?.pages??[]) {
        const photo=commonsPhoto(page.imageinfo?.[0],reviewedAt);
        if(!photo) continue;
        for(const item of files.get(page.title.replace(/^File:/,'').replace(/_/g,' '))??[]) {
          item.image=photo; count++;
        }
      }
    }catch(err){failures++;console.warn('Commons metadata batch unavailable',String(err));}
    await delay(240);
  }
  return {considered:targets.length, licensedImages:count, failedBatches:failures};
}
async function preserveTranslations(items) {
  // Only reviewed or explicitly marked machine-translated content is published.
  // Missing locales render original Indonesian instructions with a language badge.
  let translations={};
  try { translations=JSON.parse(await readFile('data/cuisine/translations.json','utf8')); }
  catch(error){if(error.code!=='ENOENT') throw error;}
  for(const item of items){
    const input=translations[item.id];
    if(!input) continue;
    item.translations={};
    for(const [locale,details] of Object.entries(input)) {
      if(locale==='id' || !['en','ms','fil','th','vi','my','km','lo','zh-SG','ta','tet','pt-TL'].includes(locale)) continue;
      if(!details || !['reviewed','machine-unreviewed'].includes(details.status)
        || !Array.isArray(details.ingredients) || !Array.isArray(details.steps)
        || !item.recipe || details.ingredients.length!==item.recipe.ingredients.length
        || details.steps.length!==item.recipe.steps.length
        || details.steps.some(step=>typeof step!=='string'||!step.trim())) continue;
      item.translations[locale]={name:details.name || item.name, ingredients:details.ingredients,
        steps:details.steps,status:details.status};
    }
  }
}
export async function main(args=process.argv.slice(2)) {
  const requested=Number(args.find(arg=>arg.startsWith('--images='))?.split('=')[1]??'180');
  const imageBudget=Number.isSafeInteger(requested)&&requested>=0&&requested<=4000?requested:180;
  console.log('Fetching Wikipedia provincial index and the MIT recipe dataset...');
  const [listed,recipes]=await Promise.all([loadWiki(),loadRecipes()]);
  const items=mergeCatalog(listed,recipes);
  await preserveTranslations(items);
  const fetchedAt=new Date().toISOString();
  const images=imageBudget?await enrichImages(items,imageBudget,fetchedAt):{considered:0,licensedImages:0,failedBatches:0};
  const result={schemaVersion:1,countryCode:'ID',fetchedAt,
    sources:[{url:WIKI_INDEX,role:'provincial dish mentions',license:'CC-BY-SA-4.0'},
      {url:RECIPE_SOURCE,role:'ingredients and cooking steps',license:'MIT'}],
    caution:'Province codes represent Wikipedia list mentions, not exclusive geographic origins. Recipe ingredients and steps are Indonesian unless a reviewed or labeled machine translation exists.',
    ...catalogSummary(items), imageEnrichment:images, dishes:items};
  await mkdir(dirname(OUT),{recursive:true});
  await writeFile(OUT,JSON.stringify(result)+'\n');
  console.log('Published '+result.dishes.length+' dish names, '+result.recipes+' recipes, '+result.images+' licensed photos to '+OUT);
}
if(process.argv[1]?.endsWith('/scripts/cuisine/build.mjs')) {
  main().catch(err=>{console.error(err);process.exitCode=1;});
}
