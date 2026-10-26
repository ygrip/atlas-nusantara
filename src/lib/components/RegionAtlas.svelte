<script lang="ts">
  import { assetUrl } from '$lib/pwa/assets';
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { upgradeRegionCode } from '$lib/atlas/code-upgrades';
  import { loadRegions, type Region } from '$lib/atlas/regions';
  import type { GeometryPackage } from '$lib/geo/types';
  import ClayMap from './ClayMap.svelte';
  import { loadEarthquakes, type EarthquakeArchive } from '$lib/data/earthquakes';
  import { earthquakeOverlay, loadPointOverlay, OVERLAY_DEFINITIONS, type PointOverlay } from '$lib/map/overlays';
  export let layer = 'warning';
  let earthquakeArchive: EarthquakeArchive | undefined;
  let customOverlay: PointOverlay | undefined;
  let overlayRequest: AbortController | undefined;
  $: activeOverlay = resolveOverlay(layer, earthquakeArchive, customOverlay);
  $: void loadCustomOverlay(layer);
  import { ADMIN_DATA_PATH, CODE_EDITION, GEOMETRY_DATA_PATH } from '$lib/atlas/edition';
  export let onselection: ((region: Region | undefined, geometry: GeometryPackage | undefined) => void) | undefined = undefined;

  let provinces: Region[] = [];
  let cities: Region[] = [];
  let province: Region | undefined;
  let city: Region | undefined;
  let query = '';
  let loading = true;
  let failed = false;
  let national: GeometryPackage | undefined;
  let geometryLoaded = false;
  let detail: GeometryPackage | undefined;
  let geometry: GeometryPackage | undefined;
  $: geometry = detail ?? national;
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
    loadRegions(ADMIN_DATA_PATH + '/provinces.json', initial.signal)
      .then(async payload => {
        provinces = payload.regions; loading = false;
        const storedCode = new URL(location.href).searchParams.get('region');
        let requested: string | undefined;
        if (storedCode) requested = upgradeRegionCode(storedCode);
        if (requested && /^\d{2}(\.\d{2})?$/.test(requested)) {
          const parent = provinces.find(item => item.code === requested.split('.')[0]);
          if (parent) { await selectRegion(parent); city = cities.find(item => item.code === requested); updateUrl(); }
        }
      })
      .catch(error => { if (error.name !== 'AbortError') { failed = true; loading = false; } });
    void loadNational();
    let active = true;
    const refreshEarthquakes = () => { void loadEarthquakes().then(archive => { if (active && archive) earthquakeArchive = archive; }); };
    refreshEarthquakes();
    const earthquakeTimer = setInterval(() => { if (!document.hidden && navigator.onLine) refreshEarthquakes(); }, 15 * 60_000);
    return () => { active = false; clearInterval(earthquakeTimer); initial.abort(); controller?.abort(); overlayRequest?.abort(); generation++; };
  });

  async function fetchGeometry(url: string): Promise<GeometryPackage | undefined> {
    try {
      const response = await fetch(assetUrl(url));
      if (!response.ok) return undefined;
      const payload = await response.json();
      if (payload.schemaVersion !== 1 || payload.codeEdition !== CODE_EDITION || !Array.isArray(payload.regions)) return undefined;
      return payload;
    } catch (error) {
      // A missing licensed package is a supported unavailable state, never synthetic geography.
      console.warn('Geometry unavailable', url, error);
      return undefined;
    }
  }

  async function loadNational() {
    national = await fetchGeometry(GEOMETRY_DATA_PATH + '/national.json');
    geometryLoaded = true;
  }

  async function loadDetail(code: string) {
    const request = ++generation;
    detail = undefined;
    const payload = await fetchGeometry(GEOMETRY_DATA_PATH + '/provinces/' + code + '.json');
    if (request === generation) detail = payload;
  }

  async function selectRegion(region: Region) {
    if (province) { city = region; updateUrl(); return; }
    controller?.abort();
    controller = new AbortController();
    province = region; city = undefined; cities = []; query = ''; loading = true; failed = false;
    updateUrl();
    void loadDetail(region.code);
    try {
      const payload = await loadRegions(ADMIN_DATA_PATH + '/cities/' + region.code + '.json', controller.signal);
      if (province?.code === region.code) cities = payload.regions;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') failed = true;
    } finally { if (province?.code === region.code) loading = false; }
  }

  function returnToNational() {
    controller?.abort(); province = undefined; city = undefined; query = ''; failed = false; loading = false;
    updateUrl();
    generation++;
    detail = undefined;
  }

  function updateUrl() {
    const url = new URL(location.href);
    const selected = city ?? province;
    if (selected) url.searchParams.set('region', selected.code);
    else url.searchParams.delete('region');
    history.replaceState(history.state, '', url);
  }

  /** Jump to a province from any level (tile map, table popup). */
  export function openProvince(code: string) {
    const target = provinces.find(item => item.code === code);
    if (!target) return;
    controller?.abort();
    province = undefined;
    void selectRegion(target);
  }

  function mapSelect(code: string) {
    const region = regions.find(item => item.code === code);
    if (region) void selectRegion(region);
  }

  /** One public entry point for the table, a saved place, or a city detail button. */
  export async function openRegion(code: string) {
    const provinceCode = code.split('.')[0];
    if (province?.code !== provinceCode) {
      const parent = provinces.find(item => item.code === provinceCode);
      if (!parent) return;
      province = undefined;
      await selectRegion(parent);
    }
    if (code.includes('.')) selectCity(code);
    else { city = undefined; updateUrl(); }
  }

  function resolveOverlay(id: string, archive: EarthquakeArchive | undefined, custom: PointOverlay | undefined): PointOverlay | undefined {
    if (id === 'earthquake' && archive) return earthquakeOverlay(archive);
    if (custom?.id === id) return custom;
    return undefined;
  }

  async function loadCustomOverlay(id: string) {
    const definition = OVERLAY_DEFINITIONS.find(item => item.id === id);
    overlayRequest?.abort();
    customOverlay = undefined;
    if (!definition?.snapshotUrl) return;
    const request = new AbortController();
    overlayRequest = request;
    try {
      const payload = await loadPointOverlay(assetUrl(definition.snapshotUrl), request.signal);
      if (!request.signal.aborted) customOverlay = payload;
    } catch (error) { if (!request.signal.aborted) console.warn('Overlay unavailable', id, error); }
  }

  function selectCity(code: string) {
    const region = cities.find(item => item.code === code);
    if (!region) return;
    city = region;
    updateUrl();
  }
