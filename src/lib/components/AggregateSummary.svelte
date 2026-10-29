<script lang="ts">
  import SavedObservatory from './SavedObservatory.svelte';
  import ColdDownload from '$lib/components/ColdDownload.svelte';
  import { loadPublished, publicationExpired } from '$lib/data/publication';
  import type { ShareSummary } from '$lib/share/card';
  import { onMount } from 'svelte';
  import { m, type MessageKey } from '$lib/i18n/messages';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { Bell, Activity, Flame, Mountain, Sigma, Download, Database, ChevronDown } from 'lucide-svelte';
  import { observatoryKind, type ObservatoryKind } from '$lib/data/observatory';
  type Kind = ObservatoryKind;
  interface Source { id: string; name: string; type?: Kind | null; status: string; intervalMinutes: number; lastSuccessAt?: string; nextDueAt?: string; sourceUrl: string; termsUrl: string }
  interface Summary { generatedAt: string; retentionDays: number; counts: Record<Kind, number>; sources: Source[]; observations: { type: Kind; properties: Record<string, unknown> }[]; derivedFacts: {id: string; value: string | number}[] }
  /** The selected map layer decides which collector's figures are shown. */
  export let layer = 'warning';
  export let onsummary: ((value: ShareSummary | undefined) => void) | undefined = undefined;
  let summary: Summary | undefined;
  let loading = true;
  let lastAttempt = 0;
  let validUntil = '';
  let controller: AbortController | undefined;
  let expiryTimer: ReturnType<typeof setInterval> | undefined;
  const kinds = [
    { id: 'warning' as const, label: 'layer_weather' as MessageKey, icon: Bell }, { id: 'earthquake' as const, label: 'layer_earthquakes' as MessageKey, icon: Activity },
    { id: 'incident' as const, label: 'layer_history' as MessageKey, icon: Flame }, { id: 'hazard' as const, label: 'layer_hazards' as MessageKey, icon: Mountain }
  ];
  $: activeKind = observatoryKind(layer);
  $: shownKinds = kinds.filter(kind => kind.id === activeKind);
  $: shownSources = (summary?.sources ?? []).filter(source => source.type === activeKind);
  $: largest = summary?.derivedFacts.find(fact => fact.id === 'max-earthquake-magnitude');

  onMount(() => {
    // The page mounts this component only after it is idle, so the first fetch can start immediately.
    void load();
    expiryTimer = setInterval(() => {
      if (validUntil && publicationExpired(validUntil)) {
        summary = undefined;
        validUntil = '';
        onsummary?.(undefined);
      }
      if (!summary && !loading && !document.hidden && navigator.onLine && Date.now() - lastAttempt >= 300000) void load();
    }, 15000);
    const resume = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => { controller?.abort(); clearInterval(expiryTimer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); };
  });
  async function load() {
    controller?.abort();
    const request = new AbortController();
    controller = request;
    loading = true;
    lastAttempt = Date.now();
    try {
        const publication = await loadPublished<Summary>('summary', request.signal);
        const payload = publication.data;
        if (!payload.counts || !Array.isArray(payload.sources) || !Array.isArray(payload.derivedFacts) || !Number.isFinite(Date.parse(payload.generatedAt))) throw Error('Invalid summary');
        if (kinds.some(kind => !Number.isSafeInteger(payload.counts[kind.id]) || payload.counts[kind.id] < 0)) throw Error('Invalid summary counts');
        if (request.signal.aborted || publicationExpired(publication.validUntil)) return;
        summary = payload;
        validUntil = publication.validUntil;
        onsummary?.({ generatedAt: payload.generatedAt, counts: payload.counts, sourceNames: payload.sources.filter((source: Source) => source.lastSuccessAt && !['disabled', 'not-configured'].includes(source.status)).map((source: Source) => source.name) });
    } catch {
      if (!request.signal.aborted) { summary = undefined; validUntil = ''; onsummary?.(undefined); }
    } finally { if (!request.signal.aborted) loading = false; }
  }
  function canDownload(kind: Kind): boolean {
    if ((summary?.counts[kind] ?? 0) > 0) return true;
    return Boolean(summary?.sources.some(source => source.type === kind && !['disabled', 'not-configured'].includes(source.status)));
  }
  function date(value?: string) {
    if (!value || !Number.isFinite(Date.parse(value))) return '—';
    return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }
  function safeUrl(value: string) {
    try { const url = new URL(value); if (url.protocol === 'https:') return url.href; } catch { return undefined; }
  }
