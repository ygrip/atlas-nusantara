<script lang="ts">
  import { ImageOff } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import type { DestinationPhoto } from '$lib/data/destination-contract';
  let { name, image }: { name: string; image?: DestinationPhoto } = $props();
  let failed = $state(false);
  $effect(() => { void image; failed = false; });
</script>

<div class="destination-image">
  {#if image && !failed}
    <img src={image.url} alt={name} loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror={() => { failed = true; }} />
  {:else}
    <span class="destination-placeholder"><ImageOff size={26} strokeWidth={1.6} aria-hidden="true" /><small>{m.destination_no_image()}</small></span>
  {/if}
</div>
{#if image}
  <p class="photo-credit">
    <a href={image.descriptionUrl} target="_blank" rel="noopener noreferrer">{image.credit} ↗</a>
    <span aria-hidden="true"> · </span>
    <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{image.license}</a>
  </p>
{/if}

<style>
  .destination-image { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; background: linear-gradient(135deg, color-mix(in srgb, var(--mint, #cce9df) 60%, var(--surface, #fff)), var(--panel, #f1e9df)); border-radius: 15px 15px 10px 10px; }
  img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .destination-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 100%; color: var(--muted); }
  .destination-placeholder small { font-size: .72rem; font-weight: 750; }
  .photo-credit { margin: 0; padding: 7px 6px 2px; color: var(--muted); font-size: .72rem; line-height: 1.45; overflow-wrap: anywhere; }
  .photo-credit a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
</style>
