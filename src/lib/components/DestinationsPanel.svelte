<script lang="ts">
  import { MapPin, Leaf, Landmark as LandmarkIcon, Search } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import type { Region } from '$lib/atlas/regions';
  import type { Landmark, DestinationIndex } from '$lib/data/destinations';
  import { filterDestinations, paginateDestinations, sortDestinations, type DestinationImageFilter, type DestinationSortDirection, type DestinationSortKey } from '$lib/data/destination-table';
  import DestinationImage from './DestinationImage.svelte';
  import PlacePicker from './PlacePicker.svelte';
  import type { PlaceOption } from '$lib/atlas/place-search';

  let { landmarks, index, loading = false, failed = false, provinces, provinceCode, onprovince }: {
    landmarks: Landmark[]; index?: DestinationIndex; loading?: boolean; failed?: boolean;
    provinces: Region[]; provinceCode?: string; onprovince: (code: string) => void;
  } = $props();
  let query = $state('');
  let category = $state('all');
  let district = $state('');
  let imageFilter = $state<DestinationImageFilter>('all');
  let sortKey = $state<DestinationSortKey>('name');
  let sortDirection = $state<DestinationSortDirection>('ascending');
  let pageSize = $state(25);
  let page = $state(0);
  $effect(() => { void provinceCode; void landmarks; page = 0; });
  $effect(() => { void query; void category; void district; void imageFilter; page = 0; });
  $effect(() => { void sortKey; void sortDirection; page = 0; });
  $effect(() => { void pageSize; page = 0; });

  const region = $derived(provinces.find(item => item.code === provinceCode));
  const totals = $derived(new Map(index?.provinces.map(item => [item.provinceCode, item.count]) ?? []));
  const total = $derived.by(() => {
    if (provinceCode) return totals.get(provinceCode);
    return index?.coverage.totalRecords;
  });
  $effect(() => { void provinceCode; district = ''; });
  const rows = $derived(landmarks);
  const districts = $derived([...new Set(rows.map(item => item.sourceDistrict).filter((value): value is string => Boolean(value?.trim())))].sort((a, b) => a.localeCompare(b, getLocale())));
  const filtered = $derived(filterDestinations(rows, { query, kind: category, district, image: imageFilter }));
  const sorted = $derived(sortDestinations(filtered, sortKey, sortDirection, getLocale()));
  const pageData = $derived(paginateDestinations(sorted, page, pageSize));
  $effect(() => { if (pageData.page !== page) page = pageData.page; });

  function changeSort(key: DestinationSortKey) {
    if (sortKey === key) {
      if (sortDirection === 'ascending') sortDirection = 'descending';
      else sortDirection = 'ascending';
      return;
    }
    sortKey = key;
    sortDirection = 'ascending';
  }

  function sortIndicator(key: DestinationSortKey): string {
    if (sortKey !== key) return '↕';
    if (sortDirection === 'ascending') return '↑';
    return '↓';
  }

  function ariaSort(key: DestinationSortKey): 'ascending' | 'descending' | 'none' {
    if (sortKey !== key) return 'none';
    return sortDirection;
  }

  const provinceOptions = $derived<PlaceOption[]>(provinces.map(item => ({ code: item.code, name: item.name, level: 'province' })));

  /** Under each province name in the popup: how many places the catalogue holds for it. */
  function placeCount(option: PlaceOption): string {
    return m.layer_destinations() + ' · ' + (totals.get(option.code) ?? '—');
  }

  function changePageSize(event: Event) {
    pageSize = Number((event.currentTarget as HTMLSelectElement).value);
  }
</script>

