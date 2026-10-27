<script lang="ts">
  import { onMount } from 'svelte';
  import { MapPin, Navigation, Bell } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { loadRegions, type Region } from '$lib/atlas/regions';
  import { ADMIN_DATA_PATH } from '$lib/atlas/edition';
  import { loadForecast, type ForecastSnapshot } from '$lib/map/weather';
  import { assetUrl } from '$lib/pwa/assets';
  import { readPins, writePins, readCurrentLocation, writeCurrentLocation, requestPosition, requestNotifications, type Pin } from '$lib/pwa/permissions';
  import WeatherPlaceCard from './WeatherPlaceCard.svelte';
  import PlacePicker from './PlacePicker.svelte';
  import type { PlaceOption } from '$lib/atlas/place-search';

  let { selectedRegion, onopen }: { selectedRegion?: Region; onopen?: (code: string) => void } = $props();
  let provinces = $state<Region[]>([]);
  let cities = $state<Region[]>([]);
  let selected = $state('32');
  let manuallySelected = $state(false);
  let pins = $state<Pin[]>([]);
  let current = $state<Extract<Pin, { type: 'coordinates' }>>();
  let forecast = $state<ForecastSnapshot>();
  let status = $state('');
  let busy = $state(false);
  let notificationPermission = $state<NotificationPermission | 'unavailable'>('unavailable');
  const placeOptions = $derived.by((): PlaceOption[] => {
    const provinceNames = new Map(provinces.map(region => [region.code, region.name]));
    const provinceOptions: PlaceOption[] = provinces.map(region => ({ code: region.code, name: region.name, level: 'province' }));
    const cityOptions: PlaceOption[] = cities.map(region => ({ code: region.code, name: region.name, level: 'city', parentName: provinceNames.get(region.parentCode ?? region.code.slice(0, 2)) }));
    return [...provinceOptions, ...cityOptions];
  });
  const names = $derived(new Map([...provinces, ...cities].map(region => [region.code, region.name])));
  $effect(() => { if (selectedRegion && !manuallySelected) selected = selectedRegion.code; });

  onMount(() => {
    document.documentElement.lang = getLocale();
    let disposed = false;
    const controller = new AbortController();
    readSavedPlaces();
    if ('Notification' in window && 'serviceWorker' in navigator) notificationPermission = Notification.permission;
    void Promise.all([
      loadRegions(ADMIN_DATA_PATH + '/provinces.json', controller.signal),
      loadRegions(ADMIN_DATA_PATH + '/cities.json', controller.signal)
    ]).then(([parents, children]) => { if (!disposed) { provinces = parents.regions; cities = children.regions; } })
      .catch(error => { if (error.name !== 'AbortError') { console.warn('Places directory unavailable', error); status = m.data_unavailable(); } });
    const refreshForecast = () => {
      void loadForecast(assetUrl('/data/weather/forecast.json'), controller.signal)
        .then(snapshot => { if (!disposed && snapshot) forecast = snapshot; })
        .catch(error => { if (error.name !== 'AbortError') console.warn('Saved-place forecast unavailable', error); });
    };
    refreshForecast();
    const forecastTimer = setInterval(() => { if (!document.hidden && navigator.onLine) refreshForecast(); }, 2 * 60 * 60_000);
    const sync = (event: StorageEvent) => { if (event.key?.startsWith('nusantara:')) readSavedPlaces(); };
    window.addEventListener('storage', sync);
    return () => { disposed = true; controller.abort(); clearInterval(forecastTimer); window.removeEventListener('storage', sync); };
  });

  function readSavedPlaces() {
    try { pins = readPins(); current = readCurrentLocation(); }
    catch (error) { console.warn('Saved places could not be read', error); status = m.pin_storage_error(); }
  }

  function pinRegion() {
    const name = names.get(selected);
    if (!name || pins.some(pin => pin.type === 'region' && pin.code === selected)) return;
    if (pins.length >= 30) { status = m.pin_storage_error(); return; }
    const next: Pin[] = [...pins, { id: 'region:' + selected, type: 'region', code: selected, name, addedAt: new Date().toISOString() }];
    try { writePins(next); pins = next; status = m.location_added(); manuallySelected = false; }
    catch (error) { console.warn('Place could not be saved', error); status = m.pin_storage_error(); }
  }

  async function useDeviceLocation() {
    busy = true;
    try {
      const coordinates = await requestPosition();
      const lat = Number(coordinates.latitude.toFixed(3));
      const lng = Number(coordinates.longitude.toFixed(3));
      const location: Extract<Pin, { type: 'coordinates' }> = { id: 'geo:' + lat + ',' + lng, type: 'coordinates', lat, lng, name: m.current_location(), addedAt: new Date().toISOString() };
      writeCurrentLocation(location);
      current = location;
      status = '';
    } catch (error) { console.warn('Device location unavailable', error); status = m.position_error(); }
    finally { busy = false; }
  }

  function removePin(id: string) {
    const next = pins.filter(pin => pin.id !== id);
    try { writePins(next); pins = next; status = ''; }
    catch (error) { console.warn('Place could not be removed', error); status = m.pin_storage_error(); }
  }

  async function notifications() {
    busy = true;
    try {
      notificationPermission = await requestNotifications();
      status = m.notification_setup();
      if (notificationPermission === 'denied') status = m.permission_denied();
    } catch (error) { console.warn('Notification permission unavailable', error); notificationPermission = 'unavailable'; status = m.permissions_unsupported(); }
    finally { busy = false; }
  }

  function openPlace(code: string) {
    onopen?.(code);
    document.getElementById('atlas')?.scrollIntoView({ block: 'start' });
  }
