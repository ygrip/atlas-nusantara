<script lang="ts">
  import { onDestroy } from 'svelte';
  import { m } from '$lib/i18n/messages';
  import type { GeometryPackage } from '$lib/geo/types';
  import { makeDestinationShareUrl, makeShareUrl, makeSpeciesShareUrl, renderDestinationShareCard, renderShareCard, renderSpeciesShareCard, summaryForShare, type ShareDestination, type ShareRegion, type ShareSpecies, type ShareSummary } from '$lib/share/card';

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
  .share-actions button, .share-close { min-height: 44px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); padding: 9px 14px; }
  dialog { width: min(680px, calc(100vw - 28px)); max-height: calc(100dvh - 28px); overflow: auto; border: 1px solid var(--border); border-radius: 22px; padding: 0; color: var(--text); background: var(--surface); }
  dialog::backdrop { background: #211f25aa; }
  .share-dialog { padding: clamp(16px, 4vw, 28px); }
  .share-header, .share-actions { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
  .share-header h2 { margin: 0; font-size: 1.2rem; }
  .share-close { width: 44px; padding: 0; font-size: 1.5rem; }
  img { display: block; width: 100%; height: auto; margin: 18px auto; border-radius: 12px; }
  p { color: var(--muted); font-size: .85rem; line-height: 1.5; }
  .share-error { color: var(--danger); }
  .share-status:empty { display: none; }
  .share-actions { justify-content: flex-start; }
  .share-actions button:disabled { opacity: .55; }
</style>
