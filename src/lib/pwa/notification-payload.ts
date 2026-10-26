export function officialWarningUrl(value: unknown, source: unknown): string | undefined {
  if (typeof value !== 'string' || !['BMKG', 'BNPB'].includes(String(source))) return undefined;
  let host = 'bmkg.go.id';
  if (source === 'BNPB') host = 'bnpb.go.id';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) return undefined;
    if (url.hostname !== host && !url.hostname.endsWith('.' + host)) return undefined;
    return url.href;
  } catch { return undefined; }
}

export function parseNotification(value: unknown, now = Date.now()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const payload = value as Record<string, unknown>;
  const url = officialWarningUrl(payload.url, payload.source);
  if (!url || typeof payload.id !== 'string' || !payload.id || payload.id.length > 200) return undefined;
  if (typeof payload.title !== 'string' || !payload.title.trim() || typeof payload.body !== 'string') return undefined;
  if (typeof payload.expiresAt !== 'string' || !Number.isFinite(Date.parse(payload.expiresAt)) || Date.parse(payload.expiresAt) <= now) return undefined;
  return { id: payload.id, title: payload.title.slice(0, 100), body: payload.body.slice(0, 240), url, source: payload.source, expiresAt: payload.expiresAt };
}
