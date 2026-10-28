<script lang="ts">
  import type { Snippet } from 'svelte';
  import { X } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';

  let { open, title, onclose, children, wide = false }: {
    open: boolean;
    title: string;
    onclose: () => void;
    children: Snippet;
    wide?: boolean;
  } = $props();

  let dialog = $state<HTMLDialogElement>();
  const titleId = $props.id();
  let returnFocus: HTMLElement | undefined;

  // The native dialog gives focus trapping, Escape handling and an inert page behind it.
  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus = document.activeElement as HTMLElement | undefined;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  });

  function handleClose() {
    if (open) onclose();
    if (returnFocus?.isConnected) returnFocus.focus();
  }

  /** A click on the backdrop lands on the dialog element itself, never on its content. */
  function handleBackdropClick(event: MouseEvent) {
    if (event.target === dialog) onclose();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions (Escape closes natively; the click only handles the backdrop) -->
<dialog bind:this={dialog} class="map-dialog" class:wide aria-labelledby={titleId} onclose={handleClose} onclick={handleBackdropClick}>
  {#if open}
    <div class="dialog-surface">
      <header class="dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" class="dialog-close" onclick={onclose} aria-label={m.dialog_close()}><X size={20} aria-hidden="true" /></button>
      </header>
      <div class="dialog-body">{@render children()}</div>
    </div>
  {/if}
</dialog>

<style>
  .map-dialog { width: min(520px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); padding: 0; overflow: hidden; border: 1px solid var(--border); border-radius: 28px; color: var(--text); background: linear-gradient(160deg, var(--surface), var(--panel)); box-shadow: 0 6px 0 -2px var(--border), 0 28px 60px -20px #00000088, inset 0 2px 1px var(--clay-highlight); }
  .map-dialog.wide { width: min(760px, calc(100vw - 24px)); }
  .map-dialog[open] { display: grid; animation: dialog-in 260ms cubic-bezier(.2, .9, .3, 1.15); }
  .map-dialog::backdrop { background: #211f25aa; backdrop-filter: blur(3px); animation: backdrop-in 200ms ease-out; }
  .dialog-surface { display: grid; grid-template-rows: auto minmax(0, 1fr); max-height: calc(100dvh - 24px); }
  .dialog-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 16px 8px 22px; }
  .dialog-head h2 { margin: 0; font-size: 1.1rem; letter-spacing: -.01em; overflow-wrap: anywhere; }
  .dialog-close { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border: 1px solid var(--border); border-radius: 15px; color: var(--text); background: linear-gradient(165deg, var(--surface), var(--panel)); cursor: pointer; box-shadow: 0 3px 0 var(--border), inset 0 2px 1px var(--clay-highlight); }
  .dialog-close:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--border); }
  .dialog-body { min-height: 0; overflow: auto; padding: 4px 22px 22px; overscroll-behavior: contain; }
  @keyframes dialog-in { from { opacity: 0; transform: translateY(18px) scale(.94); } to { opacity: 1; transform: none; } }
  @keyframes backdrop-in { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .map-dialog[open], .map-dialog::backdrop { animation: none; } }
</style>