</script>

<section id="locations" class="preferences places-section" aria-labelledby="places-heading">
  <header class="places-header"><div><span class="eyebrow"><MapPin size={15} aria-hidden="true" /> {m.nav_locations()}</span><h2 id="places-heading">{m.pins_heading()}</h2><p>{m.places_description()}</p></div>
    <button type="button" class="location-button" onclick={useDeviceLocation} disabled={busy}><Navigation size={16} aria-hidden="true" />{m.location_button()}</button>
  </header>
  <form class="places-form" onsubmit={event => { event.preventDefault(); pinRegion(); }}>
    <span class="field-label" id="place-label">{m.pin_region_label()}</span>
    <div><PlacePicker options={placeOptions} value={selected} disabled={provinces.length === 0} onchange={code => { selected = code; manuallySelected = true; }} /><button type="submit" disabled={provinces.length === 0}><MapPin size={16} aria-hidden="true" />{m.pin_button()}</button></div>
  </form>
  {#if status}<p role="status" class="state">{status}</p>{/if}
  {#if current || pins.length > 0}
    <div class="weather-cards">
      {#if current}<WeatherPlaceCard pin={current} {forecast} {names} current onopen={openPlace} />{/if}
      {#each pins as pin (pin.id)}<WeatherPlaceCard {pin} {forecast} {names} onremove={() => removePin(pin.id)} onopen={openPlace} />{/each}
    </div>
    <p class="forecast-note">{m.forecast_archive_note()} <a href="https://data.bmkg.go.id/prakiraan-cuaca/" target="_blank" rel="noreferrer">BMKG ↗</a></p>
  {:else}<p class="empty">{m.no_pins()}</p>{/if}
  <div class="notification-settings"><button type="button" onclick={notifications} disabled={busy || notificationPermission === 'unavailable' || notificationPermission === 'denied'}><Bell size={15} aria-hidden="true" />{m.notify_button()}</button><small>{m.notification_setup()}</small></div>
</section>

<style>
  .places-section { padding: clamp(18px, 3vw, 30px); min-width: 0; }
  .places-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }.places-header .eyebrow { display: flex; align-items: center; gap: 6px; }.places-header h2 { margin: 8px 0; letter-spacing: -.04em; font-size: clamp(1.6rem, 3.5vw, 2.2rem); }.places-header p { margin: 0; color: var(--muted); font-size: .88rem; line-height: 1.6; }
  button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--text); font: inherit; font-size: .8rem; font-weight: 800; box-shadow: 0 3px 0 var(--border); }.location-button { background: var(--mint); } button:disabled { opacity: .55; }
  .places-form { max-width: 680px; display: grid; gap: 7px; margin-bottom: 22px; }.places-form .field-label { font-weight: 800; font-size: .8rem; }.places-form > div { display: flex; gap: 10px; min-width: 0; }.places-form button { flex-shrink: 0; background: var(--peach); }
  .weather-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 18px; }.forecast-note,.empty,.state { font-size: .8rem; line-height: 1.6; color: var(--muted); }.forecast-note { margin: 16px 0 0; }.forecast-note a { text-decoration: underline; }
  .notification-settings { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); }.notification-settings small { color: var(--muted); font-size: .72rem; }
</style>
