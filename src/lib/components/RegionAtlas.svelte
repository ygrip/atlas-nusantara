<script lang="ts">
  import { assetUrl } from '$lib/pwa/assets';
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { loadRegions, type Region } from '$lib/atlas/regions';
  import type { GeometryPackage } from '$lib/geo/types';
  import ClayMap from './ClayMap.svelte';
  export let onselection: ((region: Region | undefined, geometry: GeometryPackage | undefined) => void) | undefined = undefined;

  let provinces: Region[] = [];
  let cities: Region[] = [];
  let province: Region | undefined;
  let city: Region | undefined;
  let query = '';
  let loading = true;
  let failed = false;
  let geometry: GeometryPackage | undefined;
  let generation = 0;
  let controller: AbortController | undefined;
  $: onselection?.(city ?? province, geometry);
  let regions: Region[] = [];
  $: {
    regions = provinces;
    if (province) regions = cities;
  }
  $: filtered = regions.filter(region => (region.name + ' ' + region.code).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  onMount(() => {
    const initial = new AbortController();
    loadRegions('/data/admin-2022/provinces.json', initial.signal)
      .then(async payload => {
        provinces = payload.regions; loading = false;
        const requested = new URL(location.href).searchParams.get('region');
        if (requested && /^\d{2}(\.\d{2})?$/.test(requested)) {
          const parent = provinces.find(item => item.code === requested.split('.')[0]);
          if (parent) { await selectRegion(parent); city = cities.find(item => item.code === requested); updateUrl(); }
        }
      })
      .catch(error => { if (error.name !== 'AbortError') { failed = true; loading = false; } });
    void loadGeometry('/data/geometry-2022/national.json');
    return () => { initial.abort(); controller?.abort(); generation++; };
  });

  async function loadGeometry(url: string) {
    const request = ++generation;
    geometry = undefined;
    try {
      const response = await fetch(assetUrl(url));
      if (!response.ok) return;
      const payload = await response.json();
      if (request !== generation) return;
      if (payload.schemaVersion !== 1 || payload.codeEdition !== 'Kepmendagri 100.1.1-6117/2022' || !Array.isArray(payload.regions)) return;
      geometry = payload;
    } catch (error) {
      // A missing licensed package is a supported unavailable state, never synthetic geography.
      if (request === generation) geometry = undefined;
    }
  }

  async function selectRegion(region: Region) {
    if (province) { city = region; updateUrl(); return; }
    controller?.abort();
    controller = new AbortController();
    province = region; city = undefined; cities = []; query = ''; loading = true; failed = false;
    updateUrl();
    void loadGeometry('/data/geometry-2022/provinces/' + region.code + '.json');
    try {
      const payload = await loadRegions('/data/admin-2022/cities/' + region.code + '.json', controller.signal);
      if (province?.code === region.code) cities = payload.regions;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') failed = true;
    } finally { if (province?.code === region.code) loading = false; }
  }

  function national() {
    controller?.abort(); province = undefined; city = undefined; query = ''; failed = false; loading = false;
    updateUrl();
    void loadGeometry('/data/geometry-2022/national.json');
  }

  function updateUrl() {
    const url = new URL(location.href);
    const selected = city ?? province;
    if (selected) url.searchParams.set('region', selected.code);
    else url.searchParams.delete('region');
    history.replaceState(history.state, '', url);
  }

  function mapSelect(code: string) {
    const region = regions.find(item => item.code === code);
    if (region) void selectRegion(region);
  }
</script>

<section class="region-atlas" aria-label={m.level_national()}>
  <nav class="atlas-breadcrumb" aria-label={m.level_province()}>
    <button type="button" onclick={national} aria-current={!province}>{m.level_national()}</button>
    {#if province}<span aria-hidden="true">/</span><button type="button" onclick={() => { city = undefined; updateUrl(); }}>{province.name}</button>{/if}
    {#if city}<span aria-hidden="true">/</span><strong>{city.name}</strong>{/if}
  </nav>
  <div class="atlas-body">
    <div class="atlas-view">
      <ClayMap label={province?.name ?? m.level_national()} {geometry} selectedCode={city?.code} onselect={mapSelect} />
      <p class="edition-note">{m.code_edition()}: Kepmendagri 100.1.1-6117/2022 · 37 / 514</p>
      {#if geometry}<p class="edition-note">{geometry.boundaryEdition} · <a href={geometry.source} target="_blank" rel="noreferrer">{m.sources_heading()} ↗</a></p>{/if}
    </div>
    <div class="region-directory">
      <label for="region-search">{m.region_search()}</label>
      <input id="region-search" type="search" bind:value={query} autocomplete="off" />
      <p class="directory-count" aria-live="polite">{filtered.length} · {#if province}{m.level_city()}{:else}{m.level_province()}{/if}</p>
      {#if loading}<p role="status">{m.loading_data()}</p>
      {:else if failed}<p role="alert">{m.data_unavailable()}</p>
      {:else if filtered.length === 0}<p role="status">{m.no_results()}</p>
      {:else}
        <ul class="region-list">
          {#each filtered as region (region.code)}
            <li><button type="button" onclick={() => selectRegion(region)} aria-pressed={city?.code === region.code}>
              <span>{region.name}</span><small>{region.code}</small>
            </button></li>
          {/each}
        </ul>
      {/if}
      {#if city}<div class="selected-region" role="status"><h3>{m.region_detail()}</h3><strong>{city.name}</strong><br />{city.code} · {m.level_city()}<br />{province?.name}<br />{m.code_edition()}: 2022</div>{/if}
    </div>
  </div>
</section>
