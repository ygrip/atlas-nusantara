<script lang="ts">
  import { LocateFixed, Minus, Plus } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import type { GeometryPackage } from '$lib/geo/types';
  import { ISLAND_GROUP_COLORS, islandGroupOf } from '$lib/atlas/islands';
  import { projectLonLat } from '$lib/map/geometry';
  import type { PointOverlay } from '$lib/map/overlays';

  let { geometry, label, selectedCode, onselect, overlay, projection }: {
    geometry: GeometryPackage; label: string; selectedCode?: string; onselect: (code: string) => void;
    overlay?: PointOverlay; projection?: GeometryPackage['projection'];
  } = $props();

  let scale = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let previousGeometry: GeometryPackage | undefined;
  $effect(() => { if (geometry !== previousGeometry) { previousGeometry = geometry; reset(); } });

  const box = $derived(geometry.viewBox.split(' ').map(Number));
  const centerX = $derived(box[0] + box[2] / 2);
  const centerY = $derived(box[1] + box[3] / 2);

  function reset() { scale = 1; panX = 0; panY = 0; }
  function zoom(factor: number) { scale = Math.min(8, Math.max(1, scale * factor)); if (scale === 1) { panX = 0; panY = 0; } }
  function fill(code: string): string { return ISLAND_GROUP_COLORS[islandGroupOf(code)].light[0]; }

  function interaction(node: HTMLDivElement) {
    const pointers = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let touchCode: string | undefined;
    let suppressClickUntil = 0;
    function coordinates(event: PointerEvent) { return { x: event.clientX, y: event.clientY }; }
    function down(event: PointerEvent) {
      if ((event.target as Element).closest('button')) return;
      pointers.set(event.pointerId, coordinates(event)); moved = 0;
      if (event.pointerType === 'touch') touchCode = (event.target as Element).getAttribute('data-code') ?? undefined;
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
      if (event.pointerType === 'touch' && moved < 5 && pointers.size === 1 && touchCode) onselect(touchCode);
      pointers.delete(event.pointerId);
      if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
    }
    function cancel(event: PointerEvent) { pointers.delete(event.pointerId); touchCode = undefined; }
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
  <button type="button" class="tool" onclick={() => zoom(1.3)} disabled={scale >= 8} aria-label={m.zoom_in()} title={m.zoom_in()}><Plus size={20} aria-hidden="true" /></button>
  <button type="button" onclick={() => zoom(1 / 1.3)} disabled={scale <= 1} aria-label={m.zoom_out()} title={m.zoom_out()}><Minus size={20} aria-hidden="true" /></button>
  <button type="button" class="tool reset" onclick={reset} aria-label={m.zoom_reset()} title={m.zoom_reset()}><LocateFixed size={20} aria-hidden="true" /><span class="tool-label">{m.zoom_reset()}</span></button>
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
        {#each overlay.pins as pin (pin.id)}
          {@const point = projectLonLat(projection, pin.lon, pin.lat)}
          {@const radius = box[2] * 0.008}
          {@const pinColor = pin.color ?? overlay.color}
          {@const pinSymbol = pin.symbol ?? overlay.symbol}
          <g class="overlay-pin" class:epicentre={overlay.id === 'earthquake'} role="img" aria-label={pin.label}>
            <title>{pin.label} · {pin.description ?? ''}</title>
            {#if pinSymbol === 'circle'}
              <circle cx={point.x} cy={point.y} r={radius} fill={pinColor} />
            {:else if pinSymbol === 'triangle'}
              <polygon points={`${point.x},${point.y - radius} ${point.x + radius},${point.y + radius} ${point.x - radius},${point.y + radius}`} fill={pinColor} />
            {:else}
              <polygon points={`${point.x},${point.y - radius} ${point.x + radius},${point.y} ${point.x},${point.y + radius} ${point.x - radius},${point.y}`} fill={pinColor} />
            {/if}
          </g>
        {/each}
      {/if}
    </g>
  </svg>
</div>
<p class="map-help">{m.map_help()}</p>

<style>
  .map-controls { display: flex; align-items: center; justify-content: flex-end; gap: 6px; padding: 8px; border: 1px solid var(--border); border-radius: 22px; background: linear-gradient(165deg, var(--surface), var(--panel)); box-shadow: 0 4px 0 -2px var(--border), inset 0 2px 1px var(--clay-highlight); }
  .tool { display: inline-grid; grid-auto-flow: column; place-items: center; gap: 8px; min-width: 44px; min-height: 44px; padding: 0 10px; border: 1px solid var(--border); border-radius: 14px; background: linear-gradient(165deg, var(--surface), var(--panel)); color: var(--text); font-weight: 800; font-size: .8rem; cursor: pointer; box-shadow: 0 3px 0 var(--border), inset 0 2px 1px var(--clay-highlight); transition: transform 120ms, box-shadow 120ms, color 160ms; }
  .tool:hover:not(:disabled) { color: var(--accent); }
  .tool:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 var(--border), inset 0 2px 4px var(--shadow); }
  .tool:disabled { opacity: .45; cursor: not-allowed; }
  .tool:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 2px; }
  .tool.reset { padding: 0 14px; }
  .map-controls output { min-width: 4ch; text-align: center; font: 800 .75rem ui-monospace, monospace; color: var(--muted); }
  @media (max-width: 700px) { .tool.reset .tool-label { display: none; } .tool.reset { padding: 0 10px; } }
  .atlas-map { min-height: 360px; display: grid; grid-template-columns: minmax(0, 1fr); place-items: center; background: linear-gradient(180deg, #bfe3ea, #8fc7d8); border: 1px solid var(--border, #e2d6c6); border-radius: 24px; overflow: hidden; }
  .interactive { touch-action: none; cursor: grab; }
  .interactive:active { cursor: grabbing; }
  svg { width: 100%; height: auto; }
  path { fill: var(--fill, #91b89b); stroke: #fffaf0; stroke-width: .5; vector-effect: non-scaling-stroke; cursor: pointer; transition: filter 160ms; }
  .region-depth { pointer-events: none; }
  .region-depth path { fill: #00000030; stroke: none; cursor: default; }
  path:hover, path:focus { filter: brightness(1.08) saturate(1.2); outline: none; }
  path.selected { fill: #e07a4f; }
  .overlay-pin circle, .overlay-pin polygon { stroke: #fff8e9; stroke-width: 2; vector-effect: non-scaling-stroke; }
  .map-help { margin: 0; font-size: .74rem; line-height: 1.5; opacity: .8; }
  @media (prefers-reduced-motion: reduce) { path, .tool { transition: none; } }
</style>