</script>

<section class="region-atlas" aria-label={m.level_national()}>
  <nav class="atlas-breadcrumb" aria-label={m.level_province()}>
    <button type="button" onclick={returnToNational} aria-current={!province}>{m.level_national()}</button>
    {#if province}<span aria-hidden="true">/</span><button type="button" onclick={() => { city = undefined; updateUrl(); }}>{province.name}</button>{/if}
    {#if city}<span aria-hidden="true">/</span><strong>{city.name}</strong>{/if}
  </nav>
  <div class="atlas-body">
    <div class="atlas-view">
      <ClayMap label={province?.name ?? m.level_national()} {national} {detail} openProvince={province?.code} selectedCode={city?.code}
        onselect={mapSelect} onprovince={openProvince} oncity={selectCity} activeLayer={layer} overlay={activeOverlay} geometryUnavailable={geometryLoaded && !national} />
      <p class="edition-note"><a href="https://data.humdata.org/dataset/cod-ab-idn" target="_blank" rel="noreferrer">BPS / OCHA · CC BY 3.0 IGO</a> · <a href="https://www.ncei.noaa.gov/products/etopo-global-relief-model" target="_blank" rel="noreferrer">ETOPO1 / NOAA</a> · <a href="/terms#sources">{m.source_details()}</a></p>
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
      {#if city}<div class="selected-region" role="status"><h3>{m.region_detail()}</h3><strong>{city.name}</strong><br />{city.code} · {m.level_city()}<br />{province?.name}</div>{/if}
    </div>
  </div>
</section>
