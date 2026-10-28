<script lang="ts">
  import { assetUrl } from '$lib/pwa/assets';
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { upgradeRegionCode } from '$lib/atlas/code-upgrades';
  import { loadRegions, type Region } from '$lib/atlas/regions';
  import type { GeometryPackage } from '$lib/geo/types';
  import { isProvinceCode } from '$lib/data/destination-index';
  import ClayMap from './ClayMap.svelte';
  import DestinationsPanel from './DestinationsPanel.svelte';
  import DirectoryTable, { type DirectoryColumn, type DirectoryRow } from './DirectoryTable.svelte';
  import RegionDetails from './RegionDetails.svelte';
  import DataExport from './DataExport.svelte';
  import { pinDataset, regionDataset, type ExportRegion } from '$lib/export/build-dataset';
  import type { ExportDataset } from '$lib/export/map-export';
  import { formatDegrees, regionCoordinatesByCode } from '$lib/atlas/region-coordinates';
  import type { ForecastSnapshot } from '$lib/map/weather';
  import { forecastCoordinates, summariseWeather } from '$lib/map/weather-summary';
  import { loadDestinationIndex, loadDestinations, destinationOverlay, type DestinationCatalog, type DestinationIndex } from '$lib/data/destinations';
  import { loadEarthquakes, type EarthquakeArchive } from '$lib/data/earthquakes';
  import { cuisineOverlay, loadCuisineIndex, type CuisineIndex } from '$lib/data/cuisine';
  import { loadHazards, type HazardSnapshot } from '$lib/data/hazards';
  import { earthquakeOverlay, loadPointOverlay, OVERLAY_DEFINITIONS, reportsOverlay, warningsOverlay, type PointOverlay } from '$lib/map/overlays';
  import { latestYear, loadPopulation, type PopulationData } from '$lib/data/population';
  import { populationHeatmap } from '$lib/data/population-heatmap';
  export let layer = 'warning';
  /** Year shown by the population heat map; the newest year when not set. */
  export let populationYear: number | undefined = undefined;
  let populationData: PopulationData | undefined;
  $: if (layer === 'population' && !populationData) void ensurePopulation();
  $: heatmap = layer === 'population' && populationData ? populationHeatmap(populationData, populationYear ?? latestYear(populationData)) : undefined;
  let initializingSelection = true;
  let selectionVersion = 0;
  let earthquakeArchive: EarthquakeArchive | undefined;
  let hazardSnapshot: HazardSnapshot | undefined;
  let destinationCatalog: DestinationCatalog | undefined;
  let destinationIndex: DestinationIndex | undefined;
  let cuisineIndex: CuisineIndex | undefined;
  let cuisineIndexLoading = false;
  $: void ensureCuisineIndex(layer);
  let destinationRequest: AbortController | undefined;
  let destinationLoading = false;
  let destinationFailed = false;
  let destinationIndexFailed = false;
  $: void loadProvinceDestinations(layer, province?.code, destinationIndex);
  let customOverlay: PointOverlay | undefined;
  let clayMap: ClayMap | undefined;
  let overlayRequest: AbortController | undefined;
  let customOverlayLoading = false;
  let customOverlayFailed = false;
  $: activeOverlay = layer === 'destinations' && destinationIndex
    ? destinationOverlay(national, destinationIndex, province?.code)
    : layer === 'cuisine' && cuisineIndex
      ? cuisineOverlay(national, cuisineIndex, province?.code)
      : resolveOverlay(layer, earthquakeArchive, hazardSnapshot, customOverlay);
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
  let initialSelectionFailed = false;
  let loadedCityProvince: string | undefined;
  let pendingCityProvince: string | undefined;
  let cityDirectoryPromise: Promise<void> | undefined;
  $: void ensureCityDirectory(layer, province?.code);
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
  /** The forecast and chosen time reported by the map, shown in the weather layer's table and details. */
  let forecast: ForecastSnapshot | undefined;
  let forecastTime: string | undefined;
  function handleWeather(next: ForecastSnapshot | undefined, time: string | undefined) { forecast = next; forecastTime = time; }
  $: showWeather = layer === 'warning' && Boolean(forecast);
  $: coordinatesByCode = regionCoordinatesByCode(geometry?.regions ?? [], national?.projection);
  function coordinatesOf(code: string) {
    return coordinatesByCode.get(code) ?? (forecast ? forecastCoordinates(forecast, code) : undefined);
  }
  $: directoryColumns = buildColumns(showWeather);
  $: directoryRows = buildRows(filtered, showWeather, forecast, forecastTime, coordinatesByCode, city?.code);
  $: selectedRegion = city ?? province;
  $: selectedWeather = showWeather && forecast && selectedRegion ? summariseWeather(forecast, selectedRegion.code, forecastTime) : undefined;
  $: selectedParent = city ? province?.name : undefined;

  function buildColumns(withWeather: boolean): DirectoryColumn[] {
    if (!withWeather) return [];
    return [
      { id: 'weather', label: m.table_weather() },
      { id: 'lat', label: m.table_latitude(), numeric: true },
      { id: 'lon', label: m.table_longitude(), numeric: true }
    ];
  }

  function buildRows(items: Region[], withWeather: boolean, snapshot: ForecastSnapshot | undefined, time: string | undefined, _coordinates: unknown, selectedCode: string | undefined): DirectoryRow[] {
    return items.map(region => {
      const row: DirectoryRow = { id: region.code, code: region.code, name: region.name, ariaLabel: region.name + ' ' + region.code, selected: selectedCode === region.code, cells: {} };
      if (!withWeather || !snapshot) return row;
      const summary = summariseWeather(snapshot, region.code, time);
      if (summary) row.cells.weather = summary.description + ' · ' + summary.temperature + '°C';
      const coordinates = coordinatesOf(region.code);
      if (coordinates) {
        row.cells.lat = formatDegrees(coordinates.lat);
        row.cells.lon = formatDegrees(coordinates.lon);
      }
      return row;
    });
  }

  /** The data behind the current layer and map level, for the export dialog. */
  function buildExportDataset(): ExportDataset | undefined {
    const definition = OVERLAY_DEFINITIONS.find(item => item.id === layer);
    let title: string = layer;
    if (definition) title = definition.label();
    const generatedAt = new Date().toISOString();
    if (layer === 'warning') return buildRegionExport(title, generatedAt);
    if (activeOverlay) return pinDataset(activeOverlay, title, province?.name ?? m.level_national(), generatedAt);
    return undefined;
  }

  function buildRegionExport(title: string, generatedAt: string): ExportDataset {
    const level: ExportRegion['level'] = province ? 'city-regency' : 'province';
    const items: ExportRegion[] = regions.map(region => ({
      code: region.code, name: region.name, level, parentCode: province?.code, parentName: province?.name
    }));
    return regionDataset({
      layer, title, scope: province?.name ?? m.level_national(), generatedAt, regions: items,
      coordinates: coordinatesOf, forecast, forecastTime
    });
  }

  function openRegionRow(code: string) {
    const region = regions.find(item => item.code === code);
    if (region) void selectRegion(region);
  }

  function pinCoordinates(pin: { lat: number; lon: number }) {
    return { lat: formatDegrees(pin.lat), lon: formatDegrees(pin.lon) };
  }

  const mountainColumns = (): DirectoryColumn[] => [
    { id: 'status', label: m.table_status() },
    { id: 'lat', label: m.table_latitude(), numeric: true },
    { id: 'lon', label: m.table_longitude(), numeric: true }
  ];

  function mountainStatus(category: string | undefined): string {
    if (category === 'active') return m.mountain_active();
    if (category === 'potential') return m.mountain_potential();
    return m.mountain_other();
  }

  function buildMountainRows(pins: typeof mountainMatches): DirectoryRow[] {
    return pins.map(pin => ({
      id: pin.id, name: pin.label, ariaLabel: pin.label,
      cells: { status: mountainStatus(pin.category), ...pinCoordinates(pin) }
    }));
  }

  function openMountain(id: string) {
    const pin = mountainMatches.find(item => item.id === id);
    if (pin) clayMap?.showMountain(pin);
  }

  let mountainLimit = 80;
  $: mountainMatches = (customOverlay?.id === 'mountains' ? customOverlay.pins : []).filter(pin =>
    (pin.label + ' ' + (pin.description ?? '')).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  onMount(() => {
    const initial = new AbortController();
    void initializeSelection(initial.signal);
    void loadDestinationIndex(initial.signal).then(index => { if (!initial.signal.aborted) destinationIndex = index; })
      .catch(error => {
        if (!initial.signal.aborted) { destinationIndexFailed = true; console.warn('Destinations unavailable', error); }
      });
    let active = true;
    const refreshEarthquakes = () => { void loadEarthquakes().then(archive => { if (active && archive) earthquakeArchive = archive; }); };
    const refreshHazards = () => { void loadHazards().then(snapshot => { if (active && snapshot) hazardSnapshot = snapshot; }); };
    refreshEarthquakes();
    refreshHazards();
    const earthquakeTimer = setInterval(() => { if (!document.hidden && navigator.onLine) { refreshEarthquakes(); refreshHazards(); } }, 15 * 60_000);
    return () => { active = false; clearInterval(earthquakeTimer); initial.abort(); controller?.abort(); overlayRequest?.abort(); destinationRequest?.abort(); generation++; };
  });

  async function loadProvinceDestinations(activeLayer: string, code: string | undefined, index: DestinationIndex | undefined) {
    destinationRequest?.abort();
    destinationCatalog = undefined;
    destinationFailed = false;
    destinationLoading = false;
    if (activeLayer !== 'destinations' || !code || !index) return;
    const request = new AbortController();
    destinationRequest = request;
    destinationLoading = true;
    try {
      const catalog = await loadDestinations(index, code, request.signal);
      if (!request.signal.aborted) destinationCatalog = catalog;
    } catch (error) {
      if (!request.signal.aborted) { destinationFailed = true; console.warn('Destination province unavailable', code, error); }
    } finally {
      if (!request.signal.aborted) destinationLoading = false;
    }
  }

  function requestedRegionCode(): string | undefined {
    const stored = new URL(location.href).searchParams.get('region');
    if (!stored) return undefined;
    const code = upgradeRegionCode(stored);
    if (!/^\d{2}(\.\d{2})?$/.test(code) || !isProvinceCode(code.split('.')[0])) return undefined;
    return code;
  }

  /** The atlas opens on the national view. Only an explicit ?region= link opens a province or city. */
  async function initializeSelection(signal: AbortSignal) {
    const initialVersion = selectionVersion;
    const requested = requestedRegionCode();
    const geometryPromise = loadNational(signal);
    try {
      const payload = await loadRegions(ADMIN_DATA_PATH + '/provinces.json', signal);
      if (signal.aborted) return;
      provinces = payload.regions;
      loading = false;
      await geometryPromise;
      if (signal.aborted || selectionVersion !== initialVersion || !requested) return;
      const code = requested.split('.')[0];
      const target = provinces.find(item => item.code === code);
      if (!target) throw Error('Requested province is unavailable');
      const expectedVersion = selectionVersion + 1;
      await selectRegion(target);
      if (signal.aborted || selectionVersion !== expectedVersion) return;
      if (requested.includes('.')) {
        await loadCityDirectory(code);
        if (signal.aborted || selectionVersion !== expectedVersion) return;
        city = cities.find(item => item.code === requested);
        updateUrl();
      }
    } catch (error) {
      if (!signal.aborted) { initialSelectionFailed = true; failed = true; loading = false; console.warn('Initial province unavailable', error); }
    } finally {
      if (!signal.aborted) initializingSelection = false;
    }
  }

  async function fetchGeometry(url: string, signal?: AbortSignal): Promise<GeometryPackage | undefined> {
    try {
      const response = await fetch(assetUrl(url), { signal });
      if (!response.ok) return undefined;
      const payload = await response.json();
      if (payload.schemaVersion !== 1 || payload.codeEdition !== CODE_EDITION || !Array.isArray(payload.regions)) return undefined;
      return payload;
    } catch (error) {
      // A missing licensed package is a supported unavailable state, never synthetic geography.
      if (!signal?.aborted) console.warn('Geometry unavailable', url, error);
      return undefined;
    }
  }

  async function loadNational(signal: AbortSignal) {
    const payload = await fetchGeometry(GEOMETRY_DATA_PATH + '/national.json', signal);
    if (signal.aborted) return undefined;
    national = payload;
    geometryLoaded = true;
    return payload;
  }

  async function loadDetail(code: string) {
    const request = ++generation;
    detail = undefined;
    const payload = await fetchGeometry(GEOMETRY_DATA_PATH + '/provinces/' + code + '.json');
    if (request === generation) detail = payload;
  }

  async function selectRegion(region: Region) {
    selectionVersion++;
    initializingSelection = false;
    if (province) { city = region; updateUrl(); return; }
    controller?.abort();
    loadedCityProvince = undefined;
    pendingCityProvince = undefined;
    cityDirectoryPromise = undefined;
    province = region; city = undefined; cities = []; query = ''; loading = false; failed = false;
    initialSelectionFailed = false;
    updateUrl();
    void loadDetail(region.code);
    if (layer !== 'destinations') await loadCityDirectory(region.code);
  }

  function ensureCityDirectory(activeLayer: string, code: string | undefined) {
    if (activeLayer !== 'destinations' && code) void loadCityDirectory(code);
  }

  function loadCityDirectory(code: string): Promise<void> {
    if (loadedCityProvince === code || province?.code !== code) return Promise.resolve();
    if (pendingCityProvince === code && cityDirectoryPromise) return cityDirectoryPromise;
    controller?.abort();
    const request = new AbortController();
    controller = request;
    pendingCityProvince = code;
    loading = true;
    failed = false;
    cityDirectoryPromise = loadRegions(ADMIN_DATA_PATH + '/cities/' + code + '.json', request.signal)
      .then(payload => {
        if (!request.signal.aborted && province?.code === code) {
          cities = payload.regions;
          loadedCityProvince = code;
        }
      })
      .catch(error => {
        if (!request.signal.aborted && province?.code === code) {
          failed = true;
          console.warn('City directory unavailable', code, error);
        }
      })
      .finally(() => {
        if (controller === request) {
          pendingCityProvince = undefined;
          cityDirectoryPromise = undefined;
          if (province?.code === code) loading = false;
        }
      });
    return cityDirectoryPromise;
  }

  function returnToNational() {
    selectionVersion++;
    initializingSelection = false;
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
    if (layer === 'destinations' && province) return;
    const region = regions.find(item => item.code === code);
    if (region) void selectRegion(region);
  }

  /** One public entry point for the table, a saved place, or a city detail button. */
  export async function openRegion(code: string) {
    const provinceCode = code.split('.')[0];
    const parent = provinces.find(item => item.code === provinceCode);
    if (!parent) return;
    let expectedVersion: number;
    if (province?.code !== provinceCode) {
      province = undefined;
      const selection = selectRegion(parent);
      expectedVersion = selectionVersion;
      await selection;
      if (selectionVersion !== expectedVersion) return;
    } else {
      expectedVersion = ++selectionVersion;
      initializingSelection = false;
    }
    if (code.includes('.')) {
      await loadCityDirectory(provinceCode);
      if (selectionVersion !== expectedVersion) return;
      selectCity(code);
    } else showProvinceOnly();
  }

  function showProvinceOnly() {
    selectionVersion++;
    initializingSelection = false;
    city = undefined;
    updateUrl();
  }

  function resolveOverlay(id: string, archive: EarthquakeArchive | undefined, hazards: HazardSnapshot | undefined, custom: PointOverlay | undefined): PointOverlay | undefined {
    if (id === 'earthquake' && archive) return earthquakeOverlay(archive);
    if (id === 'incident' && hazards) return reportsOverlay(hazards);
    if (id === 'hazard' && hazards) return warningsOverlay(hazards, Date.now());
    if (custom?.id === id) return custom;
    return undefined;
  }

  async function loadCustomOverlay(id: string) {
    const definition = OVERLAY_DEFINITIONS.find(item => item.id === id);
    overlayRequest?.abort();
    customOverlay = undefined;
    customOverlayLoading = false;
    customOverlayFailed = false;
    if (!definition?.snapshotUrl) return;
    const request = new AbortController();
    overlayRequest = request;
    customOverlayLoading = true;
    try {
      const payload = await loadPointOverlay(assetUrl(definition.snapshotUrl), request.signal);
      if (!request.signal.aborted) {
        customOverlay = payload;
        customOverlayFailed = !payload;
      }
    } catch (error) {
      if (!request.signal.aborted) {
        customOverlayFailed = true;
        console.warn('Overlay unavailable', id, error);
      }
    } finally {
      if (!request.signal.aborted) customOverlayLoading = false;
    }
  }

  async function ensureCuisineIndex(activeLayer: string) {
    if (activeLayer !== 'cuisine' || cuisineIndex || cuisineIndexLoading) return;
    cuisineIndexLoading = true;
    try { cuisineIndex = await loadCuisineIndex(); }
    catch (error) { console.warn('Cuisine index unavailable', error); }
    finally { cuisineIndexLoading = false; }
  }

  async function ensurePopulation() {
    try {
      populationData = await loadPopulation();
    } catch (error) {
      console.warn('Population data unavailable', error);
    }
  }

  function selectMapCity(code: string) {
    if (layer !== 'destinations') selectCity(code);
  }

  function selectCity(code: string) {
    selectionVersion++;
    const region = cities.find(item => item.code === code);
    if (!region) return;
    city = region;
    updateUrl();
  }
</script>

<section class="region-atlas" aria-label={m.level_national()}>
  <nav class="atlas-breadcrumb" aria-label={m.level_province()}>
    <button type="button" onclick={returnToNational} aria-current={!province}>{m.level_national()}</button>
    {#if province}<span aria-hidden="true">/</span><button type="button" onclick={showProvinceOnly}>{province.name}</button>{/if}
    {#if city}<span aria-hidden="true">/</span><strong>{city.name}</strong>{/if}
  </nav>
  <div class="atlas-body">
    <div class="atlas-view">
      <ClayMap bind:this={clayMap} label={province?.name ?? m.level_national()} {national} {detail} openProvince={province?.code} selectedCode={city?.code}
        onselect={mapSelect} onprovince={openProvince} oncity={selectMapCity} onweather={handleWeather} activeLayer={layer} overlay={activeOverlay} {heatmap} geometryUnavailable={geometryLoaded && !national} />
      <div class="atlas-actions"><DataExport buildDataset={buildExportDataset} /></div>
      {#if layer === 'mountains'}
        <p class="edition-note"><a href="https://geoservices.big.go.id/gis/rest/services/PTRA/Atlas_250K_NKRI/MapServer" target="_blank" rel="noreferrer">BIG Atlas Nasional ↗</a> · {m.mountain_coverage()}</p>
      {/if}
      <p class="edition-note"><a href="https://data.humdata.org/dataset/cod-ab-idn" target="_blank" rel="noreferrer">BPS / OCHA · CC BY 3.0 IGO</a> · <a href="https://www.ncei.noaa.gov/products/etopo-global-relief-model" target="_blank" rel="noreferrer">ETOPO1 / NOAA</a> · <a href="/terms#sources">{m.source_details()}</a></p>
    </div>
    <div class="region-directory">
      {#if layer === 'destinations'}
        <DestinationsPanel landmarks={destinationCatalog?.landmarks ?? []} index={destinationIndex} loading={initializingSelection || destinationLoading || (!destinationIndex && !destinationIndexFailed)} failed={initialSelectionFailed || destinationFailed || destinationIndexFailed} {provinces} provinceCode={province?.code} onprovince={openProvince} />
      {:else if layer === 'mountains'}
        <label for="mountain-search">{m.mountain_search()}</label>
        <input id="mountain-search" type="search" bind:value={query} autocomplete="off" />
        {#if customOverlay?.id === 'mountains'}
          <p class="directory-count" aria-live="polite">{mountainMatches.length.toLocaleString()} · {m.layer_mountains()}</p>
          {#if mountainMatches.length === 0}<p role="status">{m.no_results()}</p>
          {:else}
            <div class="mountain-list">
              <DirectoryTable label={m.layer_mountains()} nameHeader={m.table_name()} detailLabel={m.region_detail()} columns={mountainColumns()}
                rows={buildMountainRows(mountainMatches.slice(0, mountainLimit))} onopen={openMountain} />
            </div>
            {#if mountainLimit < mountainMatches.length}
              <button class="mountain-more" type="button" onclick={() => mountainLimit += 80}>{m.mountain_more()}</button>
            {/if}
          {/if}
        {:else if customOverlayLoading}<p role="status">{m.loading_data()}</p>
        {:else if customOverlayFailed}<p role="alert">{m.data_unavailable()}</p>
        {:else}<p role="status">{m.source_not_connected_details()}</p>{/if}
      {:else}
      <label for="region-search">{m.region_search()}</label>
      <input id="region-search" type="search" bind:value={query} autocomplete="off" />
      <p class="directory-count" aria-live="polite">{filtered.length} · {#if province}{m.level_city()}{:else}{m.level_province()}{/if}</p>
      {#if loading}<p role="status">{m.loading_data()}</p>
      {:else if failed}<p role="alert">{m.data_unavailable()}</p>
      {:else if filtered.length === 0}<p role="status">{m.no_results()}</p>
      {:else}
        <DirectoryTable label={province ? m.level_city() : m.level_province()} codeHeader={m.table_code()} nameHeader={province ? m.level_city() : m.level_province()}
          detailLabel={m.region_detail()} columns={directoryColumns} rows={directoryRows} onopen={openRegionRow} />
      {/if}
      {#if selectedRegion}
        <RegionDetails name={selectedRegion.name} code={selectedRegion.code} levelLabel={city ? m.level_city() : m.level_province()} parentName={selectedParent}
          coordinates={showWeather ? coordinatesOf(selectedRegion.code) : undefined} weather={selectedWeather} />
      {/if}
      {/if}
    </div>
  </div>
</section>
