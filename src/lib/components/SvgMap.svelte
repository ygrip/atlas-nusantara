<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import type { GeometryPackage } from '$lib/geo/types';
  import { ISLAND_GROUP_COLORS, islandGroupOf } from '$lib/atlas/islands';
  import { projectLonLat } from '$lib/map/geometry';
  import { visibleMountainPins } from '$lib/map/mountain-density';
  import type { PointOverlay, MapPin } from '$lib/map/overlays';

  let { geometry, label, selectedCode, onselect, onpin, overlay, projection }: {
    geometry: GeometryPackage; label: string; selectedCode?: string; onselect: (code: string) => void; onpin?: (pin: MapPin) => void;
    overlay?: PointOverlay; projection?: GeometryPackage['projection'];
  } = $props();

  let scale = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let previousGeometry: GeometryPackage | undefined;
  $effect(() => { if (geometry !== previousGeometry) { previousGeometry = geometry; reset(); } });

  const box = $derived(geometry.viewBox.split(' ').map(Number));
  const visiblePins = $derived(overlay?.id === 'mountains' ? visibleMountainPins(overlay.pins, scale) : overlay?.pins ?? []);
  const centerX = $derived(box[0] + box[2] / 2);
  const centerY = $derived(box[1] + box[3] / 2);

  function reset() { scale = 1; panX = 0; panY = 0; }
  function zoom(factor: number) { scale = Math.min(8, Math.max(1, scale * factor)); if (scale === 1) { panX = 0; panY = 0; } }
  function fill(code: string): string { return ISLAND_GROUP_COLORS[islandGroupOf(code)].light[0]; }

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
        touchCode = (event.target as Element).getAttribute('data-code') ?? undefined;
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

<div class="map-controls" role="group" aria-label={m.zoom_reset()}>
  <button type="button" onclick={() => zoom(1.3)} disabled={scale >= 8} aria-label={m.zoom_in()}>+</button>
  <button type="button" onclick={() => zoom(1 / 1.3)} disabled={scale <= 1} aria-label={m.zoom_out()}>−</button>
  <button type="button" onclick={reset}>{m.zoom_reset()}</button>
  <output aria-live="polite">{scale.toFixed(1)}×</output>
</div>
<div class="atlas-map interactive" use:interaction>
  <svg viewBox={geometry.viewBox} aria-label={label} role="group">
    <g transform={`translate(${centerX + panX} ${centerY + panY}) scale(${scale}) translate(${-centerX} ${-centerY})`}>
      <g class="region-depth" transform={`translate(0 ${box[3] * 0.012})`} aria-hidden="true">
        {#each geometry.regions as region (region.id)}<path d={region.path} />{/each}
      </g>
      {#each geometry.regions as region (region.id)}
        <path d={region.path} data-code={region.sourceCode} class:selected={selectedCode === region.sourceCode} style={`--fill: ${fill(region.sourceCode)}`}
          role="button" tabindex="0" aria-label={region.name + ' · ' + region.sourceCode}
          onclick={() => onselect(region.sourceCode)}
          onkeydown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onselect(region.sourceCode); } }}>
          <title>{region.name}</title>
        </path>
      {/each}
      {#if overlay && projection}
        {#each visiblePins as pin (pin.id)}
          {@const point = projectLonLat(projection, pin.lon, pin.lat)}
          {@const radius = box[2] * 0.004}
          {@const tint = pin.category === 'active' ? '#ca5a48' : pin.category === 'potential' ? '#c99245' : overlay.color}
          <g class="overlay-pin" class:epicentre={overlay.id === 'earthquake'} role={onpin ? 'button' : 'img'} tabindex={onpin ? 0 : undefined}
            data-pin-id={pin.id} aria-label={pin.label} onclick={() => onpin?.(pin)}
            onkeydown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onpin?.(pin); } }}>
            <title>{pin.label} · {pin.description ?? ''}</title>
            {#if overlay.symbol === 'circle'}
              <circle cx={point.x} cy={point.y} r={radius} fill={tint} />
            {:else if overlay.symbol === 'triangle'}
              <polygon points={`${point.x},${point.y - radius} ${point.x + radius},${point.y + radius} ${point.x - radius},${point.y + radius}`} fill={tint} />
            {:else}
              <polygon points={`${point.x},${point.y - radius} ${point.x + radius},${point.y} ${point.x},${point.y + radius} ${point.x - radius},${point.y}`} fill={tint} />
            {/if}
          </g>
        {/each}
      {/if}
    </g>
  </svg>
</div>
<p class="map-help">{m.map_help()}</p>

<style>
  .map-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .map-controls button { min-width: 40px; min-height: 36px; border: 1px solid var(--border, #e2d6c6); border-radius: 12px; background: var(--surface, #fffaf2); color: inherit; padding: 6px 12px; font-weight: 800; box-shadow: 0 3px 0 var(--border, #e2d6c6); }
  .map-controls output { margin-left: auto; font: 800 .75rem ui-monospace, monospace; }
  .atlas-map { min-height: 360px; display: grid; grid-template-columns: minmax(0, 1fr); place-items: center; background: linear-gradient(180deg, #bfe3ea, #8fc7d8); border: 1px solid var(--border, #e2d6c6); border-radius: 24px; overflow: hidden; }
  .interactive { touch-action: none; cursor: grab; }
  .interactive:active { cursor: grabbing; }
  svg { width: 100%; height: auto; }
  path { fill: var(--fill, #91b89b); stroke: #fffaf0; stroke-width: .5; vector-effect: non-scaling-stroke; cursor: pointer; transition: filter 160ms; }
  .region-depth { pointer-events: none; }
  .region-depth path { fill: #00000030; stroke: none; cursor: default; }
  path:hover, path:focus { filter: brightness(1.08) saturate(1.2); outline: none; }
  path.selected { fill: #e07a4f; }
  .overlay-pin { cursor:pointer; }
  .overlay-pin:focus { outline:none; filter:drop-shadow(0 0 7px #fff); }
  .overlay-pin circle, .overlay-pin polygon { stroke: #fff8e9; stroke-width: 2; vector-effect: non-scaling-stroke; }
  .map-help { margin: 0; font-size: .74rem; line-height: 1.5; opacity: .8; }
  @media (prefers-reduced-motion: reduce) { path { transition: none; } }
</style>
