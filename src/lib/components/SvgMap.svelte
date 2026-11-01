<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { fadeHistoryLabel } from '$lib/map/history-label-transition';
  import { m } from '$lib/i18n/messages';
  import { base } from '$app/paths';
  import { activeHistoricalTerritories, territoryPath, type HistoricalTerritoryCollection } from '$lib/map/history-territories';
  import HistoryMapReadout from './HistoryMapReadout.svelte';
  import { localizedHistoryName } from '$lib/data/history-summary';
  import type { GeometryPackage } from '$lib/geo/types';
  import { ISLAND_GROUP_COLORS, islandGroupOf } from '$lib/atlas/islands';
  import { projectLonLat } from '$lib/map/projection';
  import { visibleMountainPins } from '$lib/map/mountain-density';
  import type { PointOverlay, MapPin } from '$lib/map/overlays';
  import { mountainColor, type PinSymbol } from '$lib/map/overlay-contract';
  import type { RegionHeatmap } from '$lib/map/heatmap';
  import { BATUJAYA_SITE, historyPolityColor, historyMarkerActive, type HistoryZoneMarker } from '$lib/map/history-map';
  import IndonesiaFlag from './IndonesiaFlag.svelte';
  import { CLAY_PIN_VIEWBOX, clayPinInner, clayPinKey } from '$lib/map/clay-pin';

  let { geometry, label, selectedCode, onselect, onpin, onzoom, overlay, projection, heatmap, historyZones, historyYear = 682, historyFocusId, onhistoryselect }: {
    geometry: GeometryPackage; label: string; selectedCode?: string; onselect: (code: string) => void; onpin?: (pin: MapPin) => void; onzoom?: (scale: number) => void;
    overlay?: PointOverlay; projection?: GeometryPackage['projection']; heatmap?: RegionHeatmap; historyZones?: HistoryZoneMarker[]; historyYear?: number; historyFocusId?: string; onhistoryselect?: (id: string) => void;
  } = $props();

  let reducedMotion = $state(false);
  const historyFadeDuration = $derived.by(() => {
    if (reducedMotion) return 0;
    return 420;
  });
  const activeHistoryIds = $derived(new Set((historyZones ?? []).filter(zone => historyMarkerActive(zone, historyYear)).map(zone => zone.id)));
  const symbolsId = $props.id();
  onMount(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotionPreference = () => { reducedMotion = preference.matches; };
    syncMotionPreference();
    preference.addEventListener('change', syncMotionPreference);
    return () => preference.removeEventListener('change', syncMotionPreference);
  });

  let territories = $state<HistoricalTerritoryCollection>();
  let territoriesRequested = false;
  let territoriesFailed = $state(false);
  $effect(() => {
    if (!historyZones || territoriesRequested) return;
    territoriesRequested = true;
    fetch(`${base}/data/history-territories-render.geojson`)
      .then(response => {
        if (!response.ok) throw new Error(`Historical territories: HTTP ${response.status}`);
        return response.json();
      })
      .then(data => { territories = data; })
      .catch(error => { territoriesFailed = true; console.warn('Historical territory data unavailable', error); });
  });

  const MAX_SCALE = 8;
  /** The contact shadow of a clay marker sits at this fraction of its height, so it lands on the true location. */
  const CONTACT_Y = 53 / CLAY_PIN_VIEWBOX;
  let scale = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let svgElement = $state<SVGSVGElement>();
  let previousGeometry: GeometryPackage | undefined;
  $effect(() => { if (geometry !== previousGeometry) { previousGeometry = geometry; reset(); } });

  const box = $derived(geometry.viewBox.split(' ').map(Number));
  const visiblePins = $derived.by(() => {
    if (overlay?.id !== 'mountains') return overlay?.pins ?? [];
    let scope: 'national' | 'province' = 'national';
    if (geometry.level === 'city-regency') scope = 'province';
    return visibleMountainPins(overlay.pins, scale, scope);
  });
  /** Side of one clay marker in map units; the shape fills about two thirds of it. */
  const pinSize = $derived(box[2] * 0.03);
  const historicalMarkers = $derived.by(() => {
    if (!historyZones || !projection) return [];
    return historyZones.filter(zone => historyMarkerActive(zone, historyYear) && zone.confidence !== 'contested-influence').map(zone => {
      const point = projectLonLat(projection, zone.lon, zone.lat);
      return { polityId: zone.id, name: zone.name, x: point.x, y: point.y, color: historyPolityColor(zone.id) };
    });
  });
  const historyCentres = $derived.by(() => {
    const centres = new Map<string, (typeof historicalMarkers)[number]>();
    for (const mark of historicalMarkers) {
      if (!centres.has(mark.polityId)) centres.set(mark.polityId, mark);
    }
    return [...centres.values()];
  });
  /** The focused name wins when labels overlap; all centre markers remain visible. */
  const historyLabels = $derived.by(() => {
    const minDx = box[2] * 0.05;
    const minDy = box[2] * 0.014;
    const candidates = historyCentres.map(mark => ({ ...mark, centreX: mark.x })).sort((a, b) =>
      Number(b.polityId === historyFocusId) - Number(a.polityId === historyFocusId));
    const placed: typeof candidates = [];
    // Keep the centred text inside the viewBox: a label is about 0.1 of the map wide.
    const edge = box[2] * 0.07;
    for (const candidate of candidates) {
      const x = Math.min(box[0] + box[2] - edge, Math.max(box[0] + edge, candidate.x));
      const mark = { ...candidate, x };
      const crowded = placed.some(other => Math.abs(other.x - mark.x) < minDx && Math.abs(other.y - mark.y) < minDy);
      if (!crowded) placed.push(mark);
    }
    return placed;
  });
  function historyPolityIsActive(id: string): boolean {
    return activeHistoryIds.has(id);
  }
  function historyMarkerTabIndex(id: string): number {
    if (historyPolityIsActive(id)) return 0;
    return -1;
  }
  function activateHistoryPolity(id: string) {
    if (!historyPolityIsActive(id)) return;
    onhistoryselect?.(id);
  }
  function territoryFill(id: string): string {
    if (id === 'indonesia') return `url(#history-indonesia-gradient-${symbolsId})`;
    return historyPolityColor(id);
  }
  const historicalTerritories = $derived.by(() => {
    if (!projection || !historyZones) return [];
    const active = new Map(historyZones.map(zone => [zone.id, zone]));
    const activeDates = new Map(historyZones.map(zone => [zone.id, zone.polity]));
    return activeHistoricalTerritories(territories, activeDates, historyYear).map(feature => {
      const zone = active.get(feature.properties.id)!;
      const path = territoryPath(feature, projection);
      return { id: zone.id, name: zone.name, color: historyPolityColor(zone.id), fill: territoryFill(zone.id), role: feature.properties.render_role, path, key: `${zone.id}:${path}` };
    });
  });
  const historyContextPaths = $derived.by(() => {
    if (!historyZones || !projection) return [];
    return (territories?.context_land?.features ?? []).map(feature => ({ id: feature.properties.id, name: feature.properties.name, path: territoryPath(feature, projection) }));
  });
  const focusedPolity = $derived(historyZones?.find(zone => zone.id === historyFocusId && historyMarkerActive(zone, historyYear))?.polity);
  interface PinKind { id: string; symbol: PinSymbol; color: string }
  function kindOf(pin: MapPin): { symbol: PinSymbol; color: string } {
    return { symbol: pin.symbol ?? overlay?.symbol ?? 'circle', color: pin.color ?? mountainColor(pin) ?? overlay?.color ?? '#8a7f78' };
  }
  function kindId(symbol: PinSymbol, color: string): string {
    return 'clay-' + symbolsId + '-' + clayPinKey(symbol, color).replace(/[^a-z0-9]/gi, '-');
  }
  function pinKind(pin: MapPin): PinKind {
    const { symbol, color } = kindOf(pin);
    return { id: kindId(symbol, color), symbol, color };
  }
  /** One drawing per distinct symbol and colour, referenced by every matching pin. */
  const pinKinds = $derived.by(() => {
    const kinds = new Map<string, PinKind>();
    for (const pin of visiblePins) {
      const kind = pinKind(pin);
      kinds.set(kind.id, kind);
    }
    return [...kinds.values()];
  });
  const centerX = $derived(box[0] + box[2] / 2);
  const centerY = $derived(box[1] + box[3] / 2);

  /** Report the zoom so the shared map toolbar can show it and disable its limits. */
  $effect(() => { onzoom?.(scale); });

  export function reset() { scale = 1; panX = 0; panY = 0; }
  export function zoom(factor: number) { scale = Math.min(MAX_SCALE, Math.max(1, scale * factor)); if (scale === 1) { panX = 0; panY = 0; } }
  function fill(code: string): string {
    const heat = heatmap?.colors[code];
    if (heat) return `--fill-light: ${heat}; --fill-dark: ${heat}`;
    const tones = ISLAND_GROUP_COLORS[islandGroupOf(code)];
    return `--fill-light: ${tones.light[0]}; --fill-dark: ${tones.dark[0]}`;
  }

  function interaction(node: HTMLDivElement) {
    const pointers = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let touchCode: string | undefined;
    let touchPin: string | undefined;
    let touchHistory: string | undefined;
    let suppressClickUntil = 0;
    let multiTouch = false;
    let tapTimer: ReturnType<typeof setTimeout> | undefined;
    let lastTap: { x: number; y: number; time: number } | undefined;
    function clearTap() { clearTimeout(tapTimer); tapTimer = undefined; lastTap = undefined; }
    function coordinates(event: PointerEvent) { return { x: event.clientX, y: event.clientY }; }
    function mapPoint(point: { x: number; y: number }) {
      const matrix = svgElement?.getScreenCTM();
      if (!matrix) return undefined;
      return new DOMPoint(point.x, point.y).matrixTransform(matrix.inverse());
    }
    function midpoint(points: Array<{ x: number; y: number }>) {
      return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    }
    function pinch(before: Array<{ x: number; y: number }>, after: Array<{ x: number; y: number }>) {
      const oldDistance = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y);
      if (oldDistance <= 0) return;
      const newDistance = Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y);
      const oldCenter = mapPoint(midpoint(before));
      const newCenter = mapPoint(midpoint(after));
      if (!oldCenter || !newCenter) return;
      zoomAt(newDistance / oldDistance, oldCenter, newCenter);
    }
    function zoomAt(factor: number, oldCenter: { x: number; y: number }, newCenter = oldCenter) {
      const oldScale = scale;
      scale = Math.min(MAX_SCALE, Math.max(1, scale * factor));
      const ratio = scale / oldScale;
      panX = newCenter.x - centerX - (oldCenter.x - centerX - panX) * ratio;
      panY = newCenter.y - centerY - (oldCenter.y - centerY - panY) * ratio;
    }
    function tap(event: PointerEvent) {
      const now = performance.now();
      if (lastTap && now - lastTap.time <= 280 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 24) {
        clearTap();
        const focus = mapPoint(coordinates(event));
        if (focus) zoomAt(1.5, focus);
        return;
      }
      clearTimeout(tapTimer);
      const code = touchCode;
      const pinId = touchPin;
      const historyId = touchHistory;
      lastTap = { ...coordinates(event), time: now };
      tapTimer = setTimeout(() => {
        lastTap = undefined;
        if (historyId) onhistoryselect?.(historyId);
        else if (pinId) { const pin = overlay?.pins.find(item => item.id === pinId); if (pin) onpin?.(pin); }
        else if (code) onselect(code);
      }, 280);
    }
    function down(event: PointerEvent) {
      if ((event.target as Element).closest('button, .history-readout')) return;
      if (pointers.size === 0) { moved = 0; multiTouch = false; }
      pointers.set(event.pointerId, coordinates(event));
      if (pointers.size > 1) { multiTouch = true; clearTap(); }
      if (event.pointerType === 'touch') {
        node.setPointerCapture(event.pointerId);
        touchCode = undefined;
        if (!historyZones) touchCode = (event.target as Element).closest('[data-code]')?.getAttribute('data-code') ?? undefined;
        touchPin = (event.target as Element).closest('[data-pin-id]')?.getAttribute('data-pin-id') ?? undefined;
        touchHistory = (event.target as Element).closest('[data-history-id]')?.getAttribute('data-history-id') ?? undefined;
      }
    }
    function move(event: PointerEvent) {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const before = [...pointers.values()];
      const point = coordinates(event);
      pointers.set(event.pointerId, point);
      moved += Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
      if (moved < 5) return;
      clearTap();
      node.setPointerCapture(event.pointerId);
      if (pointers.size === 2) {
        pinch(before, [...pointers.values()]);
      } else if (pointers.size === 1) {
        const oldPoint = mapPoint(previous);
        const newPoint = mapPoint(point);
        if (!oldPoint || !newPoint) return;
        panX += newPoint.x - oldPoint.x;
        panY += newPoint.y - oldPoint.y;
      }
      panX = Math.max(-box[2] * scale, Math.min(box[2] * scale, panX));
      panY = Math.max(-box[3] * scale, Math.min(box[3] * scale, panY));
    }
    function up(event: PointerEvent) {
      if (!pointers.has(event.pointerId)) return;
      if (moved > 5 || event.pointerType === 'touch') suppressClickUntil = performance.now() + 300;
      if (event.pointerType === 'touch' && !multiTouch && moved < 5 && pointers.size === 1) tap(event);
      touchPin = undefined;
      touchHistory = undefined;
      pointers.delete(event.pointerId);
      if (pointers.size === 0) multiTouch = false;
      if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
    }
    function cancel(event: PointerEvent) {
      clearTap();
      pointers.delete(event.pointerId);
      touchCode = undefined;
      touchPin = undefined;
      touchHistory = undefined;
      if (pointers.size === 0) multiTouch = false;
    }
    function click(event: MouseEvent) { if (performance.now() < suppressClickUntil) { event.stopPropagation(); event.preventDefault(); } }
    function wheel(event: WheelEvent) {
      if ((event.target as Element).closest('.history-readout')) return;
      event.preventDefault();
      zoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.004));
    }
    node.addEventListener('wheel', wheel, { passive: false });
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('click', click, true);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return { destroy() {
      clearTap();
      node.removeEventListener('wheel', wheel); node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move); node.removeEventListener('click', click, true);
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel);
    } };
  }
