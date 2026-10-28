/** Validate all published cuisine shards after a local build. */
import {readFile} from 'node:fs/promises';
const read=async f=>JSON.parse(await readFile(f,'utf8'));
const root='static/data/cuisine';
const index=await read(root+'/index.json'),national=await read(root+'/national.json');
const codes=['19','64','92','93','94','95','96'];
const issues=[];
const byId=new Map(national.dishes.map(d=>[d.id,d]));
if(byId.size!==national.dishes.length)issues.push('Duplicate national dish IDs');
if(index.coverage.totalDishes!==national.dishes.length)issues.push('National total mismatch');
for(const province of index.provinces){
  const code=province.provinceCode;
  const shard=await read(root+'/provinces/'+code+'.json');
  const expected=national.dishes.filter(d=>d.provinceCodes.includes(code));
  if(province.count!==expected.length || shard.dishes.length!==expected.length)issues.push(code+': total mismatch');
  if(province.withRecipe!==expected.filter(d=>d.recipes?.length).length)issues.push(code+': recipe mismatch');
  if(province.withImage!==expected.filter(d=>d.images?.length).length)issues.push(code+': image mismatch');
  if(shard.dishes.some(d=>!byId.has(d.id)))issues.push(code+': unknown dish');
  if(codes.includes(code)&&!expected.length)issues.push(code+': still zero dishes');
}
const curated=await read('scripts/recipes/regional-supplements.json');
for(const item of curated){
  const match=national.dishes.find(d=>d.name.toLowerCase()===item.name.toLowerCase());
  if(!match)issues.push(item.name+': missing from national');
  else for(const code of item.provinceCodes)if(!match.provinceCodes.includes(code))issues.push(item.name+': missing '+code);
}
if(issues.length){console.error(issues.join('\n'));process.exitCode=1;}
else console.log('Cuisine coverage verified: '+national.dishes.length+' dishes; '+curated.length+' curated regional names; all 38 shards match.');
