<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Languages, Moon, Sun, Share2, SlidersHorizontal, X, Check } from 'lucide-svelte';
  import { changeTheme } from '$lib/pwa/theme';
  import { getLocale, locales, setLocale } from '$lib/paraglide/runtime.js';
  import { localeNames } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages.js';

  let { onshare }: { onshare: () => void } = $props();
  const flags: Record<string, string> = { en: '🇬🇧', id: '🇮🇩', ms: '🇲🇾', fil: '🇵🇭', th: '🇹🇭', vi: '🇻🇳', my: '🇲🇲', km: '🇰🇭', lo: '🇱🇦', 'zh-SG': '🇸🇬', ta: '🇸🇬', tet: '🇹🇱', 'pt-TL': '🇹🇱' };
  let languageDialog: HTMLDialogElement;
  let trigger: HTMLButtonElement;
  let options: HTMLDivElement;
  let expanded = $state(false);
  let dark = $state(false);
  let busy = $state(false);
  let languageReturnFocus: HTMLElement | undefined;

  onMount(() => {
    const sync = () => { dark = document.documentElement.dataset.theme === 'dark'; };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  });

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  function closeMenu(restoreFocus = false) {
    expanded = false;
    if (restoreFocus) trigger?.focus();
  }

  async function toggleMenu() {
    if (expanded) { closeMenu(true); return; }
    expanded = true;
    await tick();
    options.querySelector<HTMLElement>('button')?.focus();
  }

  function menuKeys(event: KeyboardEvent) {
    if (!expanded) {
      if (event.target === trigger && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        void toggleMenu();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    const controls = [trigger, ...Array.from(options.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))];
    const position = controls.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Tab') {
      event.preventDefault();
      controls[event.shiftKey ? (position <= 0 ? controls.length - 1 : position - 1) : (position >= controls.length - 1 ? 0 : position + 1)]?.focus();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : position + (event.key === 'ArrowDown' ? 1 : -1);
      controls[Math.max(0, Math.min(controls.length - 1, next))]?.focus();
    }
  }

  async function openLanguages() {
    languageReturnFocus = expanded ? trigger : document.activeElement as HTMLElement;
    closeMenu();
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
        const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = theme;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1f1c22' : '#f4ece1');
        try { localStorage.setItem('nusantara:theme', theme); }
        catch (error) { console.warn('Theme preference could not be saved', error); }
      });
    } finally { busy = false; }
  }

  async function share() {
    closeMenu();
    await tick();
    onshare();
  }

  function closeBackdrop(event: MouseEvent) {
    if (event.target !== languageDialog) return;
    const bounds = languageDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) languageDialog.close();
  }
</script>

