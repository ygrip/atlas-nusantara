/** D1 publication keys for the data the scheduled Worker keeps fresh. The page reads these first and falls back to the release files. */
export const LIVE_KEYS = {
  forecast: 'data/weather/forecast.json',
  history: 'data/weather/history.json',
  earthquakes: 'data/observations/earthquakes.json'
} as const;

/** Public paths served from D1. Only these exact paths map to keys; a request never chooses a key. */
export const LIVE_PATHS: Record<string, string> = {
  '/data/live/weather/forecast.json': LIVE_KEYS.forecast,
  '/data/live/weather/history.json': LIVE_KEYS.history,
  '/data/live/observations/earthquakes.json': LIVE_KEYS.earthquakes
};

export function liveKeyForPath(path: string): string | undefined {
  return LIVE_PATHS[path];
}
