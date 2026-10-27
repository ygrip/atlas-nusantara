export interface StartupPosition { latitude: number; longitude: number }
type LocationProvider = Pick<Geolocation, 'getCurrentPosition'>;

/** Bounded even when a browser leaves its permission dialog unanswered. */
export function requestStartupLocation(provider: LocationProvider | undefined, signal: AbortSignal, timeoutMs = 5000): Promise<StartupPosition | undefined> {
  if (!provider || signal.aborted) return Promise.resolve(undefined);
  return new Promise(resolve => {
    let settled = false;
    const finish = (position?: StartupPosition) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      resolve(position);
    };
    const abort = () => finish();
    const timer = setTimeout(() => finish(), timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    try {
      provider.getCurrentPosition(position => finish({
        latitude: position.coords.latitude, longitude: position.coords.longitude
      }), error => {
        console.info('Startup location unavailable; Jakarta is the fallback', error.code);
        finish();
      }, { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 });
    } catch (error) {
      console.info('Startup location request failed; Jakarta is the fallback', error);
      finish();
    }
  });
}
