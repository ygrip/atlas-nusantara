<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { loadRegions, type Region } from '$lib/atlas/regions';
  import { ISLAND_GROUP_NAMES, tileFor, type IslandGroup } from '$lib/atlas/tiles';

  interface ProvinceRow {
    code: string;
    name: string;
    group: IslandGroup | undefined;
    regencies: Region[];
    cities: Region[];
  }

  let { onopen }: { onopen?: (code: string) => void } = $props();

  let rows = $state<ProvinceRow[]>([]);
  let loading = $state(true);
  let failed = $state(false);
  let groupFilter = $state<IslandGroup | undefined>(undefined);
  let selected = $state<ProvinceRow | undefined>(undefined);
  let dialog: HTMLDialogElement | undefined = $state();

  const islandGroups = Object.entries(ISLAND_GROUP_NAMES) as [IslandGroup, string][];
  let visibleRows = $derived(rows.filter(row => !groupFilter || row.group === groupFilter));
  let largestTotal = $derived(Math.max(1, ...rows.map(row => row.regencies.length + row.cities.length)));

  function isCity(region: Region): boolean {
    return region.name.startsWith('KOTA ');
  }

  function buildRows(provinces: Region[], allCities: Region[]): ProvinceRow[] {
    return provinces.map(province => {
      const children = allCities.filter(region => region.parentCode === province.code);
      return {
        code: province.code,
        name: province.name,
        group: tileFor(province.code)?.group,
        regencies: children.filter(region => !isCity(region)),
        cities: children.filter(isCity)
      };
    });
  }

  onMount(() => {
    const controller = new AbortController();
    Promise.all([
      loadRegions('/data/admin-2022/provinces.json', controller.signal),
      loadRegions('/data/admin-2022/cities.json', controller.signal)
    ])
      .then(([provinces, cities]) => { rows = buildRows(provinces.regions, cities.regions); })
      .catch(error => { if (error.name !== 'AbortError') failed = true; })
      .finally(() => { loading = false; });
    return () => controller.abort();
  });

  function number(value: number): string {
    return new Intl.NumberFormat(getLocale()).format(value);
  }

  function groupName(group: IslandGroup | undefined): string {
    if (!group) return '—';
    return ISLAND_GROUP_NAMES[group];
  }

  function toggleGroup(group: IslandGroup) {
    if (groupFilter === group) {
      groupFilter = undefined;
      return;
    }
    groupFilter = group;
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
    const code = selected.code;
    closeDetails();
    onopen?.(code);
    document.getElementById('atlas')?.scrollIntoView({ block: 'start' });
  }
</script>

