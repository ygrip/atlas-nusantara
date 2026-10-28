<script lang="ts">
  import { onMount } from 'svelte';

  let { alt }: { alt: string } = $props();
  let stage: HTMLDivElement;
  let visible = $state(false);
  let motionStarted = $state(false);

  /**
   * All seven assemblies use one geography projection. Each physical plate
   * has a proper resting position and a stable painter's order: shadow,
   * foundation, middle, bevel, then top. Move the plates, never the camera.
   *
   * A small assembly pulse happens only after window.load + idle + in-view;
   * the first paint is the final static art, so users never see an empty hero.
   */
  const islands = [
    { id: 'sumatra', label: 'Sumatra', top: '#f1c2c5', bevel: '#f8d9d3', middle: '#e5a2a7', base: '#b87482' },
    { id: 'java', label: 'Java', top: '#de949a', bevel: '#f3bec0', middle: '#c66b7a', base: '#9d465f' },
    { id: 'nusa-tenggara', label: 'Bali and Nusa Tenggara', top: '#efdaac', bevel: '#fff0cb', middle: '#d2af76', base: '#a38350' },
    { id: 'kalimantan', label: 'Kalimantan', top: '#aed4b5', bevel: '#d9edcc', middle: '#8fbb9c', base: '#5d9273' },
    { id: 'sulawesi', label: 'Sulawesi', top: '#cde0af', bevel: '#e8edcb', middle: '#acc68d', base: '#76975d' },
    { id: 'maluku', label: 'Maluku', top: '#f0d3cf', bevel: '#ffe8dc', middle: '#d7aaae', base: '#ae7b83' },
    { id: 'papua', label: 'Papua', top: '#e3cda0', bevel: '#f6e5bd', middle: '#c5ad7d', base: '#947e56' }
  ];

  /** Decorative cutouts, not data about actual species locations. */
  const ornaments = [
    { id: 'rafflesia', x: 15, y: 49, size: 9.2, delay: 0 },
    { id: 'volcano', x: 36, y: 72, size: 10.5, delay: 110 },
    { id: 'orangutan', x: 41, y: 48, size: 10.8, delay: 160 },
    { id: 'palm', x: 61, y: 34, size: 10.8, delay: 210 },
    { id: 'komodo', x: 58, y: 80, size: 10.4, delay: 260 },
    { id: 'pinisi', x: 73, y: 66, size: 11.2, delay: 310 },
    { id: 'cendrawasih', x: 87, y: 53, size: 11.5, delay: 360 }
  ];

  onMount(() => {
    let loaded = document.readyState === 'complete';
    let disposed = false;
    let scheduledIdle: number | undefined;
    let scheduledTimeout: ReturnType<typeof setTimeout> | undefined;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');

    const cancelPending = () => {
      if (scheduledIdle !== undefined) window.cancelIdleCallback(scheduledIdle);
      if (scheduledTimeout !== undefined) clearTimeout(scheduledTimeout);
      scheduledIdle = undefined;
      scheduledTimeout = undefined;
    };

    const arm = () => {
      if (disposed || motionStarted || !loaded || !visible || still.matches || document.hidden) return;
      if (scheduledIdle !== undefined || scheduledTimeout !== undefined) return;
      const start = () => {
        scheduledIdle = undefined;
        scheduledTimeout = undefined;
        if (!disposed && loaded && visible && !still.matches && !document.hidden) motionStarted = true;
      };
      // Only one small class change is scheduled; all subsequent movement is
      // CSS transform animation with no per-frame JavaScript or GSAP import.
      if (typeof window.requestIdleCallback === 'function') {
        scheduledIdle = window.requestIdleCallback(start, { timeout: 1600 });
      } else {
        scheduledTimeout = setTimeout(start, 240);
      }
    };

    const onLoad = () => { loaded = true; arm(); };
    const onVisibility = () => { if (document.hidden) cancelPending(); else arm(); };
    const onMotionPreference = () => { if (still.matches) cancelPending(); else arm(); };

    // The final assembled scene is visible even if JavaScript never executes.
    if (!loaded) window.addEventListener('load', onLoad, { once: true });
    document.addEventListener('visibilitychange', onVisibility);
    still.addEventListener('change', onMotionPreference);

    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(
      entries => {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible) arm();
        else cancelPending();
      },
      { rootMargin: '120px 0px' }
    );
    if (observer) observer.observe(stage);
    else { visible = true; arm(); }

    return () => {
      disposed = true;
      cancelPending();
      observer?.disconnect();
      window.removeEventListener('load', onLoad);
      document.removeEventListener('visibilitychange', onVisibility);
      still.removeEventListener('change', onMotionPreference);
    };
  });
