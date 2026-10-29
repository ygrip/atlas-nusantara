<script lang="ts">
  import { onMount } from 'svelte';
  import { CloudSun } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';
  import { weatherConditionKey } from '$lib/i18n/weather-condition';
  import { formatDegrees, type Coordinates } from '$lib/atlas/region-coordinates';
  import type { ForecastSnapshot } from '$lib/map/weather';
  import { summariseWeather } from '$lib/map/weather-summary';
  import GooeyPanel from './GooeyPanel.svelte';

  let { forecast, code, time, name, coordinates }: { forecast: ForecastSnapshot; code: string; time?: string; name: string; coordinates?: Coordinates } = $props();

  /** The city itself, or every city of a province averaged. */
  const summary = $derived(summariseWeather(forecast, code, time));
  const readoutText = $derived.by(() => {
    if (!summary) return '';
    const condition = m[weatherConditionKey(summary.description)]();
    if (!coordinates) return condition;
    return condition + ' · ' + formatDegrees(coordinates.lat) + '°, ' + formatDegrees(coordinates.lon) + '°';
  });
  // Phones start collapsed so the readout does not cover the map.
  let open = $state(false);
  onMount(() => { open = matchMedia('(min-width: 701px)').matches; });
</script>

{#if summary}
  <GooeyPanel class="weather-readout" corner="top-right" icon={CloudSun} label={name} bind:open>
    <div aria-live="polite">
      <p class="readout-desc">{readoutText}</p>
      <dl>
        <div><dt>{m.weather_temperature()}</dt><dd>{summary.temperature}°C</dd></div>
        <div><dt>{m.weather_wind()}</dt><dd><span class="arrow" style={`transform: rotate(${summary.arrow}deg)`} aria-hidden="true">↑</span> {summary.speed} km/h {summary.from}</dd></div>
        <div><dt>{m.weather_humidity()}</dt><dd>{summary.humidity}%</dd></div>
        <div><dt>{m.weather_clouds()}</dt><dd>{summary.clouds}%</dd></div>
      </dl>
    </div>
  </GooeyPanel>
{/if}

<style>
  .readout-desc { margin: 0 0 8px; opacity: .8; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; margin: 0; }
  dt { font-size: .6rem; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; opacity: .65; }
  dd { margin: 0; font-weight: 800; white-space: nowrap; }
  .arrow { display: inline-block; }
</style>
