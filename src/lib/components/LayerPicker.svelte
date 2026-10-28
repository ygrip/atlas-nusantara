<script lang="ts">
  import type { ComponentType } from 'svelte';
  import { Check, ChevronDown, Search } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';
  import MapDialog from './MapDialog.svelte';

  interface LayerChoice { id: string; label: () => string; source: string; icon: ComponentType }

  let { layers, value, onchange }: { layers: LayerChoice[]; value: string; onchange: (id: string) => void } = $props();

  let open = $state(false);
  let query = $state('');
  let search = $state<HTMLInputElement>();

  const active = $derived(layers.find(layer => layer.id === value) ?? layers[0]);
  const matches = $derived.by(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return layers;
    return layers.filter(layer => (layer.label() + ' ' + layer.source).toLocaleLowerCase().includes(needle));
  });

  function openPicker() {
    query = '';
    open = true;
  }

  function choose(id: string) {
    open = false;
    if (id !== value) onchange(id);
  }

  // Focus the search field once the dialog is on screen so the list can be filtered by typing straight away.
  $effect(() => {
    if (open) search?.focus();
  });
</script>

{#if active}
  {@const ActiveIcon = active.icon}
  <button type="button" class="layer-picker-trigger" aria-haspopup="dialog" aria-label={m.layer_picker_button() + ': ' + active.label()} onclick={openPicker}>
    <span class="trigger-icon"><ActiveIcon size={20} aria-hidden="true" /></span>
    <span class="trigger-text"><small>{m.layer_heading()}</small><strong>{active.label()}</strong></span>
    <span class="source-tag">{active.source}</span>
    <ChevronDown size={18} aria-hidden="true" />
  </button>
{/if}

<MapDialog {open} title={m.layer_picker_title()} onclose={() => { open = false; }}>
  <label class="layer-search"><Search size={17} aria-hidden="true" />
    <input bind:this={search} type="search" bind:value={query} placeholder={m.layer_picker_search()} aria-label={m.layer_picker_search()} autocomplete="off" />
  </label>
  {#if matches.length === 0}
    <p class="layer-empty" role="status">{m.layer_picker_empty()}</p>
  {:else}
    <ul class="layer-options" aria-label={m.layer_heading()}>
      {#each matches as layer (layer.id)}
        {@const LayerIcon = layer.icon}
        <li>
          <button type="button" class="layer-option" class:chosen={layer.id === value} aria-pressed={layer.id === value} onclick={() => choose(layer.id)}>
            <span class="option-icon"><LayerIcon size={20} aria-hidden="true" /></span>
            <span class="option-text"><strong>{layer.label()}</strong><small>{layer.source}</small></span>
            {#if layer.id === value}<Check size={18} aria-hidden="true" />{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</MapDialog>

<style>
  .layer-picker-trigger { display: inline-flex; align-items: center; gap: 12px; min-height: 56px; max-width: 100%; padding: 8px 16px 8px 10px; border: 1px solid var(--border); border-radius: 20px; color: var(--text); background: linear-gradient(165deg, var(--surface), var(--panel)); cursor: pointer; text-align: left; box-shadow: 0 4px 0 var(--border), inset 0 2px 1px var(--clay-highlight); transition: transform 120ms, box-shadow 120ms; }
  .layer-picker-trigger:hover { color: var(--accent); }
  .layer-picker-trigger:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--border), inset 0 2px 4px var(--shadow); }
  .trigger-icon, .option-icon { display: grid; place-items: center; flex: none; width: 38px; height: 38px; border-radius: 14px; color: var(--accent); background: var(--panel); box-shadow: inset 0 2px 4px var(--shadow); }
  .trigger-text, .option-text { display: grid; min-width: 0; line-height: 1.2; }
  .trigger-text small { font-size: .62rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .trigger-text strong { font-size: .95rem; }
  .source-tag { font-size: .62rem; font-weight: 800; padding: 3px 8px; border-radius: 99px; background: var(--page); color: var(--muted); }
  .layer-search { display: flex; align-items: center; gap: 10px; margin: 6px 0 14px; padding: 0 14px; border: 1px solid var(--border); border-radius: 16px; background: var(--panel); box-shadow: inset 0 2px 5px var(--shadow); }
  .layer-search input { flex: 1; min-height: 46px; padding: 0; border: 0; background: transparent; box-shadow: none; outline: none; color: inherit; font: inherit; }
  .layer-options { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .layer-option { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 60px; padding: 8px 14px 8px 10px; border: 1px solid var(--border); border-radius: 18px; color: var(--text); background: var(--surface); cursor: pointer; text-align: left; box-shadow: 0 3px 0 var(--border), inset 0 2px 1px var(--clay-highlight); transition: transform 120ms, box-shadow 120ms; }
  .layer-option:hover { color: var(--accent); }
  .layer-option:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--border); }
  .layer-option.chosen { border-color: var(--accent); background: linear-gradient(170deg, var(--surface), var(--rose-wash, var(--panel))); }
  .option-text { flex: 1; }
  .option-text strong { font-size: .95rem; }
  .option-text small { font-size: .72rem; color: var(--muted); }
  .layer-empty { margin: 8px 0; color: var(--muted); font-weight: 700; }
  @media (max-width: 560px) { .layer-picker-trigger { width: 100%; } .trigger-text { flex: 1; } }
  @media (prefers-reduced-motion: reduce) { .layer-picker-trigger, .layer-option { transition: none; } }
</style>
