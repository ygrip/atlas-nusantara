<script lang="ts">
  import { Leaf, PawPrint, Search, ShieldCheck, TriangleAlert, Layers, MapPinned, Download, Info, ChevronDown } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import type { Region } from '$lib/atlas/regions';
  import { FAUNA_GROUPS, FLORA_GROUPS, SPECIES_STATUSES, type SpeciesIndex, type SpeciesKind, type SpeciesRecord } from '$lib/data/species';
  import { displayName, filterSpecies, sortSpecies, type SpeciesProtectionFilter, type SpeciesSortDirection, type SpeciesSortKey } from '$lib/data/species-table';
  import { paginateDestinations } from '$lib/data/destination-table';
  import { speciesGroupLabel, speciesRealmLabel, speciesStatusColor, speciesStatusLabel, speciesStatusTextColor } from '$lib/data/species-labels';
  import { isShareablePhoto, speciesImageCredit, speciesImageUrl, speciesPlaceholderPath } from '$lib/data/species-images';
  import { assetUrl } from '$lib/pwa/assets';
  import type { ShareSpecies } from '$lib/share/card';
  import SharePanel from './SharePanel.svelte';
  import SpeciesDialog from './SpeciesDialog.svelte';
  import SpeciesPhoto from './SpeciesPhoto.svelte';
  import PlacePicker from './PlacePicker.svelte';
  import type { PlaceOption } from '$lib/atlas/place-search';

  let { kind, species, index, loading = false, failed = false, provinces, provinceCode, onprovince }: {
    kind: SpeciesKind; species: SpeciesRecord[]; index?: SpeciesIndex; loading?: boolean; failed?: boolean;
    provinces: Region[]; provinceCode?: string; onprovince: (code: string) => void;
  } = $props();

  let query = $state('');
  let group = $state('all');
  let status = $state('all');
  let protection = $state<SpeciesProtectionFilter>('all');
  let sortKey = $state<SpeciesSortKey>('status');
  let sortDirection = $state<SpeciesSortDirection>('ascending');
  let pageSize = $state(25);
  let page = $state(0);
  $effect(() => { void provinceCode; void species; void kind; page = 0; });
  $effect(() => { void query; void group; void status; void protection; void sortKey; void sortDirection; void pageSize; page = 0; });
  $effect(() => { void kind; group = 'all'; });

  const region = $derived(provinces.find(item => item.code === provinceCode));
  const summaries = $derived(new Map(index?.provinces.map(item => [item.provinceCode, item]) ?? []));
  const total = $derived.by(() => {
    if (provinceCode) return summaries.get(provinceCode)?.count;
    return index?.coverage.totalSpecies;
  });
  const groups = $derived.by(() => {
    if (kind === 'flora') return FLORA_GROUPS;
    return FAUNA_GROUPS;
  });
  const filtered = $derived(filterSpecies(species, { query, group, status, protection }));
  const sorted = $derived(sortSpecies(filtered, sortKey, sortDirection, getLocale()));
  const pageData = $derived(paginateDestinations(sorted, page, pageSize));
  $effect(() => { if (pageData.page !== page) page = pageData.page; });
  const provinceOptions = $derived<PlaceOption[]>(provinces.map(item => ({ code: item.code, name: item.name, level: 'province' })));
  const provincesWithSpecies = $derived(index?.provinces.filter(item => item.count > 0).length ?? 0);
  const statusSegments = $derived.by(() => {
    if (!index) return [];
    return SPECIES_STATUSES.map(code => ({ code, count: index.statusCounts[code] ?? 0 })).filter(item => item.count > 0);
  });
  const nationalGroups = $derived(groups.map(id => ({ id, count: index?.groupCounts[id] ?? 0 })).filter(item => item.count > 0));

  function changeSort(key: SpeciesSortKey) {
    if (sortKey === key && sortDirection === 'ascending') sortDirection = 'descending';
    else sortDirection = 'ascending';
    sortKey = key;
  }

  function sortIndicator(key: SpeciesSortKey): string {
    if (sortKey !== key) return '↕';
    if (sortDirection === 'ascending') return '↑';
    return '↓';
  }

  function ariaSort(key: SpeciesSortKey): 'ascending' | 'descending' | 'none' {
    if (sortKey !== key) return 'none';
    return sortDirection;
  }

  function placeCount(option: PlaceOption): string {
    const count = summaries.get(option.code)?.count;
    if (count === undefined) return '—';
    return m.species_count({ count: count.toLocaleString() });
  }

  function changePageSize(event: Event) {
    pageSize = Number((event.currentTarget as HTMLSelectElement).value);
  }

  /** Matches the backdrop of the illustrations in static/illustrations/species, so the share card shows them without bars. */
  const PLACEHOLDER_BACKGROUNDS: Record<SpeciesKind, string> = { flora: '#ebf2dd', fauna: '#f6e8d3' };
  let selected = $state<SpeciesRecord | undefined>();
  let sharePanel: SharePanel | undefined = $state();
  $effect(() => { void provinceCode; void kind; selected = undefined; });

  /** A shared link carries ?species=<id>; once its province loads, the popup opens on that species. */
  let sharedSpeciesId = readSharedSpeciesId();
  $effect(() => {
    if (!sharedSpeciesId) return;
    const shared = species.find(item => item.id === sharedSpeciesId);
    if (!shared) return;
    sharedSpeciesId = undefined;
    selected = shared;
  });

  function readSharedSpeciesId(): string | undefined {
    if (typeof location === 'undefined') return undefined;
    return new URL(location.href).searchParams.get('species') ?? undefined;
  }

  function shareSpecies(record: SpeciesRecord) {
    const photo = record.images?.find(isShareablePhoto);
    const provinceName = region?.name;
    const subtitle = [speciesGroupLabel(record.group), provinceName].filter(Boolean).join(' · ');
    const request: ShareSpecies = {
      id: record.id, kind, name: displayName(record), scientificName: record.scientificName, subtitle, kindLabel: heading,
      statusCode: record.status, statusLabel: speciesStatusLabel(record.status),
      statusColor: speciesStatusColor(record.status), statusTextColor: speciesStatusTextColor(record.status),
      description: record.summary || record.habitat,
      placeholderUrl: assetUrl(speciesPlaceholderPath(kind)),
      placeholderBackground: PLACEHOLDER_BACKGROUNDS[kind]
    };
    if (photo) {
      request.imageUrl = speciesImageUrl(photo, 'large');
      request.credit = speciesImageCredit(photo, m.species_all_rights_reserved());
    }
    void sharePanel?.openSpecies({ species: request, provinceCode });
  }

  function habitatText(record: SpeciesRecord): string {
    if (record.habitat) return record.habitat;
    return record.realms.map(realm => speciesRealmLabel(realm)).join(' · ');
  }

  const kindColor = $derived(kind === 'flora' ? '#4f9a52' : '#c4762f');
  const heading = $derived.by(() => {
    if (kind === 'flora') return m.layer_flora();
    return m.layer_fauna();
  });
