<script lang="ts">
  import { onMount } from 'svelte';
  import SupportPanel from '$lib/components/SupportPanel.svelte';
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  import AdSlot from '$lib/components/AdSlot.svelte';
  import AggregateSummary from '$lib/components/AggregateSummary.svelte';
  import SharePanel from '$lib/components/SharePanel.svelte';
  import HeaderControls from '$lib/components/HeaderControls.svelte';
  import { startAtlasStory } from '$lib/motion/atlas-story';
  import type { ShareRegion, ShareSummary } from '$lib/share/card';
  import type { GeometryPackage } from '$lib/geo/types';
  import { m } from '$lib/paraglide/messages.js';
  import Preferences from '$lib/components/Preferences.svelte';
  import PwaManager from '$lib/components/PwaManager.svelte';
  import RegionAtlas from '$lib/components/RegionAtlas.svelte';
  import ProvinceTable from '$lib/components/ProvinceTable.svelte';
  import SnapshotPanel from '$lib/components/SnapshotPanel.svelte';
  import EarthquakePanel from '$lib/components/EarthquakePanel.svelte';
  import HazardPanel from '$lib/components/HazardPanel.svelte';
  import IslandChart from '$lib/components/IslandChart.svelte';
  import RegionSplit from '$lib/components/RegionSplit.svelte';
  import { CloudRain, Activity, Flame, Mountain, MapPin } from 'lucide-svelte';
  import { OVERLAY_DEFINITIONS } from '$lib/map/overlays';
  import { EDITION_COUNTS } from '$lib/atlas/edition';

  let selectedRegion: ShareRegion | undefined;
  let selectedGeometry: GeometryPackage | undefined;
  let publicSummary: ShareSummary | undefined;
  let sharePanel: SharePanel | undefined;
  let shell: HTMLDivElement;
  let atlas: RegionAtlas | undefined;
  let activeSection = 'atlas';
  let showTop = false;
  const sections = [
    { id: 'atlas', label: m.nav_atlas },
    { id: 'provinces', label: m.nav_provinces },
    { id: 'summary', label: m.nav_data },
    { id: 'locations', label: m.nav_locations },
    { id: 'support', label: m.nav_support }
  ];
  // Verified by scripts/import-regions.mjs against the pinned 2025 transcription (416 Kabupaten + 98 Kota).
  const editionStats = [
    { value: EDITION_COUNTS.provinces, label: m.stat_provinces, tone: 'peach' },
    { value: EDITION_COUNTS.regencies, label: m.stat_regencies, tone: 'mint' },
    { value: EDITION_COUNTS.municipalities, label: m.stat_cities, tone: 'lilac' }
  ];

  onMount(() => {
    document.title = m.site_title();
    const stopSections = observeSections();
    const stopStory = startAtlasStory(shell);
    return () => { stopSections(); stopStory(); };
  });

  function currentFor(id: string): 'location' | undefined {
    if (activeSection === id) return 'location';
    return undefined;
  }

  /** Highlight the section in view and reveal the back-to-top control once the hero scrolls away. */
  function observeSections(): () => void {
    if (!('IntersectionObserver' in window)) return () => {};
    const sectionObserver = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length > 0) activeSection = visible[0].target.id;
    }, { rootMargin: '-35% 0px -55% 0px' });
    for (const section of sections) {
      const element = document.getElementById(section.id);
      if (element) sectionObserver.observe(element);
    }
    const hero = document.getElementById('top');
    const heroObserver = new IntersectionObserver(([entry]) => { showTop = !entry.isIntersecting; });
    if (hero) heroObserver.observe(hero);
    return () => { sectionObserver.disconnect(); heroObserver.disconnect(); };
  }

  let activeLayer = 'destinations';
  const overlayIcons = { weather: CloudRain, earthquake: Activity, incident: Flame, hazard: Mountain, mountain: Mountain, landmark: MapPin };
  const layers = OVERLAY_DEFINITIONS.map(layer => ({ ...layer, icon: overlayIcons[layer.icon] }));
</script>

