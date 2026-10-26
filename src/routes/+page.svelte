<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale, locales, setLocale } from '$lib/paraglide/runtime.js';
  import { localeNames } from '$lib/i18n/locales.js';
  import { sources } from '$lib/data/sources.js';
  import type { AdminLevel } from '$lib/geo/types.js';

  let activeLevel: AdminLevel = 'national';
  let activeLayer = 'weather';

  const levels = [
    { id: 'national' as const, label: m.level_national },
    { id: 'province' as const, label: m.level_province },
    { id: 'city-regency' as const, label: m.level_city }
  ];
  const layers = [
    { id: 'weather', label: m.layer_weather, source: 'BMKG' },
    { id: 'earthquakes', label: m.layer_earthquakes, source: 'BMKG' },
    { id: 'history', label: m.layer_history, source: 'BNPB' },
    { id: 'hazards', label: m.layer_hazards, source: 'InaRISK' }
  ];
</script>

<svelte:head>
  <title>{m.site_title()}</title>
  <meta name="description" content={m.site_description()} />
</svelte:head>

<div class="shell">
  <header class="masthead">
    <a href="/" data-sveltekit-reload class="brand" aria-label="Nusantara">
      <span class="brand-symbol" aria-hidden="true">✦</span>
      <span>Nusantara<span class="brand-muted"> / Atlas</span></span>
    </a>
    <div class="header-actions">
      <label for="locale-picker">{m.language_label()}</label>
      <select
        id="locale-picker"
        value={getLocale()}
        onchange={(event) => setLocale(event.currentTarget.value as (typeof locales)[number])}
      >
        {#each locales as locale (locale)}
          <option value={locale}>{localeNames[locale]}</option>
        {/each}
      </select>
    </div>
  </header>

  <main>
    <section class="intro">
      <span class="eyebrow">NUSANTARA / 01</span>
      <h1>{m.site_title()}</h1>
      <p>{m.site_description()}</p>
      <div class="notice"><span class="notice-dot"></span>{m.disclaimer()}</div>
    </section>

    <section class="workspace" aria-label={m.layer_heading()}>
      <aside class="control-panel">
        <p class="panel-eyebrow">{m.layer_heading()}</p>
        <div class="control-group" role="group" aria-label={m.layer_heading()}>
          {#each layers as layer (layer.id)}
            <button type="button" class:chosen={activeLayer === layer.id}
              aria-pressed={activeLayer === layer.id}
              onclick={() => activeLayer = layer.id}>
              <span>{layer.label()}</span><span class="source-tag">{layer.source}</span>
            </button>
          {/each}
        </div>
        <div class="divider"></div>
        <p class="panel-eyebrow">{m.level_national()} → {m.level_city()}</p>
        <div class="level-group" role="group" aria-label={m.level_province()}>
          {#each levels as level (level.id)}
            <button type="button" class:chosen={activeLevel === level.id}
              aria-pressed={activeLevel === level.id}
              onclick={() => activeLevel = level.id}>
              {level.label()}
            </button>
          {/each}
        </div>
      </aside>
      <div class="map-panel">
        <div class="map-topline">
          <span>{levels.find((level) => level.id === activeLevel)?.label()}</span>
          <span class="planned"><span class="notice-dot"></span>{m.status_planned()}</span>
        </div>
        <div class="map-placeholder" role="status">
          <div class="clay-island" aria-hidden="true">
            <span class="island island-a"></span>
            <span class="island island-b"></span>
            <span class="island island-c"></span>
          </div>
          <h2>{m.map_placeholder()}</h2>
          <p>{layers.find((layer) => layer.id === activeLayer)?.label()} · {m.status_planned()}</p>
        </div>
      </div>
    </section>

    <section id="sources" class="details" aria-labelledby="sources-heading">
      <div>
        <span class="eyebrow">01 / DATA</span>
        <h2 id="sources-heading">{m.sources_heading()}</h2>
      </div>
      <div class="source-grid">
        {#each sources as source (source.id)}
          <a class="source-card" href={source.url} target="_blank" rel="noopener noreferrer">
            <div><strong>{source.agency}</strong><span>{source.kind}</span></div>
            <small>{m.status_planned()} ↗</small>
          </a>
        {/each}
      </div>
    </section>

    <section class="details" id="roadmap">
      <span class="eyebrow">02 / ROADMAP</span>
      <h2>{m.roadmap_heading()}</h2>
      <p>{m.roadmap_summary()}</p>
    </section>
  </main>
  <footer>© Nusantara · {m.disclaimer()}</footer>
</div>
