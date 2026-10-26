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
  import SnapshotPanel from '$lib/components/SnapshotPanel.svelte';
  import { getLocale, locales, setLocale } from '$lib/paraglide/runtime.js';
  import { localeNames } from '$lib/i18n/locales.js';
  import { sources } from '$lib/data/sources.js';

  let selectedRegion: ShareRegion | undefined;
  let selectedGeometry: GeometryPackage | undefined;
  let publicSummary: ShareSummary | undefined;
  let dark = false;
  let themeBusy = false;
  onMount(() => { dark = document.documentElement.dataset.theme === 'dark'; document.title = m.site_title(); });
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

<div class="shell">
  <header class="masthead">
    <a href="/" data-sveltekit-reload class="brand" aria-label="Nusantara">
      <span class="brand-symbol" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 7 6-3 6 3 6-3v13l-6 3-6-3-6 3V7Z"/><path d="M9 4v13m6-10v13"/></svg>
      </span>
      <span>Nusantara<span class="brand-muted"> / Atlas</span></span>
    </a>
    <nav class="header-navigation" aria-label="Nusantara"><a href="#sources">{m.sources_heading()}</a><a href="#support">{m.support_action()}</a></nav>
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
    <section class="intro">
      <span class="eyebrow">NUSANTARA / 01</span>
      <h1>{m.site_title()}</h1>
      <p>{m.site_description()}</p>
      <div class="notice"><span class="notice-dot" aria-hidden="true"></span>{m.disclaimer()}</div>
      <SharePanel region={selectedRegion} geometry={selectedGeometry} summary={publicSummary} />
    </section>

    <section id="atlas" class="workspace" aria-label={m.layer_heading()}>
      <aside class="control-panel">
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
      <div class="map-panel">
        <RegionAtlas onselection={(region, geometry) => { selectedRegion = region; selectedGeometry = geometry; }} />
        <SnapshotPanel kind={activeLayer} regionCode={selectedRegion?.code} />
      </div>
    </section>

    <AggregateSummary onsummary={summary => publicSummary = summary} />
    <AdSlot />
    <Preferences />
    <PwaManager />

    <section id="sources" class="details" aria-labelledby="sources-heading">
      <span class="eyebrow">02 / DATA</span>
      <h2 id="sources-heading">{m.sources_heading()}</h2>
      <div class="source-grid">
        {#each sources as source (source.id)}
          <a class="source-card" href={source.url} target="_blank" rel="noopener noreferrer">
            <div><strong>{source.agency}</strong>
              <span>{#if source.kind === 'forecast'}{m.layer_forecast()}{:else if source.kind === 'alert'}{m.layer_weather()}{:else if source.kind === 'observation'}{m.layer_earthquakes()}{:else if source.kind === 'incident'}{m.layer_history()}{:else if source.kind === 'population'}{m.layer_population()}{:else}{m.layer_hazards()}{/if}</span>
            </div>
            <small aria-hidden="true">↗</small>
          </a>
        {/each}
      </div>
    </section>
    <section class="details" id="roadmap">
      <span class="eyebrow">03 / ROADMAP</span>
      <h2>{m.roadmap_heading()}</h2>
      <p>{m.roadmap_summary()}</p>
    </section>
    <SupportPanel />
  </main>
  <footer><span>© Nusantara · {m.disclaimer()}</span><a href="https://github.com/ygrip/nusantara" target="_blank" rel="noopener noreferrer">{m.source_code()} ↗</a></footer>
</div>
