/**
 * Optional one-time 13-locale recipe translation generator.
 * Run after build:cuisine. Requires a separate OpenAI API key and model.
 * Machine output is explicitly marked unreviewed; original Indonesian
 * ingredient amounts, order and safety instructions must be checked by reviewers.
 * The browser never calls an LLM or translation API.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const LOCALES = {
  en:'English',ms:'Malay',fil:'Filipino',th:'Thai',vi:'Vietnamese',
  my:'Burmese',km:'Khmer',lo:'Lao','zh-SG':'Simplified Chinese for Singapore',
  ta:'Tamil',tet:'Tetum','pt-TL':'Portuguese for Timor-Leste'
};
const args=process.argv.slice(2), requested=args.includes('--all')?Object.keys(LOCALES):[args[args.indexOf('--locale')+1]];
if (!requested.length || requested.some(locale=>!LOCALES[locale])) {
  console.error('Usage: OPENAI_API_KEY=... OPENAI_TRANSLATE_MODEL=... npm run translate:cuisine -- --all | --locale <en|ms|fil|th|vi|my|km|lo|zh-SG|ta|tet|pt-TL>');
  process.exit(1);
}
const apiKey=process.env.OPENAI_API_KEY, model=process.env.OPENAI_TRANSLATE_MODEL;
if(!apiKey || !model) throw Error('OPENAI_API_KEY and OPENAI_TRANSLATE_MODEL are required for optional translation');
const catalog=JSON.parse(await readFile('static/data/cuisine/national.json','utf8'));
if(catalog.schemaVersion!==1||!Array.isArray(catalog.items))throw Error('Invalid cuisine national dataset');
const source=catalog.items.filter(item=>item.recipe?.language==='id'&&item.recipe.ingredients?.length&&item.recipe.steps?.length);
const fileFor = locale=>'static/data/cuisine/locales/'+locale+'.json';
await mkdir('static/data/cuisine/locales',{recursive:true});
function isValid(row,origin) {
  return row?.id===origin.id && typeof row.name==='string' && row.name.trim().length>0
    && Array.isArray(row.ingredients) && row.ingredients.length===origin.recipe.ingredients.length
    && Array.isArray(row.steps) && row.steps.length===origin.recipe.steps.length
    && row.ingredients.every(x=>typeof x==='string' && x.trim())
    && row.steps.every(x=>typeof x==='string' && x.trim());
}
async function callTranslation(locale,batch) {
  const input=batch.map(item=>({id:item.id,name:item.name,ingredients:item.recipe.ingredients,steps:item.recipe.steps}));
  const response=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',
    headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
    body:JSON.stringify({
      model,temperature:0,
      response_format:{type:'json_object'},
      messages:[
        {role:'system',content:'You are a professional culinary translator. Return a JSON object with key "recipes" containing one recipe per input, in the same order. Translate dish descriptions, each ingredient and each cooking step into '+LOCALES[locale]+'. Preserve Indonesian proper dish names and culturally specific ingredient terms where appropriate; transliterate rather than substituting different ingredients. Preserve exact weights, fractions, measurements, times, temperatures, numbering and steps. Do not add, remove, simplify or reorder anything. Preserve exact IDs. Do not add prose or Markdown.'},
        {role:'user',content:JSON.stringify(input)}
      ]
    }),
    signal:AbortSignal.timeout(120000)
  });
  if(!response.ok) throw Error('Translation API '+response.status+': '+(await response.text()).slice(0,500));
  const payload=await response.json();
  const text=payload.choices?.[0]?.message?.content;
  if(typeof text!=='string')throw Error('Translation API returned no content');
  const result=JSON.parse(text);
  if(!Array.isArray(result.recipes)||result.recipes.length!==batch.length
    ||result.recipes.some((row,i)=>!isValid(row,batch[i]))) throw Error('Translation result failed count/content validation');
  return result.recipes;
}
for(const locale of requested){
  const output=fileFor(locale);
  let existing={locale,sourceLanguage:'id',items:{}};
  try {const previous=JSON.parse(await readFile(output,'utf8'));if(previous.locale===locale)existing=previous;} catch{}
  const pending=source.filter(item=>!existing.items[item.id]||existing.items[item.id].ingredients.length!==item.recipe.ingredients.length||existing.items[item.id].steps.length!==item.recipe.steps.length);
  console.log(locale+': '+pending.length+' pending recipes');
  for(let i=0;i<pending.length;i+=4){
    const batch=pending.slice(i,i+4);
    // Fail closed and save nothing for a rejected batch.
    const translated=await callTranslation(locale,batch);
    for(const row of translated)existing.items[row.id]={name:row.name,ingredients:row.ingredients,steps:row.steps,status:'machine-unreviewed'};
    await writeFile(output,JSON.stringify(existing,null,2)+'\n'); // resumable checkpoint
    console.log('  '+Math.min(i+4,pending.length)+' / '+pending.length);
  }
  console.log('Completed '+locale+'; requires human culinary-language review before changing any status to human-reviewed.');
}