</script>

<section class="species-explorer" aria-label={heading} style:--kind-color={kindColor}>
  <header class="species-heading">
    <div>
      <span class="species-eyebrow">{#if kind === 'flora'}<Leaf size={13} />{:else}<PawPrint size={13} />{/if} {heading}</span>
      <h3>{region?.name ?? m.destination_select_province()}</h3>
    </div>
    <span class="species-total">{total?.toLocaleString() ?? '—'}</span>
  </header>
  <div class="province-field">
    <span class="province-select-label">{m.destination_select_province()}</span>
    <PlacePicker options={provinceOptions} value={provinceCode ?? ''} onchange={onprovince} title={m.destination_select_province()} detail={placeCount} />
  </div>
  {#if loading}<p role="status">{m.loading_data()}</p>
  {:else if failed}<p role="alert">{m.data_unavailable()}</p>
  {:else if !provinceCode}
    {#if index}
      <div class="bento" role="list">
        <div class="metric metric-total" role="listitem">
          <span class="metric-icon">{#if kind === 'flora'}<Leaf size={20} aria-hidden="true" />{:else}<PawPrint size={20} aria-hidden="true" />{/if}</span>
          <strong>{index.coverage.totalSpecies.toLocaleString()}</strong>
          <span class="metric-label">{heading}</span>
        </div>
        <div class="metric metric-threatened" role="listitem">
          <span class="metric-icon"><TriangleAlert size={18} aria-hidden="true" /></span>
          <strong>{index.coverage.threatened.toLocaleString()}</strong>
          <span class="metric-label">{m.species_threatened_label()}</span>
        </div>
        <div class="metric metric-protected" role="listitem">
          <span class="metric-icon"><ShieldCheck size={18} aria-hidden="true" /></span>
          <strong>{index.coverage.protectedSpecies.toLocaleString()}</strong>
          <span class="metric-label">{m.species_protected_badge()}</span>
        </div>
        <div class="metric metric-groups" role="listitem">
          <span class="metric-icon"><Layers size={18} aria-hidden="true" /></span>
          <strong>{nationalGroups.length}</strong>
          <span class="metric-label">{m.species_filter_group()}</span>
        </div>
        <div class="metric metric-provinces" role="listitem">
          <span class="metric-icon"><MapPinned size={18} aria-hidden="true" /></span>
          <strong>{provincesWithSpecies}</strong>
          <span class="metric-label">{m.level_province()}</span>
        </div>
        <div class="metric metric-status" role="listitem">
          <span class="metric-label">{m.table_status()} · IUCN</span>
          <div class="status-bar" role="img" aria-label={statusSegments.map(item => item.code + ' ' + item.count).join(', ')}>
            {#each statusSegments as item (item.code)}<span style:flex-grow={item.count} style:background={speciesStatusColor(item.code)} title={item.code + ' · ' + speciesStatusLabel(item.code) + ' · ' + item.count.toLocaleString()}></span>{/each}
          </div>
          <ul class="status-legend">
            {#each statusSegments as item (item.code)}<li><i style:background={speciesStatusColor(item.code)}></i>{item.code} <b>{item.count.toLocaleString()}</b></li>{/each}
          </ul>
        </div>
      </div>
      <ul class="group-counts" aria-label={m.species_filter_group()}>
        {#each nationalGroups as item (item.id)}<li><span>{speciesGroupLabel(item.id)}</span><strong>{item.count.toLocaleString()}</strong></li>{/each}
      </ul>
    {/if}
    <p class="species-hint">{m.species_click_province()}</p>
  {:else}
    <div class="species-filters">
      <label class="species-search"><Search size={15} aria-hidden="true" /><input type="search" bind:value={query} placeholder={m.species_search()} aria-label={m.species_search()} /></label>
      <div class="filter-row">
        <label>{m.species_filter_group()}
          <select bind:value={group}>
            <option value="all">{m.destination_filter_all()}</option>
            {#each groups as id (id)}<option value={id}>{speciesGroupLabel(id)}</option>{/each}
          </select>
        </label>
        <label>{m.table_status()}
          <select bind:value={status}>
            <option value="all">{m.destination_filter_all()}</option>
            {#each SPECIES_STATUSES as id (id)}<option value={id}>{id} · {speciesStatusLabel(id)}</option>{/each}
          </select>
        </label>
        <label>{m.species_filter_protection()}
          <select bind:value={protection}>
            <option value="all">{m.destination_filter_all()}</option>
            <option value="protected">{m.species_protected_badge()}</option>
          </select>
        </label>
      </div>
    </div>
    {#if sorted.length}
      <div class="table-toolbar">
        <p class="species-note" aria-live="polite">{m.destination_rows()} {pageData.start}–{pageData.end} / {pageData.total}</p>
        <label>{m.destination_page_size()} <select value={pageSize} onchange={changePageSize}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label>
      </div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (keyboard users must be able to focus and horizontally scroll this table region) -->
      <div class="species-table-scroll scroll-area" tabindex="0" role="region" aria-label={heading}>
        <table class="species-table" aria-label={heading + ' · ' + (region?.name ?? '')}>
          <thead><tr>
            <th scope="col">{m.destination_filter_image()}</th>
            <th scope="col" aria-sort={ariaSort('name')}><button type="button" onclick={() => changeSort('name')}>{m.destination_sort_name()} <span aria-hidden="true">{sortIndicator('name')}</span></button></th>
            <th scope="col" aria-sort={ariaSort('scientific')}><button type="button" onclick={() => changeSort('scientific')}>{m.species_latin_name()} <span aria-hidden="true">{sortIndicator('scientific')}</span></button></th>
            <th scope="col" aria-sort={ariaSort('status')}><button type="button" onclick={() => changeSort('status')}>{m.table_status()} <span aria-hidden="true">{sortIndicator('status')}</span></button></th>
            <th scope="col">{m.species_habitat()}</th>
          </tr></thead>
          <tbody>
            {#each pageData.items as record (record.id)}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions (the name button in the row is the keyboard path) -->
              <tr class="species-row" onclick={() => { selected = record; }}>
                <td class="photo-cell"><div class="species-photo"><SpeciesPhoto {kind} image={record.images?.[0]} size="small" alt={displayName(record)} /></div></td>
                <th scope="row">
                  <button type="button" class="open-species" onclick={(event) => { event.stopPropagation(); selected = record; }} aria-haspopup="dialog" aria-label={m.species_open_details({ name: displayName(record) })}>{displayName(record)}</button>
                  {#if record.name && record.nameEn && record.nameEn !== record.name}<small>{record.nameEn}</small>{/if}
                  <small>{record.family}</small>
                  {#if record.protected}<span class="protected" title={m.species_protected_badge()}><ShieldCheck size={12} aria-hidden="true" /> {m.species_protected_badge()}{#if record.cites} · CITES {record.cites}{/if}</span>{/if}
                </th>
                <td><em>{record.scientificName}</em><small>{speciesGroupLabel(record.group)}</small></td>
                <td><span class="status-badge" style:background={speciesStatusColor(record.status)} style:color={speciesStatusTextColor(record.status)} title={speciesStatusLabel(record.status)}>{record.status}</span><small>{speciesStatusLabel(record.status)}</small></td>
                <td class="habitat-cell">{habitatText(record) || '—'}{#if record.provinces.length > 1}<small>{m.species_in_provinces({ count: record.provinces.length })}</small>{/if}</td>
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
    {:else}<p role="status">{m.species_empty()}</p>{/if}
  {/if}
  <SpeciesDialog {kind} record={selected} {provinces} onclose={() => { selected = undefined; }} onshare={shareSpecies} />
  <SharePanel bind:this={sharePanel} titleId="species-share-title" />
  <p class="species-note">{m.species_coverage_note()}</p>
  {#if index}
    <div class="downloads">
      {#if index.national}<a class="download-button" href={index.national} download><span class="download-icon"><Download size={18} aria-hidden="true" /></span><span><strong>{m.download_data()}</strong><small>{m.level_national()} · {index.coverage.totalSpecies.toLocaleString()}</small></span></a>{/if}
      {#if provinceCode}<a class="download-button" href={'/data/' + kind + '/provinces/' + provinceCode + '.json'} download><span class="download-icon"><Download size={18} aria-hidden="true" /></span><span><strong>{m.download_data()}</strong><small>{region?.name} · {(total ?? 0).toLocaleString()}</small></span></a>{/if}
    </div>
    <details class="coverage-card">
      <summary><span class="coverage-icon"><Info size={18} aria-hidden="true" /></span><span class="coverage-title">{m.data_coverage()}</span><span class="coverage-chevron"><ChevronDown size={18} aria-hidden="true" /></span></summary>
      <div class="coverage-body">
        <p>{index.scope}</p>
        <p>{index.attribution}</p>
        <p>{index.license}</p>
        <p class="coverage-time">{m.source_time()}: {index.fetchedAt}</p>
        <ul class="source-chips">{#each index.sources as source (source.url)}<li><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗</a></li>{/each}</ul>
      </div>
    </details>
  {/if}
</section>

<style>
  .species-explorer { display: grid; gap: 12px; min-width: 0; }
  .species-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .species-heading h3 { margin: 3px 0 0; font-size: 1.13rem; line-height: 1.3; }
  .species-eyebrow { display: inline-flex; align-items: center; gap: 5px; font-size: .72rem; font-weight: 800; color: var(--muted); }
  .species-total { padding: 6px 10px; border-radius: 14px; background: var(--surface); font-weight: 850; box-shadow: inset 0 1px 0 var(--clay-highlight); }
  .species-hint, .species-note { color: var(--muted); font-size: .78rem; line-height: 1.5; margin: 0; }
  .province-field { display: grid; gap: 5px; min-width: 0; }
  .province-select-label, .filter-row label, .table-toolbar label { display: grid; gap: 5px; color: var(--muted); font-size: .74rem; font-weight: 750; }
  .filter-row select, .table-toolbar select { width: 100%; min-width: 0; max-width: 100%; min-height: 44px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); color: var(--text); font: inherit; }
  .species-filters { display: grid; gap: 8px; }
  .species-search { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 48px; margin: 0; padding: 0 14px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); box-shadow: var(--clay-pressed); color: var(--muted); }
  .species-search:focus-within { outline: 3px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 2px; }
  .species-search input { flex: 1 1 auto; width: auto; max-width: none; min-width: 0; min-height: 44px; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; color: var(--text); font: inherit; }
  .species-search input:focus, .species-search input:focus-visible { outline: none; }
  .filter-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .table-toolbar, .pagination { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .table-toolbar select { width: auto; min-width: 88px; }
  .bento { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .metric { position: relative; display: grid; align-content: space-between; gap: 6px; min-height: 104px; padding: 14px; border: 1px solid var(--border); border-radius: 22px; background: linear-gradient(160deg, var(--surface), var(--panel)); box-shadow: 0 4px 0 -1px var(--border), 6px 10px 20px -10px var(--shadow), inset 0 2px 1px var(--clay-highlight); overflow: hidden; }
  .metric strong { font-size: 1.7rem; line-height: 1; letter-spacing: -.02em; }
  .metric-label { color: var(--muted); font-size: .72rem; font-weight: 750; line-height: 1.3; }
  .metric-icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 12px; color: var(--tint-ink, var(--accent)); background: var(--tint, color-mix(in srgb, var(--accent) 14%, transparent)); box-shadow: inset 0 2px 1px var(--clay-highlight), 0 2px 0 -1px var(--border); }
  .metric-total { grid-column: span 2; background: linear-gradient(150deg, color-mix(in srgb, var(--kind-color) 30%, var(--surface)), var(--surface)); --tint: color-mix(in srgb, var(--kind-color) 32%, var(--surface)); --tint-ink: var(--text); }
  .metric-total strong { font-size: 2.4rem; }
  .metric-threatened { --tint: #fc7f3f33; --tint-ink: #c4541a; }
  .metric-protected { --tint: #60c65933; --tint-ink: #2f8a2a; }
  .metric-groups { --tint: #a58bc933; --tint-ink: #7459a0; }
  .metric-provinces { --tint: #4aa3d033; --tint-ink: #2a7aa6; }
  .metric-status { grid-column: span 2; min-height: 0; }
  .status-bar { display: flex; height: 16px; overflow: hidden; border-radius: 999px; box-shadow: inset 0 2px 3px var(--shadow); background: var(--border); }
  .status-bar span { min-width: 3px; }
  .status-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 0; padding: 0; list-style: none; font-size: .7rem; color: var(--muted); }
  .status-legend li { display: inline-flex; align-items: center; gap: 5px; }
  .status-legend i { width: 9px; height: 9px; border-radius: 50%; box-shadow: inset 0 1px 1px #ffffff80; }
  .status-legend b { color: var(--text); }
  .group-counts { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; margin: 0; padding: 0; }
  .group-counts li { display: flex; align-items: baseline; gap: 6px; padding: 6px 12px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border); box-shadow: 0 2px 0 -1px var(--border), inset 0 1px 0 var(--clay-highlight); font-size: .76rem; color: var(--muted); }
  .group-counts strong { color: var(--text); font-size: .9rem; }
  .downloads { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
  .download-button { display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 10px 16px 10px 10px; border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border)); border-radius: 20px; color: var(--text); text-decoration: none; background: linear-gradient(160deg, var(--surface), color-mix(in srgb, var(--accent) 10%, var(--panel))); box-shadow: 0 5px 0 -1px color-mix(in srgb, var(--accent) 30%, var(--border)), 6px 12px 20px -10px var(--shadow), inset 0 2px 1px var(--clay-highlight); transition: transform 140ms ease, box-shadow 140ms ease; }
  .download-button:hover { transform: translateY(-2px); }
  .download-button:active { transform: translateY(3px); box-shadow: 0 1px 0 -1px var(--border), inset 0 2px 5px var(--shadow); }
  .download-button:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
  .download-icon { display: grid; place-items: center; flex: none; width: 42px; height: 42px; border-radius: 15px; color: var(--on-accent); background: linear-gradient(150deg, color-mix(in srgb, var(--accent) 80%, #fff), var(--accent) 55%, var(--accent-strong)); box-shadow: inset 0 2px 1px #ffffff66, 0 3px 0 -1px var(--accent-strong); }
  .download-button strong { display: block; font-size: .86rem; line-height: 1.25; }
  .download-button small { margin-top: 2px; color: var(--muted); font-size: .72rem; font-weight: 700; }
  .coverage-card { border: 1px solid var(--border); border-radius: 24px; background: linear-gradient(160deg, var(--surface), var(--panel)); box-shadow: 0 5px 0 -2px var(--border), 8px 14px 26px -14px var(--shadow), inset 0 2px 1px var(--clay-highlight); overflow: hidden; }
  .coverage-card summary { display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 10px 16px 10px 12px; cursor: pointer; list-style: none; font-weight: 800; font-size: .86rem; }
  .coverage-card summary::-webkit-details-marker { display: none; }
  .coverage-card summary:focus-visible { outline: 3px solid var(--accent); outline-offset: -3px; border-radius: 24px; }
  .coverage-icon { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 13px; color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); box-shadow: inset 0 2px 1px var(--clay-highlight), 0 2px 0 -1px var(--border); }
  .coverage-title { flex: 1 1 auto; min-width: 0; }
  .coverage-chevron { display: grid; place-items: center; flex: none; color: var(--muted); transition: transform 200ms ease; }
  .coverage-card[open] .coverage-chevron { transform: rotate(180deg); }
  .coverage-body { display: grid; gap: 10px; margin: 0 12px 14px; padding: 14px; border-radius: 18px; background: var(--surface); box-shadow: var(--clay-pressed); }
  .coverage-body p { margin: 0; color: var(--muted); font-size: .76rem; line-height: 1.55; }
  .coverage-body .coverage-time { color: var(--text); font-weight: 700; }
  .source-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
  .source-chips a { display: inline-block; padding: 5px 11px; border: 1px solid var(--border); border-radius: 999px; color: var(--accent); background: var(--panel); font-size: .72rem; font-weight: 750; text-decoration: none; box-shadow: 0 2px 0 -1px var(--border); }
  .source-chips a:hover { background: color-mix(in srgb, var(--accent) 10%, var(--panel)); }
  @media (min-width: 720px) { .bento { grid-template-columns: repeat(4, minmax(0, 1fr)); } .metric-total { grid-column: span 2; grid-row: span 2; } .metric-status { grid-column: span 4; } }
  .species-table-scroll { min-width: 0; max-width: 100%; overflow: auto; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
  .species-table-scroll:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
  .species-table { width: 100%; min-width: 720px; border-collapse: collapse; font-size: .78rem; }
  .species-table th, .species-table td { padding: 9px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
  .species-table thead th { position: sticky; top: 0; z-index: 1; background: var(--surface); white-space: nowrap; }
  .species-table thead button { min-height: 44px; border: 0; padding: 5px 0; background: transparent; color: inherit; font: inherit; font-weight: 800; cursor: pointer; }
  .species-table tbody tr:last-child > * { border-bottom: 0; }
  .species-table tbody th { min-width: 150px; font-weight: 800; }
  .species-table small { display: block; margin-top: 2px; color: var(--muted); font-weight: 600; }
  .photo-cell { width: 140px; min-width: 140px; }
  .species-photo { width: 124px; aspect-ratio: 4 / 3; overflow: hidden; border-radius: 9px; background: var(--border); }
  .species-row { cursor: pointer; }
  .species-row:hover { background: color-mix(in srgb, var(--accent) 7%, transparent); }
  .open-species { display: block; padding: 0; border: 0; background: transparent; color: var(--text); font: inherit; font-weight: 800; text-align: left; cursor: pointer; text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--accent) 55%, transparent); text-underline-offset: 3px; }
  .open-species:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
  .status-badge { display: inline-block; min-width: 34px; padding: 3px 8px; border-radius: 9px; text-align: center; font-weight: 850; }
  .protected { display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; padding: 2px 7px; border-radius: 9px; background: color-mix(in srgb, var(--accent) 16%, transparent); font-size: .66rem; font-weight: 750; }
  .habitat-cell { min-width: 170px; max-width: 240px; }
  .pagination button { min-height: 44px; padding: 7px 14px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); color: var(--text); font: inherit; font-weight: 750; cursor: pointer; }
  .pagination button:disabled { opacity: .5; cursor: default; }
  @media (min-width: 720px) { .filter-row { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
