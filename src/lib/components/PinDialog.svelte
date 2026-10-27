<script lang="ts">
  import { ExternalLink, Share2 } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import type { MapPin, PointOverlay } from '$lib/map/overlay-contract';
  import { mountainColor } from '$lib/map/overlay-contract';
  import ClayPinIcon from './ClayPinIcon.svelte';
  import MapDialog from './MapDialog.svelte';
  import MountainDetails from './MountainDetails.svelte';

  let { pin, overlay, layerLabel, onclose, onprovince }: {
    pin?: MapPin;
    overlay?: PointOverlay;
    layerLabel: string;
    onclose: () => void;
    /** Present for the destinations layer, whose pins summarise a province. */
    onprovince?: (code: string) => void;
  } = $props();

  let status = $state('');
  let failed = $state(false);

  // A different pin starts with a clean share status.
  $effect(() => { void pin; status = ''; failed = false; });

  const symbol = $derived(pin?.symbol ?? overlay?.symbol ?? 'circle');
  const color = $derived(pin?.color ?? (pin ? mountainColor(pin) : undefined) ?? overlay?.color ?? '#8a7f78');
  const sourceUrl = $derived(pin?.sourceUrl ?? overlay?.sourceUrl);
  const isMountain = $derived(overlay?.id === 'mountains');
  const mapLink = $derived.by(() => {
    if (!pin) return '';
    const lat = pin.lat.toFixed(5);
    const lon = pin.lon.toFixed(5);
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=10/${lat}/${lon}`;
  });

  async function share() {
    if (!pin) return;
    const text = pin.description ?? m.pin_share_text({ name: pin.label });
    failed = false;
    try {
      if (navigator.share) {
        await navigator.share({ title: pin.label, text, url: mapLink });
        status = m.share_complete();
        return;
      }
      await navigator.clipboard.writeText(pin.label + '\n' + mapLink);
      status = m.share_link_copied();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      failed = true;
      status = m.share_action_failed();
    }
  }
</script>

<MapDialog open={Boolean(pin)} title={layerLabel} {onclose} wide={isMountain}>
  {#if pin}
    {#if isMountain}
      <MountainDetails {pin} />
    {:else}
      <div class="pin-hero">
        <span class="pin-badge"><ClayPinIcon {symbol} {color} size={56} /></span>
        <div class="pin-title">
          <h3>{pin.label}</h3>
          {#if pin.description}<p>{pin.description}</p>{/if}
        </div>
      </div>
      <dl class="pin-facts">
        <div><dt>{m.pin_source()}</dt><dd>{overlay?.source ?? '—'}</dd></div>
        <div><dt>{m.pin_coordinates()}</dt><dd class="mono">{pin.lat.toFixed(4)}°, {pin.lon.toFixed(4)}°</dd></div>
      </dl>
    {/if}
    <div class="pin-actions">
      <button type="button" class="pin-action primary" onclick={share}><Share2 size={18} aria-hidden="true" />{m.share_action()}</button>
      {#if sourceUrl}
        <a class="pin-action" href={sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={18} aria-hidden="true" />{m.pin_open_source()}</a>
      {/if}
      {#if pin.provinceCode && onprovince}
        <button type="button" class="pin-action" onclick={() => { const code = pin.provinceCode; onclose(); if (code) onprovince(code); }}>{m.pin_open_province()}</button>
      {/if}
    </div>
    <p class="pin-status" class:failed role={failed ? 'alert' : 'status'} aria-live="polite">{status}</p>
  {/if}
</MapDialog>

<style>
  .pin-hero { display: flex; align-items: center; gap: 16px; padding: 4px 0 14px; }
  .pin-badge { display: grid; place-items: center; flex: none; width: 84px; height: 84px; border-radius: 28px; background: var(--panel); box-shadow: inset 0 3px 8px var(--shadow), inset 0 -2px 0 var(--clay-highlight); }
  .pin-title { min-width: 0; }
  .pin-title h3 { margin: 0; font-size: clamp(1.1rem, 3.6vw, 1.45rem); line-height: 1.2; overflow-wrap: anywhere; }
  .pin-title p { margin: 6px 0 0; color: var(--muted); font-size: .86rem; line-height: 1.45; overflow-wrap: anywhere; }
  .pin-facts { display: grid; gap: 8px; margin: 0 0 16px; }
  .pin-facts div { display: flex; justify-content: space-between; gap: 14px; padding: 10px 14px; border-radius: 14px; background: var(--panel); box-shadow: inset 0 2px 4px var(--shadow); font-size: .82rem; }
  .pin-facts dt { color: var(--muted); font-weight: 800; }
  .pin-facts dd { margin: 0; text-align: right; font-weight: 700; overflow-wrap: anywhere; }
  .mono { font-family: ui-monospace, monospace; }
  .pin-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
  .pin-action { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 0 18px; border: 1px solid var(--border); border-radius: 16px; color: var(--text); background: linear-gradient(165deg, var(--surface), var(--panel)); font: inherit; font-size: .85rem; font-weight: 800; text-decoration: none; cursor: pointer; box-shadow: 0 4px 0 var(--border), inset 0 2px 1px var(--clay-highlight); transition: transform 120ms, box-shadow 120ms; }
  .pin-action.primary { color: var(--on-accent); border-color: transparent; background: radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--accent) 70%, #fff), var(--accent)); box-shadow: 0 4px 0 color-mix(in srgb, var(--accent) 60%, #000), inset 0 2px 2px #ffffff55; }
  .pin-action:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--border); }
  .pin-status { min-height: 1.2em; margin: 10px 0 0; color: var(--muted); font-size: .8rem; }
  .pin-status.failed { color: var(--danger); }
  @media (prefers-reduced-motion: reduce) { .pin-action { transition: none; } }
</style>
