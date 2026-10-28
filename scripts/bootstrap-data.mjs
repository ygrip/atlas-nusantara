import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const base = new URL(process.env.NUSANTARA_LOCAL_URL ?? 'http://127.0.0.1:8787');
if (base.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw Error('Bootstrap only accepts an uncredentialed loopback HTTP origin.');
const wrangler = resolve('node_modules/wrangler/bin/wrangler.js');
try { await access('build/index.html'); }
catch { throw Error('Run npm run build before invoking this script directly, or use npm run data:bootstrap.'); }

function run(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolvePromise();
      else reject(Error('Local Wrangler command failed with exit ' + code));
    });
  });
}

await run(['d1', 'migrations', 'apply', 'nusantara-atlas', '--local']);
await new Promise((resolvePromise, reject) => {
  const child = spawn(process.execPath, ['scripts/geo/seed-hierarchy.mjs'], { stdio: 'inherit' });
  child.once('error', reject);
  child.once('exit', code => { if (code === 0) resolvePromise(); else reject(Error('Hierarchy seed generation failed')); });
});
await run(['d1', 'execute', 'nusantara-atlas', '--local', '--file', 'cloudflare/seeds/regions.sql']);

// Never send a bootstrap trigger to an unrelated already-running local application.
let occupied = false;
try { await fetch(base, { signal: AbortSignal.timeout(1000) }); occupied = true; }
catch (error) { if (error.name === 'TimeoutError') throw Error('Local port is occupied or unresponsive. Choose a different NUSANTARA_LOCAL_URL.'); }
if (occupied) throw Error('Local port is occupied. Stop that server or choose a different NUSANTARA_LOCAL_URL.');
const args = [wrangler, 'dev', '--local', '--test-scheduled', '--port', base.port || '80'];
const dev = spawn(process.execPath, args, { stdio: 'inherit' });
const exited = new Promise(resolvePromise => dev.once('exit', resolvePromise));
let startError;
dev.once('error', error => startError = error);
try {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (startError) throw startError;
    if (dev.exitCode !== null) throw Error('Local Worker exited before becoming ready.');
    try { ready = (await fetch(new URL('/data/admin-2025/provinces.json', base), { signal: AbortSignal.timeout(1000) })).ok; }
    catch { ready = false; }
    if (ready) break;
    await sleep(1000);
  }
  if (!ready) throw Error('Local Worker did not become ready.');
  const scheduled = await fetch(new URL('/cdn-cgi/local/scheduled?format=json', base));
  if (!scheduled.ok) throw Error('Local scheduled invocation HTTP ' + scheduled.status);
  const outcome = await scheduled.json();
  if (outcome.outcome !== 'ok') throw Error('Local scheduled invocation failed: ' + JSON.stringify(outcome));
  const manifestResponse = await fetch(new URL('/data/published/manifest.json', base));
  if (!manifestResponse.ok) throw Error('Local manifest HTTP ' + manifestResponse.status);
  const manifest = await manifestResponse.json();
  const response = await fetch(new URL(manifest.summary, base));
  if (!response.ok) throw Error('Local summary HTTP ' + response.status);
  const summary = await response.json();
  console.log(JSON.stringify({ generatedAt: summary.generatedAt, retainedCounts: summary.counts, sources: summary.sources, retentionDays: summary.retentionDays }, null, 2));
} finally {
  dev.kill('SIGINT');
  await Promise.race([exited, sleep(5000)]);
  if (dev.exitCode === null) dev.kill('SIGKILL');
}
