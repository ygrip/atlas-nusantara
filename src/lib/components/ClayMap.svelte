<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import type { GeometryPackage } from '$lib/geo/types';
  import { ISLAND_GROUPS, ISLAND_GROUP_COLORS, ISLAND_GROUP_NAMES } from '$lib/atlas/islands';
  import { GEOMETRY_DATA_PATH } from '$lib/atlas/edition';
  import { assetUrl } from '$lib/pwa/assets';
  import type { AtlasScene, MapLayers, ThemeName } from '$lib/map/scene';
  import { buildField, forecastTimes, loadForecast, nearestTimeIndex, type ForecastSnapshot, type WeatherField } from '$lib/map/weather';
  import WeatherReadout from './WeatherReadout.svelte';
  import SvgMap from './SvgMap.svelte';
  import type { MapPin, PointOverlay } from '$lib/map/overlays';

  let { label, national, detail, openProvince, selectedCode, onprovince, oncity, onselect, activeLayer = 'warning', overlay, geometryUnavailable = false }: {
    geometryUnavailable?: boolean;
    activeLayer?: string;
    overlay?: PointOverlay;
    label: string;
    national?: GeometryPackage;
    detail?: GeometryPackage;
    openProvince?: string;
    selectedCode?: string;
    onprovince: (code: string) => void;
    oncity: (code: string) => void;
    /** 2D map selection at the current level (province or city). */
    onselect: (code: string) => void;
  } = $props();

  type ViewMode = '3d' | '2d';
  const PLAY_STEP_SECONDS = 6;

  let mode = $state<ViewMode>('3d');
  let webglFailed = $state(false);
  let host = $state<HTMLDivElement>();
  let scene = $state<AtlasScene>();
  let loading = $state(false);
  let mapVisible = $state(false);
  let legendOpen = $state(false);
  let documentVisible = $state(true);
  let zoomLevel = $state(1);
  let hover = $state<{ code: string; x: number; y: number }>();
  let feature = $state<{ pin: MapPin; x: number; y: number }>();
  let forecast = $state<ForecastSnapshot>();
  let times = $state<string[]>([]);
  let timeIndex = $state(0);
  let playing = $state(false);
  let progress = $state(0);
  let layers = $state<MapLayers>({ wind: true, weather: true, sea: true });
  let reducedMotion = false;
  const fieldCache = new Map<string, WeatherField>();

  const regionNames = $derived.by(() => {
    const names = new Map<string, string>();
    for (const region of national?.regions ?? []) names.set(region.sourceCode, region.name);
    for (const region of detail?.regions ?? []) names.set(region.sourceCode, region.name);
    return names;
  });
  const svgGeometry = $derived(detail ?? national);
  const currentTime = $derived(times[timeIndex]);
  const readoutCode = $derived(hover?.code ?? selectedCode ?? openProvince);
  const playLabel = $derived.by(() => {
    if (playing) return m.map_pause();
    return m.map_play();
  });

  function currentTheme(): ThemeName {
    if (document.documentElement.dataset.theme === 'dark') return 'dark';
    return 'light';
  }

  function fieldFor(time: string): WeatherField | undefined {
    if (!forecast || !national?.projection) return undefined;
    const cached = fieldCache.get(time);
    if (cached) return cached;
    const field = buildField(forecast, time, national.projection);
    fieldCache.set(time, field);
    return field;
  }

  function pushWeather() {
    if (!scene || times.length === 0) return;
    const current = fieldFor(times[timeIndex]);
    if (!current) return;
    let next: WeatherField | undefined;
    if (playing && timeIndex + 1 < times.length) next = fieldFor(times[timeIndex + 1]);
    let mix = 0;
    if (next) mix = progress;
    scene.setWeather(current, next, mix);
  }

  async function createScene(target: HTMLDivElement, nationalPackage: GeometryPackage) {
    loading = true;
    try {
      const [{ AtlasScene }, { loadRelief, rasteriseMask }] = await Promise.all([import('$lib/map/scene'), import('$lib/map/terrain')]);
      const created = new AtlasScene(target, {
        onselect: code => {
          if (code.includes('.')) oncity(code);
          else onprovince(code);
        },
        onhover: (code, x, y) => {
          if (!code) { hover = undefined; return; }
          const bounds = target.getBoundingClientRect();
          hover = { code, x: x - bounds.left, y: y - bounds.top };
        },
        onzoom: level => { zoomLevel = level; },
        onfeature: (pin, x, y) => {
          if (!pin) { feature = undefined; return; }
          const bounds = target.getBoundingClientRect();
          feature = { pin, x: x - bounds.left, y: y - bounds.top };
        }
      }, reducedMotion);
      scene = created;
      created.applyTheme(currentTheme());
      const relief = await loadRelief(assetUrl(GEOMETRY_DATA_PATH + '/relief.png'));
      // A mode switch or route change can dispose this scene while the relief is loading.
      if (scene !== created || !target.isConnected) return;
      const mask = rasteriseMask(nationalPackage.regions.map(region => region.path), 2048, 1024);
      created.setNational(nationalPackage, relief, mask, [2048, 1024]);
      created.setLayers(effectiveLayers);
      if (nationalPackage.projection) created.setOverlay(overlay, nationalPackage.projection);
      pushWeather();
      created.setProvince(openProvince, detail, false);
      created.setSelected(selectedCode);
    } catch (error) {
      console.warn('3D atlas unavailable; using the 2D map', error);
      scene?.dispose();
      scene = undefined;
      webglFailed = true;
      mode = '2d';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    legendOpen = matchMedia('(min-width: 701px)').matches;
    const syncVisibility = () => { documentVisible = !document.hidden; };
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    const controller = new AbortController();
    const handleContextLoss = (event: Event) => {
      if (mode !== '3d' || !host?.isConnected) return;
      event.preventDefault();
      webglFailed = true;
      mode = '2d';
    };
    host?.addEventListener('webglcontextlost', handleContextLoss, true);
    const refreshForecast = () => {
      void loadForecast(assetUrl('/data/weather/forecast.json'), controller.signal)
        .then(snapshot => {
          if (!snapshot || controller.signal.aborted) return;
          fieldCache.clear();
          forecast = snapshot;
          times = forecastTimes(snapshot);
          timeIndex = nearestTimeIndex(times, Date.now());
        })
        .catch(error => { if (error.name !== 'AbortError') console.warn('Forecast snapshot unavailable', error); });
    };
    refreshForecast();
    const forecastTimer = setInterval(() => { if (!document.hidden && navigator.onLine) refreshForecast(); }, 2 * 60 * 60_000);
    const themeObserver = new MutationObserver(() => scene?.applyTheme(currentTheme()));
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      controller.abort();
      clearInterval(forecastTimer);
      document.removeEventListener('visibilitychange', syncVisibility);
      host?.removeEventListener('webglcontextlost', handleContextLoss, true);
      themeObserver.disconnect();
      scene?.dispose();
      scene = undefined;
    };
  });

  $effect(() => {
    if (!host) return;
    const observer = new IntersectionObserver(entries => { mapVisible = entries.some(entry => entry.isIntersecting); }, { rootMargin: '160px' });
    observer.observe(host);
    return () => observer.disconnect();
  });

  // Create the 3D scene only when the map approaches the viewport.
  $effect(() => {
    if (mode !== '3d' || !mapVisible || !host || !national || scene || webglFailed) return;
    void createScene(host, national);
  });

  // Leaving 3D releases the GPU context.
  $effect(() => {
    if (mode === '3d' || !scene) return;
    scene.dispose();
    scene = undefined;
  });

  let lastProvince: string | undefined;
  let lastDetail: GeometryPackage | undefined;
  $effect(() => {
    const province = openProvince;
    const detailPackage = detail;
    if (!scene) return;
    if (province === lastProvince && detailPackage === lastDetail) return;
    // Wait for the province package before flying in, so cities appear where the camera lands.
    if (province && detailPackage?.regions[0]?.parentId !== province) return;
    lastProvince = province;
    lastDetail = detailPackage;
    scene.setProvince(province, detailPackage);
  });

  $effect(() => { scene?.setSelected(selectedCode); });
  const effectiveLayers = $derived.by(() => {
    if (activeLayer === 'warning') return layers;
    return { ...layers, wind: false, weather: false };
  });
  $effect(() => { scene?.setLayers(effectiveLayers); });
  $effect(() => {
    if (!scene || !national?.projection) return;
    scene.setOverlay(overlay, national.projection);
  });
  $effect(() => {
    void timeIndex; void forecast; void scene; void playing;
    pushWeather();
  });

  // Playback eases from one 3-hourly forecast step into the next.
  $effect(() => {
    if (!playing || !mapVisible || !documentVisible) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function advance(now) {
      progress += (now - last) / 1000 / PLAY_STEP_SECONDS;
      last = now;
      if (progress >= 1) {
        progress = 0;
        if (timeIndex + 1 >= times.length) timeIndex = 0;
        else timeIndex += 1;
      }
      pushWeather();
      frame = requestAnimationFrame(advance);
    });
    return () => cancelAnimationFrame(frame);
  });

  function togglePlay() {
    playing = !playing;
    progress = 0;
  }

  function toggleLayer(name: keyof MapLayers) {
    layers = { ...layers, [name]: !layers[name] };
  }

  function formatTime(time: string | undefined): string {
    if (!time) return '';
    return new Date(time).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function groupSwatch(group: (typeof ISLAND_GROUPS)[number]): string {
    return ISLAND_GROUP_COLORS[group].light[0];
  }
</script>

<div class="clay-map" data-mode={mode}>
  <div class="map-toolbar">
    <div class="segmented" role="group" aria-label={label}>
      <button type="button" aria-pressed={mode === '3d'} disabled={webglFailed} onclick={() => { mode = '3d'; }}>{m.map_view_3d()}</button>
      <button type="button" aria-pressed={mode === '2d'} onclick={() => { mode = '2d'; }}>{m.map_view_2d()}</button>
    </div>
    {#if mode === '3d'}
      <div class="map-controls" role="group" aria-label={m.zoom_reset()}>
        <button type="button" onclick={() => scene?.zoomBy(1.4)} aria-label={m.zoom_in()}>+</button>
        <button type="button" onclick={() => scene?.zoomBy(1 / 1.4)} aria-label={m.zoom_out()}>−</button>
        <button type="button" onclick={() => scene?.toggleTilt()} aria-label={m.map_tilt()} title={m.map_tilt()}>⟂</button>
        <button type="button" onclick={() => scene?.resetNorth()} aria-label={m.map_reset_north()} title={m.map_reset_north()}>N</button>
        <button type="button" onclick={() => scene?.home()}>{m.zoom_reset()}</button>
        <output aria-live="polite">{zoomLevel.toFixed(1)}×</output>
      </div>
    {/if}
  </div>

  {#if mode === '3d'}
    <div class="atlas-map atlas-3d" bind:this={host} data-ready={Boolean(scene && !loading)} role="application" aria-label={label + ' — ' + m.map_help_3d()}>
      {#if geometryUnavailable}<div class="map-loading" role="status">{m.data_unavailable()}</div>
      {:else if loading || !scene}<div class="map-loading" role="status"><span class="spinner" aria-hidden="true"></span>{m.loading_data()}</div>{/if}
      {#if feature}
        <div class="map-tooltip feature-tooltip" style={`left:${feature.x}px; top:${feature.y}px`} role="status"><strong>{feature.pin.label}</strong>{#if feature.pin.description}<small>{feature.pin.description}</small>{/if}</div>
      {:else if hover}
        <div class="map-tooltip" style={`left:${hover.x}px; top:${hover.y}px`} aria-hidden="true">
          <strong>{regionNames.get(hover.code) ?? hover.code}</strong><small>{hover.code}</small>
        </div>
      {/if}
      <aside class="map-legend" aria-label={m.map_legend_groups()}>
        <button class="legend-toggle" type="button" aria-expanded={legendOpen} onclick={() => { legendOpen = !legendOpen; }}>{m.map_legend_label()} <span aria-hidden="true">{#if legendOpen}−{:else}+{/if}</span></button>
        <div hidden={!legendOpen}>
        <p class="legend-title">{m.map_legend_groups()}</p>
        <ul class="group-legend">
          {#each ISLAND_GROUPS as group (group)}
            <li><span class="swatch" style={`--swatch: ${groupSwatch(group)}`} aria-hidden="true"></span>{ISLAND_GROUP_NAMES[group]}</li>
          {/each}
        </ul>
        {#if forecast && layers.wind && activeLayer === 'warning'}
          <p class="legend-title">{m.map_legend_wind()}</p>
          <div class="wind-ramp" aria-hidden="true"></div>
          <div class="wind-scale"><span>0</span><span>12</span><span>25</span><span>40+</span></div>
        {/if}
        {#if overlay}
          {#each overlay.legend as item}<p class="legend-title"><span class="overlay-symbol" class:triangle={item.symbol === 'triangle'} class:diamond={item.symbol === 'diamond'} style={`background:${item.color}`} aria-hidden="true"></span>{item.label}</p>{/each}
        {/if}
        <p class="legend-title">{m.map_relief()}</p>
        <div class="relief-ramp" aria-hidden="true"></div>
        <div class="wind-scale"><span>−9,000</span><span>0</span><span>4,400</span></div>
        </div>
      </aside>
      {#if forecast && readoutCode && activeLayer === 'warning'}
        <WeatherReadout {forecast} code={readoutCode} time={currentTime} name={regionNames.get(readoutCode) ?? readoutCode} />
      {/if}
    </div>
  {:else}
    {#if webglFailed}<p class="map-notice" role="status">{m.map_webgl_unavailable()}</p>{/if}
    {#if svgGeometry}<SvgMap geometry={svgGeometry} {label} {selectedCode} {onselect} {overlay} projection={national?.projection} />{/if}
  {/if}

  {#if mode === '3d' && forecast && times.length > 0 && activeLayer === 'warning'}
    <div class="weather-bar">
      <div class="layer-chips" role="group" aria-label={m.weather_snapshot()}>
        <button type="button" aria-pressed={layers.wind} onclick={() => toggleLayer('wind')}>{m.map_layer_wind()}</button>
        <button type="button" aria-pressed={layers.weather} onclick={() => toggleLayer('weather')}>{m.map_layer_weather()}</button>
        <button type="button" aria-pressed={layers.sea} onclick={() => toggleLayer('sea')}>{m.map_layer_sea()}</button>
      </div>
      <button type="button" class="play" onclick={togglePlay} aria-label={playLabel}>
        {#if playing}❚❚{:else}▶{/if}
      </button>
      <label class="time-slider">
        <span>{m.map_time()} · <strong>{formatTime(currentTime)}</strong></span>
        <input type="range" min="0" max={times.length - 1} step="1" bind:value={timeIndex} oninput={() => { progress = 0; }} />
      </label>
      <p class="weather-source">
        {m.weather_snapshot()} · {m.weather_fetched()} {formatTime(forecast.fetchedAt)} · {forecast.coverage.received}/{forecast.coverage.requested} ·
        <a href={forecast.sourceUrl} target="_blank" rel="noreferrer">BMKG ↗</a>
      </p>
    </div>
    <p class="map-help">{m.map_help_3d()} {m.weather_sea_note()}</p>
  {/if}
</div>

<style>
  .clay-map { display: grid; gap: 12px; min-width: 0; }
  .map-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
  .segmented { display: inline-flex; padding: 4px; gap: 4px; border-radius: 16px; background: var(--panel); box-shadow: inset 2px 2px 5px #0000001a, inset -2px -2px 5px #ffffff80; }
  .segmented button { min-height: 36px; min-width: 52px; border: 0; border-radius: 12px; background: transparent; color: inherit; font-weight: 800; padding: 6px 14px; cursor: pointer; }
  .segmented button[aria-pressed='true'] { background: var(--surface, #fffaf2); box-shadow: 0 3px 0 var(--border, #e2d6c6), 0 6px 14px #5e4a3422; }
  .map-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .map-controls button { min-width: 40px; min-height: 36px; border: 1px solid var(--border, #e2d6c6); border-radius: 12px; background: var(--surface, #fffaf2); color: inherit; padding: 6px 12px; font-weight: 800; cursor: pointer; box-shadow: 0 3px 0 var(--border, #e2d6c6); }
  .map-controls button:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--border, #e2d6c6); }
  .map-controls output { min-width: 3.5ch; font: 800 .75rem ui-monospace, monospace; opacity: .8; }
  .atlas-map { position: relative; min-height: 360px; display: grid; grid-template-columns: minmax(0, 1fr); border-radius: 24px; overflow: hidden; border: 1px solid var(--border, #e2d6c6); background: var(--map-bg, #dce8dd); }
  .atlas-3d { height: clamp(420px, 68vh, 760px); touch-action: none; box-shadow: inset 0 2px 0 #ffffff80, 0 18px 40px -22px #5e4a3466; }
  .atlas-3d :global(canvas.atlas-canvas) { position: absolute; inset: 0; width: 100%; height: 100%; display: block; outline: none; }
  .map-loading { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 10px; font-weight: 800; color: var(--muted, #6c6057); z-index: 2; }
  .spinner { width: 34px; height: 34px; border-radius: 50%; border: 4px solid #ffffff90; border-top-color: var(--accent, #b5532c); animation: spin 900ms linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .map-tooltip { position: absolute; transform: translate(14px, -50%); pointer-events: none; z-index: 3; display: grid; gap: 1px; padding: 8px 12px; border-radius: 14px; background: color-mix(in srgb, var(--surface, #fffaf2) 92%, transparent); box-shadow: 0 10px 24px -10px #00000055; font-size: .82rem; white-space: nowrap; }
  .map-tooltip small { font: 700 .7rem ui-monospace, monospace; opacity: .7; }
  .map-legend { position: absolute; left: 14px; bottom: 14px; z-index: 2; max-width: min(260px, calc(100% - 28px)); padding: 12px 14px; border-radius: 18px; background: color-mix(in srgb, var(--surface, #fffaf2) 88%, transparent); backdrop-filter: blur(8px); box-shadow: 0 12px 28px -16px #00000066, inset 0 1px 0 #ffffff99; font-size: .72rem; }
  .legend-toggle { display: flex; justify-content: space-between; align-items: center; gap: 22px; min-height: 32px; width: 100%; border: 0; padding: 0; background: transparent; color: inherit; font-size: .72rem; font-weight: 900; }
  .legend-title { margin: 0 0 6px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; font-size: .62rem; opacity: .75; }
  .legend-title:not(:first-child) { margin-top: 10px; }
  .group-legend { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 10px; list-style: none; margin: 0; padding: 0; font-weight: 700; }
  .group-legend li { display: flex; align-items: center; gap: 6px; min-width: 0; white-space: nowrap; }
  .group-legend li:nth-child(3) { grid-column: 1 / -1; }
  .swatch { flex: none; width: 12px; height: 12px; border-radius: 4px; background: var(--swatch); box-shadow: inset -1px -2px 2px #00000026, 0 1px 0 #00000022; }
  .wind-ramp { height: 8px; border-radius: 99px; background: linear-gradient(90deg, #ffffff, #bff2e0 30%, #ffdb80 62%, #ff8c6b); box-shadow: inset 0 0 0 1px #00000018; }
  .relief-ramp { height: 6px; border-radius: 99px; background: linear-gradient(90deg, #285678, #6bc5c1 42%, #e5d2ab 50%, #a9b48d 72%, #9d8670); }
  .overlay-symbol { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 5px; }
  .overlay-symbol.triangle { border-radius: 0; clip-path: polygon(50% 0, 100% 100%, 0 100%); }
  .overlay-symbol.diamond { border-radius: 0; transform: rotate(45deg); }
  .feature-tooltip { max-width: min(300px, 65vw); white-space: normal; }
  .feature-tooltip small { overflow-wrap: anywhere; }
  .wind-scale { display: flex; justify-content: space-between; margin-top: 3px; font: 700 .62rem ui-monospace, monospace; opacity: .75; }
  .weather-bar { display: grid; grid-template-columns: auto auto minmax(0, 1fr); align-items: center; gap: 10px 14px; padding: 10px 14px; border-radius: 20px; background: var(--surface, #fffaf2); box-shadow: inset 2px 2px 4px #ffffff90, inset -2px -3px 6px #0000000f, 0 8px 20px -14px #5e4a3455; }
  .layer-chips { display: flex; gap: 6px; }
  .layer-chips button { min-height: 34px; border: 1px solid var(--border, #e2d6c6); border-radius: 99px; background: transparent; color: inherit; padding: 4px 12px; font-weight: 800; font-size: .78rem; cursor: pointer; }
  .layer-chips button[aria-pressed='true'] { background: var(--mint, #cfe8d6); border-color: transparent; box-shadow: 0 2px 0 #00000014; }
  .play { width: 40px; height: 40px; border-radius: 50%; border: 0; background: var(--accent, #b5532c); color: var(--on-accent, #fff); font-size: .8rem; cursor: pointer; box-shadow: 0 4px 0 #8a3d1f; }
  .time-slider { display: grid; gap: 2px; min-width: 0; font-size: .78rem; }
  .time-slider input { width: 100%; accent-color: var(--accent, #b5532c); }
  .weather-source { grid-column: 1 / -1; margin: 0; font-size: .7rem; opacity: .8; }
  .map-help { margin: 0; font-size: .74rem; line-height: 1.5; opacity: .8; }
  .map-notice { margin: 0; font-size: .8rem; font-weight: 700; }
  @media (max-width: 700px) {
    .atlas-3d { height: 440px; min-height: 360px; }
    .map-legend { left: 8px; bottom: 8px; padding: 8px 10px; }
    .group-legend { grid-template-columns: 1fr 1fr; font-size: .65rem; }
    .weather-bar { grid-template-columns: auto minmax(0, 1fr); }
    .layer-chips { grid-column: 1 / -1; }
  }
  @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
</style>
