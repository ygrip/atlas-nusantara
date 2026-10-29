<script lang="ts">
  import { onMount } from 'svelte';
  import type { IslandGroup } from '$lib/atlas/islands';
  import { loadProvinceShapes, type IslandShape } from '$lib/directory/island-shapes';

  /** Draws the clay silhouette of an island group using the colours set by `groupStyle()` on an ancestor. */
  let { group, size = 28 }: { group: IslandGroup; size?: number } = $props();

  const gradientId = 'island-clay-' + Math.random().toString(36).slice(2, 8);
  let shape = $state<IslandShape | undefined>(undefined);

  const viewBox = $derived(shape ? boxFor(shape) : '0 0 1 1');
  const depth = $derived(shape ? Math.max(shape.bbox[2] - shape.bbox[0], shape.bbox[3] - shape.bbox[1]) * 0.05 : 0);

  onMount(() => {
    let active = true;
    loadProvinceShapes()
      .then(shapes => { if (active) shape = shapes.islands[group]; })
      .catch(() => { /* The coloured dot below stays as the fallback. */ });
    return () => { active = false; };
  });

  function boxFor(island: IslandShape): string {
    const [left, top, right, bottom] = island.bbox;
    const width = right - left;
    const height = bottom - top;
    const padding = Math.max(width, height) * 0.06;
    return `${left - padding} ${top - padding} ${width + padding * 2} ${height + padding * 2 + depth}`;
  }
</script>

{#if shape}
  <svg class="island-icon" style={`width: ${size * 1.6}px; height: ${size}px`} {viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--group-top)" />
        <stop offset="100%" stop-color="var(--group-side)" />
      </linearGradient>
    </defs>
    <path class="island-side" d={shape.path} transform={`translate(0 ${depth})`} fill="var(--group-side)" />
    <path class="island-top" d={shape.path} fill={`url(#${gradientId})`} />
  </svg>
{:else}
  <span class="group-dot island-fallback" style={`width: ${size * 0.6}px; height: ${size * 0.6}px`} aria-hidden="true"></span>
{/if}

<style>
  .island-icon { --group-top: var(--group-top-light); --group-side: var(--group-side-light); display: block; flex: 0 0 auto; overflow: visible; }
  :global([data-theme='dark']) .island-icon { --group-top: var(--group-top-dark); --group-side: var(--group-side-dark); }
  .island-top { stroke: color-mix(in srgb, var(--group-side) 80%, var(--border)); stroke-width: .8; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
  .island-fallback { display: inline-block; }
</style>
