<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { loadRegions } from '$lib/atlas/regions';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { readPins, writePins, requestPosition, requestNotifications, type Pin } from '$lib/pwa/permissions.js';

  type Region = { code: string; name: string };
  let regions: Region[] = [];
  let selected = '32';
  let pins: Pin[] = [];
  let status = '';
  let notificationPermission: NotificationPermission | 'unavailable' = 'unavailable';
  let locationPermission: PermissionState | 'unavailable' = 'unavailable';
  let busy = false;

  onMount(() => {
    document.documentElement.lang = getLocale();
    try {
      pins = readPins();
    } catch {
      status = m.pin_storage_error();
    }
    if ('Notification' in window && 'serviceWorker' in navigator) {
      notificationPermission = Notification.permission;
    }
    if (navigator.geolocation) locationPermission = 'prompt';
    if (!navigator.geolocation) {
      locationPermission = 'unavailable';
    } else if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then(permission => {
        locationPermission = permission.state;
        permission.onchange = () => locationPermission = permission.state;
      }).catch(() => locationPermission = 'prompt');
    }
    loadRegions('/data/admin-2022/provinces.json')
      .then(payload => { regions = payload.regions; })
      .catch(() => { status = m.data_unavailable(); });
  });

  function save(pin: Pin) {
    if (pins.some(item => item.id === pin.id)) return;
    if (pins.length >= 30) { status = m.pin_storage_error(); return; }
    const updatedPins = [...pins, pin].slice(0, 30);
    try {
      writePins(updatedPins);
      pins = updatedPins;
      status = m.location_added();
    } catch {
      status = m.pin_storage_error();
    }
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
    const updatedPins = pins.filter(item => item.id !== id);
    try {
      writePins(updatedPins);
      pins = updatedPins;
      status = '';
    } catch {
      status = m.pin_storage_error();
    }
  }
  async function notifications() {
    busy = true;
    try {
      notificationPermission = await requestNotifications();
      if (notificationPermission === 'granted') {
        status = m.notification_setup();
      } else {
        status = m.permission_denied();
      }
    } catch {
      notificationPermission = 'unavailable';
      status = m.permissions_unsupported();
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
        <button type="button" onclick={useDeviceLocation} disabled={busy || locationPermission === 'denied' || locationPermission === 'unavailable'}>{m.location_button()}</button>
        <button type="button" onclick={notifications} disabled={busy || notificationPermission === 'unavailable' || notificationPermission === 'denied'}>{m.notify_button()}</button>
      </div>
      {#if locationPermission === 'denied'}
        <p class="state">{m.permission_denied()}</p>
      {/if}
      {#if notificationPermission === 'unavailable'}
        <p class="disclaimer">{m.permissions_unsupported()}</p>
      {/if}
      <p class="disclaimer">{m.notification_setup()}</p>
      {#if notificationPermission !== 'unavailable'}
        <p class="state">{m.notify_result()} {#if notificationPermission === 'granted'}{m.permission_granted()}{:else if notificationPermission === 'denied'}{m.permission_denied()}{:else}{m.permission_prompt()}{/if}</p>
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
  .pin-form { display: grid; min-width: 0; align-content: start; gap: 12px; }
  label { font-weight: 650; font-size: .8rem; }
  .pin-row, .pin-actions { display: flex; gap: 9px; }
  .pin-row { min-width: 0; }
  .pin-row select { flex: 1 1 0; width: 0; min-width: 0; max-width: 100%; }
  .pin-row button { flex: 0 0 auto; }
  button { min-height: 44px; min-width: 44px; border: 1px solid #cbdbcc; border-radius: 12px; padding: 10px 12px; background: var(--surface); color: var(--text); font-size: .82rem; }
  button:hover:not(:disabled) { background: #e0eddf; }
  button:disabled { opacity: .5; cursor: default; }
  .pin-actions { flex-wrap: wrap; }
  .pin-actions button { flex: 1; }
  .disclaimer, .state, .empty { color: #627c6c; font-size: .78rem; line-height: 1.5; }
  .pins { display: grid; align-content: start; gap: 10px; }
  .pin { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 10px 14px; border-radius: 14px; background: var(--mint); min-width: 0; }
  .pin span { min-width: 0; overflow-wrap: anywhere; }
  .pin strong { display: block; font-size: .85rem; }
  .pin small { display: block; color: #71897d; }
  @media(max-width: 680px) { .preferences-body { grid-template-columns: 1fr; } .preferences { padding: 18px; } .archive-tag { display: none; } }
</style>
