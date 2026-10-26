import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNotification, officialWarningUrl } from '../../src/lib/pwa/notification-payload.ts';

test('notification contract preserves official source links and rejects stale or foreign payloads', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  const payload = { source: 'BMKG', id: 'cap-1', title: 'Source title', body: 'Source text', expiresAt: '2026-01-01T01:00:00Z', url: 'https://www.bmkg.go.id/alerts/nowcast/id/123_alert.xml' };
  assert.equal(parseNotification(payload, now)?.url, payload.url);
  for (const change of [{ source: 'BNPB' }, { id: '' }, { expiresAt: '2025-12-31T23:00:00Z' }, { url: 'https://bmkg.go.id.evil.test/' }, { url: 'javascript:alert(1)' }]) assert.equal(parseNotification({ ...payload, ...change }, now), undefined);
  assert.equal(officialWarningUrl('//evil.test', 'BMKG'), undefined);
});
