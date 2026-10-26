<script lang="ts">
  import WeatherIllustration from './WeatherIllustration.svelte';
  import { m } from '$lib/paraglide/messages.js';
  import type { GeometryPackage } from '$lib/geo/types';
  let { label, geometry, selectedCode, onselect }: {
    label: string; geometry?: GeometryPackage; selectedCode?: string; onselect: (code: string) => void;
  } = $props();
  let scale = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let previousGeometry: GeometryPackage | undefined;
  $effect(() => { if (geometry !== previousGeometry) { previousGeometry = geometry; reset(); } });

  function reset() { scale = 1; panX = 0; panY = 0; }
  function zoom(factor: number) { scale = Math.min(8, Math.max(1, scale * factor)); if (scale === 1) { panX = 0; panY = 0; } }

  function interaction(node: HTMLDivElement) {
    const pointers = new Map<number, {x: number; y: number}>();
    let moved = 0;
    let touchCode: string | undefined;
    let suppressClickUntil = 0;
    function coordinates(event: PointerEvent) { return { x: event.clientX, y: event.clientY }; }
    function down(event: PointerEvent) {
      if (!geometry || (event.target as Element).closest('button')) return;
      pointers.set(event.pointerId, coordinates(event)); moved = 0;
      if (event.pointerType === 'touch') touchCode = (event.target as Element).getAttribute('data-code') ?? undefined;
    }
    function move(event: PointerEvent) {
      const previous = pointers.get(event.pointerId);
      if (!previous || !geometry) return;
      const before = [...pointers.values()];
      const point = coordinates(event);
      pointers.set(event.pointerId, point);
      moved += Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
      if (moved < 5) return;
      node.setPointerCapture(event.pointerId);
      const bounds = node.getBoundingClientRect();
      const ratio = 1000 / bounds.width;
      if (pointers.size === 2) {
        const after = [...pointers.values()];
        const oldDistance = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y);
        const newDistance = Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y);
        if (oldDistance > 0) zoom(newDistance / oldDistance);
      }
      panX = Math.max(-1000 * scale, Math.min(1000 * scale, panX + (point.x - previous.x) * ratio));
      panY = Math.max(-500 * scale, Math.min(500 * scale, panY + (point.y - previous.y) * ratio));
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
      if (!geometry) return;
      event.preventDefault();
      zoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * .004));
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
  <button type="button" onclick={() => zoom(1.3)} disabled={!geometry || scale >= 8} aria-label={m.zoom_in()}>+</button>
  <button type="button" onclick={() => zoom(1 / 1.3)} disabled={!geometry || scale <= 1} aria-label={m.zoom_out()}>−</button>
  <button type="button" onclick={reset} disabled={!geometry}>{m.zoom_reset()}</button>
  <output aria-live="polite">{scale.toFixed(1)}×</output>
</div>
<div class="atlas-map" class:interactive={Boolean(geometry)} use:interaction>
  {#if geometry}
    <svg viewBox={geometry.viewBox} aria-label={label} role="group">
      <g transform={`translate(${500 + panX} ${250 + panY}) scale(${scale}) translate(-500 -250)`}>
      <g class="region-depth" transform="translate(0 8)" aria-hidden="true">
        {#each geometry.regions as region (region.id)}<path d={region.path} />{/each}
      </g>
      {#each geometry.regions as region (region.id)}
        <path d={region.path} data-code={region.sourceCode} class:selected={selectedCode === region.sourceCode}
          role="button" tabindex="0" aria-label={region.name + ' · ' + region.sourceCode}
          onclick={() => onselect(region.sourceCode)}
          onkeydown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onselect(region.sourceCode); } }}>
          <title>{region.name}</title>
        </path>
      {/each}
      </g>
    </svg>
  {:else}
    <div class="boundary-pending">
      <span class="archive-number" aria-hidden="true">2022</span>
      <h2>{m.boundary_unavailable()}</h2>
      <p>{m.boundary_explanation()}</p>
      <span class="archive-stamp">37 / 514</span>
    </div>
  {/if}
</div>
{#if geometry}<p class="map-help">{m.map_help()}</p>{/if}
<WeatherIllustration />

<style>
  .map-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 10px; }
  .map-controls button { min-width: 44px; border: 1px solid var(--border, #bccdbe); border-radius: 12px; background: var(--surface, #f7faf6); color: inherit; padding: 8px 12px; }
  .map-controls output { margin-left: auto; font-size: .75rem; }
  .map-help { font-size: .75rem; line-height: 1.5; }
  .interactive { touch-action: none; cursor: grab; }
  .interactive:active { cursor: grabbing; }
  .atlas-map { min-height: 360px; display: grid; place-items: center; background: var(--map-bg, #dce8dd); border: 1px solid var(--border, #bccdbe); border-radius: 22px; overflow: hidden; }
  svg { width: 100%; height: auto; }
  path { fill: #91b89b; stroke: #365945; stroke-width: .7; cursor: pointer; transition: fill 160ms; }
  .region-depth { pointer-events: none; }
  .region-depth path { fill: #52745b; stroke: #52745b; cursor: default; }
  path:hover, path:focus, path.selected { fill: #dcad64; stroke-width: 2; outline: none; }
  .boundary-pending { padding: 30px; max-width: 540px; text-align: center; }
  .archive-number { display: block; font-size: clamp(4rem, 9vw, 7rem); line-height: 1; font-weight: 750; letter-spacing: -.08em; color: #759c80; }
  h2 { font-size: 1.15rem; line-height: 1.4; margin: 24px 0 8px; }
  p { font-size: .9rem; line-height: 1.6; color: var(--map-text, #405b48); }
  .archive-stamp { display: inline-block; border: 1px solid #93ab98; padding: 8px 14px; border-radius: 8px; font: 600 .8rem ui-monospace, monospace; letter-spacing: .14em; }
  @media(prefers-reduced-motion: reduce) { path { transition: none; } }
</style>
