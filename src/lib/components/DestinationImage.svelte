<script lang="ts">
  import { tick } from 'svelte';
  import { ImageOff, Images, ChevronLeft, ChevronRight, X } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';
  import type { DestinationPhoto } from '$lib/data/destination-contract';

  type GalleryPhoto = { url: string; descriptionUrl?: string; credit?: string; license?: string; licenseUrl?: string };
  let { name, image, images, webImages }: {
    name: string; image?: DestinationPhoto; images?: DestinationPhoto[]; webImages?: string[];
  } = $props();
  const licensedPhotos = $derived(images?.length ? images : image ? [image] : []);
  // Unverified Google Images results are shown only when no licensed photo exists.
  const photos = $derived<GalleryPhoto[]>(licensedPhotos.length
    ? licensedPhotos
    : (webImages ?? []).map(url => ({ url })));
  let previewFailed = $state(false);
  let modalFailed = $state(false);
  let open = $state(false);
  let active = $state(0);
  let previewButton = $state<HTMLButtonElement>();
  let closeButton = $state<HTMLButtonElement>();
  let modal = $state<HTMLDivElement>();
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

  // Move the modal outside the scrollable table so desktop and mobile clips do
  // not cut it off. Destroy removes only this modal instance.
  function portalToBody(node: HTMLDivElement) {
    document.body.appendChild(node);
    return { destroy() { node.remove(); } };
  }

  // Swipe left or right on the photo to move through the gallery.
  const SWIPE_DISTANCE = 48;
  let swipeStartX: number | undefined;
  function swipeStart(event: PointerEvent) { swipeStartX = event.clientX; }
  function swipeEnd(event: PointerEvent) {
    if (swipeStartX === undefined) return;
    const distance = event.clientX - swipeStartX;
    swipeStartX = undefined;
    if (Math.abs(distance) < SWIPE_DISTANCE) return;
    if (distance < 0) step(1);
    else step(-1);
  }

  function choose(index: number) {
    active = index;
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
    onclick={showGallery} aria-label={name + ' · ' + m.destination_gallery_photos({ count: photos.length })}>
    {#if !previewFailed}
      <img src={photos[0].url} alt={name} loading="lazy" decoding="async" referrerpolicy="no-referrer"
        onerror={() => { previewFailed = true; }} />
    {:else}
      <span class="destination-placeholder"><ImageOff size={26} strokeWidth={1.6} aria-hidden="true" /><small>{m.destination_no_image()}</small></span>
    {/if}
    {#if photos.length > 1}<span class="photo-count"><Images size={13} aria-hidden="true" /> {photos.length}</span>{/if}
  </button>
  <p class="photo-credit">
    {#if photos[0].descriptionUrl}
      <a href={photos[0].descriptionUrl} target="_blank" rel="noopener noreferrer">{photos[0].credit} ↗</a>
      <span aria-hidden="true"> · </span>
      <a href={photos[0].licenseUrl} target="_blank" rel="noopener noreferrer">{photos[0].license}</a>
    {:else}
      Web image · unverified
    {/if}
  </p>
{:else}
  <div class="destination-image">
    <span class="destination-placeholder"><ImageOff size={26} strokeWidth={1.6} aria-hidden="true" /><small>{m.destination_no_image()}</small></span>
  </div>
{/if}

{#if open && current}
  <div class="gallery-overlay" use:portalToBody role="presentation">
    <button class="gallery-scrim" type="button" onclick={closeGallery} aria-label={m.destination_gallery_close()}></button>
    <div class="gallery-dialog" bind:this={modal} role="dialog" aria-modal="true" aria-label={m.destination_gallery_label({ name })} tabindex="-1">
      <header class="gallery-header">
        <span class="gallery-title"><Images size={18} aria-hidden="true" /><strong>{name}</strong></span>
        <button class="gallery-control gallery-close" type="button" bind:this={closeButton}
          onclick={closeGallery} aria-label={m.destination_gallery_close()}><X size={20} strokeWidth={2.6} /></button>
      </header>
      <div class="gallery-stage" role="group" aria-roledescription={m.destination_gallery_carousel()} aria-label={name} onpointerdown={swipeStart} onpointerup={swipeEnd} onpointercancel={() => { swipeStartX = undefined; }}>
        <div class="gallery-frame">
          {#if !modalFailed}
            {#key current.url}
              <img src={current.url} alt={name + ' · ' + (active + 1)} decoding="async" draggable="false"
                referrerpolicy="no-referrer" onerror={() => { modalFailed = true; }} />
            {/key}
          {:else}
            <span class="destination-placeholder"><ImageOff size={32} aria-hidden="true" />{m.destination_no_image()}</span>
          {/if}
        </div>
        {#if photos.length > 1}
          <button class="gallery-control gallery-nav gallery-prev" type="button" onclick={() => step(-1)}
            aria-label={m.destination_previous()}><ChevronLeft size={24} strokeWidth={2.6} /></button>
          <button class="gallery-control gallery-nav gallery-next" type="button" onclick={() => step(1)}
            aria-label={m.destination_next()}><ChevronRight size={24} strokeWidth={2.6} /></button>
        {/if}
      </div>
      {#if photos.length > 1}
        <div class="gallery-thumbs" aria-label={name}>
          {#each photos as photo, index (photo.url)}
            <button class="gallery-thumb" class:chosen={active === index} type="button" onclick={() => choose(index)}
              aria-label={name + ' · ' + (index + 1)} aria-current={active === index ? 'true' : undefined}>
              <img src={photo.url} alt="" loading="lazy" decoding="async" draggable="false" referrerpolicy="no-referrer" />
            </button>
          {/each}
        </div>
      {/if}
      <footer class="gallery-footer">
        <span class="gallery-counter" aria-live="polite">{active + 1} / {photos.length}</span>
        <span class="gallery-attribution">
          {#if current.descriptionUrl}
            <a href={current.descriptionUrl} target="_blank" rel="noopener noreferrer">{current.credit} ↗</a>
            <span> · </span>
            <a href={current.licenseUrl} target="_blank" rel="noopener noreferrer">{current.license}</a>
          {:else}
            Web image · unverified
          {/if}
        </span>
      </footer>
    </div>
  </div>
{/if}

<style>
  .destination-image { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; background: linear-gradient(135deg, color-mix(in srgb, var(--mint, #cce9df) 60%, var(--surface, #fff)), var(--panel, #f1e9df)); border-radius: 15px 15px 10px 10px; }
  .photo-preview { display: block; border: 1px solid var(--border); padding: 0; cursor: zoom-in; box-shadow: inset 0 1px 0 var(--clay-highlight); }
  .photo-preview:focus-visible, .gallery-control:focus-visible, .gallery-thumb:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  .destination-image img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .destination-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 100%; color: var(--muted); text-align: center; }
  .destination-placeholder small { font-size: .72rem; font-weight: 750; }
  .photo-count { position: absolute; right: 6px; bottom: 6px; display: inline-flex; align-items: center; gap: 4px; border-radius: 9px; background: color-mix(in srgb, var(--surface) 92%, transparent); padding: 3px 6px; box-shadow: var(--clay-pressed); color: var(--text); font-size: .72rem; font-weight: 800; }
  .photo-credit { margin: 0; padding: 7px 6px 2px; color: var(--muted); font-size: .72rem; line-height: 1.45; overflow-wrap: anywhere; }
  .photo-credit a, .gallery-attribution a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
  /* Claymorphism: soft raised surfaces, thick rounded edges, inner highlights and a bouncy press. */
  .gallery-overlay { position: fixed; inset: 0; z-index: 2500; display: grid; place-items: center; padding: 14px; }
  .gallery-scrim { position: absolute; inset: 0; width: 100%; border: 0; cursor: zoom-out; background: radial-gradient(900px 520px at 50% 0%, color-mix(in srgb, var(--accent) 26%, transparent), transparent 70%), color-mix(in srgb, var(--page) 62%, #0b0608 38%); opacity: .94; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
  .gallery-dialog { position: relative; display: grid; gap: 14px; width: min(100%, 940px); max-height: min(95dvh, 900px); overflow: hidden auto; padding: 16px; border: 2px solid color-mix(in srgb, var(--surface) 70%, var(--border)); border-radius: 36px; background: linear-gradient(160deg, color-mix(in srgb, var(--surface) 88%, #fff) 0%, var(--surface) 46%, color-mix(in srgb, var(--panel) 70%, var(--surface)) 100%); box-shadow: 0 8px 0 -2px var(--border), 14px 24px 48px var(--shadow), inset 3px 4px 6px var(--clay-highlight), inset -5px -6px 12px color-mix(in srgb, var(--shadow) 55%, transparent); color: var(--text); }
  .gallery-header, .gallery-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; min-width: 0; }
  .gallery-title { display: inline-flex; align-items: center; gap: 9px; min-width: 0; padding: 8px 16px 8px 12px; border-radius: 999px; background: var(--panel); box-shadow: var(--clay-pressed); color: var(--text); }
  .gallery-title :global(svg) { flex: none; color: var(--accent); }
  .gallery-title strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .95rem; }
  .gallery-control { display: grid; place-items: center; flex: none; width: 46px; height: 46px; padding: 0; border: 2px solid var(--border); border-radius: 50%; background: linear-gradient(160deg, color-mix(in srgb, var(--surface) 85%, #fff), var(--surface)); box-shadow: 0 5px 0 var(--border), 4px 8px 14px var(--shadow), inset 2px 2px 3px var(--clay-highlight); color: var(--text); cursor: pointer; transition: transform 180ms cubic-bezier(.34, 1.56, .64, 1), box-shadow 180ms ease-out; }
  .gallery-control:hover { transform: translateY(-2px); }
  .gallery-control:active { transform: translateY(4px); box-shadow: 0 1px 0 var(--border), 1px 2px 5px var(--shadow), inset 2px 2px 3px var(--clay-highlight); }
  .gallery-close { color: var(--accent-strong); }
  .gallery-stage { position: relative; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
  .gallery-frame { display: grid; place-items: center; min-height: 160px; max-height: 62dvh; overflow: hidden; border: 6px solid var(--surface); border-radius: 28px; background: var(--panel); box-shadow: inset 4px 5px 12px var(--shadow), inset -3px -4px 8px var(--clay-highlight), 0 6px 0 -1px var(--border), 6px 12px 22px var(--shadow); }
  .gallery-frame img { display: block; max-width: 100%; max-height: calc(62dvh - 12px); width: auto; height: auto; object-fit: contain; }
  .gallery-nav { position: absolute; top: 50%; z-index: 1; width: 52px; height: 52px; margin-top: -26px; }
  .gallery-nav:hover { transform: translateY(-2px) scale(1.04); }
  .gallery-nav:active { transform: translateY(3px) scale(.97); }
  .gallery-prev { left: -6px; } .gallery-next { right: -6px; }
  .gallery-thumbs { display: flex; gap: 10px; justify-content: center; padding: 6px 4px 10px; overflow-x: auto; scrollbar-width: none; }
  .gallery-thumbs::-webkit-scrollbar { display: none; }
  .gallery-thumb { flex: none; width: 68px; height: 52px; padding: 0; overflow: hidden; border: 3px solid var(--surface); border-radius: 17px; background: var(--panel); box-shadow: 0 4px 0 var(--border), 3px 6px 10px var(--shadow); cursor: pointer; opacity: .78; transition: transform 180ms cubic-bezier(.34, 1.56, .64, 1), opacity 120ms ease-out, box-shadow 180ms ease-out; }
  .gallery-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .gallery-thumb:hover { opacity: 1; transform: translateY(-2px); }
  .gallery-thumb.chosen { opacity: 1; border-color: var(--accent); transform: translateY(-3px) scale(1.06); box-shadow: 0 5px 0 var(--accent-strong), 3px 8px 12px var(--shadow); }
  .gallery-footer { font-size: .77rem; color: var(--muted); }
  .gallery-counter { flex: none; padding: 5px 13px; border-radius: 999px; background: var(--panel); box-shadow: var(--clay-pressed); color: var(--text); font-weight: 800; }
  .gallery-attribution { min-width: 0; overflow-wrap: anywhere; text-align: right; }
  @media (max-width: 560px) {
    .gallery-overlay { padding: 8px; }
    .gallery-dialog { gap: 11px; padding: 12px; border-radius: 28px; }
    .gallery-title strong { font-size: .86rem; }
    .gallery-frame { max-height: 56dvh; border-width: 5px; border-radius: 22px; }
    .gallery-frame img { max-height: calc(56dvh - 10px); }
    .gallery-nav { width: 44px; height: 44px; margin-top: -22px; }
    .gallery-prev { left: -4px; } .gallery-next { right: -4px; }
    .gallery-thumb { width: 58px; height: 46px; border-radius: 14px; }
  }
  @media (prefers-reduced-motion: no-preference) {
    .gallery-dialog { animation: gallery-pop .26s cubic-bezier(.34, 1.56, .64, 1); }
    .gallery-frame img { animation: gallery-photo .22s ease-out; }
    @keyframes gallery-pop { from { opacity: 0; transform: translateY(14px) scale(.94); } to { opacity: 1; transform: none; } }
    @keyframes gallery-photo { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: none; } }
  }
</style>
