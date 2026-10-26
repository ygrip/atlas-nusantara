<script lang="ts">
  import { MapPin, Leaf, Landmark as LandmarkIcon, Search } from 'lucide-svelte';
  import { m } from '$lib/paraglide/messages.js';
  import type { Region } from '$lib/atlas/regions';
  import type { Landmark } from '$lib/data/destinations';
  import DestinationImage from './DestinationImage.svelte';
  let { landmarks, provinces, provinceCode, onprovince }: {
    landmarks: Landmark[]; provinces: Region[]; provinceCode?: string; onprovince: (code: string) => void;
  } = $props();
  let category = $state<'all' | 'natural' | 'built'>('all');
  let query = $state('');
  const region = $derived(provinces.find(item => item.code === provinceCode));
  const visible = $derived(landmarks.filter(item => item.provinceCode === provinceCode
    && (category === 'all' || item.kind === category)
    && item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  const totals = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const place of landmarks) counts.set(place.provinceCode, (counts.get(place.provinceCode) ?? 0) + 1);
    return counts;
  });
</script>

<section class="destination-explorer" aria-label={m.layer_destinations()}>
  <header class="destination-heading">
    <div><span class="destination-eyebrow"><MapPin size={13} /> {m.layer_destinations()}</span><h3>{region?.name ?? m.destination_select_province()}</h3></div>
    <span class="destination-total">{provinceCode ? landmarks.filter(item => item.provinceCode === provinceCode).length : landmarks.length}</span>
  </header>
  {#if !provinceCode}
    <p class="destination-hint">{m.destination_click_province()}</p>
    <div class="province-picker">
      {#each provinces as province (province.code)}
        <button type="button" onclick={() => onprovince(province.code)}>{province.name}<small>{totals.get(province.code) ?? 0}</small></button>
      {/each}
    </div>
  {:else}
    <div class="destination-filters">
      <label class="destination-search"><Search size={15} /><input type="search" bind:value={query} placeholder={m.destination_search()} aria-label={m.destination_search()} /></label>
      <div class="destination-tabs" role="group" aria-label={m.layer_destinations()}>
        <button type="button" class:active={category === 'all'} aria-pressed={category === 'all'} onclick={() => category = 'all'}>{m.destination_all()}</button>
        <button type="button" class:active={category === 'natural'} aria-pressed={category === 'natural'} onclick={() => category = 'natural'}><Leaf size={14} />{m.destination_natural()}</button>
        <button type="button" class:active={category === 'built'} aria-pressed={category === 'built'} onclick={() => category = 'built'}><LandmarkIcon size={14} />{m.destination_built()}</button>
      </div>
    </div>
    {#if visible.length}
      <div class="destination-grid">
        {#each visible as place (place.id)}
          <article class="destination-card">
            <DestinationImage name={place.name} commonsFile={place.commonsFile} />
            <div class="destination-copy">
              <span class="destination-kind">{#if place.kind === 'natural'}<Leaf size={13} />{m.destination_natural()}{:else}<LandmarkIcon size={13} />{m.destination_built()}{/if}</span>
              <h4>{place.name}</h4>
              {#if place.sourceUrl}<a href={place.sourceUrl} target="_blank" rel="noopener noreferrer">{m.source_details()} ↗</a>{/if}
            </div>
          </article>
        {/each}
      </div>
    {:else}<p role="status">{m.destination_empty()}</p>{/if}
  {/if}
  <p class="destination-note">{m.destination_coverage_note()} <a href="https://www.direktoripariwisata.id/peta" target="_blank" rel="noopener noreferrer">{m.source_details()} ↗</a></p>
</section>

<style>
  .destination-explorer { display: grid; gap: 12px; min-width: 0; }
  .destination-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .destination-heading h3 { margin: 3px 0 0; font-size: 1.13rem; line-height: 1.3; }
  .destination-eyebrow { display: inline-flex; align-items: center; gap: 5px; font-size: .72rem; font-weight: 800; color: var(--muted); }
  .destination-total { padding: 6px 10px; border-radius: 14px; background: var(--surface); font-weight: 850; box-shadow: inset 0 1px 0 var(--clay-highlight); }
  .destination-hint, .destination-note { color: var(--muted); font-size: .78rem; line-height: 1.5; margin: 0; }
  .province-picker { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr)); gap: 7px; max-height: 400px; overflow-y: auto; }
  .province-picker button { min-height: 44px; text-align: left; display: flex; justify-content: space-between; gap: 6px; align-items: center; padding: 9px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: inherit; font-weight: 750; font-size: .77rem; }
  .province-picker small { color: var(--muted); }
  .destination-filters { display: grid; gap: 8px; }
  .destination-search { display: flex; align-items: center; gap: 7px; padding: 0 10px; border: 1px solid var(--border); border-radius: 13px; background: var(--surface); }
  .destination-search input { width: 100%; min-width: 0; padding: 9px 0; border: 0; background: transparent; color: var(--text); }
  .destination-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
  .destination-tabs button { display: inline-flex; align-items: center; gap: 5px; padding: 8px 10px; border: 1px solid var(--border); background: var(--surface); color: inherit; border-radius: 13px; font-weight: 750; font-size: .72rem; }
  .destination-tabs button.active { box-shadow: inset 0 2px 4px var(--shadow); border-color: var(--accent); }
  .destination-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(230px, 100%), 1fr)); gap: 12px; }
  .destination-card { min-width: 0; padding: 7px; border-radius: 19px; border: 1px solid var(--border); background: var(--surface); box-shadow: 0 5px 12px var(--shadow), inset 0 1px 0 var(--clay-highlight); }
  .destination-copy { display: grid; gap: 5px; padding: 10px 5px 8px; }
  .destination-kind { display: inline-flex; align-items: center; gap: 5px; color: var(--muted); font-size: .72rem; font-weight: 750; }
  .destination-copy h4 { margin: 0; font-size: .9rem; line-height: 1.35; }
  .destination-copy a { font-size: .72rem; color: var(--accent); }
  .destination-note { border-top: 1px solid var(--border); padding-top: 10px; }
  @media (max-width: 560px) { .province-picker { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
