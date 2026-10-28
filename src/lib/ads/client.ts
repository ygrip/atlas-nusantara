const scriptId = 'nusantara-adsense';
let library: Promise<void> | undefined;
let publisher: string | undefined;
const requested = new WeakSet<HTMLElement>();

declare global {
  interface Window {
    adsbygoogle?: { push: (request: Record<string, never>) => unknown };
  }
}

/** Load Google's SDK once after the configured slot has a usable layout. */
function loadLibrary(client: string): Promise<void> {
  if (publisher && publisher !== client) return Promise.reject(new Error('AdSense publisher cannot change within a document'));
  if (library) return library;
  publisher = client;
  library = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    const timeout = setTimeout(failed, 15_000);
    function cleanup() {
      clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
    }
    function failed() {
      cleanup();
      script.remove();
      library = undefined;
      publisher = undefined;
      reject(new Error('AdSense SDK was blocked, timed out, or failed to load'));
    }
    script.onload = () => { cleanup(); resolve(); };
    script.onerror = failed;
    document.head.append(script);
  });
  return library;
}

export function canRequestAd(element: HTMLElement): boolean {
  if (!element.isConnected || element.clientWidth <= 0) return false;
  if (typeof element.checkVisibility === 'function') return element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  return getComputedStyle(element).visibility === 'visible';
}

/** Request one ad once; never auto-refresh a placement. */
export async function requestAd(element: HTMLElement, client: string): Promise<boolean> {
  if (requested.has(element)) return true;
  if (!canRequestAd(element)) return false;
  await loadLibrary(client);
  if (!canRequestAd(element)) return false;
  if (requested.has(element)) return true;
  const queue = window.adsbygoogle ??= new Array<Record<string, never>>();
  queue.push({});
  requested.add(element);
  return true;
}
