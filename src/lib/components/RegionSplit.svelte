<script lang="ts">
  import { m } from '$lib/i18n/messages';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { EDITION_COUNTS } from '$lib/atlas/edition';
  import RingChart from './RingChart.svelte';

  const formatter = new Intl.NumberFormat(getLocale());
  const regencies = EDITION_COUNTS.regencies;
  const municipalities = EDITION_COUNTS.municipalities;
  const segments = $derived([
    { label: m.legend_regency(), value: regencies, color: 'var(--seg-regency)' },
    { label: m.legend_city(), value: municipalities, color: 'var(--seg-city)' }
  ]);
  const ringLabel = $derived(m.chart_split_heading() + ': ' + regencies + ' ' + m.legend_regency() + ', ' + municipalities + ' ' + m.legend_city());
</script>

<section class="clay-card region-split" aria-labelledby="region-split-heading">
  <h3 id="region-split-heading">{m.chart_split_heading()}</h3>
  <div class="split-body">
    <RingChart {segments} centerValue={formatter.format(EDITION_COUNTS.cities)} centerLabel={m.chart_regions_unit()} label={ringLabel} />
    <ul>
      {#each segments as segment (segment.label)}
        <li>
          <span class="dot" style={`background: ${segment.color}`} aria-hidden="true"></span>
          <span class="name">{segment.label}</span>
          <strong>{formatter.format(segment.value)}</strong>
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  .region-split { display: flex; flex-direction: column; gap: 16px; padding: clamp(18px, 2.6vw, 28px); min-width: 0; }
  h3 { margin: 0; font-size: 1.25rem; letter-spacing: -.03em; }
  .split-body { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 22px; }
  ul { display: grid; gap: 10px; flex: 1 1 150px; margin: 0; padding: 0; list-style: none; }
  li { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 16px; background: var(--panel); box-shadow: var(--clay-pressed); }
  .dot { width: 14px; height: 14px; border-radius: 5px; box-shadow: inset 1px 1px 2px #ffffff80, 0 2px 0 var(--shadow); }
  .name { flex: 1; font-size: .85rem; font-weight: 750; }
  strong { font-size: 1.1rem; font-variant-numeric: tabular-nums; }
</style>