<div class="header-controls" role="group" aria-label={m.nav_options()}>
  <div class="desktop-controls">
    <button class="control-button language-trigger" type="button" onclick={openLanguages} aria-label={m.select_language()} aria-haspopup="dialog">
      <span class="flag" aria-hidden="true">{flags[getLocale()]}</span><span>{localeNames[getLocale()]}</span><span aria-hidden="true">⌄</span>
    </button>
    <button class="control-button icon-control" type="button" onclick={toggleTheme} disabled={busy} aria-label={m.theme_toggle()} aria-pressed={dark}>
      {#if dark}<Sun size={20} aria-hidden="true" />{:else}<Moon size={20} aria-hidden="true" />{/if}
    </button>
    <button class="control-button icon-control" type="button" onclick={share} aria-label={m.share_heading()}><Share2 size={19} aria-hidden="true" /></button>
  </div>

  <div class="menu-scrim" class:visible={expanded} use:portal>
    {#if expanded}<button type="button" aria-label={m.dialog_close()} tabindex="-1" onclick={() => closeMenu()}></button>{/if}
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="mobile-controls" class:expanded onkeydown={menuKeys}>
    <svg class="goo-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id="nusantara-settings-goo">
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo" />
        <feComposite in="SourceGraphic" in2="goo" operator="atop" />
      </filter>
    </svg>
    <div class="goo-shadow" aria-hidden="true">
      <div class="goo-shapes">
        <span class="goo-blob trigger-blob"></span>
        <span class="goo-blob language-blob"></span>
        <span class="goo-blob share-blob"></span>
        <span class="goo-blob theme-blob"></span>
      </div>
    </div>
    <button bind:this={trigger} class="quick-trigger" type="button" aria-label={m.nav_options()} aria-expanded={expanded} aria-controls="nusantara-quick-options" onclick={toggleMenu}>
      <SlidersHorizontal class="settings-icon" size={21} aria-hidden="true" />
      <X class="close-icon" size={21} aria-hidden="true" />
    </button>
    <div bind:this={options} id="nusantara-quick-options" class="quick-menu" role="group" aria-label={m.nav_options()} inert={!expanded}>
      <button type="button" class="quick-option" onclick={openLanguages} aria-haspopup="dialog">
        <span class="flag" aria-hidden="true">{flags[getLocale()]}</span><span>{m.language_label()}</span><span class="menu-meta">{localeNames[getLocale()]}</span>
      </button>
      <button type="button" class="quick-option" onclick={share}>
        <Share2 size={18} aria-hidden="true" /><span>{m.share_heading()}</span>
      </button>
      <button type="button" class="quick-option" onclick={toggleTheme} disabled={busy} aria-label={m.theme_toggle()} aria-pressed={dark}>
        {#if dark}<Sun size={18} aria-hidden="true" />{:else}<Moon size={18} aria-hidden="true" />{/if}<span>{m.theme_toggle()}</span>
      </button>
    </div>
  </div>
</div>

<!-- Native dialog owns language selection focus and Escape handling. -->
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
  .control-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 16px; background: linear-gradient(165deg, var(--surface), var(--panel)); color: var(--text); box-shadow: 0 3px 0 var(--border), inset 0 2px 1px var(--clay-highlight), inset 0 -2px 4px var(--shadow); font-weight: 800; font-size: .8rem; }
  .control-button:active { transform: translateY(2px); box-shadow: inset 0 2px 5px var(--shadow); }
  .icon-control { width: 44px; padding: 0; }
  .flag { font: 21px/1 system-ui; flex: 0 0 auto; }
  .mobile-controls { display: none; position: relative; width: 46px; height: 46px; flex: 0 0 46px; --spring: cubic-bezier(.34, 1.56, .64, 1); }
  .goo-defs { position: absolute; width: 0; height: 0; pointer-events: none; }
  .menu-scrim { position: fixed; inset: 0; z-index: 29; pointer-events: none; visibility: hidden; opacity: 0; background: color-mix(in srgb, var(--page) 58%, transparent); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); transition: opacity 200ms ease-out, visibility 200ms; }
  .menu-scrim.visible { pointer-events: auto; visibility: visible; opacity: 1; }
  .menu-scrim button { width: 100%; height: 100%; border: 0; padding: 0; background: transparent; cursor: default; }
  .goo-shadow { position: absolute; right: -9px; top: -9px; width: min(264px, calc(100vw - 22px)); height: 260px; pointer-events: none; filter: drop-shadow(0 3px 0 var(--border)) drop-shadow(0 11px 15px var(--shadow)); }
  .goo-shapes { position: absolute; inset: 0; filter: url(#nusantara-settings-goo); }
  .goo-blob { position: absolute; top: 9px; right: 9px; height: 46px; width: 46px; border-radius: 19px; background: var(--surface); transition: transform 350ms var(--spring), width 350ms var(--spring), height 350ms var(--spring); }
  .language-blob, .share-blob, .theme-blob { transform: scale(.45); }
  .expanded .language-blob { width: calc(100% - 18px); height: 52px; transform: translateY(60px); }
  .expanded .share-blob { width: calc(100% - 18px); height: 52px; transform: translateY(120px); transition-delay: 40ms; }
  .expanded .theme-blob { width: calc(100% - 18px); height: 52px; transform: translateY(180px); transition-delay: 80ms; }
  .quick-trigger { position: relative; z-index: 2; display: grid; place-items: center; width: 46px; height: 46px; border: 0; border-radius: 18px; background: transparent; color: var(--text); box-shadow: inset 0 2px 2px var(--clay-highlight); }
  .quick-trigger :global(svg) { grid-area: 1 / 1; transition: transform 220ms ease, opacity 180ms ease; }
  .quick-trigger :global(.close-icon) { opacity: 0; transform: rotate(-80deg) scale(.65); }
  .expanded .quick-trigger :global(.settings-icon) { opacity: 0; transform: rotate(80deg) scale(.65); }
  .expanded .quick-trigger :global(.close-icon) { opacity: 1; transform: none; }
  .quick-menu { position: absolute; top: 60px; right: 0; z-index: 3; width: min(246px, calc(100vw - 40px)); display: grid; gap: 8px; pointer-events: none; visibility: hidden; }
  .expanded .quick-menu { pointer-events: auto; visibility: visible; }
  .quick-option { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; padding: 10px 13px; border: 0; border-radius: 18px; color: var(--text); background: transparent; text-align: left; font-size: .81rem; font-weight: 800; opacity: 0; transform: translateY(-24px) scale(.75); transition: opacity 170ms ease, transform 350ms var(--spring); }
  .expanded .quick-option { opacity: 1; transform: none; }
  .expanded .quick-option:nth-child(2) { transition-delay: 40ms; }
  .expanded .quick-option:nth-child(3) { transition-delay: 80ms; }
  .quick-option:active { transform: translateY(2px); }
  .quick-option > span:not(.flag) { min-width: 0; }
  .menu-meta { margin-left: auto; overflow: hidden; max-width: 90px; white-space: nowrap; text-overflow: ellipsis; color: var(--muted); font-size: .7rem; }
  .language-dialog { width: min(580px, calc(100vw - 28px)); max-height: calc(100dvh - 32px); overflow: auto; border: 1px solid var(--border); border-radius: 28px; padding: 24px; background: var(--surface); color: var(--text); box-shadow: 0 8px 0 -3px var(--border), 0 24px 70px #0003; }
  .language-dialog::backdrop { background: #19151a88; backdrop-filter: blur(4px); }
  .language-dialog header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 20px; }
  .language-dialog h2 { margin: 8px 0 0; font-size: 1.6rem; letter-spacing: -.035em; }
  .eyebrow { display: flex; gap: 6px; align-items: center; }
  .language-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
  .language-grid button { min-height: 54px; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 16px; background: var(--panel); color: var(--text); text-align: left; font-size: .88rem; font-weight: 800; }
  .language-grid button[aria-pressed='true'] { background: var(--mint); border-color: var(--accent); }
  .language-grid button :global(svg) { margin-left: auto; flex-shrink: 0; }
  .quick-trigger:focus-visible, .quick-option:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
  @media(max-width: 760px) { .desktop-controls { display: none; } .mobile-controls { display: block; } }
  @media(max-width: 400px) { .language-dialog { padding: 18px; } .language-grid { grid-template-columns: minmax(0, 1fr); } }
  @media(prefers-reduced-motion: reduce) { .goo-blob, .quick-trigger :global(svg), .quick-option, .menu-scrim { transition: none !important; } }
  @media(forced-colors: active) { .goo-shadow { display: none; } .quick-trigger, .quick-option { background: Canvas; border: 1px solid ButtonText; } }
</style>
