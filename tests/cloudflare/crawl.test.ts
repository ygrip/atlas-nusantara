import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchSource, SOURCE_REGISTRY } from '../../cloudflare/worker.ts';

const now = Date.now();
const approval = { license: 'CC0-1.0', licenseUrl: 'https://example.org/test-fixture-license', reviewer: 'Synthetic fixtures only', reviewedAt: new Date(now).toISOString() };
const source = SOURCE_REGISTRY.find(item => item.id === 'bmkg-nowcast')!;

function cap(index: number, messageType = 'Alert'): string {
  return `<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2"><identifier>fixture-${index}</identifier><sender>fixture@bmkg.go.id</sender><sent>${new Date(now - 60000).toISOString()}</sent><status>Actual</status><msgType>${messageType}</msgType><scope>Public</scope><info><language>id</language><event>Fixture</event><effective>${new Date(now - 10000).toISOString()}</effective><expires>${new Date(now + 3600000).toISOString()}</expires><headline>TEST FIXTURE</headline><description>Synthetic, never published.</description><area><areaDesc>Not an administrative join</areaDesc><polygon>-2,119 -3,119 -3,120 -2,119</polygon></area></info></alert>`;
}

test('collects a complete eighteen-item CAP feed rather than starving records beyond the first ten', async () => {
  const items = Array.from({ length: 18 }, (_, index) => `<item><link>https://www.bmkg.go.id/alerts/nowcast/id/FIXTURE${index}_alert.xml</link></item>`).join('');
  let calls = 0;
  const fetcher: typeof fetch = async input => {
    calls++;
    const url = new URL(String(input));
    if (url.pathname === '/alerts/nowcast/id') return new Response(`<rss><channel><title>Fixture feed</title><link>https://www.bmkg.go.id/alerts/nowcast/id</link>${items}</channel></rss>`);
    const index = Number(url.pathname.match(/FIXTURE(\d+)/)?.[1]);
    return new Response(cap(index));
  };
  const snapshot = await fetchSource(source, approval, now, fetcher);
  assert.equal(snapshot.records.length, 18);
  assert.equal(calls, 19);
  assert.ok(snapshot.provenance.validUntil);
  assert.ok(snapshot.records.every(record => record.regionCodes.length === 0));
});

test('malformed source envelopes and partial warning crawls fail closed', async () => {
  const earthquake = SOURCE_REGISTRY.find(item => item.id === 'bmkg-earthquakes')!;
  await assert.rejects(fetchSource(earthquake, approval, now, async () => new Response('{}')), /Infogempa/);
  await assert.rejects(fetchSource(source, approval, now, async () => new Response('<rss><channel>wrong shape</channel></rss>')), /channel/);
  const fetcher: typeof fetch = async input => {
    if (String(input).endsWith('/id')) return new Response('<rss><channel><title>Fixture</title><link>https://www.bmkg.go.id/alerts/nowcast/id</link><item><link>https://www.bmkg.go.id/alerts/nowcast/id/FIXTURE_alert.xml</link></item></channel></rss>');
    return new Response('temporarily unavailable', { status: 503 });
  };
  await assert.rejects(fetchSource(source, approval, now, fetcher), /detail fetch failed/);
});
