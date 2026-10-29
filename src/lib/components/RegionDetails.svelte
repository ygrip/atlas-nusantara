<script lang="ts">
  import { Check, Cloud, CloudLightning, CloudRain, CloudSun, Copy, Droplets, ExternalLink, MapPin, Sun, Wind } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';
  import { weatherConditionKey } from '$lib/i18n/weather-condition';
  import { formatDegrees, type Coordinates } from '$lib/atlas/region-coordinates';
  import type { WeatherSummary } from '$lib/map/weather-summary';

  let { name, code, levelLabel, parentName, coordinates, weather, neighbourName }: {
    name: string;
    code: string;
    levelLabel: string;
    parentName?: string;
    coordinates?: Coordinates;
    /** Present only on the weather layer, once a forecast is loaded. */
    weather?: WeatherSummary;
    /** Name of the nearby location whose forecast stands in for this region, when it has none of its own. */
    neighbourName?: string;
  } = $props();

  const headingId = $props.id();
  const CLOUDY_FROM = 60;
  const PARTLY_CLOUDY_FROM = 25;
  const COPIED_MS = 2200;
  let copied = $state(false);
  let copyFailed = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  /** The icon follows the forecast text first, then the cloud cover. */
  function conditionIcon(summary: WeatherSummary): typeof Sun {
    const text = summary.description.toLowerCase();
    if (/petir|thunder|storm/.test(text)) return CloudLightning;
    if (/hujan|rain|shower|drizzle/.test(text)) return CloudRain;
    if (summary.clouds >= CLOUDY_FROM) return Cloud;
    if (summary.clouds >= PARTLY_CLOUDY_FROM) return CloudSun;
    return Sun;
  }

  const coordinateText = $derived.by(() => {
    if (!coordinates) return '';
    return formatDegrees(coordinates.lat) + ', ' + formatDegrees(coordinates.lon);
  });
  const mapUrl = $derived.by(() => {
    if (!coordinates) return '';
    const lat = coordinates.lat.toFixed(5);
    const lon = coordinates.lon.toFixed(5);
    return 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lon + '#map=9/' + lat + '/' + lon;
  });

  async function copyCoordinates() {
    clearTimeout(copyTimer);
    copyFailed = false;
    try {
      await navigator.clipboard.writeText(coordinateText);
      copied = true;
    } catch (error) {
      console.warn('Coordinates could not be copied', error);
      copyFailed = true;
    }
    copyTimer = setTimeout(() => { copied = false; copyFailed = false; }, COPIED_MS);
  }
</script>

