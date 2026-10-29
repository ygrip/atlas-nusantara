<script lang="ts">
  import { m } from '$lib/i18n/messages';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { bandPath, linePath, valueScale, type MetricDefinition } from '$lib/data/weather-history-chart';
  import type { DailySeries, DailyValues } from '$lib/data/weather-history-contract';

  /**
   * One metric over the week. `series` is the region, `reference` the national average drawn dashed for comparison.
   * Without a series the axes and days still draw, so an empty chart reads as "no data" and not as a broken one.
   */
  let { days, metric, label, series, reference, emptyMessage }: {
    days: string[]; metric: MetricDefinition; label: string; series?: DailySeries; reference?: DailySeries; emptyMessage?: string;
  } = $props();

  const CHART = { width: 640, height: 300, left: 52, right: 24, top: 30, bottom: 42 };
  const plotWidth = CHART.width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const baseline = CHART.top + plotHeight;
  const gradient = $props.id();
  const INSET = 28;

  const values = $derived.by((): DailyValues => series?.[metric.id] ?? days.map(() => null));
  const referenceValues = $derived.by((): DailyValues | undefined => reference?.[metric.id]);
  const showRange = $derived(metric.id === 'tmean' && Boolean(series));
  const scale = $derived.by(() => {
    const lists: DailyValues[] = [values];
    if (referenceValues) lists.push(referenceValues);
    if (showRange && series) lists.push(series.tmin, series.tmax);
    return valueScale(lists, metric);
  });
  const hasValues = $derived(values.some(value => value !== null));

  function x(index: number): number {
    if (days.length < 2) return CHART.left + plotWidth / 2;
    return CHART.left + INSET + ((plotWidth - INSET * 2) * index) / (days.length - 1);
  }
  function y(value: number): number {
    return CHART.top + plotHeight - ((value - scale.min) / (scale.max - scale.min)) * plotHeight;
  }

  const line = $derived(linePath(values, x, y));
  const referenceLine = $derived(referenceValues ? linePath(referenceValues, x, y) : '');
  const band = $derived(showRange && series ? bandPath(series.tmin, series.tmax, x, y) : '');
  const barWidth = $derived(Math.min(46, (plotWidth - INSET * 2) / Math.max(days.length, 1) * 0.6));

  function number(value: number): string {
    return new Intl.NumberFormat(getLocale(), { minimumFractionDigits: metric.digits, maximumFractionDigits: metric.digits }).format(value);
  }
  function dayLabel(day: string): string {
    return new Intl.DateTimeFormat(getLocale(), { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z'));
  }
</script>

<svg class="weather-chart" viewBox={`0 0 ${CHART.width} ${CHART.height}`} role="img" aria-label={label + ' · ' + metric.unit + (hasValues ? '' : ' · ' + (emptyMessage ?? ''))}>
  <defs>
    <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--chart-red)" stop-opacity="0.3" />
      <stop offset="100%" stop-color="var(--chart-red)" stop-opacity="0.05" />
    </linearGradient>
  </defs>
  {#each scale.ticks as tick (tick)}
    <line class="grid" x1={CHART.left} x2={CHART.width - CHART.right} y1={y(tick)} y2={y(tick)} />
    <text class="axis-label" x={CHART.left - 8} y={y(tick) + 4} text-anchor="end">{number(tick)}</text>
  {/each}
  <line class="axis" x1={CHART.left} x2={CHART.left} y1={CHART.top} y2={baseline} />
  <line class="axis" x1={CHART.left} x2={CHART.width - CHART.right} y1={baseline} y2={baseline} />
  <text class="axis-title" x={CHART.left} y={CHART.top - 14}>{metric.unit}</text>
  {#each days as day, index (day)}
    <text class="axis-label day" x={x(index)} y={baseline + 22} text-anchor="middle">{dayLabel(day)}</text>
  {/each}

  {#if metric.id === 'rain'}
    {#each values as value, index (days[index])}
      {#if value !== null}
        <rect class="bar" x={x(index) - barWidth / 2} y={y(value)} width={barWidth} height={Math.max(0, baseline - y(value))} rx="6" />
        <text class="point-value" x={x(index)} y={y(value) - 6} text-anchor="middle">{number(value)}</text>
      {/if}
    {/each}
    {#if referenceLine}<path class="reference" d={referenceLine} />{/if}
  {:else}
    {#if band}<path d={band} fill={`url(#${gradient})`} />{/if}
    {#if referenceLine}<path class="reference" d={referenceLine} />{/if}
    <path class="series" d={line} />
    {#each values as value, index (days[index])}
      {#if value !== null}
        <circle class="dot" cx={x(index)} cy={y(value)} r="4.5" />
        <text class="point-value" x={x(index)} y={y(value) - 11} text-anchor="middle">{number(value)}</text>
      {/if}
    {/each}
  {/if}

  {#if !hasValues}
    <text class="empty-label" x={CHART.left + plotWidth / 2} y={CHART.top + plotHeight / 2} text-anchor="middle">{emptyMessage}</text>
  {/if}
</svg>

<style>
  .weather-chart { width: 100%; height: auto; display: block; }
  .grid { stroke: var(--border); stroke-width: 1; stroke-dasharray: 3 4; }
  .axis { stroke: var(--muted); stroke-width: 1.2; }
  .axis-label { font-size: 11px; font-weight: 700; fill: var(--muted); font-variant-numeric: tabular-nums; }
  .axis-title { font-size: 11px; font-weight: 800; fill: var(--muted); }
  .point-value { font-size: 11px; font-weight: 800; fill: var(--text); font-variant-numeric: tabular-nums; }
  .series { fill: none; stroke: var(--chart-red); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
  .reference { fill: none; stroke: var(--muted); stroke-width: 2; stroke-dasharray: 6 5; stroke-linejoin: round; opacity: .8; }
  .dot { fill: var(--surface); stroke: var(--chart-red); stroke-width: 2.5; }
  .bar { fill: var(--chart-green); }
  .empty-label { font-size: 13px; font-weight: 800; fill: var(--muted); }
</style>
