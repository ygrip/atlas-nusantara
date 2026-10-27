<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { latestYear, loadPopulation, provinceSeries, pyramidRows, yearTotals, type PopulationData } from '$lib/data/population';
  import { niceScale } from '$lib/data/chart-scale';
  import TabList from './TabList.svelte';

  /** provinceCode is the atlas province (two digits); without it the panel describes Indonesia as a whole. */
  let { provinceCode, year = $bindable() }: { provinceCode?: string; year?: number } = $props();

  let data = $state<PopulationData>();
  let tab = $state('trend');
  let loading = $state(true);
  let failed = $state(false);
  const chartGradient = $props.id();

  const province = $derived(data?.provinces.find(item => item.code === provinceCode));
  const scopeName = $derived(province?.name ?? m.level_national());
  const selectedYear = $derived(year ?? (data ? latestYear(data) : 0));
  const nationalTotals = $derived(data ? yearTotals(data) : []);
  const nationalSelected = $derived(nationalTotals.find(item => item.year === selectedYear));
  const series = $derived(data && province ? provinceSeries(data, province.code) : []);
  const provinceSelected = $derived(series.find(item => item.year === selectedYear));
  const firstComparableYear = $derived(province?.comparableFrom);
  const pyramid = $derived.by(() => {
    if (!data) return [];
    /** Oldest group on top, as in a conventional pyramid. */
    return [...pyramidRows(data, selectedYear)].reverse();
  });
  /** One scale for every year, so switching year shows real change instead of a re-fitted shape. */
  const widest = $derived(data ? Math.max(1, ...data.years.flatMap(entry => [...entry.male, ...entry.female])) : 1);

  interface TrendPoint { year: number; value: number; change?: number }
  const trend = $derived.by((): TrendPoint[] => {
    if (province) return series.map(item => ({ year: item.year, value: item.population }));
    return nationalTotals.map(item => ({ year: item.year, value: item.total }));
  });
  const trendRows = $derived(trend.map((point, index) => {
    if (index === 0) return point;
    return { ...point, change: point.value - trend[index - 1].value };
  }));

  const tabs = $derived([
    { id: 'trend', label: m.population_tab_trend() },
    { id: 'pyramid', label: m.population_tab_pyramid() }
  ]);

  onMount(() => {
    let active = true;
    loadPopulation()
      .then(value => { if (active) data = value; })
      .catch(error => {
        if (!active) return;
        failed = true;
        console.warn('Population data unavailable', error);
      })
      .finally(() => { if (active) loading = false; });
    return () => { active = false; };
  });

  function number(value: number, digits = 1): string {
    return new Intl.NumberFormat(getLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  }

  function signed(value: number, digits = 1): string {
    const text = number(Math.abs(value), digits);
    if (value > 0) return '+' + text;
    if (value < 0) return '−' + text;
    return text;
  }

  function barWidth(value: number): string {
    return (value / widest) * 100 + '%';
  }

  function yearAvailable(candidate: number): boolean {
    if (!firstComparableYear) return true;
    return candidate >= firstComparableYear;
  }

  // Trend chart: the y axis starts at zero, so the line shows the true (slow) pace of growth.
  const CHART = { width: 560, height: 280, left: 58, right: 24, top: 34, bottom: 40 };
  const plotWidth = CHART.width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const largestValue = $derived(trend.length ? Math.max(...trend.map(point => point.value)) : 1);
  /** Million persons for the national total, thousand persons for a province. */
  const divisor = $derived(largestValue >= 1000 ? 1000 : 1);
  const scale = $derived(niceScale(largestValue / divisor, 4));
  const axisUnit = $derived(divisor === 1000 ? m.population_axis_million() : m.population_axis_thousand());
  const valueDigits = $derived(divisor === 1000 ? 1 : 0);

  /** Keeps the first and last points (and their value labels) clear of the y axis and the right edge. */
  const POINT_INSET = 30;

  function pointX(index: number): number {
    if (trend.length < 2) return CHART.left + plotWidth / 2;
    const span = plotWidth - POINT_INSET * 2;
    return CHART.left + POINT_INSET + (span * index) / (trend.length - 1);
  }

  function pointY(value: number): number {
    return CHART.top + plotHeight - (value / divisor / scale.max) * plotHeight;
  }

  const baseline = CHART.top + plotHeight;
  const linePath = $derived(trend.map((point, index) => (index === 0 ? 'M' : 'L') + pointX(index).toFixed(1) + ' ' + pointY(point.value).toFixed(1)).join(' '));
  const areaPath = $derived.by(() => {
    if (trend.length === 0) return '';
    const last = trend.length - 1;
    return linePath + ' L' + pointX(last).toFixed(1) + ' ' + baseline + ' L' + pointX(0).toFixed(1) + ' ' + baseline + ' Z';
  });

  function date(value: string): string {
    return new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium' }).format(new Date(value));
  }
</script>

<section class="population-panel" aria-label={m.layer_population()} aria-busy={loading}>
  <header>
    <div><h3>{m.layer_population()} · {scopeName}</h3><p>{m.population_panel_desc()}</p></div>
    <span class="source-badge">BPS</span>
  </header>

  {#if loading}<p role="status">{m.loading_data()}</p>
  {:else if failed || !data || !nationalSelected}<p role="alert">{m.data_unavailable()}</p>
  {:else}
    <div class="year-picker" role="group" aria-label={m.population_select_year()}>
      {#each data.years as entry (entry.year)}
        <button type="button" aria-pressed={entry.year === selectedYear} disabled={!yearAvailable(entry.year)} onclick={() => { year = entry.year; }}>{entry.year}</button>
      {/each}
    </div>

    {#if !province}
      <dl class="summary">
        <div><dt>{m.table_total()}</dt><dd>{number(nationalSelected.total)}</dd></div>
        <div><dt>{m.population_male()}</dt><dd>{number(nationalSelected.male)}</dd></div>
        <div><dt>{m.population_female()}</dt><dd>{number(nationalSelected.female)}</dd></div>
      </dl>
      <p class="hint">{m.population_province_hint()}</p>
    {:else if provinceSelected}
      <dl class="summary five">
        <div><dt>{m.table_total()}</dt><dd>{number(provinceSelected.population)}</dd></div>
        <div><dt>{m.population_share()}</dt><dd>{number((provinceSelected.population / nationalSelected.total) * 100, 2)}%</dd></div>
        <div><dt>{m.population_growth()}</dt><dd>{signed(provinceSelected.growthPercent, 2)}%</dd></div>
        <div><dt>{m.population_density()}</dt><dd>{number(provinceSelected.densityPerKm2, 0)}</dd></div>
        <div><dt>{m.population_sex_ratio()}</dt><dd>{number(provinceSelected.sexRatio)}</dd></div>
      </dl>
    {:else}
      <p class="notice" role="status">{m.population_boundary_note({ province: province.name, year: firstComparableYear ?? '' })}</p>
    {/if}
    <p class="unit">{m.population_unit()} · {selectedYear}</p>

    <TabList prefix="population" {tabs} bind:value={tab} label={m.population_tabs_label()} />

    <div role="tabpanel" id="population-panel-trend" aria-labelledby="population-tab-trend" hidden={tab !== 'trend'}>
      <h4>{m.population_history()} · {scopeName}</h4>
      {#if province && firstComparableYear}<p class="notice" role="note">{m.population_boundary_note({ province: province.name, year: firstComparableYear })}</p>{/if}
      <div class="trend-body">
      <svg class="history" viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label={m.population_history() + ' · ' + scopeName + ' · ' + axisUnit}>
        <defs>
          <linearGradient id={chartGradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--chart-red)" stop-opacity="0.38" />
            <stop offset="100%" stop-color="var(--chart-red)" stop-opacity="0.04" />
          </linearGradient>
        </defs>
        {#each scale.ticks as tick (tick)}
          {@const y = CHART.top + plotHeight - (tick / scale.max) * plotHeight}
          <line class="grid" x1={CHART.left} x2={CHART.width - CHART.right} y1={y} y2={y} />
          <text class="axis-label" x={CHART.left - 8} y={y + 4} text-anchor="end">{number(tick, 0)}</text>
        {/each}
        <line class="axis" x1={CHART.left} x2={CHART.left} y1={CHART.top} y2={baseline} />
        <line class="axis" x1={CHART.left} x2={CHART.width - CHART.right} y1={baseline} y2={baseline} />
        <text class="axis-title" x={CHART.left} y={CHART.top - 14} text-anchor="start">{axisUnit}</text>
        {#if trend.length > 1}<path d={areaPath} fill={`url(#${chartGradient})`} />{/if}
        <path d={linePath} fill="none" stroke="var(--chart-red)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
        {#each trend as point, index (point.year)}
          <g class:current={point.year === selectedYear}>
            <circle cx={pointX(index)} cy={pointY(point.value)} r={point.year === selectedYear ? 6 : 4} fill="var(--surface)" stroke="var(--chart-red)" stroke-width="2.5" />
            <text class="point-value" x={pointX(index)} y={pointY(point.value) - 12} text-anchor="middle">{number(point.value / divisor, valueDigits)}</text>
            <text class="axis-label year" x={pointX(index)} y={baseline + 20} text-anchor="middle">{point.year}</text>
          </g>
        {/each}
      </svg>

      <table class="history-table">
        <caption class="visually-hidden">{m.population_history()} · {scopeName} · {m.population_unit()}</caption>
        <thead>
          <tr>
            <th scope="col">{m.population_year()}</th>
            <th scope="col">{m.table_total()}</th>
            <th scope="col">{m.population_change()}</th>
            {#if province}<th scope="col">{m.population_density()}</th><th scope="col">{m.population_sex_ratio()}</th>{:else}<th scope="col">{m.population_male()}</th><th scope="col">{m.population_female()}</th>{/if}
          </tr>
        </thead>
        <tbody>
          {#each trendRows as row, index (row.year)}
            {@const national = nationalTotals[index]}
            {@const detail = series.find(item => item.year === row.year)}
            <tr class:current={row.year === selectedYear}>
              <th scope="row">{row.year}</th>
              <td>{number(row.value)}</td>
              <td>{#if row.change !== undefined}{signed(row.change)} <small>({signed((row.change / (row.value - row.change)) * 100, 2)}%)</small>{:else}–{/if}</td>
              {#if province && detail}<td>{number(detail.densityPerKm2, 0)}</td><td>{number(detail.sexRatio)}</td>{:else if national}<td>{number(national.male)}</td><td>{number(national.female)}</td>{/if}
            </tr>
          {/each}
        </tbody>
      </table>
      </div>
    </div>

    <div role="tabpanel" id="population-panel-pyramid" aria-labelledby="population-tab-pyramid" hidden={tab !== 'pyramid'}>
      <h4>{m.population_pyramid()} · {m.level_national()} · {selectedYear}</h4>
      {#if province}<p class="notice" role="note">{m.population_pyramid_national_note({ province: province.name })}</p>{/if}
      <ul class="legend" aria-hidden="true">
        <li><span class="swatch male"></span>{m.population_male()}</li>
        <li><span class="swatch female"></span>{m.population_female()}</li>
      </ul>
      <ol class="pyramid" aria-hidden="true">
        {#each pyramid as row (row.ageGroup)}
          <li>
            <span class="side male-side"><span class="value">{number(row.male)}</span><span class="bar male" style={`width: ${barWidth(row.male)}`}></span></span>
            <span class="age">{row.ageGroup}</span>
            <span class="side female-side"><span class="bar female" style={`width: ${barWidth(row.female)}`}></span><span class="value">{number(row.female)}</span></span>
          </li>
        {/each}
      </ol>
      <div class="visually-hidden">
        <table>
          <caption>{m.population_pyramid()} · {m.level_national()} · {selectedYear} · {m.population_unit()}</caption>
          <thead><tr><th scope="col">{m.population_age_group()}</th><th scope="col">{m.population_male()}</th><th scope="col">{m.population_female()}</th></tr></thead>
          <tbody>
            {#each pyramid as row (row.ageGroup)}
              <tr><th scope="row">{row.ageGroup}</th><td>{number(row.male)}</td><td>{number(row.female)}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <p class="source-note"><a href={data.provinceSourceUrl} target="_blank" rel="noreferrer">{m.population_source_provinces()} ↗</a> · <a href={data.sourceUrl} target="_blank" rel="noreferrer">{m.population_source_pyramid()} ↗</a> · <a href={data.totalSourceUrl} target="_blank" rel="noreferrer">BPS ↗</a> · {date(data.fetchedAt)}</p>
  {/if}
</section>

<style>
  .population-panel { margin-top: 20px; padding: 20px; border-radius: 22px; background: var(--surface); box-shadow: var(--clay-pressed); display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; min-width: 0; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  h3 { margin: 0 0 6px; }
  h4 { margin: 0 0 10px; font-size: 1rem; }
  p { margin: 0; font-size: .85rem; color: var(--muted); }
  .source-badge { padding: 6px 10px; border-radius: 12px; background: var(--peach); font-size: .75rem; font-weight: 900; white-space: nowrap; }
  [role='tabpanel'][hidden] { display: none; }

  .year-picker { display: flex; flex-wrap: wrap; gap: 8px; }
  .year-picker button { min-width: 64px; min-height: 40px; padding: 0 14px; border: 0; border-radius: 14px; background: var(--panel); color: var(--text); font: inherit; font-weight: 850; cursor: pointer; box-shadow: var(--clay-shadow); }
  .year-picker button[aria-pressed='true'] { background: var(--accent); color: var(--on-accent); }
  .year-picker button:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; }
  .year-picker button:focus-visible { outline: 3px solid var(--accent-strong); outline-offset: 2px; }

  .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0; }
  .summary.five { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .summary div { padding: 12px 14px; border-radius: 16px; background: var(--panel); min-width: 0; }
  .summary dt { font-size: .72rem; font-weight: 800; color: var(--muted); }
  .summary dd { margin: 4px 0 0; font-size: 1.2rem; font-weight: 900; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .unit, .hint { font-size: .75rem; }
  .unit { margin-top: -8px; }
  .notice { margin: 0 0 10px; padding: 10px 14px; border-radius: 14px; background: var(--sky); color: var(--text); font-size: .8rem; font-weight: 700; line-height: 1.5; }

  .legend { display: flex; gap: 16px; margin: 0 0 10px; padding: 0; list-style: none; font-size: .75rem; font-weight: 800; }
  .legend li { display: inline-flex; align-items: center; gap: 7px; }
  .swatch { width: 14px; height: 14px; border-radius: 5px; }
  .swatch.male, .bar.male { background: var(--chart-green); }
  .swatch.female, .bar.female { background: var(--chart-rose); }

  .pyramid { display: grid; gap: 5px; margin: 0; padding: 0; list-style: none; max-width: 760px; }
  .pyramid li { display: grid; grid-template-columns: minmax(0, 1fr) 5ch minmax(0, 1fr); align-items: center; gap: 6px; }
  .side { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .male-side { justify-content: flex-end; }
  .bar { display: block; height: 18px; border-radius: 6px; transition: width 400ms var(--ease-bounce); }
  .value { font-size: .65rem; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .age { text-align: center; font-size: .72rem; font-weight: 850; }

  .trend-body { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 20px; align-items: start; }
  .history { width: 100%; height: auto; display: block; }
  .grid { stroke: var(--border); stroke-width: 1; stroke-dasharray: 3 4; }
  .axis { stroke: var(--muted); stroke-width: 1.2; }
  .axis-label { font-size: 11px; font-weight: 700; fill: var(--muted); font-variant-numeric: tabular-nums; }
  .axis-title { font-size: 11px; font-weight: 800; fill: var(--muted); }
  .point-value { font-size: 12px; font-weight: 800; fill: var(--text); font-variant-numeric: tabular-nums; }
  g.current .axis-label.year { fill: var(--accent-strong); font-weight: 900; }

  .history-table { width: 100%; border-collapse: collapse; font-size: .78rem; font-variant-numeric: tabular-nums; }
  .history-table th, .history-table td { padding: 6px 8px; text-align: right; border-bottom: 1px solid var(--border); }
  .history-table thead th { font-size: .7rem; color: var(--muted); }
  .history-table tbody th { text-align: left; }
  .history-table tr.current { background: var(--panel); font-weight: 850; }
  .history-table small { color: var(--muted); }

  .source-note { font-size: .72rem; }
  .source-note a { text-decoration: underline; }

  @media (max-width: 900px) { .trend-body { grid-template-columns: minmax(0, 1fr); } .summary.five { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 520px) {
    .summary, .summary.five { grid-template-columns: minmax(0, 1fr); }
    .history-table { display: block; overflow-x: auto; }
    header { flex-wrap: wrap; }
  }
</style>