<section class="destination-explorer" aria-label={m.layer_destinations()}>
  <header class="destination-heading">
    <div><span class="destination-eyebrow"><MapPin size={13} /> {m.layer_destinations()}</span><h3>{region?.name ?? m.destination_select_province()}</h3></div>
    <span class="destination-total">{total ?? '—'}</span>
  </header>
  <div class="province-field">
    <span class="province-select-label">{m.destination_select_province()}</span>
    <PlacePicker options={provinceOptions} value={provinceCode ?? ''} onchange={onprovince} title={m.destination_select_province()} detail={placeCount} />
  </div>
  {#if loading}<p role="status">{m.loading_data()}</p>
  {:else if failed}<p role="alert">{m.data_unavailable()}</p>
  {:else if !provinceCode}
    <p class="destination-hint">{m.destination_click_province()}</p>
  {:else}
    <div class="destination-filters">
      <label class="destination-search"><Search size={15} aria-hidden="true" /><input type="search" bind:value={query} placeholder={m.destination_search_fields()} aria-label={m.destination_search_fields()} /></label>
      <div class="filter-row">
        <label>{m.destination_filter_kind()}
          <select bind:value={category}>
            <option value="all">{m.destination_filter_all()}</option>
            <option value="natural">{m.destination_natural()}</option>
            <option value="built">{m.destination_built()}</option>
            <option value="unknown">{m.mountain_other()}</option>
          </select>
        </label>
        <label>{m.destination_filter_district()}
          <select bind:value={district}>
            <option value="">{m.destination_filter_all()}</option>
            {#each districts as name (name)}<option value={name}>{name}</option>{/each}
          </select>
        </label>
        <label>{m.destination_filter_image()}
          <select bind:value={imageFilter}>
            <option value="all">{m.destination_filter_all()}</option>
            <option value="with-image">{m.destination_filter_with_image()}</option>
            <option value="without-image">{m.destination_filter_without_image()}</option>
          </select>
        </label>
      </div>
    </div>
    {#if sorted.length}
      <div class="table-toolbar">
        <p class="destination-note" aria-live="polite">{m.destination_rows()} {pageData.start}–{pageData.end} / {pageData.total}</p>
        <label>{m.destination_page_size()} <select value={pageSize} onchange={changePageSize}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label>
      </div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (keyboard users must be able to focus and horizontally scroll this table region) -->
      <div class="destination-table-scroll scroll-area" tabindex="0" role="region" aria-label={m.layer_destinations()}>
        <table class="destination-table" aria-label={m.layer_destinations() + ' · ' + (region?.name ?? m.destination_select_province())}>
          <thead><tr>
            <th scope="col">{m.destination_filter_image()}</th>
            <th scope="col" aria-sort={ariaSort('name')}><button type="button" onclick={() => changeSort('name')}>{m.destination_sort_name()} <span aria-hidden="true">{sortIndicator('name')}</span></button></th>
            <th scope="col" aria-sort={ariaSort('kind')}><button type="button" onclick={() => changeSort('kind')}>{m.destination_sort_category()} <span aria-hidden="true">{sortIndicator('kind')}</span></button></th>
            <th scope="col" aria-sort={ariaSort('district')}><button type="button" onclick={() => changeSort('district')}>{m.destination_sort_district()} <span aria-hidden="true">{sortIndicator('district')}</span></button></th>
            <th scope="col">{m.source_details()}</th>
          </tr></thead>
          <tbody>
            {#each pageData.items as place (place.id)}
              <tr>
                <td class="photo-cell"><DestinationImage name={place.name} image={place.image} /></td>
                <th scope="row">{place.name}{#if place.officialId}<small class="official-id">{place.officialId}</small>{/if}</th>
                <td><span class="destination-kind">{#if place.kind === 'natural'}<Leaf size={13} aria-hidden="true" />{m.destination_natural()}{:else if place.kind === 'built'}<LandmarkIcon size={13} aria-hidden="true" />{m.destination_built()}{:else}{m.mountain_other()}{/if}</span></td>
                <td>{place.sourceDistrict ?? m.destination_no_district()}</td>
                <td>{#if place.sourceUrl}<a href={place.sourceUrl} target="_blank" rel="noopener noreferrer">{m.source_details()} ↗</a>{:else}—{/if}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <nav class="pagination" aria-label={m.destination_page()}>
        <button type="button" disabled={pageData.page === 0} onclick={() => page = Math.max(0, page - 1)}>{m.destination_previous()}</button>
        <span aria-live="polite">{m.destination_page()} {pageData.page + 1} / {pageData.pageCount}</span>
        <button type="button" disabled={pageData.page + 1 >= pageData.pageCount} onclick={() => page = Math.min(pageData.pageCount - 1, page + 1)}>{m.destination_next()}</button>
      </nav>
    {:else}<p role="status">{m.destination_empty()}</p>{/if}
  {/if}
  <p class="destination-note">{m.destination_coverage_note()}</p>
  {#if index}
    <details class="destination-note"><summary>{m.data_coverage()}</summary>
      <p>{index.scope}</p>
      <p>{index.attribution} · {index.license}</p>
      <p>{m.source_time()}: {index.fetchedAt}</p>
      <a href={index.sourceUrl} target="_blank" rel="noopener noreferrer">{index.source} ↗</a>
      {#if index.national}<p><a href={index.national} download>{m.download_data()} · {m.level_national()}</a></p>{/if}
      {#if provinceCode}<p><a href={'/data/destinations/provinces/' + provinceCode + '.json'} download>{m.download_data()} · {region?.name}</a></p>{/if}
    </details>
  {/if}
</section>

<style>
  .destination-explorer { display: grid; gap: 12px; min-width: 0; }
  .destination-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .destination-heading h3 { margin: 3px 0 0; font-size: 1.13rem; line-height: 1.3; }
  .destination-eyebrow { display: inline-flex; align-items: center; gap: 5px; font-size: .72rem; font-weight: 800; color: var(--muted); }
  .destination-total { padding: 6px 10px; border-radius: 14px; background: var(--surface); font-weight: 850; box-shadow: inset 0 1px 0 var(--clay-highlight); }
  .destination-hint, .destination-note { color: var(--muted); font-size: .78rem; line-height: 1.5; margin: 0; }
  .province-field { display: grid; gap: 5px; min-width: 0; }
  .province-select-label, .filter-row label, .table-toolbar label { display: grid; gap: 5px; color: var(--muted); font-size: .74rem; font-weight: 750; }
  .filter-row select, .table-toolbar select { min-width: 0; max-width: 100%; min-height: 44px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); color: var(--text); font: inherit; }
  .destination-filters { display: grid; gap: 8px; }
  /* The input is the whole control: the shell draws the border, so the global input box and its 480px cap must not apply inside it. */
  .destination-search { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 48px; margin: 0; padding: 0 14px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); box-shadow: var(--clay-pressed); color: var(--muted); }
  .destination-search:focus-within { outline: 3px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 2px; }
  .destination-search input { flex: 1 1 auto; width: auto; max-width: none; min-width: 0; min-height: 44px; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; color: var(--text); font: inherit; }
  .destination-search input:focus, .destination-search input:focus-visible { outline: none; }
  .filter-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .filter-row select, .table-toolbar select { width: 100%; min-width: 0; max-width: 100%; }
  .table-toolbar select { width: auto; min-width: 88px; }
  .table-toolbar, .pagination { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .destination-table-scroll { min-width: 0; max-width: 100%; overflow: auto; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
  .destination-table-scroll:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
  .destination-table { width: 100%; min-width: 740px; border-collapse: collapse; font-size: .78rem; }
  .destination-table th, .destination-table td { padding: 9px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: middle; }
  .destination-table thead th { position: sticky; top: 0; z-index: 1; background: var(--surface); white-space: nowrap; }
  .destination-table thead button { min-height: 44px; border: 0; padding: 5px 0; background: transparent; color: inherit; font: inherit; font-weight: 800; cursor: pointer; }
  .destination-table tbody tr:last-child > * { border-bottom: 0; }
  .destination-table tbody th { min-width: 150px; font-weight: 800; }
  .destination-table a { color: var(--accent); }
  .photo-cell { width: 150px; min-width: 150px; }
  .photo-cell :global(.destination-image) { width: 132px; aspect-ratio: 16 / 9; border-radius: 9px; }
  .photo-cell :global(.photo-credit) { max-width: 132px; padding: 4px 2px 0; font-size: .65rem; }
  .destination-kind { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
  .official-id { display: block; margin-top: 3px; color: var(--muted); font-weight: 500; }
  .pagination button { min-height: 44px; padding: 7px 12px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); color: inherit; font: inherit; font-weight: 750; }
  .pagination button:disabled { opacity: .48; cursor: not-allowed; }
  .pagination span { color: var(--muted); font-size: .78rem; }
  .destination-note { border-top: 1px solid var(--border); padding-top: 10px; }
  @media (max-width: 560px) { .filter-row { grid-template-columns: 1fr; } .table-toolbar { align-items: end; } }
</style>
