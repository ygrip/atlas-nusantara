<script lang="ts">
  import { ChevronLeft, ChevronRight, Share2, ShieldCheck, ExternalLink } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';
  import type { Region } from '$lib/atlas/regions';
  import type { SpeciesKind, SpeciesRecord } from '$lib/data/species';
  import { displayName } from '$lib/data/species-table';
  import { speciesImageCredit, speciesImagePage } from '$lib/data/species-images';
  import { speciesGroupLabel, speciesRealmLabel, speciesStatusColor, speciesStatusLabel, speciesStatusTextColor } from '$lib/data/species-labels';
  import MapDialog from './MapDialog.svelte';
  import SpeciesPhoto from './SpeciesPhoto.svelte';

  let { kind, record, provinces, onclose, onshare }: {
    kind: SpeciesKind; record?: SpeciesRecord; provinces: Region[]; onclose: () => void; onshare: (record: SpeciesRecord) => void;
  } = $props();

  let active = $state(0);
  $effect(() => { void record; active = 0; });
  const images = $derived(record?.images ?? []);
  const current = $derived(images[active]);
  const provinceNames = $derived.by(() => {
    if (!record) return [];
    const names = new Map(provinces.map(item => [item.code, item.name]));
    return record.provinces.map(code => names.get(code) ?? code);
  });
  const habitat = $derived.by(() => {
    if (!record) return '';
    const realms = record.realms.map(realm => speciesRealmLabel(realm)).join(' · ');
    if (record.habitat && realms) return record.habitat + ' (' + realms + ')';
    return record.habitat || realms;
  });
  const sourceLabels: Record<string, string> = { gbif: 'GBIF', ksdae: 'KSDAE', inaturalist: 'iNaturalist', animalworldmap: 'Animal World Map', earthsendangered: "Earth's Endangered Creatures" };

  function step(direction: number) {
    if (images.length < 2) return;
    active = (active + direction + images.length) % images.length;
  }
</script>

