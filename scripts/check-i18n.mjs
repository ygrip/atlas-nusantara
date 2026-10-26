import { readFileSync } from 'node:fs';
const settings=JSON.parse(readFileSync('project.inlang/settings.json','utf8'));
const base=JSON.parse(readFileSync('messages/en.json','utf8')); const keys=Object.keys(base).sort();
for (const locale of settings.locales) { const data=JSON.parse(readFileSync('messages/'+locale+'.json','utf8')); const actual=Object.keys(data).sort(); if(JSON.stringify(actual)!==JSON.stringify(keys)) throw new Error(locale+': translation key mismatch'); for(const key of keys) if(typeof data[key]!=='string'||!data[key].trim()) throw new Error(locale+': missing '+key); }
console.log('Validated '+settings.locales.length+' locale catalogs with '+keys.length+' keys each');
