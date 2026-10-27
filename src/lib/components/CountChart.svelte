<script lang="ts">
  import { onMount } from 'svelte';
  import type { Chart } from 'chart.js';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  export let labels: string[];
  export let values: number[];
  let canvas: HTMLCanvasElement;
  let chart: Chart<'bar'> | undefined;
  let failed = false;

  /** Semantic chart tones match the legend and update when the theme changes. */
  const tones = ['var(--chart-red)', 'var(--chart-green)', 'var(--chart-gold)', 'var(--chart-rose)'];
  const chartTones = () => ['--chart-red', '--chart-green', '--chart-gold', '--chart-rose'].map(cssValue);

  function cssValue(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function number(value: number): string {
    return new Intl.NumberFormat(getLocale()).format(value);
  }

  $: if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.update('none');
  }
  onMount(() => {
    let destroyed = false;
    async function initialize() {
      const { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } = await import('chart.js');
      if (destroyed) return;
      Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);
      const muted = cssValue('--muted');
      const font = { family: "'Nunito Variable', system-ui, sans-serif", weight: 700 as const, size: 12 };
      chart = new Chart(canvas, { type: 'bar', data: { labels, datasets: [{ label: m.retained_records(), data: values, backgroundColor: chartTones(), borderRadius: 14, borderSkipped: false, maxBarThickness: 64 }] }, options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: cssValue('--text'), titleColor: cssValue('--surface'), bodyColor: cssValue('--surface'), cornerRadius: 12, padding: 10, displayColors: false }
        },
        scales: {
          x: { ticks: { color: muted, font }, grid: { display: false }, border: { display: false } },
          y: { beginAtZero: true, ticks: { color: muted, font, precision: 0 }, grid: { color: cssValue('--border') }, border: { display: false } }
        }
      } });
    }
    function recolor() {
      if (!chart) return;
      chart.data.datasets[0].backgroundColor = chartTones();
      const muted = cssValue('--muted');
      const tooltip = chart.options.plugins?.tooltip;
      if (tooltip) {
        tooltip.backgroundColor = cssValue('--text');
        tooltip.titleColor = cssValue('--surface');
        tooltip.bodyColor = cssValue('--surface');
      }
      for (const axis of Object.values(chart.options.scales ?? {})) {
        if (axis?.ticks) axis.ticks.color = muted;
        if (axis?.grid && axis.grid.display !== false) axis.grid.color = cssValue('--border');
      }
      chart.update('none');
    }
    const theme = new MutationObserver(recolor);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void initialize().catch(error => { if (!destroyed) { failed = true; console.warn('Chart unavailable; text counts remain available', error); } }); }
    });
    observer.observe(canvas);
    return () => { destroyed = true; observer.disconnect(); theme.disconnect(); chart?.destroy(); };
  });
</script>

<figure class="count-chart">
  <figcaption>{m.retained_records()}</figcaption>
  <div class="plot"><canvas bind:this={canvas} aria-hidden="true"></canvas></div>
  <ul class="legend" aria-label={m.retained_records()}>
    {#each labels as label, index (label)}
      <li><span class="swatch" style={`background: ${tones[index % tones.length]}`} aria-hidden="true"></span><span>{label}</span><strong>{number(values[index] ?? 0)}</strong></li>
    {/each}
  </ul>
  {#if failed}<p role="status">{m.data_unavailable()}</p>{/if}
</figure>

<style>
  .count-chart { margin: 24px 0; padding: clamp(16px, 2.4vw, 26px); border-radius: 24px; background: var(--panel); box-shadow: var(--clay-pressed); }
  figcaption { font-weight: 800; font-size: 1rem; margin-bottom: 18px; }
  .plot { height: 240px; padding: 12px; border-radius: 18px; background: var(--surface); box-shadow: 4px 6px 12px var(--shadow), inset 2px 2px 4px var(--clay-highlight); }
  .legend { display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0 0; padding: 0; list-style: none; }
  .legend li { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: var(--surface); box-shadow: 0 3px 0 var(--shadow); font-size: .78rem; font-weight: 750; }
  .swatch { width: 12px; height: 12px; border-radius: 4px; box-shadow: inset 1px 1px 2px #ffffff80; }
  .legend strong { font-variant-numeric: tabular-nums; }
</style>