<MapDialog open={Boolean(record)} title={record ? displayName(record) : ''} {onclose} wide>
  {#if record}
    <article class="species-detail">
      <div class="gallery">
        <div class="stage">
          <SpeciesPhoto {kind} image={current} size="large" alt={displayName(record)} />
          {#if images.length > 1}
            <button type="button" class="nav prev" onclick={() => step(-1)} aria-label={m.destination_previous()}><ChevronLeft size={20} aria-hidden="true" /></button>
            <button type="button" class="nav next" onclick={() => step(1)} aria-label={m.destination_next()}><ChevronRight size={20} aria-hidden="true" /></button>
            <span class="counter" aria-live="polite">{m.species_photo_of({ current: active + 1, total: images.length })}</span>
          {/if}
        </div>
        {#if images.length > 1}
          <div class="thumbs">
            {#each images as image, index (image.id)}
              <button type="button" class:selected={index === active} onclick={() => { active = index; }} aria-label={m.species_photo_of({ current: index + 1, total: images.length })} aria-current={index === active}>
                <SpeciesPhoto {kind} {image} size="small" alt="" />
              </button>
            {/each}
          </div>
        {/if}
        {#if current}<p class="credit"><a href={speciesImagePage(current)} target="_blank" rel="noopener noreferrer">{speciesImageCredit(current, m.species_all_rights_reserved())} ↗</a></p>{/if}
      </div>

      <div class="info">
      <div class="identity">
        <span class="status-badge" style:background={speciesStatusColor(record.status)} style:color={speciesStatusTextColor(record.status)}>{record.status}</span>
        <div>
          <strong>{speciesStatusLabel(record.status)}</strong>
          <small>{m.table_status()} · IUCN</small>
        </div>
        {#if record.protected}<span class="protected"><ShieldCheck size={13} aria-hidden="true" /> {m.species_protected_badge()}{#if record.cites} · CITES {record.cites}{/if}</span>{/if}
      </div>
      <p class="latin"><em>{record.scientificName}</em><small>{speciesGroupLabel(record.group)} · {record.family}</small></p>
      {#if record.nameEn && record.nameEn !== displayName(record)}<p class="meta">{record.nameEn}</p>{/if}
      {#if record.aliases?.length}<p class="meta"><strong>{m.species_also_known()}:</strong> {record.aliases.join(', ')}</p>{/if}

      <section>
        <h3>{m.species_description()}</h3>
        {#if record.summary}
          <p>{record.summary}{#if record.wikipediaUrl} <a href={record.wikipediaUrl} target="_blank" rel="noopener noreferrer">Wikipedia <ExternalLink size={12} aria-hidden="true" /></a>{/if}</p>
        {:else}<p class="muted">{m.species_no_description()}</p>{/if}
      </section>
      {#if habitat}<section><h3>{m.species_habitat()}</h3><p>{habitat}</p></section>{/if}
      {#if provinceNames.length}
        <section>
          <h3>{m.species_in_provinces({ count: provinceNames.length })}</h3>
          <ul class="chips">{#each provinceNames as name (name)}<li>{name}</li>{/each}</ul>
        </section>
      {/if}
      <p class="sources">{m.species_sources()}: {record.sources.map(source => sourceLabels[source]).join(' · ')}</p>
      <button type="button" class="share" onclick={() => onshare(record)}><Share2 size={16} aria-hidden="true" /> {m.share_action()}</button>
      </div>
    </article>
  {/if}
</MapDialog>

<style>
  .species-detail { display: grid; gap: 12px; min-width: 0; }
  .gallery { display: grid; gap: 8px; }
  .stage { position: relative; aspect-ratio: 4 / 3; max-height: 46dvh; width: 100%; overflow: hidden; border-radius: 20px; border: 1px solid var(--border); background: var(--border); box-shadow: inset 0 2px 1px var(--clay-highlight); }
  .nav { position: absolute; top: 50%; transform: translateY(-50%); display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--border); border-radius: 15px; color: var(--text); background: color-mix(in srgb, var(--surface) 90%, transparent); cursor: pointer; }
  .prev { left: 10px; } .next { right: 10px; }
  .counter { position: absolute; right: 10px; bottom: 10px; padding: 3px 9px; border-radius: 10px; font-size: .7rem; font-weight: 750; color: var(--text); background: color-mix(in srgb, var(--surface) 90%, transparent); }
  .thumbs { display: flex; gap: 8px; overflow-x: auto; padding: 2px; }
  .thumbs button { flex: none; width: 72px; height: 54px; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: 12px; cursor: pointer; background: var(--border); }
  .thumbs button.selected { border-color: var(--accent); }
  .info { display: grid; gap: 12px; min-width: 0; align-content: start; }
  .credit, .sources, .muted, small { margin: 0; color: var(--muted); font-size: .72rem; line-height: 1.5; }
  .credit a, section a { color: var(--accent); }
  .identity { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
  .identity strong { display: block; font-size: .95rem; }
  .status-badge { display: inline-block; min-width: 42px; padding: 6px 11px; border-radius: 12px; text-align: center; font-weight: 850; }
  .protected { display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 10px; background: color-mix(in srgb, var(--accent) 16%, transparent); font-size: .72rem; font-weight: 750; }
  .latin { margin: 0; font-size: 1.1rem; }
  .latin small { display: block; margin-top: 2px; }
  .meta { margin: 0; font-size: .85rem; color: var(--muted); }
  h3 { margin: 0 0 4px; font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  section p { margin: 0; font-size: .92rem; line-height: 1.6; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
  .chips li { padding: 3px 10px; border: 1px solid var(--border); border-radius: 999px; font-size: .76rem; background: var(--surface); }
  .share { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 8px 18px; border: 1px solid var(--border); border-radius: 15px; color: var(--text); font: inherit; font-weight: 800; cursor: pointer; background: linear-gradient(165deg, var(--surface), var(--panel)); box-shadow: 0 3px 0 var(--border), inset 0 2px 1px var(--clay-highlight); }
  .share:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--border); }
  @media (min-width: 720px) { .species-detail { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); align-items: start; column-gap: 20px; } }
</style>
