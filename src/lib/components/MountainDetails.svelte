<script lang="ts">
  import { m } from '$lib/i18n/messages';
  import type { MapPin } from '$lib/map/overlay-contract';
  import type { DestinationPhoto } from '$lib/data/destination-contract';
  import { loadCommonsPhoto } from '$lib/data/commons-photo';

  let { pin, onclose }: { pin: MapPin; onclose?: () => void } = $props();
  let image = $state<DestinationPhoto>();
  let imageFailed = $state(false);

  // A photo is supplementary. Never guess an image filename or let search
  // results silently substitute another mountain with a similar name.
  $effect(() => {
    const name = pin.label.replace(/^Gunung\s+/i, '').trim();
    image = undefined;
    imageFailed = false;
    if (!name) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      action: 'query', generator: 'search', gsrsearch: '"' + name + '" mountain Indonesia',
      gsrlimit: '5', prop: 'pageimages', piprop: 'name',
      pithumbsize: '900', format: 'json', origin: '*'
    });
    void fetch('https://en.wikipedia.org/w/api.php?' + params, { signal: controller.signal })
      .then(response => { if (!response.ok) throw Error('Photo lookup failed'); return response.json(); })
      .then(async payload => {
        if (controller.signal.aborted) return;
        const key = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
        const match = Object.values(payload.query?.pages ?? {}).find((page: any) => {
          const title = String(page.title ?? '').replace(/^Mount\s+/i, '').replace(/^Gunung\s+/i, '').replace(/\s*\(.+\)$/, '');
          return key(title) === key(name) && typeof page.pageimage === 'string';
        }) as { pageid: number; pageimage: string } | undefined;
        if (!match || !Number.isSafeInteger(match.pageid)) return;
        const photo = await loadCommonsPhoto(match.pageimage, controller.signal);
        if (!controller.signal.aborted) image = photo;
      })
      .catch(error => { if (!controller.signal.aborted) console.warn('Mountain photo unavailable', error); });
    return () => controller.abort();
  });
  const categoryName = $derived(pin.category === 'active' ? m.mountain_active() : pin.category === 'potential' ? m.mountain_potential() : m.mountain_other());
</script>

<section class="mountain-detail" aria-label={m.mountain_details()}>
  <div class="photo">
    <img src={image && !imageFailed ? image.url : '/illustrations/mountain-placeholder.svg'}
      alt={image && !imageFailed ? pin.label : m.mountain_image_missing()} loading="lazy"
      onerror={() => imageFailed = true} />
  </div>
  <div class="information">
    <div class="detail-head">
      <span class="eyebrow">{m.layer_mountains()}</span>
      {#if onclose}<button type="button" class="close" onclick={onclose} aria-label={m.dialog_close()}>×</button>{/if}
    </div>
    <h3>{pin.label}</h3>
    <p class="kind" data-category={pin.category ?? 'other'}>{categoryName}</p>
    {#if typeof pin.value === 'number'}<p>{m.mountain_elevation()}: <strong>{pin.value.toLocaleString()} m</strong></p>{/if}
    {#if pin.description}<p>{pin.description}</p>{/if}
    <p class="coordinates">{pin.lat.toFixed(4)}°, {pin.lon.toFixed(4)}°</p>
    {#if image && !imageFailed}
      <a href={image.descriptionUrl} target="_blank" rel="noopener noreferrer">{image.credit} · {m.mountain_image_source()} ↗</a>
      <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{image.license}</a>
    {:else}<small>{m.mountain_image_missing()}</small>{/if}
    <small>{m.mountain_data_note()}</small>
  </div>
</section>

<style>
  .mountain-detail { display:grid; grid-template-columns:minmax(0, 1fr); gap:14px; }
  .photo { overflow:hidden; border-radius:18px; background:var(--panel); min-height:170px; box-shadow:inset 0 2px 5px var(--shadow); }
  .photo img { width:100%; height:100%; max-height:240px; object-fit:cover; display:block; }
  .information { min-width:0; display:flex; flex-direction:column; align-items:flex-start; gap:8px; padding:4px 5px; }
  .detail-head { align-self:stretch; display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .eyebrow { font-size:.72rem; font-weight:900; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); }
  h3 { margin:0; font-size:clamp(1.18rem, 2vw, 1.6rem); overflow-wrap:anywhere; }
  p { margin:0; font-size:.87rem; line-height:1.45; }
  .kind { padding:5px 11px; border-radius:99px; border:1px solid var(--border); font-weight:800; font-size:.75rem; }
  .kind[data-category='active'] { border-color:#ca5a48; }
  .kind[data-category='potential'] { border-color:#c99245; }
  .coordinates { font:700 .76rem ui-monospace, monospace; }
  small { font-size:.72rem; line-height:1.4; color:var(--muted); }
  a { font-size:.78rem; font-weight:800; }
  .close { min-width:38px; min-height:38px; border:1px solid var(--border); border-radius:12px; color:inherit; background:var(--surface); font-size:1.35rem; cursor:pointer; box-shadow:0 2px 0 var(--border); }
</style>
