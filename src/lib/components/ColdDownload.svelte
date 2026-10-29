<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { m } from '$lib/i18n/messages';
  import { ShieldCheck, Download, Braces, FileSpreadsheet } from 'lucide-svelte';
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
  <button class="expand-button gloss-button gold" type="button" data-kind={kind} aria-expanded={expanded} onclick={toggleDownload}>
    <span class="gloss-icon"><ShieldCheck size={18} aria-hidden="true" /></span>{m.verify_download()}
  </button>
  {#if expanded}
    <div class="download-options">
      <p class="clay-note">{m.download_protection()}</p>
      {#if sitekey}
        <div bind:this={widgetContainer} class="turnstile-widget" aria-label={m.verify_download()}></div>
        <form action="/api/export" method="POST" target="_blank" rel="noopener" onsubmit={submitDownload}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="cf-turnstile-response" value={token} />
          <div class="date-row">
            <div class="field">
              <label for={'archive-from-' + kind}>{m.archive_from()}</label>
              <input id={'archive-from-' + kind} type="date" name="from" bind:value={fromDate} min={minimumDate} max={today} required aria-describedby={'archive-window-' + kind} />
            </div>
            <div class="field">
              <label for={'archive-to-' + kind}>{m.archive_to()}</label>
              <input id={'archive-to-' + kind} type="date" name="to" bind:value={toDate} min={minimumDate} max={today} required aria-describedby={'archive-window-' + kind} />
            </div>
          </div>
          <p class="clay-note" id={'archive-window-' + kind}>{m.archive_window()}</p>
          <fieldset class="format-picker">
            <legend>JSON / CSV</legend>
            <label class:selected={format === 'json'}><input type="radio" name="format" value="json" bind:group={format} /><Braces size={16} aria-hidden="true" />JSON</label>
            <label class:selected={format === 'csv'}><input type="radio" name="format" value="csv" bind:group={format} /><FileSpreadsheet size={16} aria-hidden="true" />CSV</label>
          </fieldset>
          <button type="submit" class="gloss-button red submit-button" disabled={!token || !rangeValid || submitting || busy}>
            <span class="gloss-icon"><Download size={18} aria-hidden="true" /></span>{m.download_data()}
          </button>
        </form>
      {:else}
        <p class="unavailable" role="status">{m.verification_unavailable()}</p>
      {/if}
      {#if status}<p class="status" role="status" aria-live="polite">{status}</p>{/if}
    </div>
  {/if}
</section>

<style>
  .cold-download { display: grid; gap: 12px; justify-items: start; }
  .expand-button { max-width: 100%; text-align: left; }
  .download-options { display: grid; gap: 14px; width: 100%; padding: 16px; border: 1px solid var(--border); border-radius: 22px; background: var(--panel); box-shadow: var(--clay-pressed); }
  p { margin: 0; color: var(--muted); font-size: .78rem; line-height: 1.55; }
  form { display: grid; gap: 14px; }
  .date-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .field { display: grid; gap: 6px; min-width: 0; }
  .field label, .format-picker legend { color: var(--text); font-size: .78rem; font-weight: 800; }
  input[type='date'] { width: 100%; min-height: 46px; padding: 8px 12px; border: 2px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--text); font: inherit; font-size: .85rem; box-shadow: var(--clay-pressed); }
  .format-picker { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; border: 0; min-width: 0; }
  .format-picker legend { padding: 0; margin-bottom: 6px; }
  .format-picker label { position: relative; display: inline-flex; align-items: center; gap: 7px; min-height: 44px; padding: 8px 16px; border: 1px solid var(--border); border-radius: 999px; background: linear-gradient(165deg, var(--surface), var(--panel)); color: var(--text); font-size: .8rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 0 var(--border), inset 1px 2px 2px var(--clay-highlight); transition: transform 160ms var(--ease-bounce), box-shadow 160ms ease-out; }
  .format-picker input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; min-height: 0; margin: 0; cursor: pointer; }
  .format-picker label.selected { transform: translateY(3px); border-color: var(--accent); background: var(--red-wash); color: var(--accent-strong); box-shadow: 0 1px 0 var(--accent), inset 2px 3px 5px var(--shadow); }
  .format-picker label:focus-within { outline: 3px solid var(--accent); outline-offset: 3px; }
  .submit-button { justify-self: start; max-width: 100%; }
  .unavailable, .status { margin-top: 4px; }
  .turnstile-widget { min-height: 65px; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; } .format-picker label { transition: none; } }
</style>
