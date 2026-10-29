<script lang="ts">
  import { onMount } from 'svelte';

  interface TabChoice { id: string; label: string }

  /** Accessible tab buttons. The caller renders the panels: role="tabpanel", aria-labelledby={`${prefix}-tab-${id}`}, hidden when not chosen. */
  let { prefix, tabs, value = $bindable(), label }: { prefix: string; tabs: TabChoice[]; value: string; label: string } = $props();

  let buttons: HTMLButtonElement[] = [];
  let ready = $state(false);
  // Faster first paint must not expose an apparently clickable SSR tab before
  // its client handlers exist, otherwise the first activation can be lost.
  onMount(() => { ready = true; });

  function move(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    value = tabs[next].id;
    buttons[next]?.focus();
  }
</script>

<div class="tab-list" role="tablist" aria-label={label}>
  {#each tabs as tab, index (tab.id)}
    <button bind:this={buttons[index]} type="button" disabled={!ready} role="tab" id={`${prefix}-tab-${tab.id}`} aria-selected={value === tab.id} aria-controls={`${prefix}-panel-${tab.id}`}
      tabindex={value === tab.id ? 0 : -1} onclick={() => { value = tab.id; }} onkeydown={event => move(event, index)}>{tab.label}</button>
  {/each}
</div>

<style>
  .tab-list { display: inline-flex; gap: 6px; padding: 5px; border-radius: 18px; background: var(--panel); box-shadow: var(--clay-pressed); max-width: 100%; overflow-x: auto; }
  button { min-height: 40px; padding: 0 18px; border: 0; border-radius: 14px; background: transparent; color: var(--text); font: inherit; font-weight: 850; white-space: nowrap; cursor: pointer; }
  button[aria-selected='true'] { background: var(--accent); color: var(--on-accent); box-shadow: var(--clay-shadow); }
  button:focus-visible { outline: 3px solid var(--accent-strong); outline-offset: 2px; }
</style>
