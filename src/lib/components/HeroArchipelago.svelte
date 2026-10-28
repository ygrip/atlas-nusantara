<script lang="ts">
  import { onMount } from 'svelte';

  let { alt }: { alt: string } = $props();
  let stage: HTMLDivElement;
  let visible = $state(true);
  let reducedMotion = false;

  // A shared projected geography, with four independent clay depth layers per island.
  const islands = [
    { id: 'sumatra', label: 'Sumatra', top: '#f1bec2', rim: '#e9a9b0', side: '#c4818e' },
    { id: 'java', label: 'Java', top: '#d88b91', rim: '#c76b7b', side: '#a45067' },
    { id: 'nusa-tenggara', label: 'Bali and Nusa Tenggara', top: '#f2dba8', rim: '#dfbe88', side: '#af9163' },
    { id: 'kalimantan', label: 'Kalimantan', top: '#b9d9bc', rim: '#9ac5a1', side: '#669576' },
    { id: 'sulawesi', label: 'Sulawesi', top: '#d6e0b1', rim: '#bad095', side: '#8eac77' },
    { id: 'maluku', label: 'Maluku', top: '#f3d1cd', rim: '#dfaeb0', side: '#bb8088' },
    { id: 'papua', label: 'Papua', top: '#e4cfa4', rim: '#cbb481', side: '#a18a5e' }
  ];

  // These are decorative figurines, not real-time observations of species occurrence.
  // The 0..100 coordinates correspond to the shared geography viewBox.
  const ornaments = [
    { id: 'rafflesia', x: 15, y: 49, size: 10.5, delay: 0 },
    { id: 'flag', x: 30, y: 63, size: 8.8, delay: 130 },
    { id: 'volcano', x: 37, y: 69, size: 11, delay: 210 },
    { id: 'orangutan', x: 41, y: 46, size: 11, delay: 85 },
    { id: 'palm', x: 58, y: 35, size: 10.8, delay: 170 },
    { id: 'komodo', x: 57.5, y: 79, size: 10.5, delay: 310 },
    { id: 'pinisi', x: 72, y: 62, size: 11.5, delay: 370 },
    { id: 'cendrawasih', x: 87, y: 51, size: 11.5, delay: 260 }
  ];

  onMount(() => {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: '100px 0px' });
    observer.observe(stage);
    return () => observer.disconnect();
  });

  function move(event: PointerEvent) {
    if (reducedMotion || event.pointerType === 'touch') return;
    const rect = stage.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 9;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 7;
    stage.style.setProperty('--pan-x', x.toFixed(1) + 'px');
    stage.style.setProperty('--pan-y', y.toFixed(1) + 'px');
  }

  function reset() {
    stage.style.setProperty('--pan-x', '0px');
    stage.style.setProperty('--pan-y', '0px');
  }
</script>

