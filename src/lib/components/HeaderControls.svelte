<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { Languages, Moon, Sun, Share2, SlidersHorizontal, X, Check, Search } from 'lucide-svelte';
  import { changeTheme } from '$lib/pwa/theme';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { getLocale, locales } from '$lib/paraglide/runtime.js';
  import { localizedPath } from '$lib/i18n/paths.js';
  import { localeNames, localeEnglishNames } from '$lib/i18n/locales';
  import { m } from '$lib/i18n/messages';

  let { onshare }: { onshare: () => void } = $props();
  const flags: Record<string, string> = { en: '🇬🇧', id: '🇮🇩', ms: '🇲🇾', fil: '🇵🇭', th: '🇹🇭', vi: '🇻🇳', my: '🇲🇲', km: '🇰🇭', lo: '🇱🇦', 'zh-SG': '🇸🇬', ta: '🇸🇬', tet: '🇹🇱', 'pt-TL': '🇹🇱' };
  let root: HTMLDivElement;
  let scrim: HTMLDivElement;
  let languageDialog: HTMLDialogElement;
  let trigger: HTMLButtonElement;
  let options: HTMLDivElement;
  let expanded = $state(false);
  let dark = $state(false);
  let busy = $state(false);
  let languageReturnFocus: HTMLElement | undefined;
  let languageSearch: HTMLInputElement;
  let languageQuery = $state('');
  const filteredLocales = $derived(locales.filter(locale => normalizeLanguage(`${localeNames[locale]} ${localeEnglishNames[locale]} ${locale}`).includes(normalizeLanguage(languageQuery.trim()))));

  function normalizeLanguage(value: string) {
    return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function languageKeys(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      languageDialog.close();
      return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const buttons = Array.from(languageDialog.querySelectorAll<HTMLButtonElement>('.language-grid button'));
    if (!buttons.length) return;
    event.preventDefault();
    let direction = 1;
    if (event.key === 'ArrowUp') direction = -1;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next = current + direction;
    if (current < 0 && direction < 0) next = buttons.length - 1;
    next = (next + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  onMount(() => {
    const sync = () => { dark = document.documentElement.dataset.theme === 'dark'; };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  });

  // Keep the expanded settings modal, including for keyboard and screen readers.
  $effect(() => {
    if (!expanded) return;
    const changed: HTMLElement[] = [];
    for (let node: HTMLElement | undefined = root; node && node !== document.body; node = node.parentElement ?? undefined) {
      for (const sibling of node.parentElement?.children ?? []) {
        if (sibling === node || sibling === scrim || !(sibling instanceof HTMLElement) || sibling.inert) continue;
        sibling.inert = true;
        changed.push(sibling);
      }
    }
    return () => {
      for (const element of changed) element.inert = false;
    };
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
    languageReturnFocus = document.activeElement as HTMLElement;
    if (expanded) languageReturnFocus = trigger;
    closeMenu();
    await tick();
    languageQuery = '';
    languageDialog?.showModal();
    await tick();
    languageSearch?.focus();
  }

  function select(locale: (typeof locales)[number]) {
    languageDialog?.close();
    if (locale === getLocale()) return;
    // The language is part of the URL: navigate in place, no reload, keep the query and hash.
    const target = localizedPath(page.url.pathname, locale) + page.url.search + page.url.hash;
    void goto(target, { noScroll: true, keepFocus: true });
  }

  async function toggleTheme(event: MouseEvent) {
    if (busy) return;
    busy = true;
    try {
      await changeTheme(event.currentTarget as HTMLElement, () => {
        let theme = 'dark';
        if (document.documentElement.dataset.theme === 'dark') theme = 'light';
        document.documentElement.dataset.theme = theme;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor(theme));
        try { localStorage.setItem('nusantara:theme', theme); }
        catch (error) { console.warn('Theme preference could not be saved', error); }
      });
    } finally { busy = false; }
  }

  function themeColor(theme: string) {
    if (theme === 'dark') return '#1e191c';
    return '#f8f5f3';
  }

  async function share() {
    closeMenu(true);
    await tick();
    onshare();
  }

  function closeBackdrop(event: MouseEvent) {
    if (event.target !== languageDialog) return;
    const bounds = languageDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) languageDialog.close();
  }
</script>

{#snippet themeIcon()}
  <span class="theme-icon-swap" class:dark aria-hidden="true">
    <Sun class="sun-icon" size={22} /><Moon class="moon-icon" size={22} />
  </span>
{/snippet}

<div bind:this={root} class="header-controls" role="group" aria-label={m.nav_options()}>
  <div class="desktop-controls">
    <button class="control-button icon-control language-trigger" type="button" onclick={openLanguages} aria-label={m.select_language()} title={m.select_language()} aria-haspopup="dialog">
      <Languages size={22} aria-hidden="true" />
    </button>
    <button class="control-button icon-control" type="button" onclick={toggleTheme} disabled={busy} aria-label={m.theme_toggle()} aria-pressed={dark}>
      {@render themeIcon()}
    </button>
    <button class="control-button icon-control" type="button" onclick={share} aria-label={m.share_heading()}><Share2 size={19} aria-hidden="true" /></button>
  </div>

  <div bind:this={scrim} class="menu-scrim" class:visible={expanded} use:portal>
    {#if expanded}<button type="button" aria-label={m.dialog_close()} tabindex="-1" onclick={() => closeMenu()}></button>{/if}
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="mobile-controls" class:expanded role="group" aria-label={m.nav_options()} onkeydown={menuKeys}>
    <svg class="goo-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id="nusantara-settings-goo">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" result="goo" />
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
      <button type="button" class="quick-option" onclick={openLanguages} aria-label={m.select_language()} title={m.select_language()} aria-haspopup="dialog">
        <Languages size={22} aria-hidden="true" />
      </button>
      <button type="button" class="quick-option" onclick={toggleTheme} disabled={busy} aria-label={m.theme_toggle()} title={m.theme_toggle()} aria-pressed={dark}>
        {@render themeIcon()}
      </button>
      <button type="button" class="quick-option" onclick={share} aria-label={m.share_heading()} title={m.share_heading()} aria-haspopup="dialog">
        <Share2 size={22} aria-hidden="true" />
      </button>
    </div>
  </div>
</div>

<!-- Native dialog owns language selection focus and Escape handling. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog class="language-dialog" bind:this={languageDialog} aria-labelledby="language-title" onclick={closeBackdrop} onkeydown={languageKeys} onclose={() => languageReturnFocus?.focus()}>
  <header><div><span class="eyebrow"><Languages size={16} aria-hidden="true" /> {m.language_label()}</span><h2 id="language-title">{m.select_language()}</h2></div><button class="control-button icon-control" type="button" onclick={() => languageDialog?.close()} aria-label={m.dialog_close()}><X size={20} aria-hidden="true" /></button></header>
  <label class="language-search">
    <Search size={20} aria-hidden="true" />
    <input bind:this={languageSearch} type="search" bind:value={languageQuery} aria-label={m.language_search()} placeholder={m.language_search()} autocomplete="off" />
  </label>
  <div class="language-grid">
    {#each filteredLocales as locale (locale)}
      <button type="button" lang={locale} aria-pressed={getLocale() === locale} onclick={() => select(locale)}><span class="flag" aria-hidden="true">{flags[locale]}</span><span class="language-name"><strong>{localeNames[locale]}</strong><small>{localeEnglishNames[locale]}</small></span>{#if getLocale() === locale}<Check size={17} aria-hidden="true" />{/if}</button>
    {:else}
      <p class="language-empty" role="status">{m.no_results()}</p>
    {/each}
  </div>
</dialog>

<style>
  .header-controls, .desktop-controls { display: flex; align-items: center; gap: 8px; }
  .control-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 16px; background: linear-gradient(165deg, var(--surface), var(--panel)); color: var(--text); box-shadow: 0 3px 0 var(--border), inset 0 2px 1px var(--clay-highlight), inset 0 -2px 4px var(--shadow); font-weight: 800; font-size: .8rem; }
  .control-button:active { transform: translateY(2px); box-shadow: inset 0 2px 5px var(--shadow); }
  .icon-control { width: 48px; height: 48px; padding: 0; border-radius: 50%; }
  .theme-icon-swap { display: grid; place-items: center; width: 22px; height: 22px; }
  .theme-icon-swap :global(svg) { grid-area: 1 / 1; transition: opacity 180ms ease-out, transform 350ms var(--ease-bounce); }
  .theme-icon-swap :global(.sun-icon) { opacity: 0; transform: rotate(-90deg) scale(.6); }
  .theme-icon-swap.dark :global(.sun-icon) { opacity: 1; transform: none; }
  .theme-icon-swap.dark :global(.moon-icon) { opacity: 0; transform: rotate(90deg) scale(.6); }
  .flag { font: 21px/1 system-ui; flex: 0 0 auto; }
  .mobile-controls { display: none; position: relative; width: 48px; height: 48px; flex: 0 0 48px; --spring: cubic-bezier(.34, 1.56, .64, 1); }
  .goo-defs { position: absolute; width: 0; height: 0; pointer-events: none; }
  .menu-scrim { position: fixed; inset: 0; z-index: 29; pointer-events: none; visibility: hidden; opacity: 0; background: color-mix(in srgb, var(--page) 58%, transparent); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); transition: opacity 200ms ease-out, visibility 200ms; }
  .menu-scrim.visible { pointer-events: auto; visibility: visible; opacity: 1; }
  .menu-scrim button { width: 100%; height: 100%; border: 0; padding: 0; background: transparent; cursor: default; }
  /* Libraries.dev Gooey pattern: filter only the merging surfaces, never the icons. */
  .goo-shadow { position: absolute; right: -16px; top: -16px; width: 80px; height: 254px; pointer-events: none; filter: drop-shadow(0 0 .6px var(--border)) drop-shadow(0 4px 0 var(--border)) drop-shadow(0 10px 14px var(--shadow)); }
  .goo-shapes { position: absolute; inset: 0; filter: url(#nusantara-settings-goo); }
  .goo-blob { position: absolute; top: 16px; right: 16px; height: 48px; width: 48px; border-radius: 50%; background: var(--surface); transition: transform 350ms var(--spring), background 180ms ease-out; }
  .language-blob, .share-blob, .theme-blob { transform: scale(.5); }
  .expanded .trigger-blob { background: var(--peach); }
  .expanded .language-blob { transform: translateY(58px); }
  .expanded .theme-blob { transform: translateY(116px); transition-delay: 60ms; }
  .expanded .share-blob { transform: translateY(174px); transition-delay: 120ms; }
  .quick-trigger { position: relative; z-index: 2; display: grid; place-items: center; width: 48px; height: 48px; padding: 0; border: 1px solid var(--border); border-radius: 17px; background: linear-gradient(155deg, var(--surface), var(--panel)); color: var(--text); box-shadow: 0 4px 0 -1px var(--border), 0 7px 14px -8px var(--shadow), inset 0 2px 2px var(--clay-highlight), inset 0 -2px 4px var(--shadow); cursor: pointer; transition: transform 140ms ease-out, box-shadow 140ms ease-out, color 140ms ease-out; }
  .quick-trigger:hover { color: var(--accent); transform: translateY(-1px); }
  .quick-trigger:active { transform: translateY(2px); box-shadow: 0 1px 0 -1px var(--border), inset 0 2px 5px var(--shadow); }
  .quick-trigger :global(svg) { grid-area: 1 / 1; transition: transform 220ms ease, opacity 180ms ease; }
  .quick-trigger :global(.close-icon) { opacity: 0; transform: rotate(-80deg) scale(.65); }
  .expanded .quick-trigger :global(.settings-icon) { opacity: 0; transform: rotate(80deg) scale(.65); }
  .expanded .quick-trigger :global(.close-icon) { opacity: 1; transform: none; }
  .quick-menu { position: absolute; top: 0; right: 0; z-index: 3; width: 48px; pointer-events: none; }
  .quick-option { position: absolute; top: 0; right: 0; display: grid; place-items: center; width: 48px; height: 48px; padding: 0; border: 1px solid var(--border); border-radius: 17px; color: var(--text); background: linear-gradient(155deg, var(--surface), var(--panel)); box-shadow: 0 4px 0 -1px var(--border), 0 7px 14px -8px var(--shadow), inset 0 2px 2px var(--clay-highlight), inset 0 -2px 4px var(--shadow); cursor: pointer; opacity: 0; visibility: hidden; transform: scale(.6); transition: opacity 180ms ease-out, transform 350ms var(--spring), visibility 0s linear 350ms, color 140ms ease-out, box-shadow 140ms ease-out; }
  .quick-option:hover { color: var(--accent); }
  .expanded .quick-option { pointer-events: auto; opacity: 1; visibility: visible; transform: translateY(58px); transition-delay: 80ms, 0s, 0s; }
  .expanded .quick-option:nth-child(2) { transform: translateY(116px); transition-delay: 140ms, 60ms, 0s; }
  .expanded .quick-option:nth-child(3) { transform: translateY(174px); transition-delay: 200ms, 120ms, 0s; }
  .quick-option:active { box-shadow: inset 0 2px 5px var(--shadow); }
  .quick-option:disabled { opacity: .55; }
  .language-dialog { width: min(580px, calc(100vw - 28px)); max-height: calc(100dvh - 32px); overflow: auto; border: 1px solid var(--border); border-radius: 28px; padding: 24px; background: var(--surface); color: var(--text); box-shadow: 0 8px 0 -3px var(--border), 0 24px 70px #0003; }
  .language-dialog::backdrop { background: #19151a88; backdrop-filter: blur(4px); }
  .language-dialog header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 20px; }
  .language-dialog h2 { margin: 8px 0 0; font-size: 1.6rem; letter-spacing: -.035em; }
  .eyebrow { display: flex; gap: 6px; align-items: center; }
  .language-search { display: flex; align-items: center; gap: 10px; padding: 0 14px; margin-bottom: 16px; border: 1px solid var(--border); border-radius: 16px; background: var(--panel); color: var(--muted); box-shadow: var(--clay-pressed); }
  .language-search input { width: 100%; min-width: 0; min-height: 48px; padding: 10px 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; color: var(--text); font: inherit; }
  .language-search:focus-within { outline: 3px solid var(--accent); outline-offset: 2px; }
  .language-search input:focus-visible { outline: none; }
  .language-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; max-height: min(440px, 52dvh); overflow-y: auto; padding: 4px; overscroll-behavior: contain; }
  .language-name { display: grid; gap: 3px; }
  .language-name small { color: var(--muted); font-size: .7rem; font-weight: 650; }
  .language-empty { grid-column: 1 / -1; padding: 24px 12px; color: var(--muted); text-align: center; }
  .language-grid button { min-height: 54px; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 16px; background: var(--panel); color: var(--text); text-align: left; font-size: .88rem; font-weight: 800; }
  .language-grid button[aria-pressed='true'] { background: var(--mint); border-color: var(--accent); }
  .language-grid button :global(svg) { margin-left: auto; flex-shrink: 0; }
  .quick-trigger:focus-visible, .quick-option:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
  .quick-trigger:disabled, .quick-option:disabled { cursor: not-allowed; }
  @media(max-width: 760px) { .desktop-controls { display: none; } .mobile-controls { display: block; } }
  @media(max-width: 400px) { .language-dialog { padding: 18px; } .language-grid { grid-template-columns: minmax(0, 1fr); } }
  @media(prefers-reduced-motion: reduce) { .goo-blob, .quick-trigger, .quick-trigger :global(svg), .theme-icon-swap :global(svg), .quick-option, .menu-scrim { transition: none !important; } }
  @media(forced-colors: active) { .goo-shadow { display: none; } .quick-trigger, .quick-option { background: Canvas; border: 1px solid ButtonText; } }
</style>