<section id="provinces" class="province-table-card clay-card" aria-labelledby="province-table-heading">
  <div class="card-heading">
    <div>
      <span class="eyebrow">02 / DIRECTORY</span>
      <h2 id="province-table-heading">{m.table_heading()}</h2>
    </div>
    <div class="group-filter" role="group" aria-label={m.table_island()}>
      {#each islandGroups as [group, name] (group)}
        <button type="button" class={'chip tile-' + group} aria-pressed={groupFilter === group} onclick={() => toggleGroup(group)}>{name}</button>
      {/each}
    </div>
  </div>

  {#if loading}<p role="status">{m.loading_data()}</p>
  {:else if failed}<p role="alert">{m.data_unavailable()}</p>
  {:else}
    <!-- Scrollable regions must be keyboard reachable (WCAG 2.1.1). -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="table-scroll" tabindex="0" role="region" aria-labelledby="province-table-heading">
      <table>
        <caption>{m.table_caption()}</caption>
        <thead>
          <tr>
            <th scope="col">{m.table_code()}</th>
            <th scope="col">{m.level_province()}</th>
            <th scope="col">{m.table_island()}</th>
            <th scope="col" class="numeric">{m.stat_regencies()}</th>
            <th scope="col" class="numeric">{m.stat_cities()}</th>
            <th scope="col" class="numeric">{m.table_total()}</th>
            <th scope="col"><span class="visually-hidden">{m.table_details()}</span></th>
          </tr>
        </thead>
        <tbody>
          {#each visibleRows as row (row.code)}
            {@const total = row.regencies.length + row.cities.length}
            <tr>
              <td class="code">{row.code}</td>
              <th scope="row">{row.name}</th>
              <td><span class={'group-pill tile-' + row.group}>{groupName(row.group)}</span></td>
              <td class="numeric">{number(row.regencies.length)}</td>
              <td class="numeric">{number(row.cities.length)}</td>
              <td class="numeric total"><span class="bar" style={`--share: ${total / largestTotal}`} aria-hidden="true"></span>{number(total)}</td>
              <td><button type="button" class="details-button" aria-label={m.table_details() + ' · ' + row.name} onclick={() => openDetails(row)}>{m.table_details()}</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<dialog class="province-dialog" bind:this={dialog} onclick={closeOnBackdrop} onclose={() => (selected = undefined)} aria-labelledby="province-dialog-title">
  {#if selected}
    <div class="dialog-body">
      <header>
        <span class={'group-pill tile-' + selected.group}>{groupName(selected.group)}</span>
        <h2 id="province-dialog-title">{selected.name}</h2>
        <p>{m.table_code()} {selected.code} · {m.code_edition()}: 2022</p>
      </header>
      <div class="dialog-stats">
        <div><strong>{number(selected.regencies.length)}</strong><span>{m.stat_regencies()}</span></div>
        <div><strong>{number(selected.cities.length)}</strong><span>{m.stat_cities()}</span></div>
      </div>
      <ul class="dialog-list">
        {#each [...selected.cities, ...selected.regencies] as region (region.code)}
          <li><span>{region.name}</span><small>{region.code}</small></li>
        {/each}
      </ul>
      <div class="dialog-actions">
        <button type="button" class="primary" onclick={openInAtlas}>{m.open_in_atlas()}</button>
        <button type="button" onclick={closeDetails}>{m.dialog_close()}</button>
      </div>
    </div>
  {/if}
</dialog>

<style>
  .card-heading { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
  .card-heading h2 { margin: 8px 0 0; }
  .group-filter { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { min-height: 36px; padding: 6px 12px; border: 2px solid #ffffff99; border-radius: 999px; font-size: .75rem; font-weight: 800; color: #2e2a26; box-shadow: inset 2px 2px 3px #ffffff99, inset -2px -3px 5px #0000001a, 2px 3px 0 var(--tile-edge); transition: transform 160ms ease-out; }
  .chip[aria-pressed='true'] { transform: translateY(2px); box-shadow: inset 3px 3px 6px #0000002e; outline: 2px solid var(--text); outline-offset: 2px; }
  .table-scroll { overflow: auto; max-height: min(560px, 70vh); overscroll-behavior: contain; border-radius: 20px; background: var(--surface); box-shadow: inset 4px 4px 10px var(--shadow), inset -4px -4px 10px var(--clay-highlight); }
  table { width: 100%; min-width: 640px; border-collapse: collapse; font-size: .85rem; }
  caption { text-align: left; padding: 14px 18px 4px; color: var(--muted); font-size: .75rem; }
  th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); }
  thead th { position: sticky; top: 0; z-index: 1; font-size: .7rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); background: var(--surface); }
  tbody th { font-weight: 750; }
  tbody tr:hover { background: var(--mint); }
  tbody tr:last-child th, tbody tr:last-child td { border-bottom: 0; }
  .numeric { text-align: right; font-variant-numeric: tabular-nums; }
  .code { font-family: ui-monospace, monospace; color: var(--muted); }
  .total { position: relative; font-weight: 800; }
  .bar { display: inline-block; vertical-align: middle; width: calc(var(--share) * 60px); height: 8px; margin-right: 8px; border-radius: 99px; background: var(--accent); opacity: .55; }
  .group-pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: .7rem; font-weight: 800; color: #2e2a26; white-space: nowrap; }
  .details-button { min-height: 36px; padding: 6px 14px; border-radius: 12px; border: 2px solid var(--border); background: var(--page); color: var(--text); font-size: .75rem; font-weight: 800; box-shadow: 0 3px 0 var(--shadow); }
  .details-button:active { transform: translateY(2px); box-shadow: none; }
  .tile-sumatra { background: #f6c9a8; --tile-edge: #d79c74; }
  .tile-java { background: #d8c8f0; --tile-edge: #a994cc; }
  .tile-nusa-tenggara { background: #f3dc9b; --tile-edge: #cfb167; }
  .tile-kalimantan { background: #b9e0c3; --tile-edge: #82b893; }
  .tile-sulawesi { background: #b7d6ef; --tile-edge: #7fa8cb; }
  .tile-maluku { background: #f5b7b1; --tile-edge: #cf8780; }
  .tile-papua { background: #c9dca6; --tile-edge: #97b26c; }
  .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .province-dialog { width: min(560px, calc(100vw - 32px)); max-height: min(720px, calc(100dvh - 32px)); padding: 0; border: 3px solid var(--clay-highlight); border-radius: 30px; background: var(--surface); color: var(--text); box-shadow: var(--clay-shadow); }
  .province-dialog::backdrop { background: #2a211b66; backdrop-filter: blur(3px); }
  .province-dialog[open] { animation: pop 220ms cubic-bezier(.34,1.56,.64,1); }
  @keyframes pop { from { opacity: 0; transform: scale(.94) translateY(8px); } }
  .dialog-body { display: grid; gap: 16px; padding: clamp(20px, 4vw, 30px); }
  .dialog-body h2 { margin: 10px 0 4px; font-size: 1.6rem; letter-spacing: -.03em; }
  .dialog-body header p { margin: 0; color: var(--muted); font-size: .85rem; }
  .dialog-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .dialog-stats div { display: grid; gap: 4px; padding: 16px; border-radius: 20px; background: var(--mint); box-shadow: inset 3px 3px 6px var(--clay-highlight), inset -3px -4px 8px var(--shadow); }
  .dialog-stats strong { font-size: 2rem; line-height: 1; }
  .dialog-stats span { font-size: .75rem; color: var(--muted); font-weight: 700; }
  .dialog-list { list-style: none; margin: 0; padding: 4px 6px; max-height: 260px; overflow-y: auto; border-radius: 16px; background: var(--page); }
  .dialog-list li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 8px; border-bottom: 1px solid var(--border); font-size: .8rem; }
  .dialog-list li:last-child { border-bottom: 0; }
  .dialog-list small { font-family: ui-monospace, monospace; color: var(--muted); }
  .dialog-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-end; }
  .dialog-actions button { padding: 10px 18px; border-radius: 14px; border: 2px solid var(--border); background: var(--page); color: var(--text); font-weight: 800; box-shadow: 0 4px 0 var(--shadow); }
  .dialog-actions .primary { background: var(--accent); border-color: transparent; color: var(--on-accent); }
  .dialog-actions button:active { transform: translateY(3px); box-shadow: none; }
  @media (prefers-reduced-motion: reduce) { .province-dialog[open] { animation: none; } }
</style>