<div class="anatomy-stage" role="img" aria-label={alt} data-visible={visible}
  bind:this={stage} onpointermove={move} onpointerleave={reset}>
  <div class="ambient ambient-one"></div>
  <div class="ambient ambient-two"></div>
  <div class="world">
    <svg class="island-scene" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sea-hero" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stop-color="#b1ded9"/>
          <stop offset="0.52" stop-color="#7cc4bb"/>
          <stop offset="1" stop-color="#5caa9f"/>
        </linearGradient>
        <linearGradient id="sea-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f6f1df"/>
          <stop offset="1" stop-color="#c9c8aa"/>
        </linearGradient>
      </defs>
      <!-- A physical tray: cast shadow, sidewall, light-catching bevel, recessed sea. -->
      <rect x="23" y="33" width="955" height="427" rx="85" fill="#8c9e91" opacity=".2"/>
      <rect x="21" y="20" width="955" height="425" rx="85" fill="#a4b3a4"/>
      <rect x="20" y="10" width="955" height="425" rx="85" fill="url(#sea-rim)" stroke="#fff9eb" stroke-width="3"/>
      <rect x="34" y="24" width="927" height="397" rx="73" fill="url(#sea-hero)" stroke="#b9e4db" stroke-width="4"/>
      <g fill="none" stroke="#f7fff9" stroke-linecap="round" opacity=".34" stroke-width="2.5">
        <path d="M87 278q14-9 28 0t28 0m-56 10q14-9 28 0t28 0"/>
        <path d="M344 104q13-8 26 0t26 0m-52 10q13-8 26 0t26 0"/>
        <path d="M725 115q15-9 30 0t30 0m-60 11q15-9 30 0t30 0"/>
        <path d="M814 403q15-9 30 0t30 0"/>
        <path d="M573 304q14-8 28 0t28 0"/>
      </g>

      {#each islands as island, index (island.id)}
        <g class="island"
          style={'--top:' + island.top + ';--rim:' + island.rim + ';--side:' + island.side + ';--delay:' + (index * 85) + 'ms'}>
          <title>{island.label}</title>
          <use class="land-shadow" href={'/illustrations/atlas-anatomy.svg#' + island.id} transform="translate(0 19)"/>
          <use class="land-side" href={'/illustrations/atlas-anatomy.svg#' + island.id} transform="translate(0 12)"/>
          <use class="land-rim" href={'/illustrations/atlas-anatomy.svg#' + island.id} transform="translate(0 4)"/>
          <use class="land-top" href={'/illustrations/atlas-anatomy.svg#' + island.id}/>
        </g>
      {/each}
      <g class="compass" transform="translate(908 84)">
        <circle r="26" fill="#f7e8c3" stroke="#c19e64" stroke-width="2.5"/>
        <circle r="20" fill="none" stroke="#d5b98b" stroke-width="1"/>
        <path d="M0-17L6 0L0 17L-6 0Z" fill="#bc5f60"/>
        <path d="M0 17L-6 0H6Z" fill="#fff8e9"/>
        <circle r="3.6" fill="#c8aa77"/>
      </g>
      <g fill="#f7ebcf" stroke="#bdaf90" stroke-width="1.5">
        <circle cx="65" cy="59" r="5"/><circle cx="932" cy="389" r="5"/>
        <circle cx="65" cy="386" r="5"/>
      </g>
    </svg>
    {#each ornaments as ornament (ornament.id)}
      <span class={'ornament ornament-' + ornament.id}
        style={'--x:' + ornament.x + '%;--y:' + ornament.y + '%;--size:' + ornament.size + '%;--delay:' + ornament.delay + 'ms'}
        aria-hidden="true">
        <img src={'/illustrations/anatomy/' + ornament.id + '.webp'} alt="" loading="lazy" decoding="async" width="512" height="512"/>
      </span>
    {/each}
  </div>
</div>

<style>
  .anatomy-stage {
    --pan-x: 0px; --pan-y: 0px; position: relative; width: 100%; height: 100%; overflow: hidden;
    isolation: isolate;
    background: radial-gradient(ellipse at 78% 14%, #fef0cf 0%, transparent 37%),
      linear-gradient(160deg, #edf6e9 0%, #d7eee5 48%, #d0e2dc 100%);
  }
  .anatomy-stage::after {
    content: ''; position: absolute; z-index: 3; inset: auto 0 0; height: 9%;
    background: linear-gradient(transparent, #d9e8dbbb); pointer-events: none;
  }
  .ambient { position: absolute; border-radius: 50%; pointer-events: none; opacity: .65; filter: blur(2px); }
  .ambient-one { width: 32%; aspect-ratio: 1; top: -19%; right: -6%; background: #fff7de; }
  .ambient-two { width: 26%; aspect-ratio: 1; bottom: -16%; left: -11%; background: #b5dcd0; }
  .world {
    position: absolute; width: 100%; aspect-ratio: 2 / 1; left: 50%; top: 51%;
    transform: translate(-50%, -50%) perspective(900px) rotateX(12deg) rotateZ(-1.5deg) translate3d(var(--pan-x), var(--pan-y), 0);
    transition: transform 260ms cubic-bezier(.22,.75,.34,1); transform-style: preserve-3d; will-change: transform;
  }
  .island-scene { display: block; width: 100%; height: 100%; overflow: visible; }
  .island { opacity: 1; animation: land-appear 920ms both cubic-bezier(.2,.8,.22,1); animation-delay: var(--delay); }
  .land-shadow { fill: #46675a; opacity: .21; }
  .land-side { fill: var(--side); stroke: var(--side); stroke-width: 2.5; stroke-linejoin: round; }
  .land-rim { fill: var(--rim); stroke: #fff5dd; stroke-opacity: .6; stroke-width: 2; stroke-linejoin: round; }
  .land-top { fill: var(--top); stroke: #fff9e7; stroke-opacity: .65; stroke-width: 1.3; stroke-linejoin: round; }
  .ornament {
    position: absolute; z-index: 2; left: var(--x); top: var(--y); width: var(--size); aspect-ratio: 1;
    pointer-events: none; transform: translate(-50%, -79%); filter: drop-shadow(0 7px 5px #304c3d38);
    animation: ornament-arrive 940ms both cubic-bezier(.2,.8,.2,1);
    animation-delay: calc(var(--delay) + 180ms);
  }
  .ornament img {
    display: block; width: 100%; height: 100%; object-fit: contain;
    animation: ornament-bob 5.4s ease-in-out infinite; animation-delay: var(--delay);
  }
  .ornament-komodo img, .ornament-volcano img { animation-duration: 6.8s; }
  .ornament-flag img { animation-duration: 4.4s; }
  .anatomy-stage[data-visible="false"] :is(.island, .ornament, .ornament img) { animation-play-state: paused; }
  @keyframes land-appear {
    from { opacity: 0; translate: 0 26px; } to { opacity: 1; translate: 0 0; }
  }
  @keyframes ornament-arrive {
    from { opacity: 0; translate: 0 13px; scale: .82; } to { opacity: 1; translate: 0 0; scale: 1; }
  }
  @keyframes ornament-bob {
    0%, 100% { transform: translateY(0) rotate(-2deg); }
    50% { transform: translateY(-5px) rotate(1deg); }
  }
  :global(html[data-theme='dark']) .anatomy-stage {
    background: radial-gradient(ellipse at 78% 14%, #50483e 0%, transparent 37%),
      linear-gradient(155deg, #2d4440 0%, #233e3d 55%, #1f3335 100%);
  }
  :global(html[data-theme='dark']) .ambient-one { background: #665b41; }
  :global(html[data-theme='dark']) .ambient-two { background: #3a685c; }
  :global(html[data-theme='dark']) .anatomy-stage::after { background: linear-gradient(transparent, #253c3a99); }
  @media (max-width: 600px) {
    .world { width: 115%; top: 51%; }
    .ornament { filter: drop-shadow(0 3px 3px #304c3d33); }
  }
  @media (prefers-reduced-motion: reduce) {
    .world { transform: translate(-50%, -50%); transition: none; will-change: auto; }
    .island, .ornament, .ornament img { animation: none !important; }
  }
</style>
