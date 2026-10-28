<script lang="ts">
  import { ChevronDown, Search, X } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';
  import { searchPlaces, type PlaceOption } from '$lib/atlas/place-search';
  import MapDialog from './MapDialog.svelte';

  let { options, value, onchange, disabled = false, title, detail }: {
    options: PlaceOption[];
    /** Code of the chosen place. */
    value: string;
    onchange: (code: string) => void;
    disabled?: boolean;
    /** Dialog title and empty-trigger text; defaults to the pin-region label. */
    title?: string;
    /** Replaces the "level · parent" line under each name, for example with a count. */
    detail?: (option: PlaceOption) => string;
  } = $props();

  const heading = $derived(title ?? m.pin_region_label());

  const MAX_RESULTS = 80;
  const listId = $props.id();
  let open = $state(false);
  let query = $state('');
  let activeIndex = $state(0);
  let input = $state<HTMLInputElement>();
  let list = $state<HTMLElement>();

  const matches = $derived(searchPlaces(options, query));
  const results = $derived(matches.slice(0, MAX_RESULTS));
  const chosen = $derived(options.find(option => option.code === value));
  const activeId = $derived(results[activeIndex] ? listId + '-' + results[activeIndex].code : undefined);

  function openPicker() {
    query = '';
    activeIndex = Math.max(0, options.findIndex(option => option.code === value));
    open = true;
  }

  function closePicker() {
    open = false;
  }

  function choose(code: string) {
    onchange(code);
    closePicker();
  }

  function levelLabel(option: PlaceOption): string {
    if (option.level === 'province') return m.level_province();
    return m.level_city();
  }

  function metaOf(option: PlaceOption): string {
    if (detail) return detail(option);
    const parts = [levelLabel(option)];
    if (option.parentName) parts.push(option.parentName);
    return parts.join(' · ');
  }

  function moveActive(step: number) {
    if (results.length === 0) return;
    activeIndex = (activeIndex + step + results.length) % results.length;
    queueMicrotask(() => document.getElementById(listId + '-' + results[activeIndex].code)?.scrollIntoView({ block: 'nearest' }));
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); moveActive(1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveActive(-1); }
    else if (event.key === 'Home') { event.preventDefault(); activeIndex = 0; list?.scrollTo({ top: 0 }); }
    else if (event.key === 'Enter') {
      event.preventDefault();
      const target = results[activeIndex];
      if (target) choose(target.code);
    }
  }

  // Focus the search box as soon as the dialog opens; typing resets the highlighted row.
  $effect(() => { if (open) queueMicrotask(() => input?.focus()); });
  $effect(() => { query; activeIndex = 0; });
</script>

<button type="button" class="place-trigger" aria-haspopup="dialog" onclick={openPicker} {disabled}>
  <span class="trigger-text">
    {#if chosen}<strong>{chosen.name}</strong><small>{metaOf(chosen)}</small>
    {:else}<strong>{heading}</strong>{/if}
  </span>
  <ChevronDown size={18} aria-hidden="true" />
</button>

<MapDialog {open} title={heading} onclose={closePicker}>
  <div class="search-box">
    <Search size={18} aria-hidden="true" />
    <input
      bind:this={input}
      bind:value={query}
      type="text"
      role="combobox"
      autocomplete="off"
      spellcheck="false"
      aria-label={m.region_search()}
      placeholder={m.region_search()}
      aria-expanded="true"
      aria-controls={listId}
      aria-activedescendant={activeId}
      onkeydown={handleKeydown}
    />
    {#if query}<button type="button" class="clear" aria-label={m.dialog_close()} onclick={() => { query = ''; input?.focus(); }}><X size={16} aria-hidden="true" /></button>{/if}
  </div>
  <p class="result-count" role="status">{results.length === 0 ? m.no_results() : matches.length.toLocaleString() + ' · ' + m.pin_region_label()}</p>
  <ul id={listId} bind:this={list} class="place-list scroll-area" role="listbox" tabindex="-1" aria-label={heading}>
    {#each results as option, index (option.code)}
      <li id={listId + '-' + option.code} role="option" aria-selected={option.code === value} class:active={index === activeIndex} onclick={() => choose(option.code)} onkeydown={() => {}} onmousemove={() => { activeIndex = index; }}>
        <span class="place-name">{option.name}</span>
        <span class="place-meta">{metaOf(option)}{#if !detail} · <span class="place-code">{option.code}</span>{/if}</span>
      </li>
    {/each}
  </ul>
  {#if matches.length > MAX_RESULTS}<p class="refine">{m.place_refine({ count: MAX_RESULTS })}</p>{/if}
</MapDialog>

<style>
  .place-trigger { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 12px; flex: 1; min-width: 0; min-height: 52px; padding: 8px 16px; border: 1px solid var(--border); border-radius: 16px; color: var(--text); font: inherit; text-align: left; background: linear-gradient(165deg, var(--surface), var(--panel)); cursor: pointer; box-shadow: 0 3px 0 var(--border), inset 0 2px 1px var(--clay-highlight); }
  .place-trigger:disabled { opacity: .55; cursor: not-allowed; }
  .place-trigger:focus-visible, .search-box:focus-within { outline: 3px solid color-mix(in srgb, var(--accent) 60%, transparent); outline-offset: 2px; }
  .trigger-text { display: grid; min-width: 0; }
  .trigger-text strong { overflow: hidden; font-size: .92rem; text-overflow: ellipsis; white-space: nowrap; }
  .trigger-text small { overflow: hidden; color: var(--muted); font-size: .72rem; text-overflow: ellipsis; white-space: nowrap; }

  .search-box { position: relative; display: flex; align-items: center; gap: 8px; padding: 0 8px 0 14px; border: 1px solid var(--border); border-radius: 16px; background: var(--panel); box-shadow: var(--clay-pressed); }
  .search-box input { flex: 1; min-width: 0; min-height: 48px; border: 0; border-radius: 12px; color: var(--text); font: inherit; background: transparent; }
  .search-box input:focus, .search-box input:focus-visible { outline: none; }
  .clear { display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 12px; color: var(--muted); background: transparent; cursor: pointer; }
  .clear:hover { color: var(--accent); }
  .result-count { margin: 10px 2px 6px; color: var(--muted); font-size: .74rem; font-weight: 700; }
  .place-list { display: grid; gap: 4px; max-height: min(340px, 46dvh); margin: 0; padding: 4px; overflow: auto; list-style: none; border-radius: 16px; background: var(--panel); box-shadow: var(--clay-pressed); }
  .place-list li { display: grid; gap: 2px; min-height: 48px; padding: 8px 12px; border-radius: 12px; cursor: pointer; background: var(--surface); }
  .place-list li.active { color: var(--on-accent); background: var(--accent); }
  .place-list li[aria-selected='true']:not(.active) { background: color-mix(in srgb, var(--mint) 74%, var(--surface)); box-shadow: inset 3px 0 var(--accent); }
  .place-name { font-size: .9rem; font-weight: 800; overflow-wrap: anywhere; }
  .place-meta { font-size: .72rem; opacity: .8; }
  .place-code { font-family: ui-monospace, SFMono-Regular, monospace; font-variant-numeric: tabular-nums; }
  .refine { margin: 8px 2px 0; color: var(--muted); font-size: .74rem; }
</style>
