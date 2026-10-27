<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { ISLAND_GROUPS, ISLAND_GROUP_NAMES, type IslandGroup } from '$lib/atlas/islands';
  import { groupStyle } from '$lib/directory/group-style';
  import { loadProvinceDirectory, type ProvinceRow } from '$lib/directory/province-directory';
  import RingChart from './RingChart.svelte';
  import { Check } from 'lucide-svelte';

  type SortKey = 'code' | 'name' | 'regencies' | 'municipalities' | 'total';
  type SortDirection = 'ascending' | 'descending';

  let { onopen, selectedCode }: { onopen?: (code: string) => void; selectedCode?: string } = $props();

  let rows = $state<ProvinceRow[]>([]);
  let loading = $state(true);
  let failed = $state(false);
  let groupFilter = $state<IslandGroup | undefined>(undefined);
  let sortKey = $state<SortKey>('code');
  let sortDirection = $state<SortDirection>('ascending');
  let selected = $state<ProvinceRow | undefined>(undefined);
  let dialog: HTMLDialogElement | undefined = $state();

  const columns = $derived<{ key: SortKey; label: string; numeric: boolean }[]>([
    { key: 'code', label: m.table_code(), numeric: false },
    { key: 'name', label: m.level_province(), numeric: false },
    { key: 'regencies', label: m.legend_regency(), numeric: true },
    { key: 'municipalities', label: m.legend_city(), numeric: true },
    { key: 'total', label: m.table_total(), numeric: true }
  ]);

  const largestTotal = $derived(Math.max(1, ...rows.map(row => row.total)));
  const visibleRows = $derived(sortRows(rows.filter(matchesFilter), sortKey, sortDirection));

  function matchesFilter(row: ProvinceRow): boolean {
    if (!groupFilter) return true;
    return row.group === groupFilter;
  }

  function compareBy(a: ProvinceRow, b: ProvinceRow, key: SortKey): number {
    if (key === 'name') return a.name.localeCompare(b.name, getLocale());
    if (key === 'regencies') return a.regencies.length - b.regencies.length;
    if (key === 'municipalities') return a.municipalities.length - b.municipalities.length;
    if (key === 'total') return a.total - b.total;
    return a.code.localeCompare(b.code);
  }

  function sortRows(list: ProvinceRow[], key: SortKey, direction: SortDirection): ProvinceRow[] {
    const sorted = [...list].sort((a, b) => {
      const difference = compareBy(a, b, key);
      if (difference !== 0) return difference;
      return a.code.localeCompare(b.code);
    });
    if (direction === 'descending') sorted.reverse();
    return sorted;
  }

  onMount(() => {
    let active = true;
    loadProvinceDirectory()
      .then(loaded => { if (active) rows = loaded; })
      .catch(() => { if (active) failed = true; })
      .finally(() => { if (active) loading = false; });
    return () => { active = false; };
  });

  function number(value: number): string {
    return new Intl.NumberFormat(getLocale()).format(value);
  }

  function toggleGroup(group: IslandGroup | undefined) {
    if (group === groupFilter) {
      groupFilter = undefined;
      return;
    }
    groupFilter = group;
  }

  function sortBy(key: SortKey) {
    if (sortKey === key) {
      if (sortDirection === 'ascending') sortDirection = 'descending';
      else sortDirection = 'ascending';
      return;
    }
    sortKey = key;
    sortDirection = 'ascending';
    if (key === 'regencies' || key === 'municipalities' || key === 'total') sortDirection = 'descending';
  }

  function ariaSortFor(key: SortKey): SortDirection | 'none' {
    if (sortKey !== key) return 'none';
    return sortDirection;
  }

  function arrowFor(key: SortKey): string {
    if (sortKey !== key) return '↕';
    if (sortDirection === 'ascending') return '↑';
    return '↓';
  }

  function currentProvince(code: string): 'location' | undefined {
    if (selectedCode?.split('.')[0] === code) return 'location';
    return undefined;
  }

  function share(count: number): string {
    return (count / largestTotal) * 100 + '%';
  }

  function openDetails(row: ProvinceRow) {
    selected = row;
    dialog?.showModal();
  }

  function closeDetails() {
    dialog?.close();
  }

  function closeOnBackdrop(event: MouseEvent) {
    if (event.target === dialog) closeDetails();
  }

  function openInAtlas() {
    if (!selected) return;
    openCode(selected.code);
  }

  function openCode(code: string) {
    closeDetails();
    onopen?.(code);
    document.getElementById('atlas')?.scrollIntoView({ block: 'start' });
  }

  function ringSegments(row: ProvinceRow) {
    return [
      { label: m.legend_regency(), value: row.regencies.length, color: 'var(--seg-regency)' },
      { label: m.legend_city(), value: row.municipalities.length, color: 'var(--seg-city)' }
    ];
  }