<section class="selected-region" aria-labelledby={headingId}>
  <header class="region-head">
    <span class="level-badge">{levelLabel}</span>
    <h3 id={headingId}>{name}</h3>
    <p class="region-meta"><span class="region-code">{code}</span>{#if parentName}<span aria-hidden="true">·</span><span>{parentName}</span>{/if}</p>
  </header>

  {#if weather}
    {@const Condition = conditionIcon(weather)}
    <div class="weather-block">
      <div class="condition">
        <span class="condition-icon"><Condition size={34} aria-hidden="true" /></span>
        <div class="condition-text">
          <strong class="temperature"><span class="visually-hidden">{m.weather_temperature()}: </span>{weather.temperature}<span aria-hidden="true">°C</span></strong>
          <span class="weather-line">{m[weatherConditionKey(weather.description)]()}</span>
        </div>
      </div>
      <dl class="metrics">
        <div class="metric">
          <dt><Wind size={15} aria-hidden="true" />{m.weather_wind()}</dt>
          <dd>
            <span class="wind-arrow" style={`transform: rotate(${weather.arrow}deg)`} aria-hidden="true">↑</span>
            {weather.speed} km/h <small>{weather.from}</small>
          </dd>
        </div>
        <div class="metric">
          <dt><Droplets size={15} aria-hidden="true" />{m.weather_humidity()}</dt>
          <dd>{weather.humidity}%</dd>
          <div class="meter" role="meter" aria-label={m.weather_humidity()} aria-valuemin="0" aria-valuemax="100" aria-valuenow={weather.humidity}><span style={`width: ${weather.humidity}%`}></span></div>
        </div>
        <div class="metric">
          <dt><Cloud size={15} aria-hidden="true" />{m.weather_clouds()}</dt>
          <dd>{weather.clouds}%</dd>
          <div class="meter" role="meter" aria-label={m.weather_clouds()} aria-valuemin="0" aria-valuemax="100" aria-valuenow={weather.clouds}><span style={`width: ${weather.clouds}%`}></span></div>
        </div>
      </dl>
      {#if weather.neighbour}
        <p class="neighbour-note" role="note">{m.weather_neighbour_note({ name, nearest: neighbourName ?? weather.neighbour.code, distance: Math.max(1, Math.round(weather.neighbour.distanceKm)) })}</p>
      {/if}
    </div>
  {/if}

  {#if coordinates}
    <div class="location-block">
      <dl class="coordinates">
        <div><dt>{m.table_latitude()}</dt><dd>{formatDegrees(coordinates.lat)}°</dd></div>
        <div><dt>{m.table_longitude()}</dt><dd>{formatDegrees(coordinates.lon)}°</dd></div>
      </dl>
      <div class="location-actions">
        <button type="button" class="detail-action" onclick={copyCoordinates}>
          {#if copied}<Check size={16} aria-hidden="true" />{:else}<Copy size={16} aria-hidden="true" />{/if}
          <span>{m.region_copy_coordinates()}</span>
        </button>
        <a class="detail-action" href={mapUrl} target="_blank" rel="noopener noreferrer">
          <MapPin size={16} aria-hidden="true" /><span>{m.region_open_map()}</span><ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>
      <p class="copy-state" role="status">{#if copied}{m.region_coordinates_copied()}{:else if copyFailed}{m.region_copy_failed()}{/if}</p>
    </div>
  {/if}
</section>

<style>
  .selected-region { display: grid; gap: 14px; margin-top: 14px; padding: 16px; border: 1px solid var(--border); border-radius: 22px; background: linear-gradient(165deg, var(--surface), var(--mint)); box-shadow: 0 4px 0 var(--border), inset 0 2px 1px var(--clay-highlight); }
  .region-head { display: grid; gap: 6px; justify-items: start; }
  .level-badge { padding: 3px 10px; border-radius: 999px; background: var(--accent); color: var(--on-accent); font-size: .66rem; font-weight: 900; letter-spacing: .07em; text-transform: uppercase; }
  h3 { margin: 0; font-size: 1.2rem; line-height: 1.25; letter-spacing: -.02em; overflow-wrap: anywhere; }
  .region-meta { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; color: var(--muted); font-size: .78rem; }
  .region-code { font: 800 .76rem ui-monospace, SFMono-Regular, monospace; font-variant-numeric: tabular-nums; }

  .neighbour-note { margin: 0; padding: 10px 14px; border-radius: 14px; background: var(--sky); color: var(--text); font-size: .78rem; font-weight: 700; line-height: 1.5; }
  .weather-block { display: grid; gap: 12px; padding-top: 14px; border-top: 1px dashed var(--border); }
  .condition { display: flex; align-items: center; gap: 12px; }
  .condition-icon { display: grid; place-items: center; flex: none; width: 56px; height: 56px; border-radius: 18px; color: var(--accent-strong); background: var(--sky); box-shadow: inset 0 2px 1px var(--clay-highlight), 0 3px 0 var(--border); }
  .condition-text { display: grid; min-width: 0; }
  .temperature { font-size: 2.1rem; line-height: 1; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
  .temperature span { margin-inline-start: 2px; font-size: .95rem; font-weight: 800; letter-spacing: 0; opacity: .7; }
  .weather-line { margin-top: 3px; font-weight: 800; font-size: .86rem; overflow-wrap: anywhere; }

  .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 8px; margin: 0; }
  .metric { display: grid; align-content: start; gap: 4px; padding: 10px 12px; border-radius: 14px; background: color-mix(in srgb, var(--surface) 82%, transparent); box-shadow: inset 0 1px 0 var(--clay-highlight); }
  dt { display: flex; align-items: center; gap: 5px; color: var(--muted); font-size: .68rem; font-weight: 900; letter-spacing: .05em; text-transform: uppercase; }
  dd { margin: 0; font-weight: 850; font-size: 1rem; font-variant-numeric: tabular-nums; }
  dd small { color: var(--muted); font-size: .7rem; font-weight: 800; }
  .wind-arrow { display: inline-block; color: var(--accent); }
  .meter { height: 7px; overflow: hidden; border-radius: 999px; background: var(--border); }
  .meter span { display: block; height: 100%; border-radius: inherit; background: var(--accent); transition: width 500ms ease-out; }

  .location-block { display: grid; gap: 10px; padding-top: 14px; border-top: 1px dashed var(--border); }
  .coordinates { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; }
  .coordinates > div { padding: 8px 12px; border-radius: 14px; background: color-mix(in srgb, var(--surface) 82%, transparent); }
  .coordinates dd { font-family: ui-monospace, SFMono-Regular, monospace; font-size: .92rem; }
  .location-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .detail-action { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 0 14px; border: 1px solid var(--border); border-radius: 14px; color: var(--text); font: inherit; font-size: .78rem; font-weight: 800; text-decoration: none; background: linear-gradient(165deg, var(--surface), var(--panel)); cursor: pointer; box-shadow: 0 3px 0 var(--border), inset 0 2px 1px var(--clay-highlight); }
  .detail-action:hover { color: var(--accent); }
  .detail-action:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--border); }
  .detail-action:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 2px; }
  .copy-state { min-height: 1.2em; margin: -4px 0 0; color: var(--muted); font-size: .74rem; font-weight: 700; }
  @media (prefers-reduced-motion: reduce) { .meter span { transition: none; } }
</style>
