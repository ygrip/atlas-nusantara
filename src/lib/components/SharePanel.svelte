<script lang="ts">
  import { onDestroy } from 'svelte';
  import { m } from '$lib/i18n/messages';
  import type { GeometryPackage } from '$lib/geo/types';
  import { makeDestinationShareUrl, makeShareUrl, makeDishShareUrl, makeSpeciesShareUrl, renderDestinationShareCard, renderDishShareCard, renderShareCard, renderSpeciesShareCard, summaryForShare, type ShareDestination, type ShareDish, type ShareRegion, type ShareSpecies, type ShareSummary } from '$lib/share/card';

  export let region: ShareRegion | undefined = undefined;
  export let geometry: GeometryPackage | undefined = undefined;
  export let summary: ShareSummary | undefined = undefined;
  /** Each dialog on the page needs its own heading id, or its accessible name points at the first dialog's heading. */
  export let titleId = 'share-dialog-title';

  let dialog: HTMLDialogElement;
  let preview: HTMLImageElement;
  let imageUrl = '';
  let png: Blob | undefined;
  let busy = false;
  let status = '';
  let error = '';
  let disposed = false;
  let returnFocus: HTMLElement | undefined;

  /** Set while a destination card is open, so the link and text describe that place, not the selected province. */
  let destinationShare: { destination: ShareDestination; url: string; heading?: string } | undefined;

  $: url = destinationShare?.url ?? makeShareUrl(region);
  $: shareTitle = destinationShare?.destination.name ?? m.share_card_title();
  $: shareText = destinationShare?.destination.location ?? m.share_card_caveat();
  $: downloadName = destinationShare ? 'nusantara-' + destinationShare.destination.id + '.png' : 'nusantara-snapshot.png';
  $: publicSummary = summaryForShare(summary, region);

  onDestroy(() => {
    disposed = true;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  });

  export async function openPreview() {
    destinationShare = undefined;
    await present(renderRegionCard);
  }

  /** Shares one destination: its photo, name and location, with a link that reopens it in the destinations list. */
  export async function openDestination(request: { destination: ShareDestination; provinceCode: string; geometry?: GeometryPackage }) {
    if (busy) return;
    destinationShare = { destination: request.destination, url: makeDestinationShareUrl(request.provinceCode, request.destination.id) };
    await present(() => renderDestinationShareCard({
      destination: request.destination,
      geometry: request.geometry,
      provinceCode: request.provinceCode,
      caveat: m.share_destination_caveat(),
      noPhoto: m.share_destination_no_photo()
    }));
  }

  /** Shares one flora or fauna species: photo or illustration, names, IUCN status and description, with a link that reopens it. */
  export async function openSpecies(request: { species: ShareSpecies; provinceCode?: string }) {
    if (busy) return;
    const { species } = request;
    destinationShare = {
      destination: { id: species.kind + '-' + species.id, name: species.name, location: species.scientificName + ' · ' + species.statusLabel, kindLabel: species.kindLabel },
      url: makeSpeciesShareUrl(species.kind, request.provinceCode, species.id),
      heading: m.species_share_heading()
    };
    await present(() => renderSpeciesShareCard({ species, caveat: m.species_share_caveat() }));
  }

  /** Shares one dish: photo or illustration, name, group, recipe count and description, with a link that reopens it. */
  export async function openDish(request: { dish: ShareDish; provinceCode?: string }) {
    if (busy) return;
    const { dish } = request;
    destinationShare = {
      destination: { id: 'cuisine-' + dish.id, name: dish.name, location: dish.subtitle + ' · ' + dish.chipLabel, kindLabel: dish.kindLabel },
      url: makeDishShareUrl(request.provinceCode, dish.id),
      heading: m.cuisine_share_heading()
    };
    await present(() => renderDishShareCard({ dish, caveat: m.cuisine_share_caveat() }));
  }

  function renderRegionCard(): Promise<Blob> {
    return renderShareCard({
      region,
      geometry,
      summary: publicSummary,
      title: m.share_card_title(),
      subtitle: m.share_card_subtitle(),
      caveat: m.share_card_caveat(),
      labels: {
        warning: m.share_count_warning(),
        earthquake: m.share_count_earthquake(),
        incident: m.share_count_incident(),
        hazard: m.share_count_hazard()
      },
      unavailable: m.share_map_unavailable()
    });
  }

  async function present(render: () => Promise<Blob>) {
    if (busy) return;
    returnFocus = document.activeElement as HTMLElement;
    busy = true;
    error = '';
    status = '';
    png = undefined;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = '';
    try {
      const blob = await render();
      if (disposed) return;
      png = blob;
      imageUrl = URL.createObjectURL(blob);
      dialog.showModal();
      requestAnimationFrame(() => preview?.focus());
    } catch {
      if (disposed) return;
      error = m.share_image_failed();
      dialog.showModal();
    } finally {
      busy = false;
    }
  }

  function closePreview() {
    dialog.close();
  }

  function restoreFocus() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = '';
    png = undefined;
    if (returnFocus?.isConnected && returnFocus.getClientRects().length > 0) returnFocus.focus();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      status = m.share_link_copied();
      error = '';
    } catch {
      error = m.share_action_failed();
    }
  }

  function downloadPng() {
    if (!png) return;
    const downloadUrl = URL.createObjectURL(png);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = downloadName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }

  async function share() {
    if (!png) return;
    try {
      const files = [new File([png], downloadName, { type: 'image/png' })];
      const shareData: ShareData = { title: shareTitle, text: shareText, url };
      if (navigator.canShare?.({ files })) shareData.files = files;
      if (!navigator.share) {
        await copyLink();
        return;
      }
      await navigator.share(shareData);
      status = m.share_complete();
      error = '';
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      error = m.share_action_failed();
    }
  }
