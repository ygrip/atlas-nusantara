<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { getLocale, getLocaleForUrl, getTextDirection, overwriteGetLocale } from '$lib/paraglide/runtime.js';
  import { containPageZoom } from '$lib/i18n/host-zoom';

  let { children } = $props();

  // The locale comes from the URL. Reading SvelteKit's reactive URL makes every message
  // update in place when the language changes, with no page reload.
  if (browser) overwriteGetLocale(() => getLocaleForUrl(page.url));

  $effect(() => {
    const locale = getLocale();
    document.documentElement.lang = locale;
    document.documentElement.dir = getTextDirection(locale);
  });

  onMount(() => containPageZoom(document));
</script>

{@render children()}
