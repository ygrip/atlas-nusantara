<script lang="ts">
  import { m } from '$lib/i18n/messages';
  import type { GeometryPackage } from '$lib/geo/types';
  import { ISLAND_GROUP_COLORS, islandGroupOf } from '$lib/atlas/islands';
  import { projectLonLat } from '$lib/map/geometry';
  import { visibleMountainPins } from '$lib/map/mountain-density';
  import type { PointOverlay, MapPin } from '$lib/map/overlays';
  import { mountainColor, type PinSymbol } from '$lib/map/overlay-contract';
  import type { RegionHeatmap } from '$lib/map/heatmap';
  import { CLAY_PIN_VIEWBOX, clayPinInner, clayPinKey } from '$lib/map/clay-pin';

  let { geometry, label, selectedCode, onselect, onpin, onzoom, overlay, projection, heatmap }: {
    geometry: GeometryPackage; label: string; selectedCode?: string; onselect: (code: string) => void; onpin?: (pin: MapPin) => void; onzoom?: (scale: number) => void;
    overlay?: PointOverlay; projection?: GeometryPackage['projection']; heatmap?: RegionHeatmap;
  } = $props();

  const MAX_SCALE = 8;
  /** The contact shadow of a clay marker sits at this fraction of its height, so it lands on the true location. */
  const CONTACT_Y = 53 / CLAY_PIN_VIEWBOX;
  let scale = $state(1);
  let panX = $state(0);
  let panY = $state(0);
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
  const symbolsId = $props.id();
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
    let suppressClickUntil = 0;
    function coordinates(event: PointerEvent) { return { x: event.clientX, y: event.clientY }; }
    function down(event: PointerEvent) {
      if ((event.target as Element).closest('button')) return;
      pointers.set(event.pointerId, coordinates(event)); moved = 0;
      if (event.pointerType === 'touch') {
        touchCode = (event.target as Element).closest('[data-code]')?.getAttribute('data-code') ?? undefined;
        touchPin = (event.target as Element).closest('[data-pin-id]')?.getAttribute('data-pin-id') ?? undefined;
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
      node.setPointerCapture(event.pointerId);
      const bounds = node.getBoundingClientRect();
      const ratio = box[2] / bounds.width;
      if (pointers.size === 2) {
        const after = [...pointers.values()];
        const oldDistance = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y);
        const newDistance = Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y);
        if (oldDistance > 0) zoom(newDistance / oldDistance);
      }
      panX = Math.max(-box[2] * scale, Math.min(box[2] * scale, panX + (point.x - previous.x) * ratio));
      panY = Math.max(-box[3] * scale, Math.min(box[3] * scale, panY + (point.y - previous.y) * ratio));
    }
    function up(event: PointerEvent) {
      if (!pointers.has(event.pointerId)) return;
      if (moved > 5 || event.pointerType === 'touch') suppressClickUntil = performance.now() + 300;
      if (event.pointerType === 'touch' && moved < 5 && pointers.size === 1) {
        if (touchPin) { const hit = overlay?.pins.find(pin => pin.id === touchPin); if (hit) onpin?.(hit); }
        else if (touchCode) onselect(touchCode);
      }
      touchPin = undefined;
      pointers.delete(event.pointerId);
      if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
    }
    function cancel(event: PointerEvent) { pointers.delete(event.pointerId); touchCode = undefined; touchPin = undefined; }
    function click(event: MouseEvent) { if (performance.now() < suppressClickUntil) { event.stopPropagation(); event.preventDefault(); } }
    function wheel(event: WheelEvent) {
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
      node.removeEventListener('wheel', wheel); node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move); node.removeEventListener('click', click, true);
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel);
    } };
  }
</script>

<div class="atlas-map interactive" use:interaction>
  <svg viewBox={geometry.viewBox} aria-label={label} role="group">
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
      {#each geometry.regions as region (region.id)}
        <path d={region.path} data-code={region.sourceCode} class:selected={selectedCode === region.sourceCode} style={fill(region.sourceCode)}
          role="button" tabindex="0" aria-label={region.name + ' · ' + (heatmap?.valueText[region.sourceCode] ?? region.sourceCode)}
          onclick={() => onselect(region.sourceCode)}
          onkeydown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onselect(region.sourceCode); } }}>
          <title>{region.name}{#if heatmap?.valueText[region.sourceCode]} · {heatmap.valueText[region.sourceCode]}{/if}</title>
        </path>
      {/each}
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
</div>
<p class="map-help">{m.map_help()}</p>

<style>
  .atlas-map { min-height: 360px; display: grid; grid-template-columns: minmax(0, 1fr); place-items: center; background: linear-gradient(180deg, var(--green-wash), var(--map-bg)); border: 1px solid var(--border); border-radius: 24px; overflow: hidden; }
  .interactive { touch-action: none; cursor: grab; }
  .interactive:active { cursor: grabbing; }
  svg { width: 100%; height: auto; }
  path { fill: var(--fill-light, #91b89b); stroke: var(--surface); stroke-width: .5; vector-effect: non-scaling-stroke; cursor: pointer; transition: filter 160ms; }
  .region-depth { pointer-events: none; }
  .region-depth path { fill: #00000030; stroke: none; cursor: default; }
  :global(:root[data-theme='dark']) path:not(.selected) { fill: var(--fill-dark, #91b89b); }
  path:hover, path:focus { filter: brightness(1.08) saturate(1.2); outline: none; }
  path.selected { fill: var(--accent); stroke: var(--surface); stroke-width: 1.3; }
  .overlay-pin { cursor:pointer; }
  .overlay-pin use { transition: filter 140ms; }
  .overlay-pin:hover use, .overlay-pin:focus use { filter: brightness(1.12) drop-shadow(0 0 4px #ffffffcc); }
  .overlay-pin:focus { outline:none; }
  .overlay-pin[role='button'] { cursor: pointer; }
  .overlay-pin[role='button']:focus-visible { outline: 3px solid var(--accent); }
  .map-help { margin: 0; font-size: .74rem; line-height: 1.5; opacity: .8; }
  @media (prefers-reduced-motion: reduce) { path { transition: none; } }
</style>
