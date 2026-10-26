<script lang="ts">
  import WeatherIllustration from './WeatherIllustration.svelte';
  import { m } from '$lib/paraglide/messages.js';
  import type { GeometryPackage } from '$lib/geo/types';
  import type { Region } from '$lib/atlas/regions';
  import { ISLAND_GROUP_NAMES, PROVINCE_TILES, TILE_COLUMNS, TILE_ROWS, type IslandGroup } from '$lib/atlas/tiles';
  let { label, geometry, selectedCode, onselect, provinces = [], selectedProvince, onprovince }: {
    label: string; geometry?: GeometryPackage; selectedCode?: string; onselect: (code: string) => void;
    provinces?: Region[]; selectedProvince?: string; onprovince?: (code: string) => void;
  } = $props();
  const islandGroups = Object.entries(ISLAND_GROUP_NAMES) as [IslandGroup, string][];
  function provinceName(code: string): string | undefined {
    return provinces.find(region => region.code === code)?.name;
  }
  function tileLabel(code: string): string {
    const name = provinceName(code);
    if (!name) return code;
    return name + ' (' + code + ')';
  }
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

{#if geometry}<div class="map-controls" role="group" aria-label={m.zoom_reset()}>
  <button type="button" onclick={() => zoom(1.3)} disabled={!geometry || scale >= 8} aria-label={m.zoom_in()}>+</button>
  <button type="button" onclick={() => zoom(1 / 1.3)} disabled={!geometry || scale <= 1} aria-label={m.zoom_out()}>−</button>
  <button type="button" onclick={reset} disabled={!geometry}>{m.zoom_reset()}</button>
  <output aria-live="polite">{scale.toFixed(1)}×</output>
</div>{/if}
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
    <div class="tile-atlas">
      <div class="tile-scroll">
        <div class="tile-grid" role="group" aria-label={m.tile_map_label()} style={`--tile-columns: ${TILE_COLUMNS}; --tile-rows: ${TILE_ROWS}`}>
          {#each PROVINCE_TILES as tile (tile.code)}
            <button type="button" class={'tile tile-' + tile.group} class:selected={selectedProvince === tile.code}
              style={`grid-column: ${tile.column}; grid-row: ${tile.row}`} data-code={tile.code}
              aria-label={tileLabel(tile.code)} title={tileLabel(tile.code)} aria-pressed={selectedProvince === tile.code}
              disabled={!onprovince || !provinceName(tile.code)} onclick={() => onprovince?.(tile.code)}>
              <span class="tile-code" aria-hidden="true">{tile.code}</span>
              <span class="tile-name" aria-hidden="true">{tile.abbreviation}</span>
            </button>
          {/each}
        </div>
      </div>
      <ul class="tile-legend" aria-label={m.table_island()}>
        {#each islandGroups as [group, name] (group)}<li><span class={'legend-dot tile-' + group} aria-hidden="true"></span>{name}</li>{/each}
      </ul>
      <div class="boundary-pending">
        <span class="archive-stamp">2022 · 37 / 514</span>
        <div>
          <h2>{m.boundary_unavailable()}</h2>
          <p>{m.boundary_explanation()} {m.tile_map_note()}</p>
        </div>
      </div>
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
  .atlas-map { min-height: 360px; display: grid; grid-template-columns: minmax(0, 1fr); place-items: center; background: var(--map-bg, #dce8dd); border: 1px solid var(--border, #bccdbe); border-radius: 22px; overflow: hidden; }
  svg { width: 100%; height: auto; }
  path { fill: #91b89b; stroke: #365945; stroke-width: .7; cursor: pointer; transition: fill 160ms; }
  .region-depth { pointer-events: none; }
  .region-depth path { fill: #52745b; stroke: #52745b; cursor: default; }
  path:hover, path:focus, path.selected { fill: #dcad64; stroke-width: 2; outline: none; }
  .tile-atlas { width: 100%; min-width: 0; grid-template-columns: minmax(0, 1fr); padding: clamp(12px, 2.4vw, 22px); display: grid; gap: 14px; }
  .tile-scroll { overflow-x: auto; overscroll-behavior-x: contain; padding: 6px 4px 14px; }
  .tile-grid { display: grid; min-width: 600px; grid-template-columns: repeat(var(--tile-columns), minmax(0, 1fr)); grid-template-rows: repeat(var(--tile-rows), auto); gap: 7px; }
  .tile { aspect-ratio: 1; overflow: hidden; min-height: 0; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: 2px; padding: 5px 6px; border: 2px solid #ffffff99; border-radius: 12px; color: #2e2a26; text-align: left; box-shadow: inset 2px 2px 3px #ffffffa6, inset -3px -4px 6px #0000001f, 3px 5px 0 var(--tile-edge), 5px 9px 14px #5e4a3433; transition: transform 180ms cubic-bezier(.34,1.56,.64,1), box-shadow 180ms ease-out; }
  .tile:not(:disabled):hover, .tile:focus-visible { transform: translateY(-3px); }
  .tile:not(:disabled):active { transform: translateY(2px); box-shadow: inset 2px 2px 3px #ffffffa6, inset -3px -4px 6px #0000001f, 1px 2px 0 var(--tile-edge); }
  .tile.selected { outline: 3px solid var(--text, #392f2b); outline-offset: 2px; transform: translateY(-3px); }
  .tile-code { font: 800 .7rem/1 ui-monospace, SFMono-Regular, monospace; opacity: .75; }
  .tile-name { max-width: 100%; font-size: .5rem; font-weight: 900; line-height: 1; letter-spacing: -.03em; white-space: nowrap; overflow: hidden; text-overflow: clip; }
  .tile-sumatra { background: #f6c9a8; --tile-edge: #d79c74; }
  .tile-java { background: #d8c8f0; --tile-edge: #a994cc; }
  .tile-nusa-tenggara { background: #f3dc9b; --tile-edge: #cfb167; }
  .tile-kalimantan { background: #b9e0c3; --tile-edge: #82b893; }
  .tile-sulawesi { background: #b7d6ef; --tile-edge: #7fa8cb; }
  .tile-maluku { background: #f5b7b1; --tile-edge: #cf8780; }
  .tile-papua { background: #c9dca6; --tile-edge: #97b26c; }
  .tile-legend { display: flex; flex-wrap: wrap; gap: 8px 14px; list-style: none; margin: 0; padding: 0; font-size: .75rem; font-weight: 700; }
  .tile-legend li { display: inline-flex; align-items: center; gap: 6px; }
  .legend-dot { width: 14px; height: 14px; border-radius: 5px; box-shadow: inset -2px -2px 3px #0000001f, 1px 2px 0 var(--tile-edge); }
  .boundary-pending { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 14px 16px; border-radius: 18px; background: var(--surface, #fffaf2); box-shadow: inset 3px 3px 6px #ffffff80, inset -3px -3px 8px #00000014; }
  .boundary-pending > div { flex: 1 1 260px; }
  h2 { font-size: 1rem; line-height: 1.4; margin: 0 0 4px; }
  p { font-size: .85rem; line-height: 1.55; margin: 0; color: var(--map-text, #405b48); }
  .archive-stamp { display: inline-block; border: 2px dashed var(--border, #93ab98); padding: 8px 12px; border-radius: 12px; font: 700 .75rem ui-monospace, monospace; letter-spacing: .1em; }
  @media (max-width: 700px) { .tile-grid { min-width: 720px; } }
  @media (min-width: 1100px) { .tile { padding: 6px 2px 6px 6px; border-radius: 14px; } .tile-name { font-size: .54rem; letter-spacing: -.045em; } .tile-code { font-size: .76rem; } }
  @media(prefers-reduced-motion: reduce) { path, .tile { transition: none; } .tile:not(:disabled):hover, .tile.selected { transform: none; } }
</style>
