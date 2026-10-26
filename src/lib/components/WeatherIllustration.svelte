<script lang="ts">
  import { onMount } from 'svelte';
  import { Wind, CloudRain, CloudSun } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  let active = false;
  let visible = false;
  let node: HTMLDivElement;
  onMount(() => {
    let inViewport = false;
    const observer = new IntersectionObserver(entries => { inViewport = entries.some(entry => entry.isIntersecting); visible = inViewport && !document.hidden; });
    observer.observe(node);
    function visibility() { visible = inViewport && !document.hidden; }
    document.addEventListener('visibilitychange', visibility);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  });
</script>

<div class="weather-illustration" bind:this={node}>
  <button type="button" onclick={() => active = !active} aria-pressed={active}><Wind size={18} aria-hidden="true" />{m.illustration_effects()}</button>
  {#if active}
    <div class="atmosphere" class:running={visible} aria-hidden="true"><Wind class="wind first" size={52} /><CloudSun class="cloud" size={62} /><Wind class="wind second" size={38} /><CloudRain class="rain" size={52} /></div>
    <p>{m.illustration_disclaimer()}</p>
  {/if}
</div>

<style>
  .weather-illustration { position: relative; min-height: 44px; }
  button { display: flex; align-items: center; gap: 8px; min-height: 44px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); padding: 8px 12px; font-size: .8rem; }
  .atmosphere { display: flex; align-items: center; justify-content: space-around; margin: 20px 0; padding: 12px; border: 1px dashed var(--border); border-radius: 18px; color: var(--muted); pointer-events: none; overflow: hidden; }
  .atmosphere :global(svg) { animation: drift 8s ease-in-out infinite alternate; animation-play-state: paused; }
  .running :global(svg) { animation-play-state: running; }
  .atmosphere :global(.second) { animation-delay: -4s; }
  .atmosphere :global(.rain) { animation-delay: -2s; }
  p { font-size: .75rem; color: var(--muted); line-height: 1.5; }
  @keyframes drift { from { transform: translate(-12px, 0); } to { transform: translate(12px, -4px); } }
  @media(prefers-reduced-motion: reduce) { .atmosphere :global(svg) { animation: none; } }
</style>