<a class="skip-link" href="#atlas">{m.nav_skip()}</a>
<div class="shell" bind:this={shell}>
  <header class="masthead">
    <a href="/" data-sveltekit-reload class="brand" aria-label="Nusantara">
      <img class="brand-logo" src="/brand/logo.svg" alt="" width="44" height="44" />
      <span class="brand-desktop">Atlas Nusantara</span><span class="brand-mobile">Nusantara</span>
    </a>
    <nav class="section-nav" aria-label={m.nav_label()}>
      {#each sections as section (section.id)}
        <a href={'#' + section.id} class:active={activeSection === section.id} aria-current={currentFor(section.id)}>{section.label()}</a>
      {/each}
    </nav>
    <div class="header-actions"><HeaderControls onshare={() => sharePanel?.openPreview()} /></div>
  </header>
  <SharePanel bind:this={sharePanel} region={selectedRegion} geometry={selectedGeometry} summary={publicSummary} />

  <main>
    <section id="top" class="hero" aria-labelledby="site-title">
      <div class="clay-card hero-card">
        <div class="hero-copy">
          <span class="eyebrow">INDONESIA</span>
          <h1 id="site-title"><span class="brand-desktop">{m.site_title()}</span><span class="brand-mobile">Nusantara</span></h1>
          <p>{m.atlas_intro()}</p>

          <div class="hero-actions">
            <a class="clay-button primary" href="#atlas">{m.nav_atlas()} <span aria-hidden="true">↓</span></a>
            <a class="clay-button" href="#provinces">{m.nav_provinces()}</a>
          </div>

        </div>
        <figure class="hero-art">
          <picture>
            <source type="image/webp" srcset="/illustrations/hero-archipelago-768.webp 768w, /illustrations/hero-archipelago-1200.webp 1200w" sizes="(max-width: 900px) 100vw, 50vw" />
            <img src="/illustrations/hero-archipelago-1200.webp" width="1200" height="800" alt={m.hero_art_alt()} fetchpriority="high" decoding="async" />
          </picture>
        </figure>
      </div>
      <div class="stat-row">
        {#each editionStats as stat (stat.value)}
          <a class={'clay-card stat-card tone-' + stat.tone} href="#provinces">
            <strong>{stat.value}</strong><span>{stat.label()}</span>
          </a>
        {/each}
      </div>
    </section>

    <section id="atlas" class="atlas-section" aria-labelledby="atlas-heading">
      <div class="section-heading">
        <div>
          <span class="eyebrow">INDONESIA</span>
          <h2 id="atlas-heading">{m.nav_atlas()}</h2>
        </div>
        <div class="layer-pills" role="group" aria-label={m.layer_heading()}>
          {#each layers as layer (layer.id)}
            {@const LayerIcon = layer.icon}
            <button type="button" class:chosen={activeLayer === layer.id} aria-pressed={activeLayer === layer.id} onclick={() => activeLayer = layer.id}>
              <LayerIcon size={18} aria-hidden="true" /><span>{layer.label()}</span><span class="source-tag">{layer.source}</span>
            </button>
          {/each}
        </div>
      </div>
      <div class="clay-card atlas-stage">
        <RegionAtlas bind:this={atlas} layer={activeLayer} onselection={(region, geometry) => { selectedRegion = region; selectedGeometry = geometry; }} />
        {#if activeLayer === 'earthquake'}
          <EarthquakePanel />
        {:else if activeLayer === 'incident'}
          <HazardPanel kind="reports" />
        {:else if activeLayer === 'hazard'}
          <HazardPanel kind="warnings" />
        {:else if activeLayer === 'warning'}
          <SnapshotPanel kind="warning" regionCode={selectedRegion?.code} />
        {/if}
      </div>
    </section>

    <section class="insights" aria-label={m.chart_islands_heading()}>
      <IslandChart />
      <RegionSplit />
    </section>

    <ProvinceTable selectedCode={selectedRegion?.code} onopen={code => { void atlas?.openRegion(code); }} />

    <AggregateSummary onsummary={summary => publicSummary = summary} />
    <AdSlot />
    <Preferences {selectedRegion} onopen={code => { activeLayer = 'warning'; void atlas?.openRegion(code); }} />
    <PwaManager />

    <SupportPanel />
  </main>
  <SiteFooter />
</div>
<a class="to-top" class:visible={showTop} href="#top" aria-label={m.nav_top()} inert={!showTop}>↑</a>
