<script lang="ts">
  import { changeTheme } from '$lib/pwa/theme';
  import { onMount } from 'svelte';
  import SupportPanel from '$lib/components/SupportPanel.svelte';
  import AdSlot from '$lib/components/AdSlot.svelte';
  import AggregateSummary from '$lib/components/AggregateSummary.svelte';
  import SharePanel from '$lib/components/SharePanel.svelte';
  import type { ShareRegion, ShareSummary } from '$lib/share/card';
  import type { GeometryPackage } from '$lib/geo/types';
  import { m } from '$lib/paraglide/messages.js';
  import Preferences from '$lib/components/Preferences.svelte';
  import PwaManager from '$lib/components/PwaManager.svelte';
  import RegionAtlas from '$lib/components/RegionAtlas.svelte';
  import ProvinceTable from '$lib/components/ProvinceTable.svelte';
  import SnapshotPanel from '$lib/components/SnapshotPanel.svelte';
  import { getLocale, locales, setLocale } from '$lib/paraglide/runtime.js';
  import { localeNames } from '$lib/i18n/locales.js';
  import { sources } from '$lib/data/sources.js';

  let selectedRegion: ShareRegion | undefined;
  let selectedGeometry: GeometryPackage | undefined;
  let publicSummary: ShareSummary | undefined;
  let dark = false;
  let themeBusy = false;
  let atlas: RegionAtlas | undefined;
  let activeSection = 'atlas';
  let showTop = false;
  const sections = [
    { id: 'atlas', label: m.nav_atlas },
    { id: 'provinces', label: m.nav_provinces },
    { id: 'summary', label: m.nav_data },
    { id: 'locations', label: m.nav_locations },
    { id: 'sources', label: m.nav_sources },
    { id: 'support', label: m.nav_support }
  ];
  // Verified by scripts/import-regions.mjs against the pinned 2022 transcription (416 KAB. + 98 KOTA).
  const editionStats = [
    { value: 37, label: m.stat_provinces, tone: 'peach' },
    { value: 416, label: m.stat_regencies, tone: 'mint' },
    { value: 98, label: m.stat_cities, tone: 'lilac' }
  ];

  onMount(() => {
    dark = document.documentElement.dataset.theme === 'dark';
    document.title = m.site_title();
    return observeSections();
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
  async function toggleTheme(event: MouseEvent) {
    if (themeBusy) return;
    themeBusy = true;
    try {
      await changeTheme(event.currentTarget as HTMLElement, () => {
        dark = !dark;
        let theme = 'light';
        if (dark) theme = 'dark';
        document.documentElement.dataset.theme = theme;
        let chromeColor = '#f6f0e7';
        if (dark) chromeColor = '#211f25';
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', chromeColor);
        try { localStorage.setItem('nusantara:theme', theme); }
        catch (error) { console.warn('Theme preference could not be saved', error); }
      });
    } finally { themeBusy = false; }
  }

  let activeLayer: 'warning' | 'earthquake' | 'incident' | 'hazard' = 'warning';
  const layers = [
    { id: 'warning' as const, label: m.layer_weather, source: 'BMKG' },
    { id: 'earthquake' as const, label: m.layer_earthquakes, source: 'BMKG' },
    { id: 'incident' as const, label: m.layer_history, source: 'BNPB' },
    { id: 'hazard' as const, label: m.layer_hazards, source: 'InaRISK' }
  ];
</script>

<a class="skip-link" href="#atlas">{m.nav_skip()}</a>
<div class="shell">
  <header class="masthead">
    <a href="/" data-sveltekit-reload class="brand" aria-label="Nusantara">
      <span class="brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 7 6-3 6 3 6-3v13l-6 3-6-3-6 3V7Z"/><path d="M9 4v13m6-10v13"/></svg>
      </span>
      <span>Nusantara<span class="brand-muted"> / Atlas</span></span>
    </a>
    <nav class="section-nav" aria-label={m.nav_label()}>
      {#each sections as section (section.id)}
        <a href={'#' + section.id} class:active={activeSection === section.id} aria-current={currentFor(section.id)}>{section.label()}</a>
      {/each}
    </nav>
    <div class="header-actions">
      <button class="theme-button" type="button" onclick={toggleTheme} disabled={themeBusy} aria-label={m.theme_toggle()} aria-pressed={dark}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></svg>
      </button>
      <label for="locale-picker">{m.language_label()}</label>
      <select id="locale-picker" value={getLocale()} onchange={(event) => setLocale(event.currentTarget.value as (typeof locales)[number])}>
        {#each locales as locale (locale)}<option value={locale}>{localeNames[locale]}</option>{/each}
      </select>
    </div>
  </header>

  <main>
    <section id="top" class="bento hero-bento" aria-labelledby="site-title">
      <div class="clay-card hero-card intro">
        <span class="eyebrow">NUSANTARA / 01</span>
        <h1 id="site-title">{m.site_title()}</h1>
        <p>{m.site_description()}</p>
        <div class="notice"><span class="notice-dot" aria-hidden="true"></span>{m.disclaimer()}</div>
        <div class="hero-actions">
          <a class="clay-button primary" href="#atlas">{m.nav_atlas()} ↓</a>
          <a class="clay-button" href="#provinces">{m.table_heading()}</a>
        </div>
        <SharePanel region={selectedRegion} geometry={selectedGeometry} summary={publicSummary} />
      </div>
      {#each editionStats as stat (stat.value)}
        <a class={'clay-card stat-card tone-' + stat.tone} href="#provinces">
          <strong>{stat.value}</strong><span>{stat.label()}</span>
        </a>
      {/each}
      <div class="clay-card edition-card">
        <span class="panel-eyebrow">{m.code_edition()}</span>
        <strong>Kepmendagri 100.1.1-6117/2022</strong>
        <small>{m.tile_map_note()}</small>
      </div>
    </section>

    <section id="atlas" class="bento workspace" aria-label={m.layer_heading()}>
      <aside class="clay-card control-panel">
        <p class="panel-eyebrow">{m.layer_heading()}</p>
        <div class="control-group" role="group" aria-label={m.layer_heading()}>
          {#each layers as layer (layer.id)}
            <button type="button" class:chosen={activeLayer === layer.id} aria-pressed={activeLayer === layer.id} onclick={() => activeLayer = layer.id}>
              <span>{layer.label()}</span><span class="source-tag">{layer.source}</span>
            </button>
          {/each}
        </div>
        <div class="divider"></div>
        <a class="utility-link" href="#locations">{m.pins_heading()} ↘</a>
        <a class="utility-link" href="#sources">{m.sources_heading()} ↘</a>
        <p class="edition-note">Kepmendagri<br />100.1.1-6117/2022</p>
      </aside>
      <div class="clay-card map-panel">
        <RegionAtlas bind:this={atlas} onselection={(region, geometry) => { selectedRegion = region; selectedGeometry = geometry; }} />
        <SnapshotPanel kind={activeLayer} regionCode={selectedRegion?.code} />
      </div>
    </section>

    <ProvinceTable onopen={code => atlas?.openProvince(code)} />

    <AggregateSummary onsummary={summary => publicSummary = summary} />
    <AdSlot />
    <Preferences />
    <PwaManager />

    <section id="sources" class="details" aria-labelledby="sources-heading">
      <span class="eyebrow">05 / DATA</span>
      <h2 id="sources-heading">{m.sources_heading()}</h2>
      <div class="bento source-grid">
        {#each sources as source (source.id)}
          <a class="clay-card source-card" href={source.url} target="_blank" rel="noopener noreferrer">
            <div><strong>{source.agency}</strong>
              <span>{#if source.kind === 'forecast'}{m.layer_forecast()}{:else if source.kind === 'alert'}{m.layer_weather()}{:else if source.kind === 'observation'}{m.layer_earthquakes()}{:else if source.kind === 'incident'}{m.layer_history()}{:else if source.kind === 'population'}{m.layer_population()}{:else}{m.layer_hazards()}{/if}</span>
            </div>
            <small aria-hidden="true">↗</small>
          </a>
        {/each}
        <div class="clay-card roadmap-card" id="roadmap">
          <span class="eyebrow">06 / ROADMAP</span>
          <h3>{m.roadmap_heading()}</h3>
          <p>{m.roadmap_summary()}</p>
        </div>
      </div>
    </section>
    <SupportPanel />
  </main>
  <footer><span>© Nusantara · {m.disclaimer()}</span><a href="https://github.com/ygrip/nusantara" target="_blank" rel="noopener noreferrer">{m.source_code()} ↗</a></footer>
</div>
<a class="to-top" class:visible={showTop} href="#top" aria-label={m.nav_top()} inert={!showTop}>↑</a>
