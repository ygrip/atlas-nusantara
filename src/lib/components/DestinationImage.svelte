<script lang="ts">
  import { onMount } from 'svelte';
  import { ImageOff } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  let { name, commonsFile }: { name: string; commonsFile?: string } = $props();
  let root = $state<HTMLDivElement>();
  let image = $state<{ url: string; descriptionUrl: string; credit: string; license: string }>();
  const cache = new Map<string, Promise<NonNullable<typeof image> | undefined>>();
  // Commons API returns the exact file metadata, including license information.
  async function lookup(term: string, file?: string): Promise<NonNullable<typeof image> | undefined> {
    const params = new URLSearchParams({
      action: 'query', format: 'json', origin: '*', prop: 'imageinfo',
      iiprop: 'url|extmetadata', iiurlwidth: '500'
    });
    if (file) params.set('titles', file);
    else {
      params.set('generator', 'search');
      params.set('gsrsearch', 'intitle:"' + term.replace(/"/g, '') + '"');
      params.set('gsrnamespace', '6');
      params.set('gsrlimit', '5');
    }
    const response = await fetch('https://commons.wikimedia.org/w/api.php?' + params, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) return undefined;
    const payload = await response.json();
    const pages = Object.values(payload?.query?.pages ?? {}) as Array<{ title?: string; imageinfo?: Array<{ thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }> }>;
    const normalized = term.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const match = pages.find(page => page.imageinfo?.[0]?.thumburl && (file || (page.title ?? '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').includes(normalized)));
    const details = match?.imageinfo?.[0];
    if (!details?.thumburl || !details.descriptionurl?.startsWith('https://commons.wikimedia.org/')) return undefined;
    const plain = (value?: string) => (value ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').slice(0, 180);
    return {
      url: details.thumburl, descriptionUrl: details.descriptionurl,
      credit: plain(details.extmetadata?.Artist?.value) || 'Wikimedia Commons',
      license: plain(details.extmetadata?.LicenseShortName?.value) || 'See image source'
    };
  }
  onMount(() => {
    if (!root) return;
    let cancelled = false;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      const key = commonsFile ?? name;
      if (!cache.has(key)) cache.set(key, lookup(name, commonsFile).catch(() => undefined));
      void cache.get(key)?.then(value => { if (!cancelled) image = value; });
    }, { rootMargin: '250px' });
    observer.observe(root);
    return () => { cancelled = true; observer.disconnect(); };
  });
</script>

<div class="destination-image" bind:this={root}>
  {#if image}
    <img src={image.url} alt={name} loading="lazy" decoding="async" onerror={() => { image = undefined; }} />
    <a href={image.descriptionUrl} target="_blank" rel="noopener noreferrer" class="photo-credit" title={image.credit + ' · ' + image.license}>{image.license} · Commons ↗</a>
  {:else}
    <span class="destination-placeholder"><ImageOff size={26} strokeWidth={1.6} aria-hidden="true" /><small>{m.destination_no_image()}</small></span>
  {/if}
</div>

<style>
  .destination-image { position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; background: linear-gradient(135deg, color-mix(in srgb, var(--mint, #cce9df) 60%, var(--surface, #fff)), var(--panel, #f1e9df)); border-radius: 15px 15px 10px 10px; }
  img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .destination-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 100%; color: var(--muted); }
  .destination-placeholder small { font-size: .72rem; font-weight: 750; }
  .photo-credit { position: absolute; bottom: 6px; right: 6px; max-width: calc(100% - 12px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .66rem; background: #151a20cc; color: white; padding: 4px 7px; border-radius: 8px; }
</style>
