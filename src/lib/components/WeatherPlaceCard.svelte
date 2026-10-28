<script lang="ts">
  import { Cloud, CloudMoon, CloudRain, CloudLightning, CloudSun, Moon, Sun, Wind, Droplets, MapPin, X, Navigation } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import type { ForecastSnapshot } from '$lib/map/weather';
  import type { Pin } from '$lib/pwa/permissions';
  import { forecastForPlace } from '$lib/places/forecast';
  import { formatInZone, timeZoneForRegionCode } from '$lib/places/time-zone';
  import { isDaytimeAt, sceneForWeather } from '$lib/places/weather-scene';
  import { onMount } from 'svelte';
  import WeatherScene from './WeatherScene.svelte';

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
  const scene = $derived.by(() => {
    if (!report) return 'cloudy';
    return sceneForWeather(report.step.weather);
  });
  /** The clock and the sky follow the place itself, so a card for Papua shows Papua's time even when viewed from Java. */
  const zone = $derived(timeZoneForRegionCode(report?.point.code ?? (pin.type === 'region' ? pin.code : '')));
  /** Coordinates a pin was dropped on are used as is; a province card uses its sample forecast point. */
  const sunLatitude = $derived.by(() => {
    if (pin.type === 'coordinates') return pin.lat;
    return report?.point.lat ?? 0;
  });
  const sunLongitude = $derived.by(() => {
    if (pin.type === 'coordinates') return pin.lng;
    return report?.point.lon ?? 0;
  });
  let now = $state(Date.now());
  const night = $derived.by(() => {
    if (!report) return false;
    return !isDaytimeAt(new Date(now).toISOString(), sunLatitude, sunLongitude);
  });
  const phaseLabel = $derived.by(() => {
    if (night) return m.weather_night();
    return m.weather_daytime();
  });
  const clock = $derived(formatInZone(now, zone, getLocale(), { hour: '2-digit', minute: '2-digit' }));
  let card: HTMLElement | undefined = $state();
  let visible = $state(true);
  onMount(() => {
    if (!card) return;
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting) && !document.hidden; });
    observer.observe(card);
    const onVisibility = () => { if (document.hidden) visible = false; else now = Date.now(); };
    document.addEventListener('visibilitychange', onVisibility);
    const clockTimer = setInterval(() => { now = Date.now(); }, 30_000);
    return () => { observer.disconnect(); clearInterval(clockTimer); document.removeEventListener('visibilitychange', onVisibility); };
  });
  function icon(code: number, dark: boolean) {
    if (code === 17 || code === 95 || code === 97) return CloudLightning;
    if (code >= 60 && code <= 90) return CloudRain;
    if (code === 0 && dark) return Moon;
    if (code === 0) return Sun;
    if ((code === 1 || code === 2) && dark) return CloudMoon;
    if (code === 1 || code === 2) return CloudSun;
    return Cloud;
  }
  function isNightAt(value: string) { return !isDaytimeAt(value, sunLatitude, sunLongitude); }
  function hour(value: string) { return formatInZone(value, zone, getLocale(), { hour: '2-digit', minute: '2-digit' }); }
</script>

