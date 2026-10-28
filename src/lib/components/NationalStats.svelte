<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Pause, Play } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { EDITION_COUNTS } from '$lib/atlas/edition';
  import { NATIONAL_FACTS } from '$lib/atlas/national-facts';
  import AnimatedNumber from './AnimatedNumber.svelte';
  import ClayStatIcon, { type StatIconKind } from './ClayStatIcon.svelte';

  interface Metric {
    id: StatIconKind;
    value: number;
    decimals: number;
    label: () => string;
    /** Spelled-out unit for screen readers, e.g. "million km²". */
    unit: () => string;
    /** Short unit shown beside the big number, e.g. "M km²". */
    suffix: () => string;
    /** Administrative counts link to the province table. */
    href?: string;
  }

  /** The three cards keep their colours; the metrics rotate through them. */
  const SLOT_TONES = ['peach', 'mint', 'lilac'] as const;
  const VISIBLE_CARDS = SLOT_TONES.length;
  const ROTATE_MS = 4200;
  const REDUCED_MOTION_ROTATE_MS = 7000;
  const SWAP_MS = 380;

  const factLabels: Record<string, () => string> = {
    islands: m.stat_islands, population: m.stat_population, languages: m.stat_languages,
    ethnicGroups: m.stat_ethnic_groups, seaArea: m.stat_sea_area, landArea: m.stat_land_area
  };

  function factUnit(unit: string): string {
    if (unit === 'million') return m.unit_million();
    if (unit === 'millionKm2') return m.unit_million() + ' km²';
    return '';
  }

  function factSuffix(unit: string): string {
    if (unit === 'million') return m.unit_million_short();
    if (unit === 'millionKm2') return m.unit_million_short() + ' km²';
    return '';
  }

  const metrics: Metric[] = [
    { id: 'provinces', value: EDITION_COUNTS.provinces, decimals: 0, label: m.stat_provinces, unit: () => '', suffix: () => '', href: '#provinces' },
    { id: 'regencies', value: EDITION_COUNTS.regencies, decimals: 0, label: m.stat_regencies, unit: () => '', suffix: () => '', href: '#provinces' },
    { id: 'cities', value: EDITION_COUNTS.municipalities, decimals: 0, label: m.stat_cities, unit: () => '', suffix: () => '', href: '#provinces' },
    ...NATIONAL_FACTS.map(fact => ({
      id: fact.id as StatIconKind, value: fact.value, decimals: fact.decimals, label: factLabels[fact.id], unit: () => factUnit(fact.unit), suffix: () => factSuffix(fact.unit)
    }))
  ];

  // Slot i shows metrics[slots[i]]. One slot changes per tick, so the three cards never swap together.
  let slots = $state([0, 1, 2]);
  let nextMetric = 3;
  let nextSlot = 0;
  let paused = $state(false);
  let hovering = $state(false);
  let inView = $state(false);
  let reducedMotion = $state(false);
  let row = $state<HTMLElement>();

  const running = $derived(!paused && !hovering && inView);
  const swapMs = $derived(reducedMotion ? 0 : SWAP_MS);
  const formatter = $derived(new Intl.NumberFormat(getLocale()));

  function advance() {
    slots[nextSlot] = nextMetric % metrics.length;
    nextMetric++;
    nextSlot = (nextSlot + 1) % VISIBLE_CARDS;
  }

  onMount(() => {
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!row) return;
    const observer = new IntersectionObserver(entries => { inView = entries.some(entry => entry.isIntersecting); }, { threshold: 0.3 });
    observer.observe(row);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (!running) return;
    let interval = ROTATE_MS;
    if (reducedMotion) interval = REDUCED_MOTION_ROTATE_MS;
    const timer = setInterval(() => { if (!document.hidden) advance(); }, interval);
    return () => clearInterval(timer);
  });

  function fullValue(metric: Metric): string {
    const number = new Intl.NumberFormat(getLocale(), { minimumFractionDigits: metric.decimals, maximumFractionDigits: metric.decimals }).format(metric.value);
    return (number + ' ' + metric.unit()).trim();
  }
</script>

<!-- The cards are a decorative rotation; screen readers get the full list below. -->
<div class="stat-row" bind:this={row} aria-hidden="true" onmouseenter={() => { hovering = true; }} onmouseleave={() => { hovering = false; }}>
  {#each slots as metricIndex, slot (slot)}
    {@const metric = metrics[metricIndex]}
    <div class={'clay-card stat-card tone-' + SLOT_TONES[slot]}>
      <div class="stat-swap">
        {#key metric.id}
          <span class="stat-icon" in:fly={{ y: 16, duration: swapMs, delay: swapMs / 3 }} out:fly={{ y: -16, duration: swapMs / 1.5 }}>
            <ClayStatIcon kind={metric.id} />
          </span>
        {/key}
      </div>
      <AnimatedNumber value={metric.value} decimals={metric.decimals} suffix={metric.suffix()} duration={reducedMotion ? 0 : 1100} />
      <div class="stat-swap">
        {#key metric.id}
          <span class="stat-label" in:fly={{ y: 10, duration: swapMs, delay: swapMs / 3 }} out:fly={{ y: -10, duration: swapMs / 1.5 }}>
            {#if metric.href}<a href={metric.href} tabindex="-1">{metric.label()}</a>{:else}{metric.label()}{/if}
          </span>
        {/key}
      </div>
    </div>
  {/each}
</div>

<div class="stat-footer">
  <div class="stat-dots" aria-hidden="true">
    {#each metrics as metric, index (metric.id)}<span class="stat-dot" class:shown={slots.includes(index)}></span>{/each}
  </div>
  <button type="button" class="stat-pause" aria-pressed={paused} aria-label={paused ? m.map_play() : m.map_pause()} title={paused ? m.map_play() : m.map_pause()} onclick={() => { paused = !paused; }}>
    {#if paused}<Play size={16} aria-hidden="true" />{:else}<Pause size={16} aria-hidden="true" />{/if}
  </button>
</div>

<ul class="visually-hidden">
  {#each metrics as metric (metric.id)}<li>{metric.label()}: {fullValue(metric)}</li>{/each}
</ul>
<p class="stat-source">{m.stat_facts_source()}</p>
