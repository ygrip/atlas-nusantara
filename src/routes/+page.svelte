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
  import { m, type MessageKey } from '$lib/i18n/messages';
  import Preferences from '$lib/components/Preferences.svelte';
  import { pathFor } from '$lib/i18n/links';
  import PwaManager from '$lib/components/PwaManager.svelte';
  import PopulationPanel from '$lib/components/PopulationPanel.svelte';
  import LanguagePanel from '$lib/components/LanguagePanel.svelte';
  import LayerPicker from '$lib/components/LayerPicker.svelte';
  import RegionAtlas from '$lib/components/RegionAtlas.svelte';
  import ProvinceExplorer from '$lib/components/ProvinceExplorer.svelte';
  import SnapshotPanel from '$lib/components/SnapshotPanel.svelte';
  import EarthquakePanel from '$lib/components/EarthquakePanel.svelte';
  import HazardPanel from '$lib/components/HazardPanel.svelte';
  import CuisinePanel from '$lib/components/CuisinePanel.svelte';
  import { observatoryKind } from '$lib/data/observatory';
  import { tick } from 'svelte';
  import NationalStats from '$lib/components/NationalStats.svelte';
  import { CloudRain, Activity, Flame, Mountain, MapPin, Users, Languages, Leaf, PawPrint, UtensilsCrossed } from 'lucide-svelte';
  import { OVERLAY_DEFINITIONS } from '$lib/map/overlays';

  let selectedRegion: ShareRegion | undefined;
  let selectedGeometry: GeometryPackage | undefined;
  let publicSummary: ShareSummary | undefined;
  let sharePanel: SharePanel | undefined;
  let shell: HTMLDivElement;
  let atlas: RegionAtlas | undefined;
  let activeSection = 'atlas';
  let showTop = false;
  const allSections: { id: string; label: MessageKey }[] = [
    { id: 'atlas', label: 'nav_atlas' },
    { id: 'provinces', label: 'nav_provinces' },
    { id: 'summary', label: 'nav_data' },
    { id: 'locations', label: 'nav_locations' },
    { id: 'support', label: 'nav_support' }
  ];
  /** The observatory section only exists for layers that have collected observations. */
  $: sections = allSections.filter(section => section.id !== 'summary' || observatoryKind(activeLayer));
  let mounted = false;
  let stopSections: (() => void) | undefined;
  /** Sections can appear or disappear with the layer, so the observer is rebuilt after each layer change. */
  $: if (mounted) { void activeLayer; void tick().then(restartSectionObserver); }
  function restartSectionObserver() {
    stopSections?.();
    stopSections = observeSections();
  }
  onMount(() => {
    activeLayer = layerFromUrl();
    mounted = true;
    const stopStory = startAtlasStory(shell);
    return () => { stopSections?.(); stopSections = undefined; stopStory(); };
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

  const DEFAULT_LAYER = 'warning';
  let activeLayer = DEFAULT_LAYER;
  /** Shared by the population panel and the map heat colours so both always show the same year. */
  let populationYear: number | undefined;
  const overlayIcons = { weather: CloudRain, earthquake: Activity, incident: Flame, hazard: Mountain, mountain: Mountain, landmark: MapPin, population: Users, language: Languages, flora: Leaf, fauna: PawPrint, food: UtensilsCrossed };
  const layers = OVERLAY_DEFINITIONS.map(layer => ({ ...layer, icon: overlayIcons[layer.icon] }));

  /** A shared link may carry ?layer=<id>; unknown ids fall back to the weather layer. */
  function layerFromUrl(): string {
    const requested = new URL(location.href).searchParams.get('layer');
    if (requested && layers.some(layer => layer.id === requested)) return requested;
    return DEFAULT_LAYER;
  }

  function chooseLayer(id: string) {
    activeLayer = id;
    const url = new URL(location.href);
    if (id === DEFAULT_LAYER) url.searchParams.delete('layer');
    else url.searchParams.set('layer', id);
    history.replaceState(history.state, '', url);
  }
</script>

<svelte:head><title>{m.site_title()} — {m.og_headline()}</title></svelte:head>
<a class="skip-link" href="#atlas">{m.nav_skip()}</a>
<div class="shell" bind:this={shell}>
  <header class="masthead">
    <a href={pathFor('/')} data-sveltekit-reload class="brand" aria-label="Nusantara">
      <img class="brand-logo" src="/brand/indonesia-clay.webp" alt="" width="44" height="44" />
      <span class="brand-desktop">Atlas Nusantara</span><span class="brand-mobile">Nusantara</span>
    </a>
    <nav class="section-nav" aria-label={m.nav_label()}>
      {#each sections as section (section.id)}
        <a href={'#' + section.id} class:active={activeSection === section.id} aria-current={currentFor(section.id)}>{m[section.label]()}</a>
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
      <NationalStats />
    </section>

    <section id="atlas" class="atlas-section" aria-labelledby="atlas-heading">
      <div class="section-heading">
        <div>
          <span class="eyebrow">INDONESIA</span>
          <h2 id="atlas-heading">{m.nav_atlas()}</h2>
        </div>
        <LayerPicker {layers} value={activeLayer} onchange={chooseLayer} />
      </div>
      <div class="clay-card atlas-stage">
        <RegionAtlas bind:this={atlas} layer={activeLayer} {populationYear} onselection={(region, geometry) => { selectedRegion = region; selectedGeometry = geometry; }} />
        {#if activeLayer === 'cuisine'}
          <CuisinePanel provinceCode={selectedRegion?.code.split('.')[0]} />
        {:else if activeLayer === 'earthquake'}
          <EarthquakePanel />
        {:else if activeLayer === 'incident'}
          <HazardPanel kind="reports" />
        {:else if activeLayer === 'hazard'}
          <HazardPanel kind="warnings" />
        {:else if activeLayer === 'population'}
          <PopulationPanel provinceCode={selectedRegion?.code.split('.')[0]} regionCode={selectedRegion?.code} regionName={selectedRegion?.name} bind:year={populationYear} />
        {:else if activeLayer === 'language'}
          <LanguagePanel provinceCode={selectedRegion?.code.split('.')[0]} />
        {:else if activeLayer === 'warning'}
          <SnapshotPanel kind="warning" regionCode={selectedRegion?.code} />
        {/if}
      </div>
    </section>

    <ProvinceExplorer selectedCode={selectedRegion?.code} onopen={code => { void atlas?.openRegion(code); }} />

    <AggregateSummary layer={activeLayer} onsummary={summary => publicSummary = summary} />
    <AdSlot />
    <Preferences {selectedRegion} onopen={code => { chooseLayer('warning'); void atlas?.openRegion(code); }} />
    <PwaManager />

    <SupportPanel />
  </main>
  <SiteFooter />
</div>
<a class="to-top" class:visible={showTop} href="#top" aria-label={m.nav_top()} inert={!showTop}>↑</a>