</script>

<!-- The component stays mounted so the share card keeps its totals; the section itself only renders for layers with an observatory. -->
{#if activeKind}
<section id="summary" class="aggregate-summary details" aria-labelledby="summary-heading" aria-busy={loading}>
  <span class="eyebrow">OBSERVATORY</span>
  <h2 id="summary-heading">{m.summary_heading()}</h2>
  <p class="summary-intro">{m.summary_scope()}</p>
  {#if loading}<p class="summary-empty" role="status">{m.loading_data()}</p>
  {:else if !summary}<div class="summary-empty" role="status"><strong>{m.data_unavailable()}</strong><p>{m.no_observations()}</p></div>
    <SavedObservatory {layer} />
  {:else}
    <p class="summary-window">{m.summary_window()} · {m.ingested_time()}: <time datetime={summary.generatedAt}>{date(summary.generatedAt)}</time></p>
    <div class="summary-counts">
      {#each shownKinds as kind (kind.id)}
        <article><span class="count-label"><span class="count-icon"><svelte:component this={kind.icon} size={18} aria-hidden="true" /></span>{m[kind.label]()}</span><strong>{new Intl.NumberFormat(getLocale()).format(summary.counts[kind.id])}</strong><small>{m.retained_records()}</small>
        </article>
      {/each}
    </div>
    <div class="observability">
      <details class="derived-panel">
        <summary>
          <span class="obs-icon"><Sigma size={18} aria-hidden="true" /></span>
          <span class="obs-title">{m.derived_observations()}</span>
          {#if activeKind === 'earthquake' && largest && typeof largest.value === 'number'}<span class="obs-meta">M {largest.value.toFixed(1)}</span>{/if}
          <span class="obs-chevron"><ChevronDown size={18} aria-hidden="true" /></span>
        </summary>
        <div class="obs-body">
          {#if activeKind === 'earthquake' && largest && typeof largest.value === 'number'}<p>{m.largest_observed()}: <strong>M {largest.value.toFixed(1)}</strong></p>
          {:else if activeKind === 'earthquake'}<p>{m.no_observations()}</p>{/if}
          <p class="clay-note">{m.retention_note()}</p>
        </div>
      </details>

      <section class="archive-downloads" aria-label={m.download_data()}>
        {#each shownKinds as kind (kind.id)}
          {#if canDownload(kind.id)}
            <details class="archive-entry" data-kind={kind.id}>
              <summary>
                <span class="obs-icon"><Download size={18} aria-hidden="true" /></span>
                <span class="obs-title">{m.download_data()}</span>
                <span class="obs-meta">{m[kind.label]()}</span>
                <span class="obs-chevron"><ChevronDown size={18} aria-hidden="true" /></span>
              </summary>
              <div class="obs-body"><ColdDownload kind={kind.id} /></div>
            </details>
          {/if}
        {/each}
      </section>

      {#if shownSources.length > 0}
        <details class="source-coverage">
          <summary>
            <span class="obs-icon"><Database size={18} aria-hidden="true" /></span>
            <span class="obs-title">{m.data_coverage()}</span>
            <span class="obs-meta">{shownSources.length}</span>
            <span class="obs-chevron"><ChevronDown size={18} aria-hidden="true" /></span>
          </summary>
          <ul class="obs-body source-list">
            {#each shownSources as source (source.id)}
              {@const collecting = !['disabled', 'not-configured'].includes(source.status)}
              {@const failing = source.status === 'error' || source.status === 'stale'}
              <li class="source-row">
                <div class="source-head">
                  <a class="source-name" href={safeUrl(source.sourceUrl)} target="_blank" rel="noreferrer">{source.name} ↗</a>
                  <span class="status-chip" class:on={collecting && !failing} class:warn={failing}><span class="status-dot" aria-hidden="true"></span>{collecting ? m.source_enabled() : m.source_disabled()}</span>
                </div>
                {#if failing}<p class="source-warning">{m.data_unavailable()}</p>{/if}
                <dl>
                  <div><dt>{m.source_schedule()}</dt><dd>{source.intervalMinutes}</dd></div>
                  <div><dt>{m.source_last()}</dt><dd>{date(source.lastSuccessAt)}</dd></div>
                  <div><dt>{m.source_next()}</dt><dd>{date(source.nextDueAt)}</dd></div>
                </dl>
                <a class="source-terms" href={safeUrl(source.termsUrl)} target="_blank" rel="noreferrer">{m.source_terms()} ↗</a>
              </li>
            {/each}
          </ul>
        </details>
      {/if}
    </div>
  {/if}
</section>
{/if}

<style>
  .aggregate-summary { display: grid; gap: 14px; min-width: 0; padding: clamp(18px, 3vw, 30px); }
  .aggregate-summary > h2 { margin: 0; font-size: clamp(1.5rem, 3vw, 2.25rem); line-height: 1.15; letter-spacing: -.035em; }
  .summary-intro { max-width: 68ch; margin: 0; color: var(--muted); line-height: 1.6; }
  .summary-empty { display: grid; gap: 8px; margin: 0; padding: clamp(18px, 3vw, 28px); border: 1px solid var(--border); border-radius: 22px; background: linear-gradient(160deg, var(--surface), var(--panel)); box-shadow: inset 0 1px 0 var(--clay-highlight), 0 4px 0 var(--border); }
  .summary-empty strong { font-size: 1.1rem; }
  .summary-empty p { margin: 0; color: var(--muted); line-height: 1.55; }

  /* Observability: collapsed-by-default clay cards, each one a native <details>. */
  .observability { display: grid; gap: 14px; min-width: 0; }
  .observability :is(.derived-panel, .archive-entry, .source-coverage) { min-width: 0; border: 1px solid var(--border); border-radius: 22px; background: linear-gradient(165deg, var(--surface), var(--panel)); box-shadow: 0 4px 0 var(--border), inset 2px 3px 4px var(--clay-highlight); transition: box-shadow 180ms ease-out; }
  .observability :is(.derived-panel, .archive-entry, .source-coverage)[open] { box-shadow: 0 2px 0 var(--border), inset 0 0 0 1px var(--border), inset 3px 4px 8px var(--shadow); }
  summary { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 10px 16px; border-radius: 22px; list-style: none; cursor: pointer; }
  summary::-webkit-details-marker { display: none; }
  .obs-icon { display: grid; place-items: center; flex: 0 0 auto; width: 34px; height: 34px; border-radius: 12px; background: var(--surface); color: var(--accent); box-shadow: 0 3px 0 var(--shadow), inset 1px 1px 2px var(--clay-highlight); }
  .obs-title { flex: 1 1 auto; min-width: 0; font-weight: 850; overflow-wrap: anywhere; }
  .obs-meta { flex: 0 1 auto; padding: 4px 12px; border-radius: 999px; background: var(--red-wash); color: var(--text); font-size: .78rem; font-weight: 800; }
  .obs-chevron { display: grid; place-items: center; flex: 0 0 auto; color: var(--muted); transition: transform 220ms var(--ease-bounce); }
  details[open] > summary .obs-chevron { transform: rotate(180deg); }
  .obs-body { display: grid; gap: 12px; padding: 4px 18px 18px; }
  .obs-body p { margin: 0; color: var(--muted); line-height: 1.55; }
  .obs-body p strong { color: var(--text); }
  .source-list { margin: 0; padding: 4px 18px 18px; list-style: none; }
  .source-row { display: grid; gap: 10px; padding: 14px 16px; border-radius: 18px; background: var(--panel); box-shadow: var(--clay-pressed); }
  .source-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; }
  .source-name, .source-terms { color: var(--accent-strong); font-weight: 800; text-decoration: underline; text-underline-offset: 3px; overflow-wrap: anywhere; }
  .source-terms { justify-self: start; font-size: .8rem; }
  .status-chip { display: inline-flex; align-items: center; gap: 6px; flex: 0 1 auto; padding: 4px 10px; border-radius: 999px; background: var(--surface); color: var(--text); font-size: .72rem; font-weight: 800; box-shadow: 0 2px 0 var(--border); }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
  .status-chip.on .status-dot { background: var(--green); }
  .status-chip.warn { background: var(--gold-wash); }
  .status-chip.warn .status-dot { background: var(--warning); }
  .source-warning { color: var(--warning); font-weight: 800; }
  .source-row dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px 16px; margin: 0; font-size: .78rem; }
  .source-row dt { color: var(--muted); }
  .source-row dd { margin: 2px 0 0; font-weight: 800; }
  @media (prefers-reduced-motion: reduce) { .obs-chevron { transition: none; } }
  @media (max-width: 520px) { .aggregate-summary { padding: 18px; } }
</style>
