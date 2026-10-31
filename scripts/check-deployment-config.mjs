// Verify that the two deployable configurations cannot drift across accounts or D1.
// This checks public resource IDs, never reads or prints secret values.
import { readFileSync } from 'node:fs';

const worker = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const pages = JSON.parse(readFileSync(new URL('../pages/wrangler.jsonc', import.meta.url), 'utf8'));
function ensure(condition, message) {
  if (!condition) throw new Error('Cloudflare deployment configuration: ' + message);
}
ensure(worker.name === 'nusantara-atlas-scheduler', 'unexpected Worker name');
ensure(pages.name === 'nusantara-atlas', 'unexpected Pages project name');
ensure(worker.assets?.directory === './build', 'Worker assets must use the validated build');
ensure(pages.pages_build_output_dir === '../build', 'Pages must use the validated build');
const workerDb = worker.d1_databases?.find(database => database.binding === 'DB');
const pagesDb = pages.d1_databases?.find(database => database.binding === 'DB');
ensure(Boolean(workerDb && pagesDb), 'missing DB binding');
ensure(workerDb.database_id === pagesDb.database_id, 'Pages and Worker D1 database IDs differ');
ensure(workerDb.database_name === pagesDb.database_name, 'Pages and Worker D1 database names differ');
if (process.env.CLOUDFLARE_ACCOUNT_ID) {
  ensure(worker.account_id === process.env.CLOUDFLARE_ACCOUNT_ID, 'the GitHub account secret does not match the Wrangler account');
}
for (const config of [pages, worker]) {
  for (const name of ['CLOUDFLARE_API_TOKEN', 'TURNSTILE_SECRET', 'OPENAI_API_KEY', 'PUSH_ADMIN_TOKEN', 'PUSH_SUBSCRIBER_TOKEN']) {
    ensure(!Object.hasOwn(config.vars ?? {}, name), 'secret binding ' + name + ' must not be in plaintext vars');
  }
}
console.log('Cloudflare Pages and scheduler configuration verified (same account and D1, no plaintext secret bindings).');
