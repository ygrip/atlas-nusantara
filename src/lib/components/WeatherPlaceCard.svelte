<script lang="ts">
  import { Cloud, CloudRain, CloudLightning, CloudSun, Sun, Wind, Droplets, MapPin, X, Navigation } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import type { ForecastSnapshot } from '$lib/map/weather';
  import type { Pin } from '$lib/pwa/permissions';
  import { forecastForPlace } from '$lib/places/forecast';

  let { pin, forecast, current = false, names, onremove, onopen }: {
    pin: Pin; forecast?: ForecastSnapshot; current?: boolean; names: Map<string, string>;
    onremove?: () => void; onopen?: (code: string) => void;
  } = $props();
  const report = $derived.by(() => { if (!forecast) return undefined; return forecastForPlace(forecast, pin, Date.now()); });
  const name = $derived.by(() => {
    if (current) return m.current_location();
    if (pin.type === 'region') return names.get(pin.code) ?? pin.name;
    return pin.name;
  });
  function icon(code: number) {
    if (code === 17 || code === 95 || code === 97) return CloudLightning;
    if (code >= 60 && code <= 90) return CloudRain;
    if (code === 0) return Sun;
    if (code === 1 || code === 2) return CloudSun;
    return Cloud;
  }
  function date(value: string) { return new Intl.DateTimeFormat(getLocale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
  function hour(value: string) { return new Intl.DateTimeFormat(getLocale(), { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
</script>

<article class="weather-place pin" class:device-location={current}>
  <header><div><span class="place-kind">{#if current}<Navigation size={13} aria-hidden="true" />{:else}<MapPin size={13} aria-hidden="true" />{/if} {name}</span>{#if pin.type === 'coordinates'}<small>{pin.lat}, {pin.lng}</small>{/if}</div>
    {#if onremove}<button class="remove-place" type="button" onclick={onremove} aria-label={m.unpin_button() + ' ' + name}><X size={16} aria-hidden="true" /></button>{/if}
  </header>
  {#if report && forecast}
    {@const WeatherIcon = icon(report.step.weather)}
    <div class="current-weather"><div><strong>{report.step.t}<span>°</span></strong><p lang="en">{report.step.desc}</p></div><span class="weather-symbol"><WeatherIcon size={64} strokeWidth={1.4} aria-hidden="true" /></span></div>
    <div class="weather-measures"><span><Wind size={15} aria-hidden="true" />{report.step.ws} km/h</span><span><Droplets size={15} aria-hidden="true" />{report.step.hu}%</span><span>{m.weather_rain()} {report.step.tp} mm</span></div>
    <div class="hourly-weather">
      {#each report.upcoming as step (step.at)}
        {@const HourIcon = icon(step.weather)}
        <div><time datetime={step.at}>{hour(step.at)}</time><HourIcon size={20} aria-hidden="true" /><strong>{step.t}°</strong></div>
      {/each}
    </div>
    <p class="sample-note">{m.forecast_nearby()}: <strong>{names.get(report.point.code) ?? report.point.code}</strong>{#if report.distanceKm !== undefined} · {report.distanceKm.toFixed(1)} km{/if}</p>
    <footer><time datetime={report.step.at}>{date(report.step.at)}</time><button class="view-place" type="button" onclick={() => onopen?.(report.point.code)}>{m.open_in_atlas()} ↗</button></footer>
  {:else}<p class="sample-note">{m.data_unavailable()}</p>{/if}
</article>

<style>
  .weather-place { display: block; min-width: 0; padding: 20px; border: 1px solid var(--border); border-radius: 26px; background: linear-gradient(145deg, var(--sky), var(--surface)); box-shadow: var(--clay-shadow); }
  .weather-place.device-location { background: linear-gradient(145deg, var(--mint), var(--surface)); }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; } header > div { min-width: 0; }.place-kind { display: flex; align-items: center; gap: 6px; font-size: .95rem; font-weight: 900; overflow-wrap: anywhere; } header small { display: block; color: var(--muted); font-size: .7rem; margin-top: 3px; }
  button { color: inherit; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }.remove-place { flex: none; width: 36px; min-height: 36px; display: grid; place-items: center; padding: 0; }
  .current-weather { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 18px 0 12px; }.current-weather strong { font-size: 4.8rem; line-height: 1; letter-spacing: -.07em; font-weight: 850; }.current-weather strong span { font-size: 3.4rem; vertical-align: top; }.current-weather p { margin: 4px 0 0; font-size: .9rem; color: var(--muted); }.weather-symbol { color: var(--accent); filter: drop-shadow(1px 3px 0 #00000012); }
  .weather-measures { display: flex; flex-wrap: wrap; gap: 8px 12px; font-size: .76rem; color: var(--muted); font-weight: 750; }.weather-measures span { display: inline-flex; align-items: center; gap: 5px; }
  .hourly-weather { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; padding: 12px 0; }.hourly-weather > div { display: grid; gap: 8px; justify-items: center; padding: 10px 4px; border-radius: 14px; background: color-mix(in srgb, var(--surface) 70%, transparent); box-shadow: inset 1px 1px 2px #ffffff30; }.hourly-weather time { font-size: .65rem; color: var(--muted); }
  .sample-note { margin: 6px 0 12px; font-size: .7rem; color: var(--muted); line-height: 1.5; } footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; font-size: .68rem; color: var(--muted); }.view-place { min-height: 36px; padding: 6px 10px; font-weight: 800; font-size: .7rem; }
</style>
