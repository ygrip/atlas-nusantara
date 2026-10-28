<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { countUpValue } from '$lib/atlas/national-facts';

  let { value, decimals = 0, duration = 1400, prefix = '', suffix = '' }: {
    value: number;
    decimals?: number;
    duration?: number;
    /** Shown before the number, e.g. "≈". */
    prefix?: string;
    /** Short unit shown small after the number, e.g. "M km²". */
    suffix?: string;
  } = $props();

  // The initial HTML must contain the real fact, including for readers without JavaScript.
  let shown = $state(untrack(() => value));
  let settled = $state(true);
  let visible = $state(false);
  let element = $state<HTMLElement>();
  let reducedMotion = false;

  const formatter = $derived(new Intl.NumberFormat(getLocale(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  const text = $derived(prefix + formatter.format(shown));

  onMount(() => {
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!element) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) visible = true; }, { threshold: 0.3 });
    observer.observe(element);
    return () => observer.disconnect();
  });

  // Counts up the first time the number is on screen, and eases from the old value whenever `value` changes later.
  $effect(() => {
    const target = value;
    if (!visible) return;
    if (reducedMotion) { shown = target; settled = true; return; }
    // Read without subscribing: the animation writes `shown` every frame and must not restart itself.
    const from = untrack(() => shown);
    if (from === target) { settled = true; return; }
    settled = false;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      shown = countUpValue(from, target, now - start, duration);
      if (now - start >= duration) { shown = target; settled = true; return; }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  });
</script>

<strong bind:this={element} class="animated-number" data-settled={settled} aria-hidden="true">{text}{#if suffix}<span class="number-suffix">{suffix}</span>{/if}</strong>