</script>

<div class="anatomy-stage"
  role="img"
  aria-label={alt}
  data-motion={motionStarted ? 'playing' : 'still'}
  data-visible={visible}
  bind:this={stage}>
  <div class="ambient ambient-one"></div>
  <div class="ambient ambient-two"></div>
  <div class="world">
    <svg class="island-scene" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500"
      aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="anatomy-sea" x1="0" y1="0" x2=".95" y2="1">
          <stop offset="0" stop-color="#b0ddd3"/>
          <stop offset=".56" stop-color="#83c9be"/>
          <stop offset="1" stop-color="#69b4a9"/>
        </linearGradient>
        <linearGradient id="anatomy-bevel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff9df"/>
          <stop offset="1" stop-color="#d5caa8"/>
        </linearGradient>
      </defs>

      <!-- A physical display tray with a shallow wall, inset sea and restrained detail. -->
      <rect x="27" y="35" width="946" height="416" rx="78" fill="#3c695b" opacity=".16"/>
      <rect x="24" y="20" width="950" height="423" rx="78" fill="#799e89"/>
      <rect x="22" y="10" width="953" height="423" rx="78" fill="url(#anatomy-bevel)"
        stroke="#fff7df" stroke-width="3"/>
      <rect x="33" y="21" width="931" height="398" rx="69" fill="url(#anatomy-sea)"
        stroke="#c1e6d8" stroke-width="3"/>
      <g class="sea-ripples" fill="none" stroke="#f4fff3" opacity=".45" stroke-width="2.5" stroke-linecap="round">
        <path d="M92 275q13-8 26 0t26 0m-52 12q13-8 26 0t26 0"/>
        <path d="M353 91q12-8 24 0t24 0"/>
        <path d="M746 124q14-8 28 0t28 0"/>
        <path d="M781 399q16-9 32 0t32 0"/>
        <path d="M559 345q12-7 24 0t24 0"/>
      </g>

      <!-- Each family is a miniature five-piece assembly, kept in real geographic place.
           Fixed painter's order prevents one raised layer passing in front of a higher one. -->
      {#each islands as island, index (island.id)}
        <g class="island-assembly"
          style={'--top:' + island.top + ';--bevel:' + island.bevel + ';--middle:' + island.middle +
            ';--base:' + island.base + ';--group-delay:' + (index * 100) + 'ms'}>
          <title>{island.label}</title>
          <g class="stack-shadow">
            <use href={'/illustrations/atlas-anatomy.svg#' + island.id} transform="translate(0 27)"/>
          </g>
          <g class="stack-base">
            <use href={'/illustrations/atlas-anatomy.svg#' + island.id} transform="translate(0 19)"/>
          </g>
          <g class="stack-middle">
            <use href={'/illustrations/atlas-anatomy.svg#' + island.id} transform="translate(0 12)"/>
          </g>
          <g class="stack-bevel">
            <use href={'/illustrations/atlas-anatomy.svg#' + island.id} transform="translate(0 5)"/>
          </g>
          <g class="stack-top">
            <use href={'/illustrations/atlas-anatomy.svg#' + island.id}/>
          </g>
        </g>
      {/each}

      <!-- A central clay mount gives the flag a real physical resting point. -->
      <g class="flag-mount" transform="translate(510 291)">
        <ellipse cy="7" rx="47" ry="19" fill="#407c67" opacity=".2"/>
        <ellipse cy="3" rx="39" ry="15" fill="#b17b69"/>
        <ellipse cy="-2" rx="39" ry="15" fill="#e1b7a1"/>
        <ellipse cy="-6" rx="33" ry="10" fill="#fff1d7" stroke="#fff9e8" stroke-width="1.4"/>
        <ellipse cy="-7" rx="9" ry="3" fill="#c5ad91"/>
      </g>
      <g class="compass" transform="translate(916 77)">
        <circle r="24" fill="#f7e8c3" stroke="#c19e64" stroke-width="2"/>
        <circle r="18" fill="none" stroke="#d5b98b"/>
        <path d="M0-16L5 0L0 16L-5 0Z" fill="#b85861"/>
        <path d="M0 16L-5 0H5Z" fill="#fff8e9"/>
        <circle r="3" fill="#c8aa77"/>
      </g>
    </svg>

    {#each ornaments as ornament (ornament.id)}
      <span class={'ornament ornament-' + ornament.id}
        style={'--x:' + ornament.x + '%;--y:' + ornament.y + '%;--size:' +
          ornament.size + '%;--ornament-delay:' + ornament.delay + 'ms'}
        aria-hidden="true">
        <img src={'/illustrations/anatomy/' + ornament.id + '.webp'}
          alt="" loading="lazy" decoding="async" width="816" height="816"/>
      </span>
    {/each}

    <!-- The red-white flag is deliberately the largest, centered focal element. -->
    <span class="ornament ornament-flag"
      style="--x:51%;--y:58%;--size:20%;--ornament-delay:420ms"
      aria-hidden="true">
      <img src="/illustrations/anatomy/flag.webp" alt="" loading="eager"
        decoding="async" fetchpriority="high" width="816" height="816"/>
    </span>
  </div>
</div>

<style>
  .anatomy-stage {
    position: relative;
    isolation: isolate;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: radial-gradient(ellipse at 82% 12%, #fff7e0 0%, transparent 38%),
      linear-gradient(160deg, #edf5e8, #d7eee5 56%, #cde0d6);
  }
  .ambient {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    opacity: .5;
  }
  .ambient-one { width: 32%; aspect-ratio: 1; top: -22%; right: -10%; background: #fff4d3; }
  .ambient-two { width: 27%; aspect-ratio: 1; bottom: -21%; left: -12%; background: #a2d5c4; }
  /* No perspective, global tilt, hover parallax or animated world transform. */
  .world {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 100%;
    aspect-ratio: 2 / 1;
    transform: translate(-50%, -50%);
  }
  .island-scene { display: block; width: 100%; height: 100%; overflow: visible; }
  .stack-shadow { fill: #3d6c59; opacity: .22; }
  .stack-base { fill: var(--base); stroke: var(--base); stroke-width: 2.2; stroke-linejoin: round; }
  .stack-middle { fill: var(--middle); stroke: var(--middle); stroke-width: 2; stroke-linejoin: round; }
  .stack-bevel { fill: var(--bevel); stroke: #fdf6e8; stroke-opacity: .75; stroke-width: 1.8; stroke-linejoin: round; }
  .stack-top { fill: var(--top); stroke: #fff8e8; stroke-width: 1.4; stroke-linejoin: round; }
  .ornament {
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: var(--size);
    aspect-ratio: 1;
    transform: translate(-50%, -86%);
    pointer-events: none;
    filter: drop-shadow(0 4px 3px #2e564333);
  }
  .ornament img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .ornament-flag {
    z-index: 3;
    transform: translate(-50%, -91%);
    filter: drop-shadow(0 7px 5px #375b4f55);
  }
  .flag-mount { filter: drop-shadow(0 2px 1px #2f644022); }

  /* Animate discrete physically stacked parts after load, not the whole map.
     Resting art is visible at 0% and 100%, even if the browser delays an animation. */
  .anatomy-stage[data-motion='playing'] .stack-base {
    animation: seat-base 880ms cubic-bezier(.23,.84,.29,1) both;
    animation-delay: var(--group-delay);
  }
  .anatomy-stage[data-motion='playing'] .stack-middle {
    animation: seat-middle 940ms cubic-bezier(.23,.84,.29,1) both;
    animation-delay: calc(var(--group-delay) + 65ms);
  }
  .anatomy-stage[data-motion='playing'] .stack-bevel {
    animation: seat-middle 1000ms cubic-bezier(.23,.84,.29,1) both;
    animation-delay: calc(var(--group-delay) + 130ms);
  }
  .anatomy-stage[data-motion='playing'] .stack-top {
    animation: seat-top 1060ms cubic-bezier(.23,.84,.29,1) both;
    animation-delay: calc(var(--group-delay) + 195ms);
  }
  .anatomy-stage[data-motion='playing'] .ornament:not(.ornament-flag) {
    animation: ornament-seat 810ms ease-out both;
    animation-delay: calc(1150ms + var(--ornament-delay));
  }
  .anatomy-stage[data-motion='playing'] .ornament-flag {
    animation: flag-seat 1080ms cubic-bezier(.2,.8,.3,1) both;
    animation-delay: 1480ms;
  }
  .anatomy-stage[data-motion='playing'] .ornament-flag img {
    animation: flag-breathe 7200ms ease-in-out 2700ms infinite alternate;
    transform-origin: 34% 82%;
  }
  /* Only a tiny secondary ornament moves during idle. The islands remain settled. */
  .anatomy-stage[data-motion='playing'] .ornament-cendrawasih img {
    animation: bird-breathe 9400ms ease-in-out 2800ms infinite alternate;
  }
  .anatomy-stage[data-visible='false'] :is(.stack-base, .stack-middle, .stack-bevel, .stack-top, .ornament, .ornament img) {
    animation-play-state: paused;
  }
  @keyframes seat-base {
    0%, 100% { transform: translateY(0); }
    42% { transform: translateY(-7px); }
    69% { transform: translateY(2px); }
    84% { transform: translateY(-1px); }
  }
  @keyframes seat-middle {
    0%, 100% { transform: translateY(0); }
    38% { transform: translateY(-13px); }
    68% { transform: translateY(3px); }
    85% { transform: translateY(-1px); }
  }
  @keyframes seat-top {
    0%, 100% { transform: translateY(0); }
    37% { transform: translateY(-22px); }
    66% { transform: translateY(4px); }
    84% { transform: translateY(-1.5px); }
  }
  @keyframes ornament-seat {
    0%, 100% { translate: 0 0; }
    38% { translate: 0 -9px; }
    72% { translate: 0 2px; }
  }
  @keyframes flag-seat {
    0%, 100% { translate: 0 0; scale: 1; }
    37% { translate: 0 -14px; scale: 1.055; }
    69% { translate: 0 3px; scale: .993; }
    86% { translate: 0 -1px; scale: 1.004; }
  }
  @keyframes flag-breathe {
    from { transform: translateY(0) rotate(-.6deg); }
    to { transform: translateY(-2px) rotate(.8deg); }
  }
  @keyframes bird-breathe {
    from { transform: translateY(0); }
    to { transform: translateY(-2px); }
  }
  :global(html[data-theme='dark']) .anatomy-stage {
    background: radial-gradient(ellipse at 82% 12%, #4d4937, transparent 38%),
      linear-gradient(160deg, #314740, #29433e 56%, #233b3b);
  }
  :global(html[data-theme='dark']) .ambient-one { background: #645d40; }
  :global(html[data-theme='dark']) .ambient-two { background: #426556; }
  @media (max-width: 600px) {
    .world { width: 115%; }
    .ornament { filter: drop-shadow(0 3px 2px #2e564333); }
    .ornament-flag { filter: drop-shadow(0 4px 4px #375b4f55); }
  }
  @media (prefers-reduced-motion: reduce) {
    .anatomy-stage :is(.stack-base, .stack-middle, .stack-bevel, .stack-top, .ornament, .ornament img) {
      animation: none !important;
      translate: none !important;
      scale: 1 !important;
    }
  }
</style>
