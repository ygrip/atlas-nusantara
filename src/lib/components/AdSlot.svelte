<script lang="ts">
  import { onMount } from 'svelte';
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

  let adElement = $state<HTMLElement>();
  let hidden = $state(false);
  let mounted = false;
  let requesting = false;
  let requested = false;
  let nearViewport = false;
  let resizeObserver: ResizeObserver | undefined;

  onMount(() => {
    if (!adElement || !adsConfig) return;
    mounted = true;
    const element = adElement;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    // Google may defer a below-fold placement. Do not expire it before a visitor can reach it.
    const visibilityObserver = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || timeout !== undefined) return;
      timeout = setTimeout(() => {
        hidden = true;
        resizeObserver?.disconnect();
      }, 30_000);
      visibilityObserver.disconnect();
    });
    visibilityObserver.observe(element);
    // Automatic loading starts shortly before the placement is visible, not during hero paint.
    const loadingObserver = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      nearViewport = true;
      void loadAd();
      loadingObserver.disconnect();
    }, { rootMargin: '500px 0px' });
    loadingObserver.observe(element);
    function updateStatus() {
      const status = element.dataset.adStatus;
      if (status !== 'filled' && status !== 'unfilled') return;
      clearTimeout(timeout);
      visibilityObserver.disconnect();
      hidden = status === 'unfilled';
      resizeObserver?.disconnect();
    }
    const observer = new MutationObserver(updateStatus);
    observer.observe(element, { attributes: true, attributeFilter: ['data-ad-status'] });
    resizeObserver = new ResizeObserver(() => { void loadAd(); });
    resizeObserver.observe(element);
    updateStatus();
    void loadAd();
    return () => {
      mounted = false;
      clearTimeout(timeout);
      observer.disconnect();
      loadingObserver.disconnect();
      visibilityObserver.disconnect();
      resizeObserver?.disconnect();
    };
  });

  async function loadAd() {
    if (!nearViewport || !adsConfig || !adElement || requested || requesting || !canRequestAd(adElement)) return;
    requesting = true;
    try {
      requested = await requestAd(adElement, adsConfig.client);
      if (requested) resizeObserver?.disconnect();
    } catch (error) {
      if (mounted) hidden = true;
      resizeObserver?.disconnect();
      console.warn('Advertisement could not load', error);
    } finally {
      requesting = false;
    }
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
  <aside class="ad-slot network-ad-slot" aria-label={m.advertisement()} {hidden}>
    <span class="ad-label">{m.advertisement()}</span>
    <ins bind:this={adElement} class="adsbygoogle" data-ad-client={adsConfig.client} data-ad-slot={adsConfig.placements.home} data-ad-format="auto" data-full-width-responsive="true" data-adtest={testAttribute}></ins>
  </aside>
{/if}

<style>
  .ad-slot { margin-block: 40px; padding: 16px; border-block: 1px solid var(--line); }
  .ad-label { display: block; margin-bottom: 12px; color: var(--muted); font-size: 12px; text-align: center; }
  .network-ad-slot { min-height: 250px; text-align: center; }
  .network-ad-slot[hidden] { display: none; }
  .adsbygoogle { display: block; width: 100%; min-height: 250px; }
</style>
