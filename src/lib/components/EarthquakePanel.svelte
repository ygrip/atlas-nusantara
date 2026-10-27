<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { loadEarthquakes, type EarthquakeArchive } from '$lib/data/earthquakes';
  let archive: EarthquakeArchive | undefined;
  let loading = true;
  onMount(() => {
    let active = true;
    const refresh = () => {
      void loadEarthquakes().then(value => {
        if (!active) return;
        if (value) archive = value;
        loading = false;
      });
    };
    refresh();
    const timer = setInterval(() => { if (!document.hidden && navigator.onLine) refresh(); }, 15 * 60_000);
    return () => { active = false; clearInterval(timer); };
  });
  function date(value: string) { return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
</script>

<section class="earthquake-panel" aria-label={m.layer_earthquakes()} aria-busy={loading}>
  <header><div><h3>{m.layer_earthquakes()}</h3><p>{m.earthquake_archive_details()}</p></div><span class="archive-badge">BMKG · M5+</span></header>
  {#if loading}<p role="status">{m.loading_data()}</p>
  {:else if archive}
    <div class="quake-summary"><strong>{archive.events.length}</strong><span>{m.retained_records()}</span><small>{m.ingested_time()}: {date(archive.fetchedAt)} · <a href={archive.termsUrl} target="_blank" rel="noreferrer">BMKG ↗</a></small></div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (a scrollable list must be focusable so keyboard users can scroll it) -->
    <ol class="quake-events scroll-area" tabindex="0" aria-label={m.layer_earthquakes()}>
      {#each archive.events as event (event.id)}
        <li><span class="magnitude">M{event.magnitude.toFixed(1)}</span><div><strong>{event.place}</strong><time datetime={event.observedAt}>{date(event.observedAt)} · {event.depthKm} km</time></div></li>
      {/each}
    </ol>
  {:else}<p role="status">{m.data_unavailable()}</p>{/if}
</section>

<style>
  .earthquake-panel { margin-top: 20px; padding: 20px; border-radius: 22px; background: var(--surface); box-shadow: var(--clay-pressed); }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; } h3 { margin: 0 0 6px; } p { margin: 0; font-size: .85rem; color: var(--muted); }
  .archive-badge { padding: 6px 10px; border-radius: 12px; background: var(--peach); font-size: .75rem; font-weight: 900; white-space: nowrap; }
  .quake-summary { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; padding: 16px 0; }.quake-summary strong { font-size: 2rem; }.quake-summary small { margin-left: auto; color: var(--muted); }
  .quake-events { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; max-height: 320px; overflow: auto; list-style: none; margin: 0; padding: 4px; }
  li { display: flex; gap: 12px; align-items: center; padding: 12px; border-radius: 16px; background: var(--panel); } li strong { font-size: .8rem; display: block; } time { display: block; font-size: .72rem; color: var(--muted); margin-top: 4px; }
  .magnitude { flex: none; font-weight: 900; color: var(--accent); font-size: 1rem; } a { text-decoration: underline; }
  @media(max-width: 700px) { .quake-events { grid-template-columns: minmax(0, 1fr); } header { flex-wrap: wrap; } }
</style>
