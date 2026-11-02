// Generate static/ads.txt from config/ads.json so the file never drifts from the AdSense client ID.
import { readFile, writeFile } from 'node:fs/promises';

const GOOGLE_CERTIFICATION_AUTHORITY_ID = 'f08c47fec0942fa0';
const AD_CLIENT_PATTERN = /^ca-pub-(\d{16})$/;

export function buildAdsTxt(config) {
  if (config?.enabled !== true) return '';
  const match = AD_CLIENT_PATTERN.exec(config.client ?? '');
  if (!match) throw new Error('config/ads.json: client must look like ca-pub-0000000000000000');
  const publisherId = 'pub-' + match[1];
  return 'google.com, ' + publisherId + ', DIRECT, ' + GOOGLE_CERTIFICATION_AUTHORITY_ID + '\n';
}

if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  const config = JSON.parse(await readFile(new URL('../config/ads.json', import.meta.url), 'utf8'));
  await writeFile(new URL('../static/ads.txt', import.meta.url), buildAdsTxt(config));
  console.log('Generated static/ads.txt from config/ads.json');
}
