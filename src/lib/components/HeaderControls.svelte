<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Languages, Moon, Sun, Share2, SlidersHorizontal, X, Check } from 'lucide-svelte';
  import { changeTheme } from '$lib/pwa/theme';
  import { getLocale, locales, setLocale } from '$lib/paraglide/runtime.js';
  import { localeNames } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages.js';

  let { onshare }: { onshare: () => void } = $props();
  const flags: Record<string, string> = { en: '🇬🇧', id: '🇮🇩', ms: '🇲🇾', fil: '🇵🇭', th: '🇹🇭', vi: '🇻🇳', my: '🇲🇲', km: '🇰🇭', lo: '🇱🇦', 'zh-SG': '🇸🇬', ta: '🇸🇬', tet: '🇹🇱', 'pt-TL': '🇹🇱' };
  let menu = $state<HTMLDetailsElement>();
  let languageDialog = $state<HTMLDialogElement>();
  let dark = $state(false);
  let busy = $state(false);
  let languageReturnFocus: HTMLElement | undefined;

  onMount(() => {
    const sync = () => { dark = document.documentElement.dataset.theme === 'dark'; };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const closeOutside = (event: PointerEvent) => { if (menu?.open && !menu.contains(event.target as Node)) menu.open = false; };
    window.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeMenu);
    return () => { observer.disconnect(); window.removeEventListener('pointerdown', closeOutside); window.removeEventListener('keydown', closeMenu); };
  });

  async function openLanguages() {
    languageReturnFocus = document.activeElement as HTMLElement;
    if (menu?.open) languageReturnFocus = menu.querySelector('summary') ?? languageReturnFocus;
    if (menu) menu.open = false;
    await tick();
    languageDialog?.showModal();
  }

  function select(locale: (typeof locales)[number]) {
    languageDialog?.close();
    setLocale(locale);
  }

  async function toggleTheme(event: MouseEvent) {
    if (busy) return;
    busy = true;
    try {
      await changeTheme(event.currentTarget as HTMLElement, () => {
        let theme = 'dark';
        if (document.documentElement.dataset.theme === 'dark') theme = 'light';
        document.documentElement.dataset.theme = theme;
        let chrome = '#f4ece1';
        if (theme === 'dark') chrome = '#1f1c22';
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', chrome);
        try { localStorage.setItem('nusantara:theme', theme); }
        catch (error) { console.warn('Theme preference could not be saved', error); }
      });
    } finally { busy = false; }
  }

  async function share() {
    if (menu) menu.open = false;
    await tick();
    onshare();
  }

  function closeMenu(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !menu?.open) return;
    menu.open = false;
    menu.querySelector('summary')?.focus();
  }

  function closeBackdrop(event: MouseEvent) {
    if (event.target !== languageDialog) return;
    const bounds = languageDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) languageDialog.close();
  }
</script>

