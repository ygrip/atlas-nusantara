<script lang="ts">
  import { onMount } from 'svelte';
  import { Box, ChevronDown, ChevronUp, CloudRain, Compass, Layers, LocateFixed, Map as MapIcon, Minus, Pause, Play, Plus, Rotate3d, Waves, Wind } from 'lucide-svelte';
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
  /** Share of the forecast range already passed, used to paint the filled part of the slider track. */
  const sliderFill = $derived.by(() => {
    if (times.length < 2) return 0;
    return (timeIndex / (times.length - 1)) * 100;
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
      <button type="button" aria-pressed={mode === '3d'} disabled={webglFailed} onclick={() => { mode = '3d'; }}><Box size={18} aria-hidden="true" /><span>{m.map_view_3d()}</span></button>
      <button type="button" aria-pressed={mode === '2d'} onclick={() => { mode = '2d'; }}><MapIcon size={18} aria-hidden="true" /><span>{m.map_view_2d()}</span></button>
    </div>
    {#if mode === '3d'}
      <div class="map-controls" role="group" aria-label={m.zoom_reset()}>
        <div class="tool-group">
          <button type="button" class="tool" onclick={() => scene?.zoomBy(1.4)} aria-label={m.zoom_in()} title={m.zoom_in()}><Plus size={20} aria-hidden="true" /></button>
          <output aria-live="polite">{zoomLevel.toFixed(1)}×</output>
          <button type="button" class="tool" onclick={() => scene?.zoomBy(1 / 1.4)} aria-label={m.zoom_out()} title={m.zoom_out()}><Minus size={20} aria-hidden="true" /></button>
        </div>
        <span class="divider" aria-hidden="true"></span>
        <div class="tool-group">
          <button type="button" class="tool" onclick={() => scene?.toggleTilt()} aria-label={m.map_tilt()} title={m.map_tilt()}><Rotate3d size={20} aria-hidden="true" /></button>
          <button type="button" class="tool" onclick={() => scene?.resetNorth()} aria-label={m.map_reset_north()} title={m.map_reset_north()}><Compass size={20} aria-hidden="true" /></button>
        </div>
        <span class="divider" aria-hidden="true"></span>
        <button type="button" class="tool reset" onclick={() => scene?.home()} aria-label={m.zoom_reset()} title={m.zoom_reset()}><LocateFixed size={20} aria-hidden="true" /><span class="tool-label">{m.zoom_reset()}</span></button>
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
        <button class="legend-toggle" type="button" aria-expanded={legendOpen} onclick={() => { legendOpen = !legendOpen; }}>
          <span class="legend-heading"><Layers size={16} aria-hidden="true" />{m.map_legend_label()}</span>
          {#if legendOpen}<ChevronDown size={16} aria-hidden="true" />{:else}<ChevronUp size={16} aria-hidden="true" />{/if}
        </button>
        <div class="legend-body" hidden={!legendOpen}>
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
        <button type="button" aria-pressed={layers.wind} title={m.map_layer_wind()} onclick={() => toggleLayer('wind')}><Wind size={18} aria-hidden="true" /><span class="chip-label">{m.map_layer_wind()}</span></button>
        <button type="button" aria-pressed={layers.weather} title={m.map_layer_weather()} onclick={() => toggleLayer('weather')}><CloudRain size={18} aria-hidden="true" /><span class="chip-label">{m.map_layer_weather()}</span></button>
        <button type="button" aria-pressed={layers.sea} title={m.map_layer_sea()} onclick={() => toggleLayer('sea')}><Waves size={18} aria-hidden="true" /><span class="chip-label">{m.map_layer_sea()}</span></button>
      </div>
      <div class="playback">
        <button type="button" class="play" onclick={togglePlay} aria-label={playLabel} title={playLabel}>
          {#if playing}<Pause size={20} aria-hidden="true" />{:else}<Play size={20} aria-hidden="true" />{/if}
        </button>
        <label class="time-slider">
          <span>{m.map_time()} · <strong>{formatTime(currentTime)}</strong></span>
          <input type="range" min="0" max={times.length - 1} step="1" style={`--fill: ${sliderFill}%`} bind:value={timeIndex} oninput={() => { progress = 0; }} />
        </label>
      </div>
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
  /* Floating clay toolbar: view mode on the left, camera tools grouped on the right. */
  .map-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 8px; border: 1px solid var(--border); border-radius: 22px; background: linear-gradient(165deg, var(--surface), var(--panel)); box-shadow: 0 4px 0 -2px var(--border), inset 0 2px 1px var(--clay-highlight); }
  .segmented { display: inline-flex; padding: 4px; gap: 4px; border: 1px solid var(--border); border-radius: 17px; background: var(--panel); box-shadow: inset 0 2px 5px var(--shadow); }
  .segmented button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; min-width: 68px; border: 0; border-radius: 13px; background: transparent; color: var(--muted); font-weight: 800; padding: 6px 14px; cursor: pointer; transition: background 160ms, color 160ms, box-shadow 160ms; }
  .segmented button:disabled { opacity: .45; cursor: not-allowed; }
  .segmented button[aria-pressed='true'] { background: linear-gradient(170deg, var(--surface), var(--panel)); color: var(--accent); box-shadow: 0 3px 0 var(--border), inset 0 2px 1px var(--clay-highlight); }
  .map-controls { display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0; }
  .tool-group { display: inline-flex; align-items: center; gap: 4px; padding: 3px; border-radius: 16px; background: var(--panel); box-shadow: inset 0 2px 4px var(--shadow); }
  .divider { align-self: stretch; width: 1px; margin: 6px 0; border-radius: 1px; background: var(--border); }
  .tool { display: inline-grid; grid-auto-flow: column; place-items: center; gap: 8px; min-width: 44px; min-height: 44px; padding: 0 10px; border: 1px solid var(--border); border-radius: 14px; background: linear-gradient(165deg, var(--surface), var(--panel)); color: var(--text); font-weight: 800; font-size: .8rem; cursor: pointer; box-shadow: 0 3px 0 var(--border), inset 0 2px 1px var(--clay-highlight); transition: transform 120ms, box-shadow 120ms, color 160ms; }
  .tool:hover { color: var(--accent); }
  .tool:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--border), inset 0 2px 4px var(--shadow); }
  .tool:focus-visible, .segmented button:focus-visible, .layer-chips button:focus-visible, .play:focus-visible, .legend-toggle:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 2px; }
  .tool.reset { padding: 0 14px; }
  .map-controls output { min-width: 4ch; text-align: center; font: 800 .75rem ui-monospace, monospace; color: var(--muted); }
  .atlas-map { position: relative; min-height: 360px; display: grid; grid-template-columns: minmax(0, 1fr); border-radius: 24px; overflow: hidden; border: 1px solid var(--border, #e2d6c6); background: var(--map-bg, #dce8dd); }
  .atlas-3d { height: clamp(420px, 68vh, 760px); touch-action: none; box-shadow: inset 0 2px 0 #ffffff80, 0 18px 40px -22px #5e4a3466; }
  .atlas-3d :global(canvas.atlas-canvas) { position: absolute; inset: 0; width: 100%; height: 100%; display: block; outline: none; }
  .map-loading { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 10px; font-weight: 800; color: var(--muted, #6c6057); z-index: 2; }
  .spinner { width: 34px; height: 34px; border-radius: 50%; border: 4px solid #ffffff90; border-top-color: var(--accent, #b5532c); animation: spin 900ms linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .map-tooltip { position: absolute; transform: translate(14px, -50%); pointer-events: none; z-index: 3; display: grid; gap: 1px; padding: 8px 12px; border-radius: 14px; background: color-mix(in srgb, var(--surface, #fffaf2) 92%, transparent); box-shadow: 0 10px 24px -10px #00000055; font-size: .82rem; white-space: nowrap; }
  .map-tooltip small { font: 700 .7rem ui-monospace, monospace; opacity: .7; }
  .map-legend { position: absolute; left: 14px; bottom: 14px; z-index: 2; max-width: min(260px, calc(100% - 28px)); padding: 6px 14px 8px; border: 1px solid var(--border); border-radius: 20px; background: color-mix(in srgb, var(--surface) 90%, transparent); backdrop-filter: blur(10px); box-shadow: 0 4px 0 -2px var(--border), 0 14px 28px -16px #00000066, inset 0 1px 0 var(--clay-highlight); font-size: .72rem; color: var(--text); }
  .legend-toggle { display: flex; justify-content: space-between; align-items: center; gap: 22px; min-height: 40px; width: 100%; border: 0; padding: 0; background: transparent; color: inherit; font-size: .76rem; font-weight: 900; cursor: pointer; border-radius: 12px; }
  .legend-heading { display: inline-flex; align-items: center; gap: 8px; color: var(--accent); }
  .legend-body { padding-top: 6px; border-top: 1px dashed var(--border); }
  .legend-title { margin: 0 0 6px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; font-size: .62rem; opacity: .75; }
  .legend-title:not(:first-child) { margin-top: 10px; }
  .group-legend { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 10px; list-style: none; margin: 0; padding: 0; font-weight: 700; }
  .group-legend li { display: flex; align-items: center; gap: 6px; min-width: 0; white-space: nowrap; }
  .group-legend li:nth-child(3) { grid-column: 1 / -1; }
  .swatch { flex: none; width: 12px; height: 12px; border-radius: 4px; background: var(--swatch); box-shadow: inset -1px -2px 2px #00000026, 0 1px 0 #00000022; }
  .wind-ramp { height: 8px; border-radius: 99px; background: linear-gradient(90deg, #ffffff, #bff2e0 30%, #ffdb80 62%, #ff8c6b); box-shadow: inset 0 0 0 1px #00000018; }
  /* Matches the 3D shading: navy deep sea, turquoise shallows, sand shore, green lowland, brown highland, rock and ice. Ticks echo the contour lines. */
  .relief-ramp { height: 8px; border-radius: 99px; box-shadow: inset 0 0 0 1px #00000018; background: repeating-linear-gradient(90deg, transparent 0 11px, #00000030 11px 12px), linear-gradient(90deg, #093866, #1f8fba 30%, #4fd2c6 46%, #e9d7a9 50%, #5b9150 56%, #8ba05a 68%, #8a7a5a 82%, #cfd2d4 94%, #ffffff); }
  .overlay-symbol { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 5px; }
  .overlay-symbol.triangle { border-radius: 0; clip-path: polygon(50% 0, 100% 100%, 0 100%); }
  .overlay-symbol.diamond { border-radius: 0; transform: rotate(45deg); }
  .feature-tooltip { max-width: min(300px, 65vw); white-space: normal; }
  .feature-tooltip small { overflow-wrap: anywhere; }
  .wind-scale { display: flex; justify-content: space-between; margin-top: 3px; font: 700 .62rem ui-monospace, monospace; opacity: .75; }
  /* Bottom dock: layer chips, then play button with the time slider, then the source line. */
  .weather-bar { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 10px 18px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 22px; background: linear-gradient(165deg, var(--surface), var(--panel)); box-shadow: 0 4px 0 -2px var(--border), inset 0 1px 1px var(--clay-highlight); }
  .layer-chips { display: flex; gap: 6px; padding: 4px; border-radius: 17px; background: var(--panel); box-shadow: inset 0 2px 5px var(--shadow); }
  .layer-chips button { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; min-width: 44px; border: 1px solid var(--border); border-radius: 13px; background: var(--surface); color: var(--muted); padding: 4px 13px; font-weight: 800; font-size: .78rem; cursor: pointer; box-shadow: 0 3px 0 var(--border), inset 0 2px 1px var(--clay-highlight); transition: transform 120ms, box-shadow 120ms, color 160ms; }
  .layer-chips button[aria-pressed='true'] { background: var(--mint); color: var(--text); border-color: transparent; box-shadow: inset 0 2px 5px var(--shadow); transform: translateY(2px); }
  .playback { display: flex; align-items: center; gap: 14px; min-width: 0; }
  .play { flex: none; display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; border: 0; background: radial-gradient(circle at 32% 26%, color-mix(in srgb, var(--accent) 70%, #fff), var(--accent)); color: var(--on-accent, #fff); cursor: pointer; box-shadow: 0 4px 0 color-mix(in srgb, var(--accent) 60%, #000), inset 0 2px 2px #ffffff66; transition: transform 120ms, box-shadow 120ms; }
  .play:active { transform: translateY(3px); box-shadow: 0 1px 0 color-mix(in srgb, var(--accent) 60%, #000), inset 0 2px 3px #00000033; }
  .time-slider { display: grid; flex: 1; gap: 6px; min-width: 0; font-size: .78rem; }
  .time-slider input { --track-height: 12px; -webkit-appearance: none; appearance: none; width: 100%; height: 28px; margin: 0; background: transparent; cursor: pointer; }
  .time-slider input::-webkit-slider-runnable-track { height: var(--track-height); border-radius: 99px; border: 1px solid var(--border); background: linear-gradient(90deg, var(--accent) var(--fill, 0%), var(--panel) var(--fill, 0%)); box-shadow: inset 0 2px 4px var(--shadow); }
  .time-slider input::-moz-range-track { height: var(--track-height); border-radius: 99px; border: 1px solid var(--border); background: var(--panel); box-shadow: inset 0 2px 4px var(--shadow); }
  .time-slider input::-moz-range-progress { height: var(--track-height); border-radius: 99px; background: var(--accent); }
  .time-slider input::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 26px; height: 26px; margin-top: calc((var(--track-height) - 26px) / 2 - 1px); border-radius: 50%; border: 2px solid var(--surface); background: radial-gradient(circle at 32% 28%, #fff, var(--surface) 55%, var(--panel)); box-shadow: 0 3px 0 var(--border), 0 5px 10px #00000030; }
  .time-slider input::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--surface); background: radial-gradient(circle at 32% 28%, #fff, var(--surface) 55%, var(--panel)); box-shadow: 0 3px 0 var(--border), 0 5px 10px #00000030; }
  .time-slider input:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 3px; border-radius: 99px; }
  .weather-source { grid-column: 1 / -1; margin: 0; padding-top: 8px; border-top: 1px dashed var(--border); font-size: .7rem; color: var(--muted); }
  .weather-source a { color: var(--accent); font-weight: 800; }
  .map-help { margin: 0; font-size: .74rem; line-height: 1.5; opacity: .8; }
  .map-notice { margin: 0; font-size: .8rem; font-weight: 700; }
  @media (max-width: 1000px) {
    .tool.reset .tool-label { display: none; }
    .tool.reset { padding: 0 10px; }
  }
  /* Phones: icon-only controls. The text stays in the accessibility tree through the aria-labels and clipped labels. */
  @media (max-width: 700px) {
    .atlas-3d { height: 440px; min-height: 360px; border-radius: 20px; }
    .map-legend { left: 8px; bottom: 8px; padding: 4px 10px 6px; }
    .group-legend { grid-template-columns: 1fr 1fr; font-size: .65rem; }
    .map-toolbar { flex-direction: column; align-items: stretch; gap: 8px; padding: 8px; border-radius: 20px; }
    .segmented { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .segmented button { min-width: 0; padding: 6px 8px; }
    .map-controls { display: grid; grid-template-columns: auto auto auto; justify-content: space-between; gap: 6px; width: 100%; }
    .divider { display: none; }
    .tool-group { gap: 2px; }
    .tool { min-width: 44px; padding: 0 8px; }
    .map-controls output { min-width: 3.4ch; font-size: .7rem; }
    .weather-bar { grid-template-columns: minmax(0, 1fr); gap: 10px; padding: 10px; border-radius: 20px; }
    .layer-chips { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .layer-chips button { padding: 4px; }
    .chip-label { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .playback { gap: 10px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner { animation: none; }
    .segmented button, .tool, .layer-chips button, .play { transition: none; }
  }
</style>
