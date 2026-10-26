<script lang="ts">
  import { Cloud, CloudRain, CloudLightning, CloudSun, Sun, Wind, Droplets, MapPin, X, Navigation } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import type { ForecastSnapshot } from '$lib/map/weather';
  import type { Pin } from '$lib/pwa/permissions';
  import { forecastForPlace } from '$lib/places/forecast';
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
  const night = $derived.by(() => {
    if (!report) return false;
    return !isDaytimeAt(report.step.at, report.point.lon);
  });
  let card: HTMLElement | undefined = $state();
  let visible = $state(true);
  onMount(() => {
    if (!card) return;
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting) && !document.hidden; });
    observer.observe(card);
    const onVisibility = () => { if (document.hidden) visible = false; };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', onVisibility); };
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

<article class="weather-place pin scene-{scene}" class:night class:device-location={current} bind:this={card}>
  <header><div><span class="place-kind">{#if current}<Navigation size={13} aria-hidden="true" />{:else}<MapPin size={13} aria-hidden="true" />{/if} {name}</span>{#if pin.type === 'coordinates'}<small>{pin.lat}, {pin.lng}</small>{/if}</div>
    {#if onremove}<button class="remove-place" type="button" onclick={onremove} aria-label={m.unpin_button() + ' ' + name}><X size={16} aria-hidden="true" /></button>{/if}
  </header>
  {#if report && forecast}
    {@const WeatherIcon = icon(report.step.weather)}
    <div class="current-weather"><div class="temperature"><strong>{report.step.t}<span>°</span></strong><p lang="en"><WeatherIcon size={15} aria-hidden="true" /> {report.step.desc}</p></div><WeatherScene {scene} {night} paused={!visible} /></div>
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
  .weather-place { --card-top: #dff0fb; --card-bottom: #f6fbff; --ink: #2b3a4a; --ink-soft: #55697c; position: relative; display: block; min-width: 0; padding: 18px; border: 0; border-radius: 32px; overflow: hidden; color: var(--ink);
    background: linear-gradient(160deg, var(--card-top), var(--card-bottom)); box-shadow: 0 6px 0 -2px #00000014, 8px 16px 28px #3b506b2e, inset 3px 4px 5px #ffffffb8, inset -4px -6px 10px #3b506b1f; transition: transform .25s ease, box-shadow .25s ease; }
  .weather-place:hover { transform: translateY(-3px); box-shadow: 0 9px 0 -2px #00000014, 10px 22px 32px #3b506b38, inset 3px 4px 5px #ffffffb8, inset -4px -6px 10px #3b506b1f; }
  .weather-place.scene-clear { --card-top: #ffe9a8; --card-bottom: #fff8e6; --ink: #4a3a12; --ink-soft: #7a6628; }
  .weather-place.scene-partly { --card-top: #cfe8fb; --card-bottom: #fff3d6; }
  .weather-place.scene-cloudy { --card-top: #dbe3ec; --card-bottom: #f3f6fa; }
  .weather-place.scene-rain { --card-top: #bcd3e8; --card-bottom: #e4eef7; }
  .weather-place.scene-storm { --card-top: #8f9bb8; --card-bottom: #c9d1e3; --ink: #1f2638; --ink-soft: #3d4764; }
  .weather-place.scene-mist { --card-top: #e3e8e6; --card-bottom: #f6f7f4; }
  .weather-place.device-location { outline: 3px solid #8fd1a655; outline-offset: -3px; }
  .weather-place.night { --card-top: #2c3558; --card-bottom: #4b5686; --ink: #f4f1ff; --ink-soft: #c5c9e6; }
  .weather-place.night.scene-storm { --card-top: #232a45; --card-bottom: #3c4568; }
  .weather-place.scene-storm::after { content: ''; position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; animation: sky-flash 3.2s ease-in-out infinite; }
  header { position: relative; z-index: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; } header > div { min-width: 0; }
  .place-kind { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: .85rem; font-weight: 900; overflow-wrap: anywhere; background: #ffffff66; box-shadow: inset 1px 2px 2px #ffffffaa, inset -1px -2px 3px #3b506b1f; }
  header small { display: block; color: var(--ink-soft); font-size: .7rem; margin: 5px 0 0 10px; }
  button { color: inherit; background: #ffffff70; border: 0; border-radius: 14px; box-shadow: 0 3px 0 #00000014, inset 1px 2px 2px #ffffffb0; transition: transform .15s ease, box-shadow .15s ease; }
  button:hover { transform: translateY(-1px); } button:active { transform: translateY(2px); box-shadow: 0 1px 0 #00000014, inset 1px 2px 3px #3b506b33; }
  .remove-place { flex: none; width: 36px; min-height: 36px; display: grid; place-items: center; padding: 0; }
  .current-weather { position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 0 6px; }
  .temperature strong { display: block; font-size: 4.6rem; line-height: 1; letter-spacing: -.07em; font-weight: 850; text-shadow: 2px 3px 0 #ffffff66; }.temperature strong span { font-size: 3.2rem; vertical-align: top; }
  .temperature p { display: flex; align-items: center; gap: 6px; margin: 6px 0 0; font-size: .9rem; font-weight: 800; color: var(--ink-soft); }
  .weather-measures { position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 8px; font-size: .74rem; font-weight: 800; }
  .weather-measures span { display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px; border-radius: 999px; background: #ffffff66; color: var(--ink); box-shadow: inset 1px 2px 2px #ffffffaa, inset -1px -2px 3px #3b506b1f; }
  .hourly-weather { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 14px 0 10px; }
  .hourly-weather > div { display: grid; gap: 8px; justify-items: center; padding: 11px 4px; border-radius: 20px; background: #ffffff5c; box-shadow: 0 4px 0 #00000012, inset 2px 2px 3px #ffffffb8, inset -2px -3px 5px #3b506b1a; animation: chip-rise .5s ease both; }
  .hourly-weather > div:nth-child(2) { animation-delay: .08s; } .hourly-weather > div:nth-child(3) { animation-delay: .16s; } .hourly-weather > div:nth-child(4) { animation-delay: .24s; }
  .hourly-weather time { font-size: .65rem; font-weight: 800; color: var(--ink-soft); }
  .sample-note { position: relative; z-index: 1; margin: 6px 0 12px; font-size: .7rem; color: var(--ink-soft); line-height: 1.5; }
  footer { position: relative; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; font-size: .68rem; color: var(--ink-soft); }
  .view-place { min-height: 36px; padding: 6px 12px; font-weight: 800; font-size: .7rem; }
  @keyframes chip-rise { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes sky-flash { 0%, 55%, 100% { opacity: 0; } 58% { opacity: .5; } 62% { opacity: .08; } 66% { opacity: .4; } 76% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .weather-place, .weather-place::after, .hourly-weather > div { animation: none; transition: none; } }
</style>
