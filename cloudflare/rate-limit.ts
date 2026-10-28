const MAX_NAMESPACE_LENGTH = 64;
const MAX_KEY_LENGTH = 256;
const MAX_LIMIT = 100_000;
const MAX_PERIOD_SECONDS = 86_400;
const RATE_LIMIT_SQL = `
  INSERT INTO request_rate_limits (namespace, key, window_start, window_end, requests)
  VALUES (?, ?, ?, ?, 1)
  ON CONFLICT(namespace, key, window_start) DO UPDATE
    SET requests = requests + 1
    WHERE requests < ?
  RETURNING requests
`;

interface RateLimitRow {
  requests: number;
}

export class D1RateLimiter {
  private readonly db: D1Database;
  private readonly namespace: string;
  private readonly requestLimit: number;
  private readonly periodMilliseconds: number;
  private readonly now: () => number;

  constructor(
    db: D1Database,
    namespace: string,
    requestLimit: number,
    periodSeconds: number,
    now: () => number = Date.now
  ) {
    if (!namespace || namespace.length > MAX_NAMESPACE_LENGTH || !/^[a-zA-Z0-9:_-]+$/.test(namespace)) {
      throw new Error('Rate-limit namespace must use 1 to 64 safe characters');
    }
    if (!Number.isSafeInteger(requestLimit) || requestLimit < 1 || requestLimit > MAX_LIMIT) {
      throw new Error('Rate-limit limit must be an integer from 1 to 100000');
    }
    if (!Number.isSafeInteger(periodSeconds) || periodSeconds < 1 || periodSeconds > MAX_PERIOD_SECONDS) {
      throw new Error('Rate-limit period must be an integer from 1 to 86400 seconds');
    }
    this.db = db;
    this.namespace = namespace;
    this.requestLimit = requestLimit;
    this.periodMilliseconds = periodSeconds * 1000;
    this.now = now;
  }

  async limit(input: { key: string }): Promise<{ success: boolean }> {
    const { key } = input;
    if (typeof key !== 'string' || key.length < 1 || key.length > MAX_KEY_LENGTH) {
      throw new Error('Rate-limit key must contain 1 to 256 characters');
    }
    const now = this.now();
    if (!Number.isSafeInteger(now) || now < 0) {
      throw new Error('Rate-limit clock must return a non-negative safe integer in milliseconds');
    }
    const windowStart = Math.floor(now / this.periodMilliseconds) * (this.periodMilliseconds / 1000);
    const windowEnd = windowStart + this.periodMilliseconds / 1000;
    const row = await this.db.prepare(RATE_LIMIT_SQL)
      .bind(this.namespace, key, windowStart, windowEnd, this.requestLimit)
      .first<RateLimitRow>();
    if (row) return { success: true };
    return { success: false };
  }
}

/** Remove expired fixed windows from a scheduled cleanup, never from request handling. */
export async function cleanupRateLimits(db: D1Database, now: number): Promise<number> {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error('Rate-limit cleanup time must be a non-negative safe integer in milliseconds');
  }
  const nowSeconds = Math.floor(now / 1000);
  const result = await db.prepare('DELETE FROM request_rate_limits WHERE window_end <= ?').bind(nowSeconds).run();
  return result.meta.changes;
}
