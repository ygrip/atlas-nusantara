<script lang="ts">
  import CountChart from './CountChart.svelte';
  import ColdDownload from '$lib/components/ColdDownload.svelte';
  import { loadPublished, publicationExpired } from '$lib/data/publication';
  import type { ShareSummary } from '$lib/share/card';
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { Bell, Activity, Flame, Mountain } from 'lucide-svelte';
  type Kind = 'warning' | 'earthquake' | 'incident' | 'hazard';
  interface Source { id: string; name: string; type?: Kind | null; status: string; intervalMinutes: number; lastSuccessAt?: string; nextDueAt?: string; sourceUrl: string; termsUrl: string }
  interface Summary { generatedAt: string; retentionDays: number; counts: Record<Kind, number>; sources: Source[]; observations: { type: Kind; properties: Record<string, unknown> }[]; derivedFacts: {id: string; value: string | number}[] }
  export let onsummary: ((value: ShareSummary | undefined) => void) | undefined = undefined;
  let summary: Summary | undefined;
  let loading = true;
  let lastAttempt = 0;
  let validUntil = '';
  let controller: AbortController | undefined;
  let expiryTimer: ReturnType<typeof setInterval> | undefined;
  const kinds = [
    { id: 'warning' as const, label: m.layer_weather, icon: Bell }, { id: 'earthquake' as const, label: m.layer_earthquakes, icon: Activity },
    { id: 'incident' as const, label: m.layer_history, icon: Flame }, { id: 'hazard' as const, label: m.layer_hazards, icon: Mountain }
  ];
  $: largest = summary?.derivedFacts.find(fact => fact.id === 'max-earthquake-magnitude');
  $: countValues = kinds.map(kind => summary?.counts[kind.id] ?? 0);

  onMount(() => {
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

<section id="summary" class="aggregate-summary details" aria-labelledby="summary-heading" aria-busy={loading}>
  <span class="eyebrow">04 / OBSERVATORY</span>
  <h2 id="summary-heading">{m.summary_heading()}</h2>
  <p class="summary-intro">{m.summary_scope()}</p>
  {#if loading}<p class="summary-empty" role="status">{m.loading_data()}</p>
  {:else if !summary}<div class="summary-empty" role="status"><strong>{m.data_unavailable()}</strong><p>{m.no_observations()}</p></div>
  {:else}
    <p class="summary-window">{m.summary_window()} · {m.ingested_time()}: <time datetime={summary.generatedAt}>{date(summary.generatedAt)}</time></p>
    <div class="summary-counts">
      {#each kinds as kind (kind.id)}
        <article><span class="count-label"><span class="count-icon"><svelte:component this={kind.icon} size={18} aria-hidden="true" /></span>{kind.label()}</span><strong>{new Intl.NumberFormat(getLocale()).format(summary.counts[kind.id])}</strong><small>{m.retained_records()}</small>
        </article>
      {/each}
    </div>
    <section class="archive-downloads" aria-label={m.download_data()}>
      {#each kinds as kind (kind.id)}
        {#if canDownload(kind.id)}<div class="archive-entry" data-kind={kind.id}><strong>{kind.label()}</strong><ColdDownload kind={kind.id} /></div>{/if}
      {/each}
    </section>
    {#if Object.values(summary.counts).some(count => count > 0)}<CountChart labels={kinds.map(kind => kind.label())} values={countValues} />{/if}
    <div class="derived-panel">
      <h3>{m.derived_observations()}</h3>
      {#if largest && typeof largest.value === 'number'}<p>{m.largest_observed()}: <strong>M {largest.value.toFixed(1)}</strong></p>
      {:else}<p>{m.no_observations()}</p>{/if}
      <p>{m.retention_note()}</p>
    </div>
    <h3>{m.data_coverage()}</h3>
    <div class="source-schedules">
      {#each summary.sources as source (source.id)}
        <article>
          <div><a href={safeUrl(source.sourceUrl)} target="_blank" rel="noreferrer">{source.name} ↗</a>
            <small>{#if !['disabled', 'not-configured'].includes(source.status)}{m.source_enabled()}{:else}{m.source_disabled()}{/if} · <a href={safeUrl(source.termsUrl)} target="_blank" rel="noreferrer">{m.source_terms()} ↗</a></small></div>
          {#if source.status === 'error' || source.status === 'stale'}<p>{m.data_unavailable()}</p>{/if}
          <dl><div><dt>{m.source_schedule()}</dt><dd>{source.intervalMinutes}</dd></div><div><dt>{m.source_last()}</dt><dd>{date(source.lastSuccessAt)}</dd></div><div><dt>{m.source_next()}</dt><dd>{date(source.nextDueAt)}</dd></div></dl>
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .aggregate-summary { display: grid; gap: 14px; min-width: 0; padding: clamp(18px, 3vw, 30px); }
  .aggregate-summary > h2 { margin: 0; font-size: clamp(1.5rem, 3vw, 2.25rem); line-height: 1.15; letter-spacing: -.035em; }
  .summary-intro { max-width: 68ch; margin: 0; color: var(--muted); line-height: 1.6; }
  .summary-empty { display: grid; gap: 8px; margin: 0; padding: clamp(18px, 3vw, 28px); border: 1px solid var(--border); border-radius: 22px; background: linear-gradient(160deg, var(--surface), var(--panel)); box-shadow: inset 0 1px 0 var(--clay-highlight), 0 4px 0 var(--border); }
  .summary-empty strong { font-size: 1.1rem; }
  .summary-empty p { margin: 0; color: var(--muted); line-height: 1.55; }
  @media (max-width: 520px) { .aggregate-summary { padding: 18px; } }
</style>
