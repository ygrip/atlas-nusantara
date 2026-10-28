<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Info, X } from 'lucide-svelte';
  import { m } from '$lib/i18n/messages';

  type Corner = 'top-right' | 'bottom-left';

  let { label, corner, open = $bindable(false), icon = Info, class: className = '', children }: {
    /** Heading of the panel, and the accessible name of its toggle. */
    label: string;
    corner: Corner;
    open?: boolean;
    /** Icon of the collapsed button. */
    icon?: typeof Info;
    class?: string;
    children: Snippet;
  } = $props();

  const id = $props.id();
  const BUTTON_SIZE = 48;
  let contentWidth = $state(BUTTON_SIZE);
  let contentHeight = $state(BUTTON_SIZE);
  /** Stays false until the first toggle so the drips do not play on page load. */
  let touched = $state(false);

  const Icon = $derived(icon);
  const toggleLabel = $derived(open ? m.map_info_hide({ label }) : m.map_info_show({ label }));

  function toggle() {
    touched = true;
    open = !open;
  }
</script>

<!--
  Goo effect: the blobs below are blurred and re-sharpened by one SVG filter, so the round button and the
  panel body melt into each other while the panel stretches open. The text lives outside the filter.
-->
<svg class="goo-defs" width="0" height="0" aria-hidden="true" focusable="false">
  <filter id={'goo-' + id} x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
    <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" />
  </filter>
</svg>

<aside
  class={'gooey ' + className}
  class:open
  class:touched
  data-corner={corner}
  style={`--goo-w: ${contentWidth}px; --goo-h: ${contentHeight}px; --goo-filter: url(#goo-${id})`}
>
  <div class="goo" aria-hidden="true">
    <span class="blob core"></span>
    <span class="blob body"></span>
    <span class="blob drip one"></span>
    <span class="blob drip two"></span>
  </div>

  <div class="content" id={'panel-' + id} inert={!open} bind:offsetWidth={contentWidth} bind:offsetHeight={contentHeight}>
    <header class="head"><strong>{label}</strong></header>
    <div class="body">{@render children()}</div>
  </div>

  <button type="button" class="toggle" aria-expanded={open} aria-controls={'panel-' + id} aria-label={toggleLabel} title={toggleLabel} onclick={toggle}>
    <span class="icon icon-closed"><Icon size={22} aria-hidden="true" /></span>
    <span class="icon icon-open"><X size={20} aria-hidden="true" /></span>
  </button>
</aside>

<style>
  .goo-defs { position: absolute; width: 0; height: 0; pointer-events: none; }

  .gooey { --size: 48px; --spring: cubic-bezier(.34, 1.56, .64, 1); --soft: cubic-bezier(.4, 0, .2, 1); position: absolute; z-index: 2; width: var(--goo-w); height: var(--goo-h); pointer-events: none; }
  .gooey[data-corner='top-right'] { top: 14px; right: 14px; }
  .gooey[data-corner='bottom-left'] { bottom: 14px; left: 14px; }

  .goo { position: absolute; inset: 0; filter: var(--goo-filter) drop-shadow(0 0 .6px var(--border)) drop-shadow(0 10px 14px #0000003a); }
  .blob { position: absolute; background: var(--surface); }
  [data-corner='top-right'] .blob { top: 0; right: 0; }
  [data-corner='bottom-left'] .blob { bottom: 0; left: 0; }

  .core { width: var(--size); height: var(--size); border-radius: 50%; }
  .blob.body { width: var(--size); height: var(--size); border-radius: calc(var(--size) / 2); transition: width 560ms var(--spring) 40ms, height 620ms var(--spring) 90ms, border-radius 560ms var(--spring); }
  .open .blob.body { width: var(--goo-w); height: var(--goo-h); border-radius: 24px; }
  /* Closing runs the other way: the height gives way first, then the width draws back into the button. */
  .gooey:not(.open) .blob.body { transition: width 520ms var(--spring) 90ms, height 460ms var(--spring), border-radius 520ms var(--spring); }

  .drip { width: 16px; height: 16px; border-radius: 50%; opacity: 0; }
  .touched .drip { animation: drip-out 720ms var(--soft) both; }
  .touched .drip.two { width: 11px; height: 11px; animation-delay: 110ms; }
  [data-corner='top-right'] { --drip-x: -46px; --drip-y: 50px; }
  [data-corner='bottom-left'] { --drip-x: 46px; --drip-y: -50px; }
  @keyframes drip-out {
    0% { opacity: 1; transform: translate(0, 0) scale(1); }
    45% { opacity: 1; transform: translate(var(--drip-x), var(--drip-y)) scale(.85); }
    100% { opacity: 1; transform: translate(0, 0) scale(.2); }
  }

  .content { position: absolute; width: max-content; max-width: min(260px, calc(100vw - 44px)); box-sizing: border-box; padding: 0 16px 14px; color: var(--text); font-size: .78rem; opacity: 0; transform: scale(.94); transition: opacity 120ms var(--soft), transform 120ms var(--soft); pointer-events: none; }
  [data-corner='top-right'] .content { top: 0; right: 0; transform-origin: top right; }
  [data-corner='bottom-left'] .content { bottom: 0; left: 0; transform-origin: bottom left; }
  .open .content { opacity: 1; transform: none; pointer-events: auto; transition: opacity 260ms var(--soft) 200ms, transform 420ms var(--spring) 160ms; }
  .head { display: flex; align-items: center; min-height: var(--size); padding-inline-end: calc(var(--size) - 6px); }
  [data-corner='bottom-left'] .head { order: 2; padding-inline-end: 0; padding-inline-start: calc(var(--size) - 6px); margin-top: 0; }
  [data-corner='bottom-left'] .content { display: flex; flex-direction: column; padding-top: 14px; }
  [data-corner='bottom-left'] .body { order: 1; }
  .head strong { font-size: .86rem; line-height: 1.25; overflow-wrap: anywhere; }

  .toggle { position: absolute; display: grid; place-items: center; width: var(--size); height: var(--size); padding: 0; border: 0; border-radius: 50%; color: var(--accent); background: transparent; cursor: pointer; pointer-events: auto; transition: transform 160ms var(--spring), color 160ms; }
  [data-corner='top-right'] .toggle { top: 0; right: 0; }
  [data-corner='bottom-left'] .toggle { bottom: 0; left: 0; }
  .toggle:hover { transform: scale(1.08); }
  .toggle:active { transform: scale(.92); }
  .toggle:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 70%, transparent); outline-offset: 2px; }
  .icon { position: absolute; display: grid; place-items: center; transition: opacity 180ms, transform 320ms var(--spring); }
  .icon-open { opacity: 0; transform: rotate(-90deg) scale(.5); }
  .open .icon-closed { opacity: 0; transform: rotate(90deg) scale(.5); }
  .open .icon-open { opacity: 1; transform: none; }

  @media (prefers-reduced-motion: reduce) {
    .goo { filter: drop-shadow(0 0 .6px var(--border)) drop-shadow(0 10px 14px #0000003a); }
    .blob.body, .gooey:not(.open) .blob.body, .content, .open .content, .toggle, .icon { transition: none; }
    .touched .drip { animation: none; }
  }
  @media (max-width: 700px) {
    .gooey[data-corner='top-right'] { top: 8px; right: 8px; }
    .gooey[data-corner='bottom-left'] { bottom: 8px; left: 8px; }
  }
</style>
