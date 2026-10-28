<script lang="ts">
  import { UtensilsCrossed, Search, BookOpen, Camera, Layers, MapPinned, Download, Info, ChevronDown, Clock3 } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { m } from '$lib/i18n/messages';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import type { Region } from '$lib/atlas/regions';
  import { CUISINE_GROUPS, loadCuisineTranslations, type CuisineDish, type CuisineIndex, type CuisineTranslations } from '$lib/data/cuisine';
  import { filterDishes, recipeCount, sortDishes, type CuisineContentFilter, type CuisineSortDirection, type CuisineSortKey } from '$lib/data/cuisine-table';
  import { paginateDestinations } from '$lib/data/destination-table';
  import { cuisineGroupColor, cuisineGroupLabel } from '$lib/data/cuisine-labels';
  import { CUISINE_PLACEHOLDER_PATH, cuisineImageCredit, cuisineImageUrl, isShareableCuisinePhoto } from '$lib/data/cuisine-images';
  import { assetUrl } from '$lib/pwa/assets';
  import type { ShareDish } from '$lib/share/card';
  import SharePanel from './SharePanel.svelte';
  import CuisineDialog from './CuisineDialog.svelte';
  import CuisinePhoto from './CuisinePhoto.svelte';
  import PlacePicker from './PlacePicker.svelte';
  import type { PlaceOption } from '$lib/atlas/place-search';

  let { dishes, index, loading = false, failed = false, provinces, provinceCode, onprovince }: {
    dishes: CuisineDish[]; index?: CuisineIndex; loading?: boolean; failed?: boolean;
    provinces: Region[]; provinceCode?: string; onprovince: (code: string) => void;
  } = $props();

  let query = $state('');
  let group = $state('all');
  let content = $state<CuisineContentFilter>('all');
  let sortKey = $state<CuisineSortKey>('recipes');
  let sortDirection = $state<CuisineSortDirection>('ascending');
  let pageSize = $state(25);
  let page = $state(0);
  $effect(() => { void provinceCode; void dishes; page = 0; });
  $effect(() => { void query; void group; void content; void sortKey; void sortDirection; void pageSize; page = 0; });

  const region = $derived(provinces.find(item => item.code === provinceCode));
  const summaries = $derived(new Map(index?.provinces.map(item => [item.provinceCode, item]) ?? []));
  const total = $derived.by(() => {
    if (provinceCode) return summaries.get(provinceCode)?.count;
    return index?.coverage.totalDishes;
  });
  const filtered = $derived(filterDishes(dishes, { query, group, content }));
  const sorted = $derived(sortDishes(filtered, sortKey, sortDirection, getLocale()));
  const pageData = $derived(paginateDestinations(sorted, page, pageSize));
  $effect(() => { if (pageData.page !== page) page = pageData.page; });
  const provinceOptions = $derived<PlaceOption[]>(provinces.map(item => ({ code: item.code, name: item.name, level: 'province' })));
  const provincesWithDishes = $derived(index?.provinces.filter(item => item.count > 0).length ?? 0);
  const groupSegments = $derived.by(() => {
    if (!index) return [];
    return CUISINE_GROUPS.map(id => ({ id, count: index.groupCounts[id] ?? 0 })).filter(item => item.count > 0);
  });

  function changeSort(key: CuisineSortKey) {
    if (sortKey === key && sortDirection === 'ascending') sortDirection = 'descending';
    else sortDirection = 'ascending';
    sortKey = key;
  }

  function sortIndicator(key: CuisineSortKey): string {
    if (sortKey !== key) return '↕';
    if (sortDirection === 'ascending') return '↑';
    return '↓';
  }

  function ariaSort(key: CuisineSortKey): 'ascending' | 'descending' | 'none' {
    if (sortKey !== key) return 'none';
    return sortDirection;
  }

  function placeCount(option: PlaceOption): string {
    const count = summaries.get(option.code)?.count;
    if (count === undefined) return '—';
    return m.cuisine_count({ count: count.toLocaleString() });
  }

  function changePageSize(event: Event) {
    pageSize = Number((event.currentTarget as HTMLSelectElement).value);
  }

  /** Optional per-locale recipe translations; a missing file simply leaves the recipes in Indonesian. */
  let translations = $state<CuisineTranslations | null>(null);
  onMount(() => {
    const controller = new AbortController();
    loadCuisineTranslations(getLocale(), controller.signal).then(value => { translations = value; })
      .catch(error => { if (!controller.signal.aborted) console.warn('Cuisine translations unavailable, showing Indonesian', error); });
    return () => controller.abort();
  });

  /** Matches the backdrop of static/illustrations/cuisine/dish.svg, so the share card shows it without bars. */
  const PLACEHOLDER_BACKGROUND = '#f5e1c8';
  let selected = $state<CuisineDish | undefined>();
  let sharePanel: SharePanel | undefined = $state();
  $effect(() => { void provinceCode; selected = undefined; });

  /** A shared link carries ?dish=<id>; once its province loads, the popup opens on that dish. */
  let sharedDishId = readSharedDishId();
  $effect(() => {
    if (!sharedDishId) return;
    const shared = dishes.find(item => item.id === sharedDishId);
    if (!shared) return;
    sharedDishId = undefined;
    selected = shared;
  });

  function readSharedDishId(): string | undefined {
    if (typeof location === 'undefined') return undefined;
    return new URL(location.href).searchParams.get('dish') ?? undefined;
  }

  function shareDish(dish: CuisineDish) {
    const lead = dish.images?.[0];
    const photo = lead && isShareableCuisinePhoto(lead) ? lead : undefined;
    const subtitle = [cuisineGroupLabel(dish.group), region?.name].filter(Boolean).join(' · ');
    let chipLabel = cuisineGroupLabel(dish.group);
    if (recipeCount(dish) > 0) chipLabel = m.cuisine_recipe_count({ count: recipeCount(dish) });
    const request: ShareDish = {
      id: dish.id, name: dish.name, subtitle, kindLabel: heading, chipLabel,
      chipColor: cuisineGroupColor(dish.group), chipTextColor: '#1a1a1a',
      description: dish.summary,
      placeholderUrl: assetUrl(CUISINE_PLACEHOLDER_PATH), placeholderBackground: PLACEHOLDER_BACKGROUND
    };
    if (photo) {
      request.imageUrl = cuisineImageUrl(photo, 'large');
      request.credit = cuisineImageCredit(photo);
    }
    void sharePanel?.openDish({ dish: request, provinceCode });
  }

  function firstRecipeFacts(dish: CuisineDish): string {
    const recipe = dish.recipes?.[0];
    if (!recipe) return '';
    const facts: string[] = [];
    if (recipe.timeMinutes) facts.push(recipe.timeMinutes + ' ' + m.cuisine_minutes());
    if (recipe.yield) facts.push(recipe.yield);
    return facts.join(' · ');
  }

  const heading = $derived(m.layer_cuisine());