</script>

<section id="provinces" class="province-table-card clay-card" aria-labelledby="province-table-heading">
  <div class="card-heading">
    <div>
      <span class="eyebrow">{m.level_province()}</span>
      <h2 id="province-table-heading">{m.table_heading()}</h2>
    </div>
    <div class="group-filter" role="group" aria-label={m.table_island()}>
      <button type="button" class="chip all" aria-pressed={groupFilter === undefined} onclick={() => toggleGroup(undefined)}>{m.filter_all()}</button>
      {#each ISLAND_GROUPS as group (group)}
        <button type="button" class="chip group-chip" style={groupStyle(group)} aria-pressed={groupFilter === group} onclick={() => toggleGroup(group)}>{ISLAND_GROUP_NAMES[group]}</button>
      {/each}
    </div>
  </div>

  {#if loading}<p role="status">{m.loading_data()}</p>
  {:else if failed}<p role="alert">{m.data_unavailable()}</p>
  {:else}
    <ul class="legend" aria-hidden="true">
      <li><span class="swatch regency"></span>{m.legend_regency()}</li>
      <li><span class="swatch city"></span>{m.legend_city()}</li>
    </ul>
    <!-- Scrollable regions must be keyboard reachable (WCAG 2.1.1). -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="table-scroll" tabindex="0" role="region" aria-labelledby="province-table-heading">
      <table>
        <caption>{m.table_caption()}</caption>
        <thead>
          <tr>
            {#each columns as column (column.key)}
              <th scope="col" class:numeric={column.numeric} aria-sort={ariaSortFor(column.key)}>
                <button type="button" class="sort-button" onclick={() => sortBy(column.key)}>{column.label}<span class="sort-arrow" aria-hidden="true">{arrowFor(column.key)}</span></button>
              </th>
            {/each}
            <th scope="col"><span class="visually-hidden">{m.table_details()}</span></th>
          </tr>
        </thead>
        <tbody>
          {#each visibleRows as row (row.code)}
            <tr class:active-region={selectedCode?.split('.')[0] === row.code} style={groupStyle(row.group)}>
              <td class="code">{row.code}</td>
              <th scope="row">
                <button class="province-name province-link" type="button" aria-current={currentProvince(row.code)} onclick={() => openCode(row.code)}><span class="group-dot" title={ISLAND_GROUP_NAMES[row.group]}></span>{row.name}{#if currentProvince(row.code)}<span class="selected-marker"><Check size={13} aria-hidden="true" /></span>{/if}</button>
                <small>{ISLAND_GROUP_NAMES[row.group]}</small>
              </th>
              <td class="numeric">{number(row.regencies.length)}</td>
              <td class="numeric">{number(row.municipalities.length)}</td>
              <td class="numeric total">
                <span class="meter" aria-hidden="true">
                  <span class="meter-bar" style={`width: ${share(row.total)}`}>
                    <span class="meter-part regency" style={`flex: ${row.regencies.length} 1 0`}></span>
                    <span class="meter-part city" style={`flex: ${row.municipalities.length} 1 0`}></span>
                  </span>
                </span>
                <strong>{number(row.total)}</strong>
              </td>
              <td class="action"><button type="button" class="details-button" aria-label={m.table_details() + ' · ' + row.name} onclick={() => openDetails(row)}>{m.table_details()}</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<dialog class="province-dialog" bind:this={dialog} onclick={closeOnBackdrop} onclose={() => (selected = undefined)} aria-labelledby="province-dialog-title">
  {#if selected}
    <div class="dialog-body" style={groupStyle(selected.group)}>
      <header>
        <span class="group-chip pill"><span class="group-dot"></span>{ISLAND_GROUP_NAMES[selected.group]}</span>
        <h2 id="province-dialog-title">{selected.name}</h2>
        <p>{m.table_code()} {selected.code}</p>
      </header>
      <div class="dialog-summary">
        <RingChart segments={ringSegments(selected)} centerValue={number(selected.total)} centerLabel={m.table_total()} label={selected.name + ': ' + selected.regencies.length + ' ' + m.legend_regency() + ', ' + selected.municipalities.length + ' ' + m.legend_city()} size={132} thickness={16} />
        <div class="dialog-stats">
          <div class="stat regency"><strong>{number(selected.regencies.length)}</strong><span>{m.stat_regencies()}</span></div>
          <div class="stat city"><strong>{number(selected.municipalities.length)}</strong><span>{m.stat_cities()}</span></div>
        </div>
      </div>
      <div class="dialog-columns">
        <section aria-label={m.legend_regency()}>
          <h3><span class="swatch regency"></span>{m.legend_regency()}</h3>
          <ul class="dialog-list">
            {#each selected.regencies as region (region.code)}
              <li><button type="button" class="city-link" onclick={() => openCode(region.code)}><span>{region.name}</span><small>{region.code}</small></button></li>
            {/each}
          </ul>
          {#if selected.regencies.length === 0}<p class="dialog-empty">—</p>{/if}
        </section>
        <section aria-label={m.legend_city()}>
          <h3><span class="swatch city"></span>{m.legend_city()}</h3>
          <ul class="dialog-list">
            {#each selected.municipalities as region (region.code)}
              <li><button type="button" class="city-link" onclick={() => openCode(region.code)}><span>{region.name}</span><small>{region.code}</small></button></li>
            {/each}
          </ul>
          {#if selected.municipalities.length === 0}<p class="dialog-empty">—</p>{/if}
        </section>
      </div>
      <div class="dialog-actions">
        <button type="button" class="primary" onclick={openInAtlas}>{m.open_in_atlas()}</button>
        <button type="button" onclick={closeDetails}>{m.dialog_close()}</button>
      </div>
    </div>
  {/if}
</dialog>

<style>
  .province-link { border: 0; padding: 0; background: transparent; color: inherit; font: inherit; font-weight: 850; text-align: left; }
  table tbody tr.active-region > th, table tbody tr.active-region > td { background: color-mix(in srgb, var(--mint) 60%, var(--surface)); box-shadow: inset 0 1px 0 var(--border), inset 0 -1px 0 var(--border); transform: none; }
  tbody tr.active-region > :first-child { box-shadow: inset 4px 0 0 var(--accent), inset 0 1px 0 var(--border), inset 0 -1px 0 var(--border); color: var(--accent); }
  tbody tr.active-region > :last-child { box-shadow: inset -1px 0 0 var(--border), inset 0 1px 0 var(--border), inset 0 -1px 0 var(--border); }
  .selected-marker { display: inline-grid; place-items: center; width: 22px; height: 22px; flex-shrink: 0; border-radius: 50%; background: var(--accent); color: var(--on-accent); }
  .province-link { min-height: 44px; }
  .province-link[aria-current='location'] { color: var(--accent); }
  .city-link { display: flex; justify-content: space-between; gap: 12px; align-items: center; width: 100%; border: 0; padding: 6px; border-radius: 10px; background: transparent; color: inherit; text-align: left; }
  .city-link:hover { background: var(--mint); }
  .card-heading { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
  .card-heading h2 { margin: 8px 0 0; }
  .group-filter { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { min-height: 38px; padding: 6px 14px; border: 2px solid var(--clay-highlight); border-radius: 999px; font-size: .75rem; font-weight: 800; color: #2e2a26; background: var(--surface); box-shadow: inset 2px 2px 3px #ffffff80, inset -2px -3px 5px #0000001a, 0 3px 0 var(--shadow); transition: transform 160ms var(--ease-bounce), box-shadow 160ms ease-out; }
  .chip.all { color: var(--text); }
  .chip.group-chip { background: var(--group-top); box-shadow: inset 2px 2px 3px #ffffff80, inset -2px -3px 5px #0000001a, 0 3px 0 var(--group-side); }
  .chip:hover { transform: translateY(-2px); }
  .chip[aria-pressed='true'] { transform: translateY(2px); box-shadow: inset 3px 3px 6px #0000002e; outline: 2px solid var(--text); outline-offset: 2px; }
  .legend { display: flex; gap: 16px; margin: 0 0 12px; padding: 0; list-style: none; font-size: .75rem; font-weight: 800; }
  .legend li { display: inline-flex; align-items: center; gap: 7px; }
  .swatch { display: inline-block; width: 14px; height: 14px; border-radius: 5px; box-shadow: inset 1px 1px 2px #ffffff80, 0 2px 0 var(--shadow); }
  .swatch.regency, .meter-part.regency { background: var(--seg-regency); }
  .swatch.city, .meter-part.city { background: var(--seg-city); }

  .table-scroll { overflow: auto; max-height: min(620px, 72vh); overscroll-behavior: contain; padding: 0 10px 10px; border-radius: 22px; background: var(--panel); box-shadow: var(--clay-pressed); }
  table { width: 100%; min-width: 720px; border-collapse: separate; border-spacing: 0 8px; font-size: .85rem; }
  caption { text-align: left; padding: 14px 8px 2px; color: var(--muted); font-size: .75rem; }
  thead th { position: sticky; top: 0; z-index: 2; padding: 10px 14px; text-align: left; background: var(--panel); font-size: .7rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
  th.numeric, td.numeric { text-align: right; }
  .sort-button { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 4px 8px; margin: 0 -8px; border: 0; border-radius: 10px; background: transparent; color: inherit; font: inherit; letter-spacing: inherit; text-transform: inherit; font-weight: 800; }
  .sort-button:hover { background: var(--surface); color: var(--text); }
  th[aria-sort='ascending'] .sort-button, th[aria-sort='descending'] .sort-button { color: var(--accent); }
  .sort-arrow { font-size: .8rem; }

  tbody th, tbody td { padding: 10px 14px; text-align: left; background: var(--surface); transition: transform 180ms var(--ease-bounce), box-shadow 180ms ease-out; }
  tbody tr:nth-child(even) th, tbody tr:nth-child(even) td { background: color-mix(in srgb, var(--surface) 70%, var(--page)); }
  tbody tr > :first-child { border-radius: 16px 0 0 16px; }
  tbody tr > :last-child { border-radius: 0 16px 16px 0; }
  tbody tr:hover th, tbody tr:hover td { transform: translateY(-2px); box-shadow: 0 5px 0 var(--shadow); background: var(--mint); }
  .code { font-family: ui-monospace, SFMono-Regular, monospace; color: var(--muted); font-weight: 700; }
  .province-name { display: inline-flex; align-items: center; gap: 9px; font-weight: 800; }
  tbody th small { display: block; margin: 2px 0 0 25px; color: var(--muted); font-size: .7rem; font-weight: 650; }
  td.numeric { font-variant-numeric: tabular-nums; font-weight: 700; }
  td.total { display: table-cell; white-space: nowrap; }
  .meter { display: inline-block; vertical-align: middle; width: 84px; height: 10px; margin-right: 10px; border-radius: 99px; background: var(--panel); box-shadow: inset 1px 1px 3px var(--shadow); overflow: hidden; }
  .meter-bar { display: flex; height: 100%; gap: 1px; border-radius: 99px; overflow: hidden; }
  td.total strong { display: inline-block; min-width: 2ch; vertical-align: middle; }
  td.action { text-align: right; }
  .details-button { min-height: 38px; padding: 6px 14px; border-radius: 12px; border: 2px solid var(--border); background: var(--page); color: var(--text); font-size: .75rem; font-weight: 800; box-shadow: 0 3px 0 var(--shadow); transition: transform 160ms var(--ease-bounce); }
  .details-button:hover { transform: translateY(-1px); }
  .details-button:active { transform: translateY(2px); box-shadow: none; }

  .province-dialog { width: min(680px, calc(100vw - 28px)); max-height: min(780px, calc(100dvh - 28px)); padding: 0; border: 3px solid var(--clay-highlight); border-radius: 32px; background: var(--surface); color: var(--text); box-shadow: var(--clay-shadow); overflow: auto; }
  .province-dialog::backdrop { background: #2a211b66; backdrop-filter: blur(4px); }
  .province-dialog[open] { animation: pop 240ms var(--ease-bounce); }
  @keyframes pop { from { opacity: 0; transform: scale(.94) translateY(10px); } }
  .dialog-body { display: grid; gap: 18px; padding: clamp(20px, 4vw, 32px); }
  .dialog-body header { display: grid; gap: 8px; justify-items: start; }
  .dialog-body h2 { margin: 0; font-size: clamp(1.6rem, 4vw, 2.1rem); letter-spacing: -.04em; line-height: 1.1; }
  .dialog-body header p { margin: 0; color: var(--muted); font-size: .8rem; }
  .pill { display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 999px; font-size: .72rem; font-weight: 800; color: #2e2a26; }
  .dialog-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; padding: 18px; border-radius: 24px; background: var(--panel); box-shadow: var(--clay-pressed); }
  .dialog-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; flex: 1 1 220px; }
  .stat { display: grid; gap: 4px; padding: 14px 16px; border-radius: 20px; box-shadow: inset 3px 3px 6px #ffffff73, inset -3px -4px 8px #0000001a, 0 4px 0 var(--shadow); }
  .stat.regency { background: var(--seg-regency); }
  .stat.city { background: var(--seg-city); }
  .stat strong { font-size: 2rem; line-height: 1; color: #2e2a26; }
  .stat span { font-size: .72rem; font-weight: 800; color: #2e2a26; opacity: .8; }
  .dialog-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .dialog-columns h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: .85rem; }
  .dialog-list { list-style: none; margin: 0; padding: 4px 8px; max-height: 240px; overflow-y: auto; border-radius: 16px; background: var(--page); box-shadow: var(--clay-pressed); }
  .dialog-list:empty { display: none; }
  .dialog-list li { display: flex; justify-content: space-between; gap: 10px; padding: 8px 4px; border-bottom: 1px solid var(--border); font-size: .8rem; }
  .dialog-list li:last-child { border-bottom: 0; }
  .dialog-list small { font-family: ui-monospace, monospace; color: var(--muted); }
  .dialog-empty { margin: 0; padding: 14px; border-radius: 16px; background: var(--page); color: var(--muted); text-align: center; }
  .dialog-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
  .dialog-actions button { padding: 10px 20px; border-radius: 14px; border: 2px solid var(--border); background: var(--page); color: var(--text); font-weight: 800; box-shadow: 0 4px 0 var(--shadow); }
  .dialog-actions .primary { background: var(--accent); border-color: transparent; color: var(--on-accent); }
  .dialog-actions button:active { transform: translateY(3px); box-shadow: none; }
  @media (max-width: 560px) { .dialog-columns { grid-template-columns: minmax(0, 1fr); } .dialog-summary { justify-content: center; } }
  @media (prefers-reduced-motion: reduce) {
    .province-dialog[open] { animation: none; }
    tbody tr:hover th, tbody tr:hover td, .chip:hover { transform: none; }
  }
</style>
