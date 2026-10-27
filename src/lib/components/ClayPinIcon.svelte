<script lang="ts">
  import type { PinSymbol } from '$lib/map/overlay-contract';
  import { CLAY_PIN_VIEWBOX, clayPinInner } from '$lib/map/clay-pin';

  let { symbol, color, size = 22 }: { symbol: PinSymbol; color: string; size?: number } = $props();
  // Gradient ids must be unique per instance: a copy inside a hidden (display: none) container would break a shared id.
  const uid = $props.id();
  const markup = $derived(clayPinInner(symbol, color, uid));
</script>

<svg class="clay-pin-icon" width={size} height={size} viewBox={`0 0 ${CLAY_PIN_VIEWBOX} ${CLAY_PIN_VIEWBOX}`} aria-hidden="true" focusable="false">{@html markup}</svg>

<style>
  .clay-pin-icon { flex: none; display: inline-block; vertical-align: middle; overflow: visible; }
</style>
