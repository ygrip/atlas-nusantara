<script lang="ts">
  import { m } from '$lib/i18n/messages';

  let { x = 0, y = 0, width = 30, decorative = false }: {
    x?: number;
    y?: number;
    width?: number;
    decorative?: boolean;
  } = $props();
  const height = $derived(width * 2 / 3);
  const flagName = $derived(`${m.history_official_flag()}: ${m.history_indonesia_flag()}`);
</script>

<svg {x} {y} {width} {height} viewBox="0 0 3 2" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden={decorative} aria-label={flagName}>
  <title>{flagName}</title>
  <rect width="3" height="1" fill="#FF0000" />
  <rect y="1" width="3" height="1" fill="#FFFFFF" />
</svg>

<style>
  svg { display: block; flex: none; filter: drop-shadow(0 1px 2px #0006); }
</style>
