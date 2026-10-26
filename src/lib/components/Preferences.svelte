<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { readPins, writePins, requestPosition, requestNotifications, type Pin } from '$lib/pwa/permissions.js';

  type Region = { code: string; name: string };
  let regions: Region[] = [];
  let selected = '32';
  let pins: Pin[] = [];
  let status = '';
  let notificationPermission: NotificationPermission | 'unavailable' = 'unavailable';
  let busy = false;

  onMount(() => {
    document.documentElement.lang = getLocale();
    pins = readPins();
    notificationPermission = 'Notification' in window ? Notification.permission : 'unavailable';
    fetch('/data/admin-2022/provinces.json')
      .then(response => { if (!response.ok) throw Error('Region data not available'); return response.json(); })
      .then(payload => { regions = Array.isArray(payload.regions) ? payload.regions : []; })
      .catch(() => { status = m.position_error(); });
  });

  function save(pin: Pin) {
    if (pins.some(item => item.id === pin.id)) return;
    pins = [...pins, pin].slice(0, 30);
    writePins(pins);
    status = m.location_added();
  }
  function pinRegion() {
    const region = regions.find(item => item.code === selected);
    if (!region) return;
    save({ id: 'region:' + region.code, type: 'region', code: region.code,
      name: region.name, addedAt: new Date().toISOString() });
  }
  async function useDeviceLocation() {
    busy = true;
    try {
      const coordinates = await requestPosition();
      // Approximate coordinates (~100 m) limit unnecessary precision in saved pins.
      const lat = Number(coordinates.latitude.toFixed(3));
      const lng = Number(coordinates.longitude.toFixed(3));
      save({ id: 'geo:' + lat + ',' + lng, type: 'coordinates', lat, lng,
        name: lat + ', ' + lng, addedAt: new Date().toISOString() });
    } catch {
      status = m.position_error();
    } finally { busy = false; }
  }
  function removePin(id: string) {
    pins = pins.filter(item => item.id !== id);
    writePins(pins);
    status = '';
  }
  async function notifications() {
    busy = true;
    try {
      notificationPermission = await requestNotifications();
      status = notificationPermission === 'granted'
        ? m.notification_setup() : m.permission_denied();
    } catch {
      status = m.permission_denied();
    } finally { busy = false; }
  }
</script>

<section id="locations" class="preferences">
  <header class="preferences-header">
    <div><span class="eyebrow">03 / PERSONAL</span><h2>{m.pins_heading()}</h2></div>
    <span class="archive-tag">Kepmendagri 2022</span>
  </header>
  <div class="preferences-body">
    <div class="pin-form">
      <label for="province-code">{m.pin_region_label()}</label>
      <div class="pin-row">
        <select id="province-code" bind:value={selected} disabled={regions.length === 0}>
          {#each regions as region (region.code)}
            <option value={region.code}>{region.code} · {region.name}</option>
          {/each}
        </select>
        <button type="button" onclick={pinRegion} disabled={regions.length === 0}>{m.pin_button()}</button>
      </div>
      <div class="pin-actions">
        <button type="button" onclick={useDeviceLocation} disabled={busy}>{m.location_button()}</button>
        <button type="button" onclick={notifications} disabled={busy || notificationPermission === 'unavailable'}>{m.notify_button()}</button>
      </div>
      <p class="disclaimer">{m.notification_setup()}</p>
      {#if notificationPermission !== 'unavailable'}
        <p class="state">{m.notify_result()} {notificationPermission}</p>
      {/if}
      {#if status}<p role="status" class="state">{status}</p>{/if}
    </div>
    <div class="pins">
      {#if pins.length === 0}
        <p class="empty">{m.no_pins()}</p>
      {:else}
        {#each pins as pin (pin.id)}
          <div class="pin">
            <span><strong>{pin.name}</strong>{#if pin.type === 'region'}<small>{pin.code}</small>{/if}</span>
            <button type="button" aria-label={m.unpin_button() + ' ' + pin.name} onclick={() => removePin(pin.id)}>{m.unpin_button()}</button>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</section>

<style>
  .preferences { margin-top: 32px; padding: 24px; border: 1px solid #f7fbf2; border-radius: 28px; background: #e4eee3; box-shadow: 9px 11px 26px #c6d5c9, -8px -8px 22px #fafff9; }
  .preferences-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .preferences h2 { letter-spacing: -.04em; font-size: clamp(1.35rem, 3vw, 2rem); margin: 12px 0 24px; }
  .archive-tag { font-size: .7rem; white-space: nowrap; color: #5a8370; }
  .preferences-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 28px; }
  .pin-form { display: grid; align-content: start; gap: 12px; }
  label { font-weight: 650; font-size: .8rem; }
  .pin-row, .pin-actions { display: flex; gap: 9px; }
  .pin-row select { flex: 1; min-width: 0; max-width: 100%; }
  button { border: 1px solid #cbdbcc; border-radius: 12px; padding: 10px 12px; background: #f7faf4; color: #365945; font-size: .82rem; }
  button:hover:not(:disabled) { background: #e0eddf; }
  button:disabled { opacity: .5; cursor: default; }
  .pin-actions { flex-wrap: wrap; }
  .pin-actions button { flex: 1; }
  .disclaimer, .state, .empty { color: #627c6c; font-size: .78rem; line-height: 1.5; }
  .pins { display: grid; align-content: start; gap: 10px; }
  .pin { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 14px; border-radius: 14px; background: #f0f6ee; min-width: 0; }
  .pin span { min-width: 0; overflow-wrap: anywhere; }
  .pin strong { display: block; font-size: .85rem; }
  .pin small { display: block; color: #71897d; }
  @media(max-width: 680px) { .preferences-body { grid-template-columns: 1fr; } .preferences { padding: 18px; } .archive-tag { display: none; } }
</style>