</script>

<section class="cuisine-explorer" aria-label={heading} style:--kind-color="#bb7448">
  <header class="cuisine-heading">
    <div>
      <span class="cuisine-eyebrow"><UtensilsCrossed size={13} /> {heading}</span>
      <h3>{region?.name ?? m.destination_select_province()}</h3>
    </div>
    <span class="cuisine-total">{total?.toLocaleString() ?? '—'}</span>
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
          <span class="metric-icon"><UtensilsCrossed size={20} aria-hidden="true" /></span>
          <strong>{index.coverage.totalDishes.toLocaleString()}</strong>
          <span class="metric-label">{heading}</span>
        </div>
        <div class="metric metric-recipes" role="listitem">
          <span class="metric-icon"><BookOpen size={18} aria-hidden="true" /></span>
          <strong>{index.coverage.withRecipe.toLocaleString()}</strong>
          <span class="metric-label">{m.cuisine_metric_with_recipe()}</span>
        </div>
        <div class="metric metric-photos" role="listitem">
          <span class="metric-icon"><Camera size={18} aria-hidden="true" /></span>
          <strong>{index.coverage.withImage.toLocaleString()}</strong>
          <span class="metric-label">{m.cuisine_metric_with_photo()}</span>
        </div>
        <div class="metric metric-types" role="listitem">
          <span class="metric-icon"><Layers size={18} aria-hidden="true" /></span>
          <strong>{groupSegments.length}</strong>
          <span class="metric-label">{m.cuisine_filter_group()}</span>
        </div>
        <div class="metric metric-provinces" role="listitem">
          <span class="metric-icon"><MapPinned size={18} aria-hidden="true" /></span>
          <strong>{provincesWithDishes}</strong>
          <span class="metric-label">{m.level_province()}</span>
        </div>
        <div class="metric metric-groupbar" role="listitem">
          <span class="metric-label">{m.cuisine_filter_group()}</span>
          <div class="group-bar" role="img" aria-label={groupSegments.map(item => cuisineGroupLabel(item.id) + ' ' + item.count).join(', ')}>
            {#each groupSegments as item (item.id)}<span style:flex-grow={item.count} style:background={cuisineGroupColor(item.id)} title={cuisineGroupLabel(item.id) + ' · ' + item.count.toLocaleString()}></span>{/each}
          </div>
          <ul class="group-legend">
            {#each groupSegments as item (item.id)}<li><i style:background={cuisineGroupColor(item.id)}></i>{cuisineGroupLabel(item.id)} <b>{item.count.toLocaleString()}</b></li>{/each}
          </ul>
        </div>
      </div>
    {/if}
    <p class="cuisine-hint">{m.cuisine_choose_province()}</p>
  {:else}
    <div class="cuisine-filters">
      <label class="cuisine-search"><Search size={15} aria-hidden="true" /><input type="search" bind:value={query} placeholder={m.cuisine_search()} aria-label={m.cuisine_search()} /></label>
      <div class="filter-row">
        <label>{m.cuisine_filter_group()}
          <select bind:value={group}>
            <option value="all">{m.destination_filter_all()}</option>
            {#each CUISINE_GROUPS as id (id)}<option value={id}>{cuisineGroupLabel(id)}</option>{/each}
          </select>
        </label>
        <label>{m.cuisine_filter_content()}
          <select bind:value={content}>
            <option value="all">{m.destination_filter_all()}</option>
            <option value="recipe">{m.cuisine_filter_recipe()}</option>
            <option value="photo">{m.cuisine_filter_photo()}</option>
          </select>
        </label>
      </div>
    </div>
    {#if sorted.length}
      <div class="table-toolbar">
        <p class="cuisine-note" aria-live="polite">{m.destination_rows()} {pageData.start}–{pageData.end} / {pageData.total}</p>
        <label>{m.destination_page_size()} <select value={pageSize} onchange={changePageSize}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label>
      </div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (keyboard users must be able to focus and horizontally scroll this table region) -->
      <div class="cuisine-table-scroll scroll-area" tabindex="0" role="region" aria-label={heading}>
        <table class="cuisine-table" aria-label={heading + ' · ' + (region?.name ?? '')}>
          <thead><tr>
            <th scope="col">{m.destination_filter_image()}</th>
            <th scope="col" aria-sort={ariaSort('name')}><button type="button" onclick={() => changeSort('name')}>{m.destination_sort_name()} <span aria-hidden="true">{sortIndicator('name')}</span></button></th>
            <th scope="col" aria-sort={ariaSort('group')}><button type="button" onclick={() => changeSort('group')}>{m.cuisine_filter_group()} <span aria-hidden="true">{sortIndicator('group')}</span></button></th>
            <th scope="col" aria-sort={ariaSort('recipes')}><button type="button" onclick={() => changeSort('recipes')}>{m.cuisine_recipes_heading()} <span aria-hidden="true">{sortIndicator('recipes')}</span></button></th>
          </tr></thead>
          <tbody>
            {#each pageData.items as dish (dish.id)}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions (the name button in the row is the keyboard path) -->
              <tr class="cuisine-row" onclick={() => { selected = dish; }}>
                <td class="photo-cell"><div class="cuisine-photo"><CuisinePhoto image={dish.images?.[0]} size="small" alt={dish.name} /></div></td>
                <th scope="row">
                  <button type="button" class="open-dish" onclick={(event) => { event.stopPropagation(); selected = dish; }} aria-haspopup="dialog" aria-label={m.cuisine_open_details({ name: dish.name })}>{dish.name}</button>
                  {#if dish.provinceCodes.length > 1}<small>{m.cuisine_in_provinces({ count: dish.provinceCodes.length })}</small>{/if}
                </th>
                <td><span class="group-badge" style:--group-color={cuisineGroupColor(dish.group)} title={cuisineGroupLabel(dish.group)}><span>{cuisineGroupLabel(dish.group)}</span></span></td>
                <td class="recipe-cell">
                  {#if recipeCount(dish) > 0}
                    <span class="has-recipe"><BookOpen size={12} aria-hidden="true" /> {m.cuisine_recipe_count({ count: recipeCount(dish) })}</span>
                    {#if firstRecipeFacts(dish)}<small><Clock3 size={11} aria-hidden="true" /> {firstRecipeFacts(dish)}</small>{/if}
                  {:else}<small>—</small>{/if}
                </td>
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
    {:else}<p role="status">{m.cuisine_empty()}</p>{/if}
  {/if}
  <CuisineDialog dish={selected} {provinces} {translations} onclose={() => { selected = undefined; }} onshare={shareDish} />
  <SharePanel bind:this={sharePanel} titleId="cuisine-share-title" />
  <p class="cuisine-note">{m.cuisine_coverage_note()}</p>
  {#if index}
    <div class="downloads">
      {#if index.national}<a class="download-button" href={index.national} download><span class="download-icon"><Download size={18} aria-hidden="true" /></span><span><strong>{m.download_data()}</strong><small>{m.level_national()} · {index.coverage.totalDishes.toLocaleString()}</small></span></a>{/if}
      {#if provinceCode}<a class="download-button" href={'/data/cuisine/provinces/' + provinceCode + '.json'} download><span class="download-icon"><Download size={18} aria-hidden="true" /></span><span><strong>{m.download_data()}</strong><small>{region?.name} · {(total ?? 0).toLocaleString()}</small></span></a>{/if}
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
  .cuisine-explorer { display: grid; gap: 12px; min-width: 0; }
  .cuisine-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .cuisine-heading h3 { margin: 3px 0 0; font-size: 1.13rem; line-height: 1.3; }
  .cuisine-eyebrow { display: inline-flex; align-items: center; gap: 5px; font-size: .72rem; font-weight: 800; color: var(--muted); }
  .cuisine-total { padding: 6px 10px; border-radius: 14px; background: var(--surface); font-weight: 850; box-shadow: inset 0 1px 0 var(--clay-highlight); }
  .cuisine-hint, .cuisine-note { color: var(--muted); font-size: .78rem; line-height: 1.5; margin: 0; }
  .province-field { display: grid; gap: 5px; min-width: 0; }
  .province-select-label, .filter-row label, .table-toolbar label { display: grid; gap: 5px; color: var(--muted); font-size: .74rem; font-weight: 750; }
  .filter-row select, .table-toolbar select { width: 100%; min-width: 0; max-width: 100%; min-height: 44px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); color: var(--text); font: inherit; }
  .cuisine-filters { display: grid; gap: 8px; }
  .cuisine-search { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 48px; margin: 0; padding: 0 14px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); box-shadow: var(--clay-pressed); color: var(--muted); }
  .cuisine-search:focus-within { outline: 3px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 2px; }
  .cuisine-search input { flex: 1 1 auto; width: auto; max-width: none; min-width: 0; min-height: 44px; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; color: var(--text); font: inherit; }
  .cuisine-search input:focus, .cuisine-search input:focus-visible { outline: none; }
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
  .metric-recipes { --tint: #fc7f3f33; --tint-ink: #c4541a; }
  .metric-photos { --tint: #60c65933; --tint-ink: #2f8a2a; }
  .metric-types { --tint: #a58bc933; --tint-ink: #7459a0; }
  .metric-provinces { --tint: #4aa3d033; --tint-ink: #2a7aa6; }
  .metric-groupbar { grid-column: span 2; min-height: 0; }
  .group-bar { display: flex; height: 16px; overflow: hidden; border-radius: 999px; box-shadow: inset 0 2px 3px var(--shadow); background: var(--border); }
  .group-bar span { min-width: 3px; }
  .group-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 0; padding: 0; list-style: none; font-size: .7rem; color: var(--muted); }
  .group-legend li { display: inline-flex; align-items: center; gap: 5px; }
  .group-legend i { width: 9px; height: 9px; border-radius: 50%; box-shadow: inset 0 1px 1px #ffffff80; }
  .group-legend b { color: var(--text); }
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
  @media (min-width: 720px) { .bento { grid-template-columns: repeat(4, minmax(0, 1fr)); } .metric-total { grid-column: span 2; grid-row: span 2; } .metric-groupbar { grid-column: span 4; } }
  .cuisine-table-scroll { min-width: 0; max-width: 100%; overflow: auto; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
  .cuisine-table-scroll:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
  .cuisine-table { width: 100%; min-width: 720px; border-collapse: collapse; font-size: .78rem; }
  .cuisine-table th, .cuisine-table td { padding: 9px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
  .cuisine-table thead th { position: sticky; top: 0; z-index: 1; background: var(--surface); white-space: nowrap; }
  .cuisine-table thead button { min-height: 44px; border: 0; padding: 5px 0; background: transparent; color: inherit; font: inherit; font-weight: 800; cursor: pointer; }
  .cuisine-table tbody tr:last-child > * { border-bottom: 0; }
  .cuisine-table tbody th { min-width: 150px; font-weight: 800; }
  .cuisine-table small { display: block; margin-top: 2px; color: var(--muted); font-weight: 600; }
  .photo-cell { width: 140px; min-width: 140px; }
  .cuisine-photo { width: 124px; aspect-ratio: 4 / 3; overflow: hidden; border-radius: 9px; background: var(--border); }
  .cuisine-row { cursor: pointer; }
  .cuisine-row:hover { background: color-mix(in srgb, var(--accent) 7%, transparent); }
  .open-dish { display: block; padding: 0; border: 0; background: transparent; color: var(--text); font: inherit; font-weight: 800; text-align: left; cursor: pointer; text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--accent) 55%, transparent); text-underline-offset: 3px; }
  .open-dish:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
  .has-recipe { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 9px; background: color-mix(in srgb, var(--accent) 16%, transparent); font-size: .72rem; font-weight: 750; }
  .group-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    max-width: 100%;
    padding: 4px 10px;
    border: 1px solid color-mix(in srgb, var(--group-color) 28%, var(--border));
    border-radius: 12px;
    background: linear-gradient(155deg,
      color-mix(in srgb, var(--group-color) 10%, var(--surface)),
      color-mix(in srgb, var(--group-color) 18%, var(--panel)));
    box-shadow: 0 3px 0 -1px color-mix(in srgb, var(--group-color) 30%, var(--border)),
      0 5px 10px -8px var(--shadow),
      inset 0 1px 1px var(--clay-highlight);
    color: var(--text);
    font-size: .72rem;
    font-weight: 850;
    line-height: 1.35;
    white-space: nowrap;
  }
  .group-badge > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .group-badge::before {
    content: '';
    flex: 0 0 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--group-color);
    box-shadow: inset 0 1px 1px #ffffff55, 0 1px 1px var(--shadow);
  }
    .recipe-cell { min-width: 150px; }
  .pagination button { min-height: 44px; padding: 7px 14px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); color: var(--text); font: inherit; font-weight: 750; cursor: pointer; }
  .pagination button:disabled { opacity: .5; cursor: default; }
  
</style>
