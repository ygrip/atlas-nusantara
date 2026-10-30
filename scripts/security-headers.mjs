import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_HASH_PATTERN = /^'sha256-[A-Za-z0-9+/]{43}='$/;
const MAX_HEADER_LINE_BYTES = 2000;
const AD_SCRIPT_ORIGINS = ['https://pagead2.googlesyndication.com', 'https://ep2.adtrafficquality.google'];
const AD_CONNECT_ORIGINS = [
  'https://pagead2.googlesyndication.com',
  'https://googleads.g.doubleclick.net',
  'https://tpc.googlesyndication.com',
  'https://ep1.adtrafficquality.google'
];
const BASE_FRAME_ORIGINS = ['https://challenges.cloudflare.com'];

export function validateHttpsOrigin(value, allowWildcard = false) {
  if (typeof value !== 'string' || value.length > 300 || !value.startsWith('https://')) {
    throw new Error('CSP origins must be HTTPS origins');
  }
  if (value.includes('*')) {
    if (!allowWildcard || !/^https:\/\/\*\.[a-z0-9.-]+(?::443)?$/i.test(value)) {
      throw new Error('CSP wildcard origins must use a leading DNS wildcard');
    }
    return value.replace(/:443$/i, '');
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('CSP origin is invalid');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('CSP values must be HTTPS origins without credentials, paths, queries or fragments');
  }
  let origin = url.origin;
  if (origin.endsWith(':443')) origin = origin.slice(0, -4);
  return origin;
}

function unique(values) {
  return [...new Set(values)];
}

export function createContentSecurityPolicy({ scriptHashes, adsConfig, dataOrigins = [] }) {
  for (const hash of scriptHashes) {
    if (!SCRIPT_HASH_PATTERN.test(hash)) throw new Error('CSP inline-script hash is invalid');
  }
  const checkedDataOrigins = dataOrigins.map(value => validateHttpsOrigin(value));
  const scripts = ["'self'", ...scriptHashes, 'https://challenges.cloudflare.com'];
  const connect = ["'self'", 'https://challenges.cloudflare.com', ...checkedDataOrigins];
  const frames = [...BASE_FRAME_ORIGINS];
  if (adsConfig?.enabled === true) {
    scripts.push(...AD_SCRIPT_ORIGINS);
    connect.push(...AD_CONNECT_ORIGINS);
    if (!Array.isArray(adsConfig.frameOrigins) || adsConfig.frameOrigins.length === 0) {
      throw new Error('Enabled ads require explicit frame origins');
    }
    for (const origin of adsConfig.frameOrigins) frames.push(validateHttpsOrigin(origin, true));
  }
  const directives = [
    "default-src 'none'",
    'base-uri \'none\'',
    'form-action \'self\'',
    'frame-ancestors \'none\'',
    `script-src ${unique(scripts).join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "media-src 'self'",
    `connect-src ${unique(connect).join(' ')}`,
    `frame-src ${unique(frames).join(' ')}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'"
  ];
  const policy = directives.join('; ');
  if (Buffer.byteLength(`Content-Security-Policy: ${policy}`) > MAX_HEADER_LINE_BYTES) {
    throw new Error('Content-Security-Policy exceeds the Pages 2000-byte header-line limit');
  }
  return policy;
}

export function hashInlineScripts(html) {
  const hashes = new Set();
  const scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (const match of html.matchAll(scriptTag)) {
    if (/\bsrc\s*=/.test(match[1])) continue;
    // JSON-LD and JSON data blocks are inert; CSP script hashes apply to executable code.
    // Hashing every localized JSON-LD payload would exceed Cloudflare Pages' header limit.
    if (/\btype\s*=\s*["']application\/(?:ld\+)?json["']/i.test(match[1])) continue;
    const body = match[2];
    if (!body.trim()) continue;
    const digest = createHash('sha256').update(body, 'utf8').digest('base64');
    hashes.add(`'sha256-${digest}'`);
  }
  return [...hashes].sort();
}

async function listHtmlFiles(directory) {
  const results = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...await listHtmlFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(entryPath);
    }
  }
  return results;
}

export async function createBuildPolicy({ buildDirectory, adsConfig, environment = process.env }) {
  const htmlFiles = await listHtmlFiles(buildDirectory);
  if (htmlFiles.length === 0) throw new Error(`No built HTML files found in ${buildDirectory}`);
  const hashes = new Set();
  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, 'utf8');
    for (const hash of hashInlineScripts(html)) hashes.add(hash);
  }
  const dataOrigins = [];
  for (const name of ['VITE_PUBLIC_DATA_ORIGIN', 'VITE_PUBLIC_SNAPSHOT_ORIGIN']) {
    const value = environment[name];
    if (value) dataOrigins.push(value);
  }
  return createContentSecurityPolicy({ scriptHashes: [...hashes], adsConfig, dataOrigins });
}

export function applySecurityHeaders(headersText, policy) {
  if (typeof policy !== 'string' || policy.includes('\n') || policy.length === 0) {
    throw new Error('Generated CSP must be a non-empty single line');
  }
  if (Buffer.byteLength(`Content-Security-Policy: ${policy}`) > MAX_HEADER_LINE_BYTES) {
    throw new Error('Content-Security-Policy exceeds the Pages 2000-byte header-line limit');
  }
  const lines = headersText.split(/\r?\n/);
  const policyLines = lines.filter(line => /^\s*Content-Security-Policy:/i.test(line));
  let result = headersText;
  if (policyLines.length > 1) throw new Error('Multiple Content-Security-Policy headers found in build/_headers');
  if (policyLines.length === 1) {
    result = lines.map(line => {
      if (!/^\s*Content-Security-Policy:/i.test(line)) return line;
      const indentation = line.match(/^\s*/)?.[0] ?? '';
      return `${indentation}Content-Security-Policy: ${policy}`;
    }).join('\n');
  } else {
    const globalPattern = lines.findIndex(line => line.trim() === '/*');
    if (globalPattern < 0) throw new Error('build/_headers is missing the global /* rule');
    lines.splice(globalPattern + 1, 0, `  Content-Security-Policy: ${policy}`);
    result = lines.join('\n');
  }
  const normalized = result.replace(/\r\n/g, '\n');
  if (normalized.endsWith('\n')) return normalized;
  return `${normalized}\n`;
}

async function run() {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const buildDirectory = resolve(projectRoot, 'build');
  const headersPath = join(buildDirectory, '_headers');
  const adsConfigPath = join(projectRoot, 'config', 'ads.json');
  const [headersText, adsJson] = await Promise.all([
    readFile(headersPath, 'utf8'),
    readFile(adsConfigPath, 'utf8')
  ]);
  const adsConfig = JSON.parse(adsJson);
  const { loadEnv } = await import('vite');
  const environment = { ...loadEnv('production', projectRoot, 'VITE_PUBLIC_'), ...process.env };
  const policy = await createBuildPolicy({ buildDirectory, adsConfig, environment });
  const staticHeaders = await readFile(join(projectRoot, 'static', '_headers'), 'utf8');
  const hstsPresent = /^\s*Strict-Transport-Security:/im.test(staticHeaders);
  if (!hstsPresent) throw new Error('static/_headers must declare Strict-Transport-Security');
  const generatedHeaders = applySecurityHeaders(headersText, policy);
  await writeFile(headersPath, generatedHeaders);
  console.log(`Generated CSP for ${ (await listHtmlFiles(buildDirectory)).length } HTML files (${policy.length} characters).`);
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) await run();
