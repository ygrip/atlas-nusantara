<script lang="ts">
  import SnapshotRecords from './SnapshotRecords.svelte';
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import type { Snapshot } from '$lib/data/ingestion/schema';
  import { loadPublished, publicationExpired } from '$lib/data/publication';
  export let kind: 'warning' | 'earthquake' | 'incident' | 'hazard';
  export let regionCode: string | undefined = undefined;
  let mounted = false;
  let snapshot: Snapshot | undefined;
  let loading = false;
  let lastAttempt = 0;
  let controller: AbortController | undefined;
  let now = Date.now();
  let validUntil = '';
  $: visibleRecords = (snapshot?.records ?? []).filter(record => !regionCode || record.regionCodes.some(code => code === regionCode || code.startsWith(regionCode + '.') || regionCode.startsWith(code + '.')));
  $: unmappedRecords = (snapshot?.records ?? []).filter(record => Boolean(regionCode) && record.regionCodes.length === 0);
  $: stale = snapshot && ((snapshot.provenance.validUntil && Date.parse(snapshot.provenance.validUntil) <= now) || (kind === 'earthquake' && now - Date.parse(snapshot.provenance.fetchedAt) > 3600000));
  $: if (mounted) void load(kind);

  onMount(() => {
    mounted = true;
    const timer = setInterval(() => {
      now = Date.now();
      if (validUntil && publicationExpired(validUntil, now)) { snapshot = undefined; validUntil = ''; }
      if (!snapshot && !loading && !document.hidden && navigator.onLine && now - lastAttempt >= 300000) void load(kind);
    }, 15000);
    const resume = () => {
      if (!document.hidden) {
        now = Date.now();
        if (validUntil && publicationExpired(validUntil, now)) { snapshot = undefined; validUntil = ''; }
        void load(kind);
      }
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => { clearInterval(timer); controller?.abort(); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); };
  });

  async function load(type: typeof kind) {
    controller?.abort();
    const request = new AbortController();
    controller = request;
    snapshot = undefined; validUntil = ''; loading = true;
    lastAttempt = Date.now();
    try {
      const publication = await loadPublished<Snapshot>(type, request.signal);
      if (!request.signal.aborted && !publicationExpired(publication.validUntil)) {
        snapshot = publication.data;
        validUntil = publication.validUntil;
      }
    } catch {
      if (!request.signal.aborted) { snapshot = undefined; validUntil = ''; }
    } finally { if (!request.signal.aborted) loading = false; }
  }

  function date(value: string) {
    return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }
</script>

<section class="snapshot-panel" aria-label={m.layer_weather()} aria-busy={loading}>
  <div class="snapshot-heading"><h3>{m.layer_weather()}</h3>
    {#if snapshot}<span class="snapshot-state" class:stale>{#if stale}{m.status_stale()}{:else}{m.status_snapshot()}{/if}</span>{/if}
  </div>
  <p>{m.snapshot_explanation()}</p>
  {#if loading}<p role="status">{m.loading_data()}</p>
  {:else if !snapshot}<p role="status" class="unavailable">{m.data_unavailable()}</p>
  {:else}
    <dl class="snapshot-provenance">
      <div><dt>{m.sources_heading()}</dt><dd><a href={snapshot.provenance.sourceUrl} target="_blank" rel="noreferrer">{snapshot.provenance.source} ↗</a></dd></div>
      <div><dt>{m.source_time()}</dt><dd>{#if snapshot.provenance.sourcePublishedAt}<time datetime={snapshot.provenance.sourcePublishedAt}>{date(snapshot.provenance.sourcePublishedAt)}</time>{:else}—{/if}</dd></div>
      <div><dt>{m.ingested_time()}</dt><dd><time datetime={snapshot.provenance.fetchedAt}>{date(snapshot.provenance.fetchedAt)}</time></dd></div>
    </dl>
    {#if regionCode}<p>{m.region_detail()}: {regionCode}</p>{/if}
    {#if visibleRecords.length === 0 && unmappedRecords.length === 0}
      <p>{#if regionCode}{m.region_no_matches()}{:else}{m.empty_records()}{/if}</p>
    {/if}
    <SnapshotRecords records={visibleRecords} source={snapshot.provenance.source} />
    {#if unmappedRecords.length > 0}
      <p class="coverage-note" role="note">{m.region_mapping_unavailable()}</p>
      <SnapshotRecords records={unmappedRecords} source={snapshot.provenance.source} />
    {/if}
  {/if}
</section>
