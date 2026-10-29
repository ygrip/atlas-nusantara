<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowUp } from 'lucide-svelte';
  import SupportPanel from '$lib/components/SupportPanel.svelte';
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  import AdSlot from '$lib/components/AdSlot.svelte';
  import HeaderControls from '$lib/components/HeaderControls.svelte';

  import HeroArchipelago from '$lib/components/HeroArchipelago.svelte';
  import type { ShareRegion, ShareSummary } from '$lib/share/card';
  import type { GeometryPackage } from '$lib/geo/types';
  import { m, type MessageKey } from '$lib/i18n/messages';
  import Preferences from '$lib/components/Preferences.svelte';
  import { pathFor } from '$lib/i18n/links';
  import PwaManager from '$lib/components/PwaManager.svelte';
  import LayerPicker from '$lib/components/LayerPicker.svelte';
  import { afterLoadIdle } from '$lib/perf/idle';
  import ProvinceExplorer from '$lib/components/ProvinceExplorer.svelte';
  import { observatoryKind } from '$lib/data/observatory';
  import { tick } from 'svelte';
  import NationalStats from '$lib/components/NationalStats.svelte';
  import { CloudRain, Activity, Flame, Mountain, MapPin, Users, Languages, Leaf, PawPrint, UtensilsCrossed } from 'lucide-svelte';
  import { OVERLAY_DEFINITIONS } from '$lib/map/overlays';

  let selectedRegion: ShareRegion | undefined;
  let selectedGeometry: GeometryPackage | undefined;
  let publicSummary: ShareSummary | undefined;
  /** The share dialog and the layer panels are downloaded when first needed, not with the page. */
  type ShareDialog = typeof import('$lib/components/SharePanel.svelte').default;
  let ShareDialogComponent: ShareDialog | undefined;
  let sharePanel: { openPreview: () => unknown } | undefined;
  const panelModules = {
    earthquake: () => import('$lib/components/EarthquakePanel.svelte'),
    hazard: () => import('$lib/components/HazardPanel.svelte'),
    population: () => import('$lib/components/PopulationPanel.svelte'),
    language: () => import('$lib/components/LanguagePanel.svelte'),
    weather: () => import('$lib/components/WeatherPanel.svelte')
  };

  async function openShare() {
    if (!ShareDialogComponent) ShareDialogComponent = (await import('$lib/components/SharePanel.svelte')).default;
    await tick();
    sharePanel?.openPreview();
  }

  /**
   * The map, its data loaders and the observatory are the bulk of the page script. They are fetched once the
   * hero has painted (once the page is idle) so they stay off the
   * critical path of first paint.
   */
  type AtlasComponent = typeof import('$lib/components/RegionAtlas.svelte').default;
  type SummaryComponent = typeof import('$lib/components/AggregateSummary.svelte').default;
  let AtlasView: AtlasComponent | undefined;
  let SummaryView: SummaryComponent | undefined;
  let atlas: InstanceType<AtlasComponent> | undefined;
  let deferredLoading: Promise<void> | undefined;
  /** Layer panels wait for the same signal so their data never races the first paint. */
  let panelsReady = false;

  function loadDeferredSections(): Promise<void> {
    if (!deferredLoading) {
      deferredLoading = Promise.all([
        import('$lib/components/RegionAtlas.svelte'),
        import('$lib/components/AggregateSummary.svelte')
      ]).then(([atlasModule, summaryModule]) => {
        AtlasView = atlasModule.default;
        SummaryView = summaryModule.default;
        panelsReady = true;
      });
    }
    return deferredLoading;
  }

  /** Opens a region from outside the map, loading the map first when it is not there yet. */
  async function openRegion(code: string) {
    await loadDeferredSections();
    await tick();
    void atlas?.openRegion(code);
  }

  /**
   * Loads right after the page goes idle. It deliberately ignores scroll and touch: parsing the map bundle
   * while the user is mid-scroll makes scrolling stutter, and idle already comes well before they reach it.
   */
  function startDeferredLoading(): () => void {
    return afterLoadIdle(() => { void loadDeferredSections(); }, 1500);
  }
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
    const stopDeferred = startDeferredLoading();
    return () => { stopDeferred(); stopSections?.(); stopSections = undefined; };
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
<div class="shell">
  <header class="masthead">
    <a href={pathFor('/')} data-sveltekit-reload class="brand" aria-label="Nusantara">
      <img class="brand-logo" src="/brand/logo-96.webp" alt="" width="44" height="44" />
      <span class="brand-desktop">Atlas Nusantara</span><span class="brand-mobile">Nusantara</span>
    </a>
    <nav class="section-nav" aria-label={m.nav_label()}>
      {#each sections as section (section.id)}
        <a href={'#' + section.id} class:active={activeSection === section.id} aria-current={currentFor(section.id)}>{m[section.label]()}</a>
      {/each}
    </nav>
    <div class="header-actions"><HeaderControls onshare={openShare} /></div>
  </header>
  {#if ShareDialogComponent}<svelte:component this={ShareDialogComponent} bind:this={sharePanel} region={selectedRegion} geometry={selectedGeometry} summary={publicSummary} />{/if}

  <main>
    <section id="top" class="hero" aria-labelledby="site-title">
      <div class="clay-card hero-card">
        <HeroArchipelago alt={m.hero_art_alt()} />
        <div class="hero-copy">
          <span class="eyebrow rise" style="--i:0">INDONESIA</span>
          <h1 id="site-title"><span class="brand-desktop">{m.site_title()}</span><span class="brand-mobile">Nusantara</span></h1>
          <span class="hero-tagline rise" style="--i:3">{m.og_headline()}</span>
          <p>{m.atlas_intro()}</p>

          <div class="hero-actions rise" style="--i:5">
            <a class="clay-button primary" href="#atlas">{m.hero_cta_atlas()} <span aria-hidden="true">↓</span></a>
            <a class="clay-button" href="#provinces">{m.hero_cta_provinces()}</a>
          </div>
        </div>
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
      <div class="clay-card atlas-stage" class:pending={!AtlasView}>
        {#if AtlasView}
          <svelte:component this={AtlasView} bind:this={atlas} layer={activeLayer} {populationYear} onselection={(region, geometry) => { selectedRegion = region; selectedGeometry = geometry; }} />
        {:else}
          <p class="atlas-pending" role="status">{m.loading_data()}</p>
        {/if}
        {#if !panelsReady}
          <!-- Layer panels load with the map. -->
        {:else if activeLayer === 'earthquake'}
          {#await panelModules.earthquake() then module}<svelte:component this={module.default} />{/await}
        {:else if activeLayer === 'incident'}
          {#await panelModules.hazard() then module}<svelte:component this={module.default} kind="reports" />{/await}
        {:else if activeLayer === 'hazard'}
          {#await panelModules.hazard() then module}<svelte:component this={module.default} kind="warnings" />{/await}
        {:else if activeLayer === 'population'}
          {#await panelModules.population() then module}<svelte:component this={module.default} provinceCode={selectedRegion?.code.split('.')[0]} regionCode={selectedRegion?.code} regionName={selectedRegion?.name} bind:year={populationYear} />{/await}
        {:else if activeLayer === 'language'}
          {#await panelModules.language() then module}<svelte:component this={module.default} provinceCode={selectedRegion?.code.split('.')[0]} />{/await}
        {:else if activeLayer === 'warning'}
          {#await panelModules.weather() then module}<svelte:component this={module.default} regionCode={selectedRegion?.code} regionName={selectedRegion?.name} />{/await}
        {/if}
      </div>
    </section>

    <ProvinceExplorer selectedCode={selectedRegion?.code} onopen={code => { void openRegion(code); }} />

    {#if SummaryView}<svelte:component this={SummaryView} layer={activeLayer} onsummary={summary => publicSummary = summary} />
    {:else if observatoryKind(activeLayer)}
      <!-- Same section id and heading as the real component, so anchors and prerendered text exist before it loads. -->
      <section id="summary" class="aggregate-summary details pending" aria-labelledby="summary-heading" aria-busy="true">
        <span class="eyebrow">OBSERVATORY</span>
        <h2 id="summary-heading">{m.summary_heading()}</h2>
        <p class="summary-pending">{m.summary_scope()}</p>
      </section>
    {/if}
    <AdSlot />
    <Preferences {selectedRegion} onopen={code => { chooseLayer('warning'); void openRegion(code); }} />
    <PwaManager />

    <SupportPanel />
  </main>
  <SiteFooter />
</div>
<a class="to-top" class:visible={showTop} href="#top" aria-label={m.nav_top()} inert={!showTop}><ArrowUp size={20} strokeWidth={3} aria-hidden="true" /></a>