<article class="weather-place pin scene-{scene}" class:night class:device-location={current} bind:this={card}>
  <header><div><span class="place-kind">{#if current}<Navigation size={13} aria-hidden="true" />{:else}<MapPin size={13} aria-hidden="true" />{/if} {name}</span>{#if pin.type === 'coordinates'}<small>{pin.lat}, {pin.lng}</small>{/if}</div>
    {#if onremove}<button class="remove-place" type="button" onclick={onremove} aria-label={m.unpin_button() + ' ' + name}><X size={16} aria-hidden="true" /></button>{/if}
  </header>
  {#if report && forecast}
    <p class="local-clock"><span class="clock-chip">{#if night}<Moon size={15} aria-hidden="true" />{:else}<Sun size={15} aria-hidden="true" />{/if}<span class="visually-hidden">{m.weather_local_time()}, {phaseLabel}: </span><time datetime={new Date(now).toISOString()}>{clock}</time> <abbr title={zone.id}>{zone.abbreviation}</abbr><span class="phase" aria-hidden="true">{phaseLabel}</span></span></p>
    {@const WeatherIcon = icon(report.step.weather, night)}
    <div class="current-weather"><div class="temperature"><strong>{report.step.t}<span>°</span></strong><p lang="en"><WeatherIcon size={15} aria-hidden="true" /> {report.step.desc}</p></div><WeatherScene {scene} {night} paused={!visible} /></div>
    <div class="weather-measures"><span><Wind size={15} aria-hidden="true" />{report.step.ws} km/h</span><span><Droplets size={15} aria-hidden="true" />{report.step.hu}%</span><span>{m.weather_rain()} {report.step.tp} mm</span></div>
    <div class="hourly-weather">
      {#each report.upcoming as step (step.at)}
        {@const HourIcon = icon(step.weather, isNightAt(step.at))}
        <div><time datetime={step.at}>{hour(step.at)}</time><HourIcon size={20} aria-hidden="true" /><strong>{step.t}°</strong></div>
      {/each}
    </div>
    <p class="sample-note">{m.forecast_nearby()}: <strong>{names.get(report.point.code) ?? report.point.code}</strong>{#if report.distanceKm !== undefined} · {report.distanceKm.toFixed(1)} km{/if}</p>
    <footer><button class="view-place" type="button" onclick={() => onopen?.(report.point.code)}>{m.open_in_atlas()} ↗</button></footer>
  {:else}<p class="sample-note">{m.data_unavailable()}</p>{/if}
</article>

<style>
  /* Every palette keeps --ink at 7:1 or better and --ink-soft at 4.5:1 or better against both ends of its gradient and the chip fill. */
  .weather-place { --card-top: #dff0fb; --card-bottom: #f6fbff; --ink: #1d2a38; --ink-soft: #3a4f63; --chip: #ffffffb3; --chip-edge: #3b506b26; --lift: #ffffffd9; --shade: #3b506b24; --glow: #ffffff80;
    position: relative; display: block; min-width: 0; padding: 18px; border: 0; border-radius: 32px; overflow: hidden; color: var(--ink);
    background: linear-gradient(160deg, var(--card-top), var(--card-bottom)); box-shadow: 0 6px 0 -2px #00000018, 8px 16px 28px #3b506b33, inset 3px 4px 5px var(--lift), inset -4px -6px 10px var(--shade); transition: transform .25s ease, box-shadow .25s ease; }
  .weather-place:hover { transform: translateY(-3px); box-shadow: 0 9px 0 -2px #00000018, 10px 22px 32px #3b506b3d, inset 3px 4px 5px var(--lift), inset -4px -6px 10px var(--shade); }
  .weather-place.scene-clear { --card-top: #ffe6a0; --card-bottom: #fff6dc; --ink: #34270a; --ink-soft: #5c4a12; }
  .weather-place.scene-partly { --card-top: #cfe8fb; --card-bottom: #fff0cf; }
  .weather-place.scene-cloudy { --card-top: #d3dce7; --card-bottom: #eef2f7; }
  .weather-place.scene-rain { --card-top: #b4cde4; --card-bottom: #dfeaf5; --ink: #14212e; --ink-soft: #2f4459; }
  .weather-place.scene-storm { --card-top: #aab6d2; --card-bottom: #d3d9ea; --ink: #121a2b; --ink-soft: #2a3552; }
  .weather-place.scene-mist { --card-top: #dde4e1; --card-bottom: #f3f5f1; }
  .weather-place.device-location { outline: 3px solid #2f8a57; outline-offset: -3px; }
  /* Night: deep indigo clay with light ink; chips turn into darker pillows so white text keeps its contrast. */
  .weather-place.night { --card-top: #1c2447; --card-bottom: #38437a; --ink: #f8f6ff; --ink-soft: #d5d9f2; --chip: #0b102e66; --chip-edge: #00000040; --lift: #ffffff33; --shade: #00000047; --glow: transparent; }
  .weather-place.night.scene-storm { --card-top: #161c36; --card-bottom: #323c68; }
  .weather-place.night.scene-clear { --card-top: #1a2350; --card-bottom: #3a4585; }
  .weather-place.scene-storm::after { content: ''; position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; animation: sky-flash 3.2s ease-in-out infinite; }
  header { position: relative; z-index: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; } header > div { min-width: 0; }
  .place-kind, .clock-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: 999px; font-weight: 900; background: var(--chip); color: var(--ink); box-shadow: 0 2px 0 var(--chip-edge), inset 1px 2px 2px var(--lift), inset -1px -2px 3px var(--shade); }
  .place-kind { font-size: .95rem; overflow-wrap: anywhere; }
  header small { display: block; color: var(--ink-soft); font-size: .8rem; margin: 5px 0 0 10px; }
  .local-clock { position: relative; z-index: 1; margin: 10px 0 0; }
  .clock-chip { font-size: .85rem; font-variant-numeric: tabular-nums; }
  .clock-chip time { font-size: 1rem; letter-spacing: .02em; }
  .clock-chip abbr { text-decoration: none; font-weight: 800; color: var(--ink-soft); }
  .clock-chip .phase { padding-inline-start: 8px; margin-inline-start: 2px; border-inline-start: 2px solid var(--chip-edge); color: var(--ink-soft); font-weight: 800; }
  button { color: inherit; background: var(--chip); border: 0; border-radius: 14px; box-shadow: 0 3px 0 var(--chip-edge), inset 1px 2px 2px var(--lift); transition: transform .15s ease, box-shadow .15s ease; cursor: pointer; }
  button:hover { transform: translateY(-1px); } button:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--chip-edge), inset 1px 2px 3px var(--shade); }
  button:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; }
  .remove-place { flex: none; width: 44px; min-height: 44px; display: grid; place-items: center; padding: 0; }
  .current-weather { position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 0 6px; }
  .temperature strong { display: block; font-size: 4.6rem; line-height: 1; letter-spacing: -.07em; font-weight: 850; text-shadow: 2px 3px 0 var(--glow); }.temperature strong span { font-size: 3.2rem; vertical-align: top; }
  .temperature p { display: flex; align-items: center; gap: 6px; margin: 6px 0 0; font-size: 1rem; font-weight: 800; color: var(--ink-soft); }
  .weather-measures { position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 8px; font-size: .85rem; font-weight: 800; }
  .weather-measures span { display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px; border-radius: 999px; background: var(--chip); color: var(--ink); box-shadow: inset 1px 2px 2px var(--lift), inset -1px -2px 3px var(--shade); }
  .hourly-weather { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 14px 0 10px; }
  .hourly-weather > div { display: grid; gap: 8px; justify-items: center; padding: 11px 4px; border-radius: 20px; background: var(--chip); box-shadow: 0 4px 0 var(--chip-edge), inset 2px 2px 3px var(--lift), inset -2px -3px 5px var(--shade); animation: chip-rise .5s ease both; }
  .hourly-weather > div:nth-child(2) { animation-delay: .08s; } .hourly-weather > div:nth-child(3) { animation-delay: .16s; } .hourly-weather > div:nth-child(4) { animation-delay: .24s; }
  .hourly-weather time { font-size: .8rem; font-weight: 800; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
  .sample-note { position: relative; z-index: 1; margin: 6px 0 12px; font-size: .8rem; color: var(--ink-soft); line-height: 1.5; }
  footer { position: relative; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; font-size: .8rem; color: var(--ink-soft); }
  .view-place { min-height: 44px; padding: 6px 14px; font-weight: 800; font-size: .8rem; }
  @keyframes chip-rise { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes sky-flash { 0%, 55%, 100% { opacity: 0; } 58% { opacity: .5; } 62% { opacity: .08; } 66% { opacity: .4; } 76% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .weather-place, .weather-place::after, .hourly-weather > div { animation: none; transition: none; } }
  @media (forced-colors: active) { .weather-place, .place-kind, .clock-chip, button, .weather-measures span, .hourly-weather > div { border: 1px solid CanvasText; } }
</style>
