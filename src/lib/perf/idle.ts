/**
 * Runs `task` once the page has finished loading and the browser is idle, so background downloads
 * (forecast data, saved places) do not compete with the first paint. Returns a function that cancels it.
 */
export function afterLoadIdle(task: () => void, timeoutMs = 3000): () => void {
  let cancelled = false;
  let idleHandle: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function run() {
    if (cancelled) return;
    cancelled = true;
    task();
  }

  function schedule() {
    if (cancelled) return;
    if (typeof requestIdleCallback === 'function') idleHandle = requestIdleCallback(run, { timeout: timeoutMs });
    else timer = setTimeout(run, 200);
  }

  if (document.readyState === 'complete') schedule();
  else addEventListener('load', schedule, { once: true });

  return () => {
    cancelled = true;
    removeEventListener('load', schedule);
    if (idleHandle !== undefined && typeof cancelIdleCallback === 'function') cancelIdleCallback(idleHandle);
    if (timer !== undefined) clearTimeout(timer);
  };
}
