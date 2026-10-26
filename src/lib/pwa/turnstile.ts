export interface TurnstileWidgetOptions {
  sitekey: string;
  action: 'archive_download';
  size?: 'compact';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
}

export interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileWidgetOptions): string;
  remove(widgetId: string): void;
  reset(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptLoad: Promise<TurnstileApi> | undefined;

/** Load the third-party challenge only after a visitor requests an archive download. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptLoad) return scriptLoad;

  scriptLoad = new Promise<TurnstileApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-nusantara-turnstile]');
    const script = existingScript ?? document.createElement('script');
    let timeout: ReturnType<typeof setTimeout>;
    function cleanup() {
      clearTimeout(timeout);
      script.removeEventListener('load', loaded);
      script.removeEventListener('error', failed);
    }
    function loaded() {
      cleanup();
      if (window.turnstile) resolve(window.turnstile);
      else { script.remove(); reject(new Error('Turnstile loaded without its API')); }
    }
    function failed() {
      cleanup();
      script.remove();
      reject(new Error('Turnstile failed to load'));
    }

    if (!existingScript) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.nusantaraTurnstile = 'true';
    }
    script.addEventListener('load', loaded, { once: true });
    script.addEventListener('error', failed, { once: true });
    timeout = setTimeout(failed, 15000);
    if (!existingScript) document.head.append(script);
  }).catch(error => {
    scriptLoad = undefined;
    throw error;
  });

  return scriptLoad;
}
