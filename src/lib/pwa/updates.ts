interface UpdateCallbacks {
  ready: () => void;
  waiting: () => void;
  controllerChanged: (previouslyControlled: boolean) => void;
  checked: () => void;
  failed: (error: unknown, manual: boolean) => void;
}

/** Observe SvelteKit's single registration; never activate an update without consent. */
export function watchUpdates(callbacks: UpdateCallbacks) {
  const container = navigator.serviceWorker;
  let registration: ServiceWorkerRegistration | undefined;
  let waiting: ServiceWorker | undefined;
  let installing: ServiceWorker | undefined;
  let previouslyControlled = Boolean(container.controller);
  let disposed = false;
  let lastCheck = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  function detectWaiting() {
    waiting = registration?.waiting ?? undefined;
    if (waiting) callbacks.waiting();
  }
  function stateChanged() {
    if (installing?.state === 'installed' && container.controller) {
      waiting = registration?.waiting ?? installing;
      callbacks.waiting();
    }
  }
  function updateFound() {
    installing?.removeEventListener('statechange', stateChanged);
    installing = registration?.installing ?? undefined;
    installing?.addEventListener('statechange', stateChanged);
  }
  function controllerChanged() {
    waiting = undefined;
    callbacks.controllerChanged(previouslyControlled);
    previouslyControlled = true;
  }
  async function check(manual = false) {
    if (disposed) return;
    if (!navigator.onLine) { if (manual) callbacks.failed(Error('Offline'), true); return; }
    if (!manual && Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    try {
      const current = registration ?? await container.getRegistration();
      if (!current) throw Error('Offline registration is not ready');
      registration = current;
      if (current.waiting || current.installing) { detectWaiting(); if (manual) callbacks.checked(); return; }
      await current.update();
      if (disposed) return;
      registration = current;
      detectWaiting();
      if (manual) callbacks.checked();
    } catch (error) { if (!disposed) callbacks.failed(error, manual); }
  }
  function resumeCheck() { if (!document.hidden) void check(); }

  container.addEventListener('controllerchange', controllerChanged);
  document.addEventListener('visibilitychange', resumeCheck);
  window.addEventListener('online', resumeCheck);
  container.ready.then(current => {
    if (disposed) return;
    registration = current;
    current.addEventListener('updatefound', updateFound);
    updateFound();
    detectWaiting();
    callbacks.ready();
    timer = setInterval(resumeCheck, 300000);
    void check();
  }).catch(error => { if (!disposed) callbacks.failed(error, false); });

  return {
    check,
    activate() {
      if (!waiting) return false;
      waiting.postMessage({ type: 'SKIP_WAITING' });
      return true;
    },
    destroy() {
      disposed = true;
      clearInterval(timer);
      registration?.removeEventListener('updatefound', updateFound);
      installing?.removeEventListener('statechange', stateChanged);
      container.removeEventListener('controllerchange', controllerChanged);
      document.removeEventListener('visibilitychange', resumeCheck);
      window.removeEventListener('online', resumeCheck);
    }
  };
}