<div class="header-controls" role="group" aria-label={m.nav_options()}>
  <div class="desktop-controls">
    <button class="language-trigger control-button" type="button" onclick={openLanguages} aria-label={m.select_language()} aria-haspopup="dialog"><span class="flag" aria-hidden="true">{flags[getLocale()]}</span><span>{localeNames[getLocale()]}</span><span aria-hidden="true">⌄</span></button>
    <button class="control-button icon-control" type="button" onclick={toggleTheme} disabled={busy} aria-label={m.theme_toggle()} aria-pressed={dark}>
      {#if dark}<Sun size={20} aria-hidden="true" />{:else}<Moon size={20} aria-hidden="true" />{/if}
    </button>
    <button class="control-button icon-control" type="button" onclick={share} aria-label={m.share_heading()}><Share2 size={19} aria-hidden="true" /></button>
  </div>
  <details class="mobile-controls" bind:this={menu}>
    <!-- SVG-only summary needs an explicit button role for consistent browser accessibility trees. -->
    <!-- svelte-ignore a11y_no_redundant_roles -->
    <summary class="control-button icon-control" role="button" aria-label={m.nav_options()}><SlidersHorizontal size={21} aria-hidden="true" /></summary>
    <div class="quick-menu" role="group" aria-label={m.nav_options()}>
      <button type="button" onclick={openLanguages} aria-haspopup="dialog"><span class="flag" aria-hidden="true">{flags[getLocale()]}</span>{m.language_label()}<span class="menu-meta">{localeNames[getLocale()]}</span></button>
      <button type="button" onclick={share}><Share2 size={18} aria-hidden="true" />{m.share_heading()}</button>
      <button type="button" onclick={toggleTheme} disabled={busy} aria-label={m.theme_toggle()} aria-pressed={dark}>{#if dark}<Sun size={18} aria-hidden="true" />{:else}<Moon size={18} aria-hidden="true" />{/if}{m.theme_toggle()}</button>
    </div>
  </details>
</div>

<!-- Native dialog handles focus containment and Escape; the backdrop click is optional pointer recovery. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog class="language-dialog" bind:this={languageDialog} aria-labelledby="language-title" onclick={closeBackdrop} onclose={() => languageReturnFocus?.focus()}>
  <header><div><span class="eyebrow"><Languages size={16} aria-hidden="true" /> {m.language_label()}</span><h2 id="language-title">{m.select_language()}</h2></div><button class="control-button icon-control" type="button" onclick={() => languageDialog?.close()} aria-label={m.dialog_close()}><X size={20} aria-hidden="true" /></button></header>
  <div class="language-grid">
    {#each locales as locale (locale)}
      <button type="button" lang={locale} aria-pressed={getLocale() === locale} onclick={() => select(locale)}><span class="flag" aria-hidden="true">{flags[locale]}</span><span>{localeNames[locale]}</span>{#if getLocale() === locale}<Check size={17} aria-hidden="true" />{/if}</button>
    {/each}
  </div>
</dialog>

<style>
  .header-controls, .desktop-controls { display: flex; align-items: center; gap: 8px; }
  .control-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 15px; background: var(--surface); color: var(--text); box-shadow: 0 3px 0 var(--border), inset 1px 1px 2px var(--clay-highlight); font-weight: 800; font-size: .8rem; }
  .icon-control { width: 44px; padding: 0; } .flag { font: 22px/1 system-ui; } .mobile-controls { display: none; position: relative; }
  summary { list-style: none; cursor: pointer; } summary::-webkit-details-marker { display: none; }
  .quick-menu { position: absolute; right: 0; top: calc(100% + 12px); display: grid; gap: 6px; width: min(280px, calc(100vw - 36px)); padding: 10px; border: 1px solid var(--border); border-radius: 22px; background: var(--surface); box-shadow: 0 8px 0 -4px var(--border), 0 20px 40px -16px var(--shadow); z-index: 40; transform-origin: top right; animation: menu-in 180ms ease-out; }
  .quick-menu button { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 10px 12px; text-align: left; border: 0; border-radius: 14px; color: var(--text); background: var(--panel); font-size: .82rem; font-weight: 800; flex-wrap: wrap; }.menu-meta { margin-left: auto; color: var(--muted); font-size: .72rem; }
  @keyframes menu-in { from { opacity: 0; transform: translateY(-6px) scale(.97); } to { opacity: 1; transform: none; } }
  .language-dialog { width: min(580px, calc(100vw - 28px)); max-height: calc(100dvh - 32px); overflow: auto; border: 1px solid var(--border); border-radius: 28px; padding: 24px; background: var(--surface); color: var(--text); box-shadow: 0 8px 0 -3px var(--border), 0 24px 70px #0003; }
  .language-dialog::backdrop { background: #19151a88; backdrop-filter: blur(4px); }
  .language-dialog header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 20px; }.language-dialog h2 { margin: 8px 0 0; font-size: 1.6rem; letter-spacing: -.035em; }.eyebrow { display: flex; gap: 6px; align-items: center; }
  .language-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }.language-grid button { min-height: 54px; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 16px; background: var(--panel); color: var(--text); text-align: left; font-size: .88rem; font-weight: 800; }.language-grid button[aria-pressed='true'] { background: var(--mint); border-color: var(--accent); }.language-grid button :global(svg) { margin-left: auto; flex-shrink: 0; }
  @media(max-width: 760px) { .desktop-controls { display: none; }.mobile-controls { display: block; } }
  @media(max-width: 400px) { .language-dialog { padding: 18px; }.language-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
