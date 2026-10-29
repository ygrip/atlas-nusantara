<script lang="ts">
  import { onMount } from 'svelte';
  import { Activity, Bell, CloudSun, Flame } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { activeWarnings, type HazardSnapshot } from '$lib/data/hazards';
  import { loadEarthquakes, type EarthquakeArchive } from '$lib/data/earthquakes';
  import { loadHazards } from '$lib/data/hazards';
  import { afterLoadIdle } from '$lib/perf/idle';
  import { loadForecast, type ForecastSnapshot } from '$lib/map/weather';
  import { assetUrl } from '$lib/pwa/assets';

  /** The selected map layer decides which saved figures are relevant. */
  let { layer = 'warning' }: { layer?: string } = $props();

  let earthquakes = $state<EarthquakeArchive>();
  let hazards = $state<HazardSnapshot>();
  let forecast = $state<ForecastSnapshot>();
  let loaded = $state(false);

  onMount(() => {
    const controller = new AbortController();
    // These files feed a summary far below the first screen, so they are read once the page has loaded.
    const cancel = afterLoadIdle(() => {
      void Promise.allSettled([
        loadEarthquakes().then(value => { earthquakes = value; }),
        loadHazards().then(value => { hazards = value; }),
        loadForecast(assetUrl('/data/weather/forecast.json'), controller.signal).then(value => { forecast = value; })
      ]).then(() => { if (!controller.signal.aborted) loaded = true; });
    });
    return () => { cancel(); controller.abort(); };
  });

  const warningCount = $derived(hazards ? activeWarnings(hazards, Date.now()).length : 0);
  const reportCount = $derived(hazards ? hazards.events.items.length : 0);
  const quakeCount = $derived(earthquakes ? earthquakes.events.length : 0);
  const forecastPoints = $derived(forecast ? forecast.points.length : 0);
  const largest = $derived.by(() => {
    if (!earthquakes || earthquakes.events.length === 0) return undefined;
    return Math.max(...earthquakes.events.map(event => event.magnitude));
  });
  const savedAt = $derived.by(() => {
    const stamps = [earthquakes?.fetchedAt, hazards?.fetchedAt, forecast?.fetchedAt].filter((value): value is string => Boolean(value));
    if (stamps.length === 0) return undefined;
    return stamps.sort().at(-1);
  });
  const hasAny = $derived(Boolean(earthquakes || hazards || forecast));

  const allCards = $derived([
    { id: 'warning', label: m.hazard_warnings_count(), value: warningCount, icon: Bell },
    { id: 'earthquake', label: m.layer_earthquakes(), value: quakeCount, icon: Activity },
    { id: 'reports', label: m.layer_disaster_reports(), value: reportCount, icon: Flame },
    { id: 'forecast', label: m.observatory_forecast_points(), value: forecastPoints, icon: CloudSun }
  ]);
  /** Which saved card and source belong to which layer. */
  const CARD_FOR_LAYER: Record<string, string> = { warning: 'forecast', earthquake: 'earthquake', incident: 'reports', hazard: 'warning' };
  const cards = $derived(allCards.filter(card => card.id === CARD_FOR_LAYER[layer]));
  const showQuakeSource = $derived(layer === 'earthquake');
  const showHazardSource = $derived(layer === 'hazard' || layer === 'incident');
  const showForecastSource = $derived(layer === 'warning');

  function date(value: string): string {
    return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }
</script>

{#if loaded && hasAny && savedAt}
  <div class="saved-observatory" data-testid="saved-observatory">
    <p class="saved-note">{m.observatory_saved_note({ date: date(savedAt) })}</p>
    <div class="summary-counts">
      {#each cards as card (card.id)}
        <article><span class="count-label"><span class="count-icon"><card.icon size={18} aria-hidden="true" /></span>{card.label}</span><strong>{new Intl.NumberFormat(getLocale()).format(card.value)}</strong></article>
      {/each}
    </div>
    {#if layer === 'earthquake' && largest !== undefined}<p class="saved-largest">{m.largest_observed()}: <strong>M {largest.toFixed(1)}</strong></p>{/if}
    <ul class="saved-sources">
      {#if earthquakes && showQuakeSource}<li>{earthquakes.attribution} <a href={earthquakes.sourceUrl} target="_blank" rel="noopener noreferrer">{earthquakes.source} ↗</a></li>{/if}
      {#if hazards && showHazardSource}<li>{hazards.warnings.attribution} <a href={hazards.warnings.termsUrl} target="_blank" rel="noopener noreferrer">BMKG ↗</a></li>{/if}
      {#if forecast && showForecastSource}<li>{forecast.attribution} <a href={forecast.sourceUrl} target="_blank" rel="noopener noreferrer">{forecast.source} ↗</a></li>{/if}
    </ul>
  </div>
{/if}

<style>
  .saved-observatory { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; min-width: 0; }
  .saved-note { margin: 0; padding: 10px 14px; border-radius: 14px; background: var(--sky); font-size: .82rem; font-weight: 700; line-height: 1.5; }
  .saved-largest { margin: 0; color: var(--muted); }
  .saved-sources { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; color: var(--muted); font-size: .74rem; line-height: 1.5; }
  .saved-sources a { text-decoration: underline; }
</style>