</script>

<div class="atlas-map interactive" class:historical={Boolean(historyZones)} use:interaction>
  <svg bind:this={svgElement} viewBox={geometry.viewBox} preserveAspectRatio="xMidYMid meet" aria-label={label} role="group">
    <g transform={`translate(${centerX + panX} ${centerY + panY}) scale(${scale}) translate(${-centerX} ${-centerY})`}>
      <g class="region-depth" transform={`translate(0 ${box[3] * 0.012})`} aria-hidden="true">
        {#each geometry.regions as region (region.id)}<path d={region.path} />{/each}
      </g>
      {#if overlay && projection}
        <defs>
          {#each pinKinds as kind (kind.id)}
            <symbol id={kind.id} viewBox={`0 0 ${CLAY_PIN_VIEWBOX} ${CLAY_PIN_VIEWBOX}`} overflow="visible">{@html clayPinInner(kind.symbol, kind.color, kind.id)}</symbol>
          {/each}
        </defs>
      {/if}
      {#if historyZones}
        <defs>
          <linearGradient id={'history-indonesia-gradient-' + symbolsId} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox" spreadMethod="pad">
              <stop offset="0%" stop-color="#FF0000" /><stop offset="50%" stop-color="#FF0000" />
              <stop offset="50%" stop-color="#FFFFFF" /><stop offset="100%" stop-color="#FFFFFF" />
          </linearGradient>
        </defs>
      {/if}
      {#each geometry.regions as region (region.id)}
        {#if historyZones}
          <path d={region.path} data-code={region.sourceCode} aria-hidden="true" />
        {:else}
          <path d={region.path} data-code={region.sourceCode} class:selected={selectedCode === region.sourceCode} style={fill(region.sourceCode)}
            role="button" tabindex="0" aria-label={region.name + ' · ' + (heatmap?.valueText[region.sourceCode] ?? region.sourceCode)}
            onclick={() => onselect(region.sourceCode)}
            onkeydown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onselect(region.sourceCode); } }}>
            <title>{region.name}{#if heatmap?.valueText[region.sourceCode]} · {heatmap.valueText[region.sourceCode]}{/if}</title>
          </path>
        {/if}
      {/each}
      {#if historyZones}
        <g aria-hidden="true">{#each historyContextPaths as context (context.id)}<path class="history-context-land" d={context.path}><title>{context.name}</title></path>{/each}</g>
        <!-- Display geometry is already intersected with the exact land mask at build time. -->
        <g class="history-territories">
          {#each historicalTerritories as territory (territory.key)}
            <path class="history-territory" class:focused={territory.id === historyFocusId} class:indonesia={territory.id === 'indonesia'} class:declaration-claim={territory.role === 'declared_claim_reference_not_effective_control'} transition:fade={{ duration: historyFadeDuration }} data-history-id={territory.id} d={territory.path}
              style={`--territory-color:${territory.color};--territory-fill:${territory.fill}`} fill-rule="evenodd" role="button"
              tabindex={historyMarkerTabIndex(territory.id)} aria-hidden={!historyPolityIsActive(territory.id)} aria-disabled={!historyPolityIsActive(territory.id)} aria-label={localizedHistoryName(territory.id, territory.name)} aria-pressed={territory.id === historyFocusId}
              onclick={() => activateHistoryPolity(territory.id)}
              onkeydown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activateHistoryPolity(territory.id); } }}><title>{localizedHistoryName(territory.id, territory.name)}</title></path>
          {/each}
        </g>
        <g class="history-labels">
          {#each historyCentres as mark (mark.polityId)}
            <g class="history-label-button" data-history-id={mark.polityId} role="button" tabindex={historyMarkerTabIndex(mark.polityId)} aria-hidden={!historyPolityIsActive(mark.polityId)} aria-disabled={!historyPolityIsActive(mark.polityId)} aria-label={localizedHistoryName(mark.polityId, mark.name)} aria-pressed={mark.polityId === historyFocusId}
              out:fadeHistoryLabel={{ duration: historyFadeDuration }}
              onclick={() => activateHistoryPolity(mark.polityId)}
              onkeydown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activateHistoryPolity(mark.polityId); } }}>
              <title>{localizedHistoryName(mark.polityId, mark.name)}</title>
              {#if mark.polityId === 'indonesia'}
                {@const flagWidth = box[2] * 0.015}
                <IndonesiaFlag x={mark.x - flagWidth / 2} y={mark.y - flagWidth * 2 / 3 - 2} width={flagWidth} decorative />
              {:else}
                <path d={`M${mark.x},${mark.y} v-8 m0,0 h6 l-1.5,2.2 l1.5,2.2 h-6`} fill={mark.color} stroke="#fff" stroke-width="0.7" vector-effect="non-scaling-stroke" />
              {/if}
            </g>
          {/each}
          {#each historyLabels as mark (mark.polityId)}
            <g class="history-label-button" data-history-id={mark.polityId} role="button" tabindex={historyMarkerTabIndex(mark.polityId)} aria-hidden={!historyPolityIsActive(mark.polityId)} aria-disabled={!historyPolityIsActive(mark.polityId)} aria-label={localizedHistoryName(mark.polityId, mark.name)} aria-pressed={mark.polityId === historyFocusId}
              out:fadeHistoryLabel={{ duration: historyFadeDuration }}
              onclick={() => activateHistoryPolity(mark.polityId)}
              onkeydown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activateHistoryPolity(mark.polityId); } }}>
              <title>{localizedHistoryName(mark.polityId, mark.name)}</title>
              <text class="history-label" class:focused={mark.polityId === historyFocusId} x={mark.x} y={mark.y + 3} text-anchor="middle" font-size={box[2] * 0.0105}>{localizedHistoryName(mark.polityId, mark.name).replace(/\s*\(.*\)$/, '')}</text>
            </g>
          {/each}
        </g>
      {/if}
      {#if historyZones && projection && historyYear >= BATUJAYA_SITE.from && historyYear <= BATUJAYA_SITE.to}
        {@const site = projectLonLat(projection, BATUJAYA_SITE.lon, BATUJAYA_SITE.lat)}
        <a href={BATUJAYA_SITE.source} target="_blank" rel="noreferrer" aria-label={m.history_event_bce400()}>
          <title>{m.history_event_bce400()}</title>
          <path d={`M${site.x},${site.y - 5} l5,5 -5,5 -5,-5 z`} fill="#635b78" stroke="white" stroke-width="1.2" />
          <text class="history-label" x={site.x + 8} y={site.y} font-size={box[2] * 0.0105}>{BATUJAYA_SITE.name}</text>
        </a>
      {/if}
      {#if overlay && projection}
        {#each visiblePins as pin (pin.id)}
          {@const point = projectLonLat(projection, pin.lon, pin.lat)}
          {@const kind = pinKind(pin)}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex (SVG pin is keyboard-operable when a handler is provided) -->
          <g class="overlay-pin" class:epicentre={overlay.id === 'earthquake'} role={onpin ? 'button' : 'img'} tabindex={onpin ? 0 : undefined}
            data-pin-id={pin.id} data-code={pin.provinceCode} aria-label={pin.label} onclick={() => onpin?.(pin)}
            onkeydown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onpin?.(pin); } }}>
            <title>{pin.label}</title>
            <use href={'#' + kind.id} x={point.x - pinSize / 2} y={point.y - pinSize * CONTACT_Y} width={pinSize} height={pinSize} />
          </g>
        {/each}
      {/if}
    </g>
  </svg>
  {#if focusedPolity}<HistoryMapReadout polity={focusedPolity} />{/if}
</div>
<p class="map-help">{m.map_help()}{#if historyZones} · <a href="https://github.com/Seshat-Global-History-Databank/cliopatria" target="_blank" rel="noreferrer">Cliopatria, Bennett et al. ({m.history_adapted()})</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>{#if territoriesFailed} · {m.data_unavailable()}{/if}{/if}</p>

<style>
  .atlas-map { height: var(--map-viewport-height, clamp(280px, 52svh, 520px)); min-width: 0; display: block; background: linear-gradient(180deg, var(--green-wash), var(--map-bg)); border: 1px solid var(--border); border-radius: 24px; overflow: hidden; }
  .interactive { position:relative; touch-action: none; cursor: grab; }
  .atlas-map.historical { background:#a9cdd5 !important; }
  .historical path[data-code] { fill:#f0ece6;stroke:#d0c4ce;cursor:default; }
  .historical .region-depth { display:none; }
  :global(:root[data-theme='dark']) .atlas-map.historical { background:#203941 !important; }
  :global(:root[data-theme='dark']) .historical path[data-code] { fill:#41464a;stroke:#65636a; }
  .interactive:active { cursor: grabbing; }
  svg { display: block; width: 100%; height: 100%; }
  path { fill: var(--fill-light, #91b89b); stroke: var(--surface); stroke-width: .5; vector-effect: non-scaling-stroke; cursor: pointer; transition: filter 160ms; }
  .region-depth { pointer-events: none; }
  .region-depth path { fill: #00000030; stroke: none; cursor: default; }
  :global(:root[data-theme='dark']) path:not(.selected) { fill: var(--fill-dark, #91b89b); }
  path[role='button']:hover, path[role='button']:focus { filter: brightness(1.08) saturate(1.2); outline: none; }
  path.selected { fill: var(--accent); stroke: var(--surface); stroke-width: 1.3; }
  .history-territory, :global(:root[data-theme='dark']) .history-territory:not(.selected) { fill:var(--territory-fill, var(--territory-color));fill-opacity:.34;stroke:var(--text);stroke-width:3.2;stroke-linejoin:round;paint-order:stroke fill;vector-effect:non-scaling-stroke;cursor:pointer;transition:fill-opacity 260ms ease,stroke-width 260ms ease; }
  .history-territory:hover,.history-territory.focused,.history-territory:focus-visible {fill-opacity:.58;stroke-width:4.4;filter:none;}
  .history-territory:focus-visible {outline:3px solid var(--accent);outline-offset:2px;}
  .history-territory.indonesia,:global(:root[data-theme='dark']) .history-territory.indonesia { fill:var(--territory-fill);fill-opacity:.96;stroke:#b9162c;stroke-width:4; }
  .history-territory.declaration-claim,:global(:root[data-theme='dark']) .history-territory.declaration-claim{fill-opacity:.2;stroke-dasharray:5 4}
  .history-context-land,:global(:root[data-theme='dark']) .history-context-land:not(.selected){fill:var(--panel);stroke:var(--border);cursor:default;pointer-events:none}
  .history-label-button { cursor:pointer; }
  .history-label-button[aria-hidden='true'] { pointer-events:none; cursor:default; }
  .history-label-button:focus-visible .history-label { stroke:var(--accent); stroke-width:5px; }
  .history-label { fill:#2b2420; stroke:#fffaf2; stroke-width:3px; paint-order:stroke; stroke-linejoin:round; font-weight:700; opacity:.85; }
  .history-label.focused { font-weight:900; opacity:1; }
  :global(:root[data-theme='dark']) .history-label { fill:#f4ede4; stroke:#1d1916; }
  .overlay-pin { cursor:pointer; }
  .overlay-pin use { transition: filter 140ms; }
  .overlay-pin:hover use, .overlay-pin:focus use { filter: brightness(1.12) drop-shadow(0 0 4px #ffffffcc); }
  .overlay-pin:focus { outline:none; }
  .overlay-pin[role='button'] { cursor: pointer; }
  .overlay-pin[role='button']:focus-visible { outline: 3px solid var(--accent); }
  .map-help { margin: 0; font-size: .74rem; line-height: 1.5; opacity: .8; }
   @media (prefers-reduced-motion: reduce) { path,.history-territory { transition: none; animation:none; } }
</style>
