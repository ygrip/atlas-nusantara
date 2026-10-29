<script lang="ts">
  import { m } from '$lib/i18n/messages';
  import IslandChart from './IslandChart.svelte';
  import RegionSplit from './RegionSplit.svelte';
  import TabList from './TabList.svelte';

  let { onopen, selectedCode }: { onopen?: (code: string) => void; selectedCode?: string } = $props();

  let tab = $state('overview');
  let ProvinceTable: typeof import('./ProvinceTable.svelte').default | undefined = $state();
  let provinceTableRequested = false;
  let provinceTableFailed = $state(false);

  $effect(() => {
    if (tab !== 'provinces' || provinceTableRequested) return;
    provinceTableRequested = true;
    provinceTableFailed = false;
    void import('./ProvinceTable.svelte')
      .then(module => { ProvinceTable = module.default; })
      .catch(error => {
        provinceTableRequested = false;
        provinceTableFailed = true;
        console.warn('Province table unavailable', error);
      });
  });
  const tabs = $derived([
    { id: 'overview', label: m.tab_overview() },
    { id: 'provinces', label: m.tab_province_detail() }
  ]);
</script>

<section id="provinces" class="province-explorer clay-card" aria-labelledby="province-explorer-heading">
  <div class="explorer-heading">
    <div>
      <span class="eyebrow">{m.level_province()}</span>
      <h2 id="province-explorer-heading">{m.table_heading()}</h2>
    </div>
    <TabList prefix="province-explorer" {tabs} bind:value={tab} label={m.table_heading()} />
  </div>

  <div role="tabpanel" id="province-explorer-panel-overview" aria-labelledby="province-explorer-tab-overview" hidden={tab !== 'overview'}>
    <div class="insights">
      <IslandChart />
      <RegionSplit />
    </div>
  </div>
  <div role="tabpanel" id="province-explorer-panel-provinces" aria-labelledby="province-explorer-tab-provinces" hidden={tab !== 'provinces'}>
    {#if ProvinceTable}
      <ProvinceTable {selectedCode} {onopen} />
    {:else if provinceTableFailed}
      <p role="alert">{m.data_unavailable()}</p>
    {:else}
      <p role="status">{m.loading_data()}</p>
    {/if}
  </div>
</section>

<style>
  .province-explorer { padding: clamp(18px, 3vw, 30px); min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; }
  .explorer-heading { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 14px 24px; }
  .explorer-heading h2 { margin: 8px 0 0; font-size: clamp(1.5rem, 3.4vw, 2.2rem); letter-spacing: -.04em; }
  [role='tabpanel'] { min-width: 0; }
  [role='tabpanel'][hidden] { display: none; }
</style>
