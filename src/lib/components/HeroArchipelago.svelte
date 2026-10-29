<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '$lib/i18n/messages';
  import type { HeroInteraction } from '$lib/hero/interaction';
  import type { HeroSprite } from '$lib/hero/sprites';

  let { alt }: { alt: string } = $props();
  let interaction: HeroInteraction | undefined;
  let ready = $state(false);
  let sprites = $state<Record<string, HeroSprite>>({});
  let active = $state('');
  let soundUnavailable = $state(false);

  // Keep the first render static. Effects and their stylesheet load after window.load,
  // during idle time; audio is fetched only inside the subsequent user gesture.
  onMount(() => {
    let disposed = false;
    let idle = 0;
    let fallback = 0;
    async function prepare() {
      try {
        const module = await import('$lib/hero/interaction');
        await module.preloadHeroSprites();
        if (disposed) return;
        sprites = module.heroSprites;
        interaction = module.createHeroInteraction((id) => { active = id; }, () => { soundUnavailable = true; });
        ready = true;
      } catch (error) {
        console.warn('Hero interactions unavailable; keeping the static illustration.', error);
      }
    }
    function schedule() {
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(() => { void prepare(); }, { timeout: 1500 });
      else fallback = window.setTimeout(() => { void prepare(); }, 200);
    }
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    return () => {
      disposed = true;
      window.removeEventListener('load', schedule);
      if (idle) window.cancelIdleCallback(idle);
      window.clearTimeout(fallback);
      interaction?.destroy();
    };
  });

  function play(id: string) {
    soundUnavailable = false;
    interaction?.toggle(id);
  }

  /**
   * Seven island families share one geography projection. Each is a three-plate clay stack
   * (base, middle, top) over a soft shadow. The map is never tilted or re-projected.
   */
  const islands = [
    { id: 'sumatra', label: 'Sumatra', top: '#f1c2c5', middle: '#e5a2a7', base: '#b87482' },
    { id: 'java', label: 'Java', top: '#de949a', middle: '#c66b7a', base: '#9d465f' },
    { id: 'nusa-tenggara', label: 'Bali and Nusa Tenggara', top: '#efdaac', middle: '#d2af76', base: '#a38350' },
    { id: 'kalimantan', label: 'Kalimantan', top: '#aed4b5', middle: '#8fbb9c', base: '#5d9273' },
    { id: 'sulawesi', label: 'Sulawesi', top: '#cde0af', middle: '#acc68d', base: '#76975d' },
    { id: 'maluku', label: 'Maluku', top: '#f0d3cf', middle: '#d7aaae', base: '#ae7b83' },
    { id: 'papua', label: 'Papua', top: '#e3cda0', middle: '#c5ad7d', base: '#947e56' }
  ];

  /**
   * Decorative clay cutouts, not species or landmark locations. x/y is the bottom-centre anchor
   * as a percentage of the map box; width is a percentage of the map box width.
   */
  const ornaments = [
    { id: 'tiger', x: 23, y: 59.5, width: 8.6 },
    { id: 'volcano', x: 33.3, y: 69.3, width: 8.5 },
    { id: 'orangutan', x: 41.2, y: 39.8, width: 9 },
    { id: 'flag', x: 51, y: 57, width: 10.5 },
    { id: 'komodo', x: 53.9, y: 82.3, width: 10 },
    { id: 'pinisi', x: 69.6, y: 84.5, width: 9.5 },
    { id: 'cendrawasih', x: 86.3, y: 55.7, width: 7.5 }
  ];
  const labels: Record<string, () => string> = {
    tiger: m.hero_tiger, orangutan: m.hero_orangutan, flag: m.hero_flag,
    volcano: m.hero_volcano, komodo: m.hero_komodo,
    pinisi: m.hero_pinisi, cendrawasih: m.hero_cendrawasih
  };
  const imageSize = { tiger: [144, 150], volcano: [144, 168], orangutan: [152, 156], flag: [176, 333],
    komodo: [168, 119], pinisi: [160, 180], cendrawasih: [128, 178] } as Record<string, number[]>;

</script>

