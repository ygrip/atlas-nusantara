import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const project = JSON.parse(await readFile(resolve('project.inlang/settings.json'), 'utf8'));
const base = JSON.parse(await readFile(resolve('messages', project.baseLocale + '.json'), 'utf8'));
const errors = [];
const keys = Object.keys(base).sort();
const placeholders = (value) => [...value.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)]
  .map((match) => match[1]).sort().join('|');

if (new Set(project.locales).size !== project.locales.length) errors.push('Duplicate locales');
if (!project.locales.includes(project.baseLocale)) errors.push('Base locale is missing');
for (const locale of project.locales) {
  let data;
  try { data = JSON.parse(await readFile(resolve('messages', locale + '.json'), 'utf8')); }
  catch (error) { errors.push(locale + ': missing/invalid JSON: ' + String(error)); continue; }
  for (const key of keys) {
    if (typeof data[key] !== 'string' || data[key].trim().length === 0) {
      errors.push(locale + ': missing/empty key ' + key); continue;
    }
    if (placeholders(data[key]) !== placeholders(base[key])) {
      errors.push(locale + ': mismatched placeholders for ' + key);
    }
  }
  for (const key of Object.keys(data)) {
    if (!keys.includes(key)) errors.push(locale + ': unexpected key ' + key);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Checked ' + project.locales.length + ' locales with ' + keys.length + ' complete keys.');
}
