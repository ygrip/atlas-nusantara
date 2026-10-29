<script lang="ts">
  import { onDestroy } from 'svelte';
  import { ArrowUpRight, Download, Share2 } from 'lucide-svelte';
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
  let renderRequest = 0;
  let returnFocus: HTMLElement | undefined;
  let shareTitle = '';
  let shareText = '';

  /** Set while a destination card is open, so the link and text describe that place, not the selected province. */
  let destinationShare: { destination: ShareDestination; url: string; text: string; heading?: string } | undefined;

  $: url = destinationShare?.url ?? makeShareUrl(region);
  $: {
    const itemName = destinationShare?.destination.name ?? region?.name;
    shareTitle = m.site_title() + ' — ' + m.og_headline();
    if (itemName) shareTitle = itemName + ' — ' + m.site_title();
    shareText = m.share_atlas_text();
    if (region) shareText = m.share_region_text({ name: region.name });
    if (destinationShare) shareText = destinationShare.text;
  }
  $: downloadName = destinationShare ? 'nusantara-' + destinationShare.destination.id + '.png' : 'nusantara-snapshot.png';
  $: publicSummary = summaryForShare(summary, region);

  onDestroy(() => {
    disposed = true;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  });

  export async function openPreview() {
    if (busy) return;
    destinationShare = undefined;
    await present(renderRegionCard);
  }

  /** Shares one destination: its photo, name and location, with a link that reopens it in the destinations list. */
  export async function openDestination(request: { destination: ShareDestination; provinceCode: string; geometry?: GeometryPackage }) {
    if (busy) return;
    destinationShare = {
      destination: request.destination,
      url: makeDestinationShareUrl(request.provinceCode, request.destination.id),
      text: m.share_destination_text({ name: request.destination.name, location: request.destination.location })
    };
    await present(() => renderDestinationShareCard({
      destination: request.destination,
      geometry: request.geometry,
      provinceCode: request.provinceCode,
      caveat: m.share_destination_caveat(),
      noPhoto: m.share_destination_no_photo(),
      visitLabel: m.share_visit_cta()
    }));
  }

  /** Shares one flora or fauna species: photo or illustration, names, IUCN status and description, with a link that reopens it. */
  export async function openSpecies(request: { species: ShareSpecies; provinceCode?: string }) {
    if (busy) return;
    const { species } = request;
    destinationShare = {
      destination: { id: species.kind + '-' + species.id, name: species.name, location: species.scientificName + ' · ' + species.statusLabel, kindLabel: species.kindLabel },
      url: makeSpeciesShareUrl(species.kind, request.provinceCode, species.id),
      heading: m.species_share_heading(),
      text: m.share_species_text({ name: species.name, scientificName: species.scientificName })
    };
    await present(() => renderSpeciesShareCard({ species, caveat: m.species_share_caveat(), visitLabel: m.share_visit_cta() }));
  }

  /** Shares one dish: photo or illustration, name, group, recipe count and description, with a link that reopens it. */
  export async function openDish(request: { dish: ShareDish; provinceCode?: string }) {
    if (busy) return;
    const { dish } = request;
    destinationShare = {
      destination: { id: 'cuisine-' + dish.id, name: dish.name, location: dish.subtitle + ' · ' + dish.chipLabel, kindLabel: dish.kindLabel },
      url: makeDishShareUrl(request.provinceCode, dish.id),
      heading: m.cuisine_share_heading(),
      text: m.share_dish_text({ name: dish.name })
    };
    await present(() => renderDishShareCard({ dish, caveat: m.cuisine_share_caveat(), visitLabel: m.share_visit_cta() }));
  }

  function renderRegionCard(): Promise<Blob> {
    let subtitle = m.og_tagline();
    if (region) subtitle = m.share_card_subtitle();
    return renderShareCard({
      region,
      geometry,
      summary: publicSummary,
      title: region?.name ?? m.og_headline(),
      subtitle,
      caveat: m.share_card_caveat(),
      labels: {
        warning: m.share_count_warning(),
        earthquake: m.share_count_earthquake(),
        incident: m.share_count_incident(),
        hazard: m.share_count_hazard()
      },
      unavailable: m.share_map_unavailable(),
      visitLabel: m.share_visit_cta()
    });
  }

  async function present(render: () => Promise<Blob>) {
    if (busy) return;
    returnFocus = document.activeElement as HTMLElement;
    const request = ++renderRequest;
    busy = true;
    error = '';
    status = '';
    png = undefined;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = '';
    dialog.showModal();
    try {
      const blob = await render();
      if (disposed || request !== renderRequest || !dialog.open) return;
      png = blob;
      imageUrl = URL.createObjectURL(blob);
      requestAnimationFrame(() => preview?.focus());
    } catch {
      if (disposed || request !== renderRequest || !dialog.open) return;
      error = m.share_image_failed();
    } finally {
      if (request === renderRequest) busy = false;
    }
  }

  function closePreview() {
    dialog.close();
  }

  function restoreFocus() {
    renderRequest += 1;
    busy = false;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = '';
    png = undefined;
    if (returnFocus?.isConnected && returnFocus.getClientRects().length > 0) returnFocus.focus();
  }

  async function copyShareText() {
    try {
      await navigator.clipboard.writeText(shareText + '\n\n' + url);
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
      const canShareFile = navigator.canShare?.({ files }) ?? false;
      if (canShareFile) shareData.files = files;
      if (!navigator.share) {
        await copyShareText();
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
  <dialog bind:this={dialog} aria-labelledby={titleId} aria-busy={busy} onclose={restoreFocus}>
    <div class="share-dialog">
      <div class="share-header">
        <div class="share-identity">
          <span class="share-logo"><img src="/brand/logo-96.webp" alt="" aria-hidden="true" width="44" height="44" /></span>
          <div><p class="share-brand-name">{m.site_title()}</p><h2 id={titleId}>{#if destinationShare}{destinationShare.heading ?? m.share_place_heading()}{:else}{m.share_heading()}{/if}</h2></div>
        </div>
        <button type="button" class="share-close" onclick={closePreview} aria-label={m.share_close()}>×</button>
      </div>
      <div class="share-body">
        {#if busy}
          <p class="share-loading" role="status" aria-live="polite"><span class="share-spinner" aria-hidden="true"></span>{m.share_generating()}</p>
        {:else if imageUrl}<img class="share-preview" bind:this={preview} src={imageUrl} alt={m.share_preview_alt()} tabindex="-1" />{/if}
        <p class="share-caption">{shareText}</p>
        <a class="share-site" href={url} target="_blank" rel="noopener noreferrer">nusantara.readynaz.com<ArrowUpRight size={15} aria-hidden="true" /></a>
      </div>
      {#if error}<p class="share-error" role="alert">{error}</p>{/if}
      <p class="share-status" role="status" aria-live="polite">{status}</p>
      <div class="share-actions">
        <button type="button" onclick={share} disabled={!png || busy}><Share2 size={18} aria-hidden="true" /><span>{m.share_action()}</span></button>
        <button type="button" onclick={downloadPng} disabled={!png || busy}><Download size={18} aria-hidden="true" /><span>{m.share_download_png()}</span></button>
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
  dialog { width: min(680px, calc(100vw - 28px)); max-height: calc(100dvh - 28px); overflow: hidden; border: 1px solid var(--border); border-radius: 28px; padding: 0; color: var(--text); background: linear-gradient(145deg, var(--surface), var(--panel)); box-shadow: 0 8px 0 -2px var(--border), 0 26px 70px -16px var(--shadow), inset 0 2px 3px var(--clay-highlight), inset 0 -4px 12px color-mix(in srgb, var(--shadow) 35%, transparent); }
  dialog::backdrop { background: #211f25aa; }
  .share-dialog { display: flex; flex-direction: column; max-height: calc(100dvh - 30px); padding: clamp(16px, 4vw, 28px); }
  .share-header { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex: none; padding-bottom: 16px; }
  .share-identity { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .share-identity > div { min-width: 0; }
  .share-logo { display: grid; place-items: center; width: 56px; height: 56px; flex: none; border: 1px solid var(--border); border-radius: 18px; background: linear-gradient(145deg, var(--surface), var(--panel)); box-shadow: 0 4px 0 -1px var(--border), 0 7px 12px -6px var(--shadow), inset 2px 2px 3px var(--clay-highlight), inset -2px -3px 5px var(--shadow); }
  .share-logo img { display: block; width: 44px; height: 44px; object-fit: contain; }
  .share-brand-name { margin: 0 0 3px; color: var(--accent); font-size: .75rem; font-weight: 900; letter-spacing: .04em; }
  .share-body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 4px 4px 10px; scrollbar-gutter: stable; }
  .share-caption { margin: 16px 0 0; color: var(--text); text-wrap: pretty; }
  .share-site { display: inline-flex; align-items: center; gap: 5px; min-height: 44px; color: var(--accent); font-size: .8rem; font-weight: 800; overflow-wrap: anywhere; }
  .share-site:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; border-radius: 5px; }
  .share-actions { align-items: center; gap: 10px; }
  .share-header h2 { margin: 0; font-size: 1.1rem; overflow-wrap: anywhere; }
  .share-close { display: grid; place-items: center; flex: none; width: 44px; padding: 0; border-radius: 50%; font-size: 1.5rem; }
  .share-preview { display: block; width: 100%; height: auto; margin: 0 auto; border: 1px solid var(--border); border-radius: 22px; box-shadow: 0 4px 0 -1px var(--border), 0 10px 20px -10px var(--shadow); }
  p { color: var(--muted); font-size: .85rem; line-height: 1.5; }
  .share-error { color: var(--danger); }
  .share-status:empty { display: none; }
  .share-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; flex: none; padding-top: 12px; }
  .share-actions button { display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; width: 100%; min-height: 50px; padding: 10px 12px; font-size: .875rem; line-height: 1.35; font-weight: 800; }
  .share-actions button span { overflow-wrap: anywhere; }
  .share-loading { display: flex; align-items: center; justify-content: center; gap: 12px; aspect-ratio: 1; margin: 18px 0; }
  .share-spinner { width: 24px; height: 24px; flex: none; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: share-spin 800ms linear infinite; }
  @keyframes share-spin { to { transform: rotate(360deg); } }
  .share-actions button:disabled { opacity: .55; cursor: not-allowed; box-shadow: 0 2px 0 -1px var(--border), inset 0 1px 1px var(--clay-highlight); transform: none; filter: none; }
  @media (prefers-reduced-motion: reduce) { .share-actions button, .share-close { transition: none; } .share-spinner { animation: none; border-top-color: var(--border); } }
</style>
