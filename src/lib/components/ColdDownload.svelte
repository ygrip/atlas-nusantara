<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { m } from '$lib/i18n/messages';
  import { loadTurnstile, type TurnstileApi } from '$lib/pwa/turnstile';

  export let kind: 'warning' | 'earthquake' | 'incident' | 'hazard';

  const sitekey = String(import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '').trim();
  let expanded = false;
  let widgetContainer: HTMLDivElement;
  let widgetApi: TurnstileApi | undefined;
  let widgetId: string | undefined;
  let token = '';
  const maxDaysInclusive = 31;
  let today = utcDate(new Date());
  let minimumDate = addUtcDays(today, -365);
  let fromDate = addUtcDays(today, -30);
  let toDate = today;
  let format: 'json' | 'csv' = 'json';
  let rangeValid = false;
  let busy = false;
  let submitting = false;
  let status = '';
  let destroyed = false;
  let challengeGeneration = 0;
  $: rangeValid = isValidWindow(fromDate, toDate, minimumDate, today);

  onDestroy(() => {
    destroyed = true;
    challengeGeneration += 1;
    if (widgetApi && widgetId) widgetApi.remove(widgetId);
    widgetId = undefined;
    token = '';
  });

  async function toggleDownload() {
    if (expanded) {
      expanded = false;
      clearChallenge();
      status = '';
      return;
    }
    expanded = true;
    status = '';
    today = utcDate(new Date());
    minimumDate = addUtcDays(today, -365);
    fromDate = addUtcDays(today, -30);
    toDate = today;
    if (!sitekey) return;
    await renderChallenge();
  }

  async function renderChallenge() {
    if (!sitekey || busy || destroyed) return;
    busy = true;
    const currentGeneration = challengeGeneration + 1;
    challengeGeneration = currentGeneration;
    await tick();
    if (!expanded || destroyed || currentGeneration !== challengeGeneration) {
      busy = false;
      return;
    }
    try {
      const api = await loadTurnstile();
      if (!expanded || destroyed || currentGeneration !== challengeGeneration) return;
      widgetApi = api;
      widgetId = api.render(widgetContainer, {
        sitekey,
        action: 'archive_download',
        size: 'compact',
        callback: value => {
          if (destroyed || currentGeneration !== challengeGeneration) return;
          token = value;
          status = '';
          submitting = false;
        },
        'expired-callback': () => invalidateChallenge(currentGeneration, m.data_unavailable()),
        'error-callback': () => invalidateChallenge(currentGeneration, m.data_unavailable())
      });
    } catch (error) {
      console.warn('Cold archive challenge unavailable', error);
      if (!destroyed && currentGeneration === challengeGeneration) status = m.data_unavailable();
    } finally {
      if (currentGeneration === challengeGeneration) busy = false;
    }
  }

  function invalidateChallenge(generation: number, message: string) {
    if (destroyed || generation !== challengeGeneration) return;
    token = '';
    submitting = false;
    status = message;
  }

  function clearChallenge() {
    challengeGeneration += 1;
    busy = false;
    token = '';
    submitting = false;
    if (widgetApi && widgetId) widgetApi.remove(widgetId);
    widgetId = undefined;
    widgetApi = undefined;
  }

  function submitDownload(event: SubmitEvent) {
    if (!rangeValid) {
      event.preventDefault();
      status = m.archive_window();
      return;
    }
    if (!token || submitting) {
      event.preventDefault();
      status = m.data_unavailable();
      return;
    }
    const usedWidget = widgetId;
    const usedApi = widgetApi;
    submitting = true;
    status = m.loading_data();
    // Let the browser serialize the hidden token and begin the native target=_blank POST first.
    setTimeout(() => {
      if (destroyed) return;
      token = '';
      if (usedApi && usedWidget) usedApi.reset(usedWidget);
      submitting = false;
      status = '';
    }, 0);
  }

  function utcDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  function addUtcDays(value: string, days: number): string {
    const date = new Date(value + 'T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + days);
    return utcDate(date);
  }

  function isValidWindow(from: string, to: string, minimum: string, maximum: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return false;
    if (from < minimum || to > maximum || from > to) return false;
    const fromTime = Date.parse(from + 'T00:00:00.000Z');
    const toTime = Date.parse(to + 'T00:00:00.000Z');
    if (utcDate(new Date(fromTime)) !== from || utcDate(new Date(toTime)) !== to) return false;
    const differenceDays = (toTime - fromTime) / 86_400_000;
    return Number.isInteger(differenceDays) && differenceDays < maxDaysInclusive;
  }
</script>

<section class="cold-download" aria-label={m.download_data()}>
  <button class="expand-button" type="button" data-kind={kind} aria-expanded={expanded} onclick={toggleDownload}>{m.download_data()}</button>
  {#if expanded}
    <div class="download-options">
      <p class="clay-note">{m.download_protection()}</p>
      <p class="clay-note" id={'archive-window-' + kind}>{m.archive_window()}</p>
      {#if sitekey}
        <div bind:this={widgetContainer} class="turnstile-widget" aria-label={m.verify_download()}></div>
        <form action="/api/export" method="POST" target="_blank" rel="noopener" onsubmit={submitDownload}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="cf-turnstile-response" value={token} />
          <label for={'archive-from-' + kind}>{m.archive_from()}</label>
          <input id={'archive-from-' + kind} type="date" name="from" bind:value={fromDate} min={minimumDate} max={today} required aria-describedby={'archive-window-' + kind} />
          <label for={'archive-to-' + kind}>{m.archive_to()}</label>
          <input id={'archive-to-' + kind} type="date" name="to" bind:value={toDate} min={minimumDate} max={today} required aria-describedby={'archive-window-' + kind} />
          <label for={'archive-format-' + kind}>JSON / CSV</label>
          <select id={'archive-format-' + kind} bind:value={format} name="format">
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          <button type="submit" disabled={!token || !rangeValid || submitting || busy}>{m.verify_download()}</button>
        </form>
      {:else}
        <p class="unavailable" role="status">{m.verification_unavailable()}</p>
      {/if}
      {#if status}<p class="status" role="status" aria-live="polite">{status}</p>{/if}
    </div>
  {/if}
</section>

<style>
  .cold-download { margin-top: 10px; }
  button, select, input[type='date'] { min-height: 44px; border: 1px solid var(--border); border-radius: 12px; padding: 8px 12px; background: var(--surface); color: var(--text); font: inherit; font-size: .8rem; }
  button { cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: .55; }
  .expand-button { text-decoration: underline; text-underline-offset: 3px; }
  .download-options { display: grid; gap: 12px; margin-top: 12px; padding: 16px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
  p { margin: 0 0 12px; color: var(--muted); font-size: .78rem; line-height: 1.55; }
  .unavailable, .status { margin-top: 12px; }
  form { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  label { font-size: .8rem; }
  input[type='date'] { max-width: 100%; border: 1px solid var(--border); border-radius: 12px; padding: 8px 12px; background: var(--surface); color: var(--text); font: inherit; font-size: .8rem; }
  .turnstile-widget { min-height: 65px; margin: 12px 0; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; } }
</style>