<div class="anatomy-stage" role="group" aria-label={alt}>
  <div class="world">
    <svg class="island-scene" xmlns="http://www.w3.org/2000/svg" viewBox="-10 40 1020 440"
      aria-hidden="true" focusable="false">
      <g class="sea-ripples" fill="none" stroke="#f4fff3" stroke-width="2.5" stroke-linecap="round">
        <path d="M92 275q13-8 26 0t26 0m-52 12q13-8 26 0t26 0"/>
        <path d="M353 91q12-8 24 0t24 0"/>
        <path d="M746 124q14-8 28 0t28 0"/>
        <path d="M781 410q16-9 32 0t32 0"/>
        <path d="M559 365q12-7 24 0t24 0"/>
        <path d="M180 430q14-8 28 0t28 0"/>
      </g>

      {#each islands as island (island.id)}
        <g class="island-assembly"
          style={'--top:' + island.top + ';--middle:' + island.middle + ';--base:' + island.base}>
          <title>{island.label}</title>
          <g class="stack-shadow"><use href={'/illustrations/atlas-anatomy.svg#' + island.id} transform="translate(0 5)"/></g>
          <g class="stack-base"><use href={'/illustrations/atlas-anatomy.svg#' + island.id} transform="translate(0 3)"/></g>
          <g class="stack-middle"><use href={'/illustrations/atlas-anatomy.svg#' + island.id} transform="translate(0 1.5)"/></g>
          <g class="stack-top"><use href={'/illustrations/atlas-anatomy.svg#' + island.id}/></g>
        </g>
      {/each}
    </svg>

    {#each ornaments as ornament (ornament.id)}
      <button type="button" class={'ornament ornament-' + ornament.id}
        class:playing={active === ornament.id} disabled={!ready}
        style={'--x:' + ornament.x + '%;--y:' + ornament.y + '%;--w:' + ornament.width + '%'}
        aria-label={labels[ornament.id]()} aria-pressed={active === ornament.id}
        title={labels[ornament.id]() + ' · ' + m.hero_ornament_stop()} onclick={() => play(ornament.id)}>
        <span class="ornament-body" aria-hidden="true">
          <img class="cutout" src={'/illustrations/hero/' + ornament.id + '.webp'}
            srcset={'/illustrations/hero/' + ornament.id + '-1x.webp 1x, /illustrations/hero/' + ornament.id + '.webp 2x'} alt=""
            width={imageSize[ornament.id][0]} height={imageSize[ornament.id][1]}
            decoding="async" fetchpriority="low"/>
          {#if ready}
            {#if sprites[ornament.id]}
              {@const sprite = sprites[ornament.id]}
              <span class="motion-viewport"
                style={'width:' + sprite.width + '%;left:' + sprite.left + '%;bottom:' + sprite.bottom + '%;--sprite-cycle:' + sprite.cycle + 'ms;--sprite-repeats:' + sprite.repeats}>
                <img class="motion-strip" src={'/illustrations/hero/motion/' + ornament.id + '.webp'}
                  srcset={'/illustrations/hero/motion/' + ornament.id + '-1x.webp 1x, /illustrations/hero/motion/' + ornament.id + '.webp 2x'}
                  alt="" width={sprite.frameSize * 8} height={sprite.frameSize} decoding="async" fetchpriority="low"/>
              </span>
            {/if}
          {/if}
        </span>
      </button>
    {/each}
  </div>
  {#if ready}
    <div class="ornament-hint">{m.hero_ornament_hint()} <a href="/audio/hero/CREDITS.md" aria-label={m.hero_sound_credits()}>♫</a></div>
  {/if}
  <span class="sound-status" role="status">{#if soundUnavailable}{m.hero_sound_unavailable()}{/if}</span>
</div>

<style>
  .anatomy-stage {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    background:
      radial-gradient(ellipse 46% 60% at 88% 4%, #fff6dc 0%, transparent 70%),
      linear-gradient(118deg, #d6efe6 0%, #aadfd2 42%, #7fc7bb 100%);
  }
  :global(:root[data-theme='dark']) .anatomy-stage {
    background:
      radial-gradient(ellipse 46% 60% at 88% 4%, #5a5640 0%, transparent 70%),
      linear-gradient(118deg, #2d4a46 0%, #264340 46%, #213a3a 100%);
  }
  /* Keeps the copy readable where it crosses the archipelago. */
  .anatomy-stage::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg,
      color-mix(in srgb, var(--surface) 95%, transparent) 0%,
      color-mix(in srgb, var(--surface) 88%, transparent) 30%,
      color-mix(in srgb, var(--surface) 46%, transparent) 44%,
      transparent 56%);
  }

  .world {
    position: absolute;
    top: 28px;
    bottom: 0;
    right: -2.5%;
    margin-block: auto;
    width: 69%;
    aspect-ratio: 1020 / 440;
    transform-origin: 72% 50%;
  }
  .island-scene { display: block; width: 100%; height: 100%; overflow: visible; }
  .sea-ripples { opacity: .5; }
  .stack-shadow { fill: #2d5f52; opacity: .16; }
  .stack-base { fill: var(--base); stroke: var(--base); stroke-width: 1.2; stroke-linejoin: round; }
  .stack-middle { fill: var(--middle); stroke: var(--middle); stroke-width: 1; stroke-linejoin: round; }
  .stack-top { fill: var(--top); stroke: #fff8e8; stroke-width: .8; stroke-linejoin: round; }

  .ornament {
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: max(44px, var(--w));
    min-height: 44px;
    transform: translate(-50%, -100%);
    padding: 0;
    border: 0;
    background: none;
    border-radius: 12px;
    pointer-events: auto;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .ornament:disabled { cursor: default; }
  .ornament:focus-visible { outline: 3px solid var(--text); outline-offset: 5px; }
  .ornament-body { position: relative; display: block; pointer-events: none; }
  .ornament-hint { position: absolute; right: 16px; bottom: 10px; z-index: 3; font-size: .65rem; color: var(--text); background: var(--surface); padding: 4px 8px; border-radius: 10px; }
  .ornament-hint a { pointer-events: auto; padding: 4px; color: inherit; }
  .sound-status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  .cutout { display: block; width: 100%; height: auto; }
  /* A gradient ellipse is a contact shadow without a per-frame blur filter. */
  .ornament::before {
    content: '';
    position: absolute;
    left: 6%;
    right: 6%;
    bottom: -4%;
    height: 14%;
    background: radial-gradient(closest-side, #2d5f5266, transparent);
  }

  /* Interactive motion is in a separate stylesheet, loaded only after page load. */

  /* Keep the text column clear just above the shared mobile breakpoint. */
  @media (min-width: 761px) and (max-width: 900px) {
    .world { width: 64%; right: -2.2%; }
  }
  @media (max-width: 760px) {
    .anatomy-stage::after {
      background: linear-gradient(180deg,
        color-mix(in srgb, var(--surface) 96%, transparent) 0%,
        color-mix(in srgb, var(--surface) 80%, transparent) 46%,
        transparent 72%);
    }
    .world { top: auto; bottom: 10px; right: auto; left: 2%; width: 96%; margin-block: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .anatomy-stage * { animation: none !important; }
  }
</style>
