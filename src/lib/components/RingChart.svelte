<script lang="ts">
  /** A clay donut: rounded arcs on a pressed track, with a value in the middle. Pure SVG, no animation. */
  interface Segment { label: string; value: number; color: string }

  let { segments, centerValue, centerLabel, label, size = 168, thickness = 20 }: {
    segments: Segment[];
    centerValue: string;
    centerLabel: string;
    label: string;
    size?: number;
    thickness?: number;
  } = $props();

  interface Arc { color: string; dash: string; offset: number }

  const radius = $derived((size - thickness) / 2);
  const center = $derived(size / 2);

  function computeArcs(items: Segment[], arcRadius: number, arcThickness: number): Arc[] {
    const circumference = 2 * Math.PI * arcRadius;
    const total = items.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return [];
    // Round caps extend by half the thickness on each side, so leave that room between arcs.
    const gap = arcThickness + 2;
    const visibleItems = items.filter(item => item.value > 0);
    const arcs: Arc[] = [];
    let consumed = 0;
    for (const item of visibleItems) {
      const length = (item.value / total) * circumference;
      let visible = length - gap;
      if (visibleItems.length === 1) visible = circumference - 0.01;
      if (visible < 0.01) visible = 0.01;
      arcs.push({ color: item.color, dash: visible + ' ' + circumference, offset: -(consumed + gap / 2) });
      consumed += length;
    }
    return arcs;
  }

  const arcs = $derived(computeArcs(segments, radius, thickness));
</script>

<figure class="ring" style={`--ring-size: ${size}px`}>
  <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
    <circle class="ring-track" cx={center} cy={center} r={radius} fill="none" stroke-width={thickness} />
    <g transform={`rotate(-90 ${center} ${center})`}>
      {#each arcs as arc (arc.color + arc.offset)}
        <circle cx={center} cy={center} r={radius} fill="none" stroke={arc.color} stroke-width={thickness}
          stroke-linecap="round" stroke-dasharray={arc.dash} stroke-dashoffset={arc.offset} />
      {/each}
    </g>
  </svg>
  <figcaption><strong>{centerValue}</strong><span>{centerLabel}</span></figcaption>
</figure>

<style>
  .ring { position: relative; width: var(--ring-size); max-width: 100%; margin: 0; aspect-ratio: 1; flex: 0 0 auto; }
  svg { display: block; width: 100%; height: 100%; filter: drop-shadow(0 6px 6px var(--shadow)); }
  .ring-track { stroke: var(--panel); }
  figcaption { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; gap: 2px; }
  strong { font-size: calc(var(--ring-size) * .2); line-height: 1; letter-spacing: -.04em; }
  span { font-size: .7rem; font-weight: 750; color: var(--muted); }
</style>
