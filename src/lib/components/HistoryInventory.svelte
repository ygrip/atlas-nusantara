<script lang="ts">
  import { onMount } from 'svelte';
  import { ChevronDown, LibraryBig } from '@lucide/svelte';
  import { m } from '$lib/i18n/messages';
  import { foldHistorySearch } from '$lib/data/history-catalogue';
  import { loadHistoryInventory, type HistoryInventory } from '$lib/data/history-inventory';

  let { query = '' }: { query?: string } = $props();
  let inventory = $state.raw<HistoryInventory>();
  let failed = $state(false);
  let expanded = $state(false);
  const matches = $derived.by(() => {
    const search = foldHistorySearch(query.trim());
    return (inventory?.features ?? []).filter(feature => {
      const names = [feature.properties.name, feature.properties.source_label, ...feature.properties.aliases];
      return names.some(name => foldHistorySearch(name).includes(search));
    });
  });
  onMount(() => {
    loadHistoryInventory().then(data => inventory = data).catch(error => {
      failed = true;
      console.warn('Historical discovery inventory unavailable', error);
    });
  });
</script>

<details class="inventory bento-card" bind:open={expanded}>
  <summary>
    <span class="inventory-icon" aria-hidden="true"><LibraryBig size={21} /></span>
    <span class="inventory-title">{m.history_inventory()}</span>
    {#if inventory}<span class="bento-chip" aria-live="polite">{matches.length} / {inventory.features.length}</span>{/if}
    <ChevronDown class="disclosure-icon" size={19} aria-hidden="true" />
  </summary>
  <div class="inventory-body">
  {#if expanded}
  <p>{m.history_inventory_note()}</p>
  {#if failed}
    <p role="alert">{m.data_unavailable()}</p>
  {:else if !inventory}
    <p role="status">{m.loading_data()}</p>
  {:else if matches.length === 0}
    <p role="status">{m.history_inventory_empty()}</p>
  {:else}
    <ul>
      {#each matches as feature (feature.id)}
        <li><a href={feature.properties.source_url} target="_blank" rel="noreferrer">{feature.properties.source_label}</a></li>
      {/each}
    </ul>
    <small><a href={inventory.metadata.source_url} target="_blank" rel="noreferrer">Wikipedia · CC BY-SA 4.0</a></small>
  {/if}
  {/if}
  </div>
</details>

<style>
  .inventory{min-width:0;border:1px solid var(--border);border-radius:24px;background:linear-gradient(145deg,var(--surface),var(--panel));box-shadow:0 5px 0 -1px var(--border),inset 2px 2px 3px var(--clay-highlight),inset -2px -3px 6px var(--shadow)}
  summary{display:flex;align-items:center;gap:12px;min-height:76px;padding:16px 18px;list-style:none;cursor:pointer;border-radius:24px;color:var(--text)}
  summary::-webkit-details-marker{display:none}summary:hover{background:color-mix(in srgb,var(--accent) 4%,transparent)}
  .inventory-icon{display:grid;place-items:center;flex:none;width:42px;height:42px;border-radius:15px;background:var(--mint);color:var(--accent-strong);box-shadow:0 3px 0 var(--border),inset 2px 2px 3px var(--clay-highlight)}
  .inventory-title{flex:1;min-width:0;font-size:1rem;font-weight:850;line-height:1.35;overflow-wrap:anywhere}
  .bento-chip{flex:none;padding:6px 9px;border:1px solid var(--border);border-radius:11px;background:var(--surface);box-shadow:inset 1px 1px 2px var(--clay-highlight),0 2px 0 var(--border);font-size:.75rem;font-weight:800;font-variant-numeric:tabular-nums;color:var(--muted)}
  summary :global(.disclosure-icon){flex:none;transition:transform 180ms ease}details[open] summary :global(.disclosure-icon){transform:rotate(180deg)}
  .inventory-body{display:grid;gap:12px;padding:0 18px 18px}p{margin:0;padding:12px 14px;border:1px solid var(--border);border-radius:15px;background:var(--panel);font-size:.82rem;line-height:1.6;color:var(--muted);box-shadow:inset 1px 2px 4px var(--shadow)}
  ul{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));align-content:start;gap:10px;list-style:none;margin:0;padding:4px 4px 8px;max-height:20rem;overflow-y:auto;overscroll-behavior:contain}
  li{min-width:0}a{color:var(--accent-strong);overflow-wrap:anywhere}li a{display:flex;align-items:center;min-height:48px;padding:10px 12px;border:1px solid var(--border);border-radius:15px;background:linear-gradient(150deg,var(--surface),var(--panel));box-shadow:0 3px 0 -1px var(--border),inset 1px 2px 2px var(--clay-highlight);font-size:.84rem;font-weight:750;text-decoration:none;transition:box-shadow 120ms,border-color 120ms}
  li a:hover{border-color:var(--accent)}li a:active{box-shadow:inset 1px 2px 4px var(--shadow)}
  a:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:3px}small{font-size:.75rem}
  @media(max-width:420px){summary{padding:14px;gap:8px}.inventory-icon{width:36px;height:36px;border-radius:13px}.inventory-title{font-size:.9rem}.bento-chip{padding:5px 7px;font-size:.75rem}.inventory-body{padding:0 14px 14px}}
  @media(prefers-reduced-motion:reduce){summary :global(.disclosure-icon),li a{transition:none}}
</style>
