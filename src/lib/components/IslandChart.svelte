<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { ISLAND_GROUP_NAMES } from '$lib/atlas/islands';
  import { groupStyle } from '$lib/directory/group-style';
  import { loadProvinceDirectory, totalsByGroup, type GroupTotals } from '$lib/directory/province-directory';

  let totals = $state<GroupTotals[]>([]);
  let loading = $state(true);
  let failed = $state(false);

  const largest = $derived(Math.max(1, ...totals.map(item => item.total)));

  onMount(() => {
    let active = true;
    loadProvinceDirectory()
      .then(rows => { if (active) totals = totalsByGroup(rows); })
      .catch(() => { if (active) failed = true; })
      .finally(() => { if (active) loading = false; });
    return () => { active = false; };
  });

  function number(value: number): string {
    return new Intl.NumberFormat(getLocale()).format(value);
  }

  /** Width of a group's bar relative to the biggest group, so bars compare at a glance. */
  function barWidth(item: GroupTotals): string {
    return (item.total / largest) * 100 + '%';
  }
</script>

<section class="clay-card island-chart" aria-labelledby="island-chart-heading">
  <header>
    <h3 id="island-chart-heading">{m.chart_islands_heading()}</h3>
    <p>{m.chart_islands_desc()}</p>
  </header>

  {#if loading}<p role="status">{m.loading_data()}</p>
  {:else if failed}<p role="alert">{m.data_unavailable()}</p>
  {:else}
    <ul class="legend" aria-hidden="true">
      <li><span class="swatch regency"></span>{m.legend_regency()}</li>
      <li><span class="swatch city"></span>{m.legend_city()}</li>
    </ul>

    <ol class="bars" aria-hidden="true">
      {#each totals as item (item.group)}
        <li style={groupStyle(item.group)}>
          <span class="group-name"><span class="group-dot"></span>{ISLAND_GROUP_NAMES[item.group]}</span>
          <span class="track">
            <span class="bar" style={`width: ${barWidth(item)}`}>
              {#if item.regencies > 0}<span class="segment regency" style={`flex: ${item.regencies} 1 0`}>{item.regencies}</span>{/if}
              {#if item.municipalities > 0}<span class="segment city" style={`flex: ${item.municipalities} 1 0`}>{item.municipalities}</span>{/if}
            </span>
          </span>
          <strong class="total">{number(item.total)}</strong>
        </li>
      {/each}
    </ol>

    <table class="visually-hidden">
      <caption>{m.chart_islands_heading()}</caption>
      <thead><tr><th scope="col">{m.table_island()}</th><th scope="col">{m.legend_regency()}</th><th scope="col">{m.legend_city()}</th><th scope="col">{m.table_total()}</th></tr></thead>
      <tbody>
        {#each totals as item (item.group)}
          <tr><th scope="row">{ISLAND_GROUP_NAMES[item.group]}</th><td>{item.regencies}</td><td>{item.municipalities}</td><td>{item.total}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<style>
  .island-chart { display: flex; flex-direction: column; gap: 14px; padding: clamp(18px, 2.6vw, 28px); min-width: 0; }
  h3 { margin: 0; font-size: 1.25rem; letter-spacing: -.03em; }
  header p { margin: 4px 0 0; color: var(--muted); font-size: .85rem; line-height: 1.5; }
  .legend { display: flex; gap: 16px; margin: 0; padding: 0; list-style: none; font-size: .75rem; font-weight: 800; }
  .legend li { display: inline-flex; align-items: center; gap: 7px; }
  .swatch { width: 16px; height: 16px; border-radius: 6px; box-shadow: inset 1px 1px 2px #ffffff80, 0 2px 0 var(--shadow); }
  .swatch.regency, .segment.regency { background: var(--seg-regency); }
  .swatch.city, .segment.city { background: var(--seg-city); }
  .bars { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
  .bars li { display: grid; grid-template-columns: minmax(96px, 150px) minmax(0, 1fr) 2.6ch; align-items: center; gap: 12px; }
  .group-name { display: inline-flex; align-items: center; gap: 8px; font-size: .8rem; font-weight: 800; min-width: 0; }
  .track { display: block; height: 28px; padding: 3px; border-radius: 99px; background: var(--panel); box-shadow: var(--clay-pressed); }
  .bar { display: flex; height: 100%; min-width: 0; border-radius: 99px; overflow: hidden; box-shadow: 0 2px 0 var(--shadow); transition: width 400ms var(--ease-bounce); }
  .segment { display: grid; place-items: center; min-width: 0; overflow: hidden; font-size: .65rem; font-weight: 850; color: #2e2a26; box-shadow: inset 2px 2px 3px #ffffff73, inset -2px -3px 4px #0000001f; }
  .segment + .segment { margin-left: 2px; }
  .total { font-size: .95rem; text-align: right; font-variant-numeric: tabular-nums; }
  @media (max-width: 520px) {
    .bars li { grid-template-columns: minmax(0, 1fr) 2.6ch; }
    .track { grid-column: 1 / -1; grid-row: 2; }
    .total { grid-row: 1; grid-column: 2; }
  }
</style>