</script>

<section class="share-panel" aria-label={m.share_heading()}>
  <dialog bind:this={dialog} aria-labelledby={titleId} onclose={restoreFocus}>
    <div class="share-dialog">
      <div class="share-header">
        <h2 id={titleId}>{#if destinationShare}{destinationShare.heading ?? m.share_place_heading()}{:else}{m.share_heading()}{/if}</h2>
        <button type="button" class="share-close" onclick={closePreview} aria-label={m.share_close()}>×</button>
      </div>
      {#if imageUrl}<img bind:this={preview} src={imageUrl} alt={m.share_preview_alt()} tabindex="-1" />{/if}
      <p>{#if destinationShare}{destinationShare.destination.name} · {destinationShare.destination.location}{:else}{m.share_card_caveat()}{/if}</p>
      {#if error}<p class="share-error" role="alert">{error}</p>{/if}
      <p class="share-status" role="status" aria-live="polite">{status}</p>
      <div class="share-actions">
        <button type="button" onclick={share} disabled={!png}>{m.share_action()}</button>
        <button type="button" onclick={copyLink}>{m.share_copy_link()}</button>
        <button type="button" onclick={downloadPng} disabled={!png}>{m.share_download_png()}</button>
      </div>
    </div>
  </dialog>
</section>

<style>
  .share-actions button, .share-close { min-height: 44px; border: 1px solid var(--border); border-radius: 15px; background: linear-gradient(160deg, var(--surface), var(--panel)); color: var(--text); padding: 9px 14px; box-shadow: 0 4px 0 -1px var(--border), 0 7px 14px -8px var(--shadow), inset 0 2px 1px var(--clay-highlight), inset 0 -2px 4px var(--shadow); cursor: pointer; transition: transform 140ms ease-out, box-shadow 140ms ease-out, color 140ms ease-out; }
  .share-actions button:hover, .share-close:hover { color: var(--accent); transform: translateY(-1px); }
  .share-actions button:active, .share-close:active { transform: translateY(2px); box-shadow: 0 1px 0 -1px var(--border), inset 0 2px 5px var(--shadow); }
  .share-actions button:first-child { border-color: color-mix(in srgb, var(--accent) 60%, var(--border)); background: linear-gradient(155deg, color-mix(in srgb, var(--accent) 90%, white), var(--accent) 55%, var(--accent-strong)); color: var(--on-accent); box-shadow: 0 4px 0 -1px var(--accent-strong), 0 7px 14px -8px var(--shadow), inset 0 2px 2px #ffffff55; font-weight: 800; }
  .share-actions button:first-child:hover { color: var(--on-accent); filter: brightness(1.04); }
  .share-actions button:focus-visible, .share-close:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 70%, transparent); outline-offset: 3px; }
  dialog { width: min(680px, calc(100vw - 28px)); max-height: calc(100dvh - 28px); overflow: auto; border: 1px solid var(--border); border-radius: 22px; padding: 0; color: var(--text); background: var(--surface); }
  dialog::backdrop { background: #211f25aa; }
  .share-dialog { padding: clamp(16px, 4vw, 28px); }
  .share-header, .share-actions { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
  .share-header h2 { margin: 0; font-size: 1.2rem; }
  .share-close { display: grid; place-items: center; flex: none; width: 44px; padding: 0; border-radius: 50%; font-size: 1.5rem; }
  img { display: block; width: 100%; height: auto; margin: 18px auto; border-radius: 12px; }
  p { color: var(--muted); font-size: .85rem; line-height: 1.5; }
  .share-error { color: var(--danger); }
  .share-status:empty { display: none; }
  .share-actions { justify-content: flex-start; }
  .share-actions button:disabled { opacity: .55; cursor: not-allowed; box-shadow: 0 2px 0 -1px var(--border), inset 0 1px 1px var(--clay-highlight); transform: none; filter: none; }
  @media (prefers-reduced-motion: reduce) { .share-actions button, .share-close { transition: none; } }
</style>
