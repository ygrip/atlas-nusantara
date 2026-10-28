/**
 * Optional local Wikimedia Commons image discovery for curated regional cuisine.
 * Creates a review queue only; never inserts unchecked photos into cuisine JSON.
 * Run: node scripts/recipes/discover-regional-images.mjs
 * Output: tmp/recipes-cache/regional-image-candidates.json
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const input='scripts/recipes/regional-supplements.json';
const output='tmp/recipes-cache/regional-image-candidates.json';
const dishes=JSON.parse(await readFile(input,'utf8'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=s=>String(s??'').replace(/<[^>]*>/g,'').replace(/&(?:amp|quot|lt|gt);/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
const rows=[];
for(const dish of dishes){
  const params=new URLSearchParams({action:'query',generator:'search',gsrsearch:'filetype:bitmap '+dish.name,gsrnamespace:'6',gsrlimit:'8',prop:'imageinfo',iiprop:'url|size|extmetadata',format:'json'});
  try{
    const response=await fetch('https://commons.wikimedia.org/w/api.php?'+params,{headers:{'user-agent':'AtlasNusantaraCuisineReview/0.1 (https://github.com/ygrip/atlas-nusantara)','accept':'application/json'},signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw Error('HTTP '+response.status);
    const json=await response.json();
    const candidates=Object.values(json.query?.pages??{}).map(page=>{
      const info=page.imageinfo?.[0],meta=info?.extmetadata??{};
      const license=clean(meta.LicenseShortName?.value);
      return {file:page.title,url:info?.descriptionurl,preview:info?.thumburl??info?.url,width:info?.width,license,credit:clean(meta.Artist?.value),licenseUrl:meta.LicenseUrl?.value,
        eligible:Boolean(info?.width&&info?.url&&/^(CC0|CC BY(?:-SA)?|Public domain)/i.test(license)&&clean(meta.Artist?.value))};
    }).filter(c=>c.url);
    rows.push({id:dish.id,name:dish.name,candidates});
  }catch(error){rows.push({id:dish.id,name:dish.name,error:String(error),candidates:[]});}
  await sleep(800);
}
await mkdir(path.dirname(output),{recursive:true});
await writeFile(output,JSON.stringify({generatedAt:new Date().toISOString(),note:'Manual review required for subject match, credit, license, and Commons hash path. Do not bulk-apply automatically.',rows},null,2)+'\n');
console.log('Wrote '+output+' for '+rows.length+' dishes');
