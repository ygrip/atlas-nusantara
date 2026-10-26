// Per-source scheduling and retention. Pure functions shared by the CLI runner and the Cloudflare Worker.

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** A source is due when it never succeeded, or its interval has elapsed since the last success. */
export function isDue(lastSuccessAt, intervalMinutes, now) {
  if (!lastSuccessAt) return true;
  const last = Date.parse(lastSuccessAt);
  if (!Number.isFinite(last)) return true;
  return now - last >= intervalMinutes * MINUTE_MS;
}

/** Event time decides retention, so an old record never lives on only because it was re-fetched. */
export function isRetained(event, retentionDays, now) {
  return now - Date.parse(event.occurredAt) <= retentionDays * DAY_MS;
}

/**
 * Re-aggregates stored events with freshly collected ones. Fresh records win by id; records of every
 * source are kept while inside that source's retention window. Sources without a registry entry are dropped.
 * @param {object[]} stored  events from the previous snapshot or the database
 * @param {object[]} fresh  events just collected
 * @param {Map<string, number>} retentionBySourceName  source display name -> retention in days
 */
export function reaggregate(stored, fresh, retentionBySourceName, now) {
  const byId = new Map();
  for (const event of stored) byId.set(event.id, event);
  for (const event of fresh) byId.set(event.id, event);
  const kept = [];
  for (const event of byId.values()) {
    const retentionDays = retentionBySourceName.get(event.source);
    if (retentionDays === undefined) continue;
    if (isRetained(event, retentionDays, now)) kept.push(event);
  }
  return kept;
}

export function retentionMap(eventSources) {
  return new Map(eventSources.map(source => [source.meta.name, source.retentionDays]));
}
