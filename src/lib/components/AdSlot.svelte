<script lang="ts">
  import { tick } from 'svelte';
  import { m } from '$lib/i18n/messages';
  import { adsConfig } from '$lib/ads/config';
  import { canRequestAd, requestAd } from '$lib/ads/client';

  const sponsorEnabled = import.meta.env.VITE_SPONSOR_ENABLED === 'true';
  const sponsorTitle = String(import.meta.env.VITE_SPONSOR_TITLE ?? '').slice(0, 120);
  let sponsorHref = $state<string>();
  try {
    const url = new URL(String(import.meta.env.VITE_SPONSOR_URL ?? ''));
    if (url.protocol === 'https:' && !url.username && !url.password) sponsorHref = url.href;
  } catch { sponsorHref = undefined; }

  let optedIn = $state(false);
  let adReady = $state(false);
  let adElement = $state<HTMLElement>();
  let adError = $state(false);
  let adUnfilled = $state(false);

  $effect(() => {
    const element = adElement;
    if (!element) return;
    const updateStatus = () => { adUnfilled = element.dataset.adStatus === 'unfilled'; };
    const observer = new MutationObserver(updateStatus);
    observer.observe(element, { attributes: true, attributeFilter: ['data-ad-status'] });
    updateStatus();
    return () => observer.disconnect();
  });

  async function loadAd() {
    if (!adsConfig || !optedIn || !adElement || adReady) return;
    if (!canRequestAd(adElement)) return;
    try {
      adReady = await requestAd(adElement, adsConfig.client);
      adError = !adReady;
    } catch (error) {
      adError = true;
      console.warn('Optional advertisement could not load', error);
    }
  }

  function allowAds() {
    optedIn = true;
    void tick().then(loadAd);
  }

  const testAttribute = $derived.by(() => {
    if (adsConfig?.testMode) return 'on';
    return undefined;
  });

</script>

{#if sponsorEnabled && sponsorHref && sponsorTitle}
  <aside class="ad-slot" aria-label={m.advertisement()}>
    <span>{m.advertisement()}</span><strong>{sponsorTitle}</strong>
    <a href={sponsorHref} target="_blank" rel="sponsored noopener noreferrer">{m.sponsor_action()} ↗</a>
  </aside>
{/if}

{#if adsConfig}
  <aside class="ad-slot network-ad-slot" aria-label={m.advertisement()}>
    <span class="ad-label">{m.advertisement()}{#if adsConfig.testMode} · test ad{/if}</span>
    {#if !optedIn}
      <p>Google advertisements are optional. Continue only if you agree to load Google advertising content from third parties.</p>
      <button type="button" onclick={allowAds}>Load advertisement</button>
    {:else}
      <ins bind:this={adElement} class="adsbygoogle" data-ad-client={adsConfig.client} data-ad-slot={adsConfig.placements.home} data-ad-format="auto" data-full-width-responsive="true" data-adtest={testAttribute}></ins>
      {#if adError}<p role="status">The optional advertisement could not load. The atlas remains available.</p>
      {:else if adUnfilled}<p role="status">Google returned no advertisement for this request. The atlas remains available.</p>{/if}
    {/if}
  </aside>
{/if}

<style>
  .ad-slot { margin-block: 40px; padding: 16px; border-block: 1px solid var(--line); }
  .ad-label { display: block; margin-bottom: 12px; color: var(--muted); font-size: 12px; text-align: center; }
  .network-ad-slot { min-height: 250px; text-align: center; }
  .network-ad-slot p { margin: 12px auto; max-width: 42rem; color: var(--muted); }
  .network-ad-slot button { min-height: 44px; padding: 8px 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); font: inherit; cursor: pointer; }
  .adsbygoogle { display: block; width: 100%; min-height: 250px; }
</style>
