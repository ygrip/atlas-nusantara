<script lang="ts">
  import { onMount } from 'svelte';
  import type { Chart } from 'chart.js';
  import { m } from '$lib/paraglide/messages.js';
  export let labels: string[];
  export let values: number[];
  let canvas: HTMLCanvasElement;
  let chart: Chart<'bar'> | undefined;
  let failed = false;
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
      const color = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
      chart = new Chart(canvas, { type: 'bar', data: { labels, datasets: [{ label: m.retained_records(), data: values, backgroundColor: ['#b6cba7', '#e0ac80', '#bfb0d4', '#a2c8ce'], borderRadius: 8 }] }, options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { color }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color, precision: 0 }, grid: { color: '#88888822' } } }
      } });
    }
    function recolor() {
      if (!chart) return;
      const color = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
      for (const axis of Object.values(chart.options.scales ?? {})) if (axis?.ticks) axis.ticks.color = color;
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

<figure class="count-chart"><figcaption>{m.retained_records()}</figcaption><div><canvas bind:this={canvas} aria-hidden="true"></canvas></div>{#if failed}<p role="status">{m.data_unavailable()}</p>{/if}</figure>

<style>.count-chart { margin: 24px 0; padding: 24px; border: 1px solid var(--border); border-radius: 20px; background: var(--surface); } figcaption { font-weight: 750; margin-bottom: 20px; } .count-chart > div { height: 240px; }</style>
