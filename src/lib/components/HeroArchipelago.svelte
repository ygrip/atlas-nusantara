<script lang="ts">
  let { alt }: { alt: string } = $props();

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
  const imageSize = { tiger: [406, 420], volcano: [361, 420], orangutan: [411, 420], flag: [222, 420],
    komodo: [420, 297], pinisi: [374, 420], cendrawasih: [302, 420] } as Record<string, number[]>;

</script>

<div class="anatomy-stage" role="img" aria-label={alt}>
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
      <span class={'ornament ornament-' + ornament.id}
        style={'--x:' + ornament.x + '%;--y:' + ornament.y + '%;--w:' + ornament.width + '%'}
        aria-hidden="true">
        <img src={'/illustrations/hero/' + ornament.id + '.webp'} alt=""
          width={imageSize[ornament.id][0]} height={imageSize[ornament.id][1]}
          decoding="async" fetchpriority={ornament.id === 'flag' ? 'high' : 'low'}/>
      </span>
    {/each}
  </div>
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
    top: 0;
    bottom: 0;
    right: 0;
    margin-block: auto;
    width: 73%;
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
    width: var(--w);
    transform: translate(-50%, -100%);
  }
  .ornament img { position: relative; display: block; width: 100%; height: auto; }
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

  /* One short entrance for the entire solid stack; no separated plates or perpetual idle loops. */
  .world { animation: world-glide 650ms cubic-bezier(.22, .8, .2, 1) backwards; }
  @keyframes world-glide { from { translate: -2% 0; } }

  @media (max-width: 720px) {
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
