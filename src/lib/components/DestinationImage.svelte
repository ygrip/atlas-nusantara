<script lang="ts">
  import { tick } from 'svelte';
  import { ImageOff, Images, ChevronLeft, ChevronRight, X } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import type { DestinationPhoto } from '$lib/data/destination-contract';

  let { name, image, images }: { name: string; image?: DestinationPhoto; images?: DestinationPhoto[] } = $props();
  const photos = $derived(images?.length ? images : image ? [image] : []);
  let previewFailed = $state(false);
  let modalFailed = $state(false);
  let open = $state(false);
  let active = $state(0);
  let previewButton: HTMLButtonElement;
  let closeButton: HTMLButtonElement;
  let modal: HTMLDivElement;
  const current = $derived(photos[active]);

  $effect(() => {
    void photos;
    previewFailed = false;
    modalFailed = false;
    active = 0;
    open = false;
  });

  $effect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  });

  async function showGallery() {
    active = 0;
    modalFailed = false;
    open = true;
    await tick();
    closeButton?.focus();
  }

  async function closeGallery() {
    open = false;
    await tick();
    previewButton?.focus();
  }

  function step(delta: number) {
    if (!photos.length) return;
    active = (active + delta + photos.length) % photos.length;
    modalFailed = false;
  }

  function handleKey(event: KeyboardEvent) {
    if (!open) return;
    if (event.key === 'Escape') { event.preventDefault(); void closeGallery(); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    else if (event.key === 'Tab') {
      const focusable = [...(modal?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') ?? [])];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
</script>

<svelte:window onkeydown={handleKey} />

{#if photos.length}
  <button class="destination-image photo-preview" type="button" bind:this={previewButton}
    onclick={showGallery} aria-label={name + ' · ' + photos.length + ' photos'}>
    {#if !previewFailed}
      <img src={photos[0].url} alt={name} loading="lazy" decoding="async" referrerpolicy="no-referrer"
        onerror={() => { previewFailed = true; }} />
    {:else}
      <span class="destination-placeholder"><ImageOff size={26} strokeWidth={1.6} aria-hidden="true" /><small>{m.destination_no_image()}</small></span>
    {/if}
    {#if photos.length > 1}<span class="photo-count"><Images size={13} aria-hidden="true" /> {photos.length}</span>{/if}
  </button>
  <p class="photo-credit">
    <a href={photos[0].descriptionUrl} target="_blank" rel="noopener noreferrer">{photos[0].credit} ↗</a>
    <span aria-hidden="true"> · </span>
    <a href={photos[0].licenseUrl} target="_blank" rel="noopener noreferrer">{photos[0].license}</a>
  </p>
{:else}
  <div class="destination-image">
    <span class="destination-placeholder"><ImageOff size={26} strokeWidth={1.6} aria-hidden="true" /><small>{m.destination_no_image()}</small></span>
  </div>
{/if}

{#if open && current}
  <div class="gallery-overlay" role="presentation">
    <button class="gallery-scrim" type="button" onclick={closeGallery} aria-label="Close image gallery"></button>
    <div class="gallery-dialog" bind:this={modal} role="dialog" aria-modal="true" aria-label={name + ' · gallery'} tabindex="-1">
      <header class="gallery-header">
        <strong>{name}</strong>
        <button class="gallery-control gallery-close" type="button" bind:this={closeButton}
          onclick={closeGallery} aria-label="Close image gallery"><X size={21} /></button>
      </header>
      <div class="gallery-stage">
        {#if photos.length > 1}
          <button class="gallery-control gallery-prev" type="button" onclick={() => step(-1)}
            aria-label={m.destination_previous()}><ChevronLeft size={25} /></button>
        {/if}
        {#if !modalFailed}
          <img src={current.url} alt={name + ' · ' + (active + 1)} decoding="async"
            referrerpolicy="no-referrer" onerror={() => { modalFailed = true; }} />
        {:else}
          <span class="destination-placeholder"><ImageOff size={32} aria-hidden="true" />{m.destination_no_image()}</span>
        {/if}
        {#if photos.length > 1}
          <button class="gallery-control gallery-next" type="button" onclick={() => step(1)}
            aria-label={m.destination_next()}><ChevronRight size={25} /></button>
        {/if}
      </div>
      <footer class="gallery-footer">
        <span class="gallery-counter" aria-live="polite">{active + 1} / {photos.length}</span>
        <span class="gallery-attribution">
          <a href={current.descriptionUrl} target="_blank" rel="noopener noreferrer">{current.credit} ↗</a>
          <span> · </span>
          <a href={current.licenseUrl} target="_blank" rel="noopener noreferrer">{current.license}</a>
        </span>
      </footer>
      {#if photos.length > 1}
        <div class="gallery-dots" aria-label={name}>
          {#each photos as photo, index (photo.descriptionUrl)}
            <button class:chosen={active === index} type="button" onclick={() => { active = index; modalFailed = false; }}
              aria-label={name + ' · ' + (index + 1)} aria-current={active === index ? 'true' : undefined}></button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .destination-image { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; background: linear-gradient(135deg, color-mix(in srgb, var(--mint, #cce9df) 60%, var(--surface, #fff)), var(--panel, #f1e9df)); border-radius: 15px 15px 10px 10px; }
  .photo-preview { display: block; border: 1px solid var(--border); padding: 0; cursor: zoom-in; box-shadow: inset 0 1px 0 var(--clay-highlight); }
  .photo-preview:focus-visible, .gallery-control:focus-visible, .gallery-dots button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  .destination-image img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .destination-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 100%; color: var(--muted); text-align: center; }
  .destination-placeholder small { font-size: .72rem; font-weight: 750; }
  .photo-count { position: absolute; right: 6px; bottom: 6px; display: inline-flex; align-items: center; gap: 4px; border-radius: 9px; background: color-mix(in srgb, var(--surface) 92%, transparent); padding: 3px 6px; box-shadow: var(--clay-pressed); color: var(--text); font-size: .72rem; font-weight: 800; }
  .photo-credit { margin: 0; padding: 7px 6px 2px; color: var(--muted); font-size: .72rem; line-height: 1.45; overflow-wrap: anywhere; }
  .photo-credit a, .gallery-attribution a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
  .gallery-overlay { position: fixed; inset: 0; z-index: 2500; display: grid; place-items: center; padding: 14px; }
  .gallery-scrim { position: absolute; inset: 0; width: 100%; border: 0; background: rgba(8, 18, 21, .82); cursor: zoom-out; }
  .gallery-dialog { position: relative; display: grid; gap: 10px; width: min(100%, 980px); max-height: min(94dvh, 900px); padding: 12px; border: 1px solid var(--border); border-radius: 24px; background: var(--surface); box-shadow: var(--clay-shadow, 0 12px 48px #0004); color: var(--text); }
  .gallery-header, .gallery-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; min-width: 0; }
  .gallery-header strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gallery-control { display: grid; place-items: center; flex: none; width: 44px; height: 44px; padding: 0; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); box-shadow: var(--clay-pressed); color: var(--text); cursor: pointer; }
  .gallery-stage { position: relative; display: grid; place-items: center; min-height: 150px; max-height: 68dvh; }
  .gallery-stage img { display: block; max-width: 100%; max-height: 65dvh; width: auto; height: auto; object-fit: contain; border-radius: 11px; }
  .gallery-stage .gallery-prev, .gallery-stage .gallery-next { position: absolute; top: 50%; z-index: 1; transform: translateY(-50%); background: color-mix(in srgb, var(--surface) 92%, transparent); }
  .gallery-prev { left: 4px; } .gallery-next { right: 4px; }
  .gallery-footer { font-size: .77rem; color: var(--muted); }
  .gallery-counter { flex: none; font-weight: 800; }
  .gallery-attribution { min-width: 0; overflow-wrap: anywhere; text-align: right; }
  .gallery-dots { display: flex; flex-wrap: wrap; justify-content: center; gap: 7px; max-height: 60px; overflow-y: auto; }
  .gallery-dots button { width: 10px; height: 10px; padding: 0; border: 0; border-radius: 50%; background: var(--muted); opacity: .4; cursor: pointer; }
  .gallery-dots button.chosen { background: var(--accent); opacity: 1; }
  @media (max-width: 560px) { .gallery-dialog { border-radius: 17px; padding: 10px; } .gallery-header strong { font-size: .9rem; } .gallery-stage { max-height: 60dvh; } .gallery-stage img { max-height: 58dvh; } }
  @media (prefers-reduced-motion: no-preference) { .gallery-dialog { animation: appear .16s ease-out; } @keyframes appear { from { opacity: 0; transform: scale(.985); } to { opacity: 1; transform: scale(1); } } }
</style>
