<script lang="ts">
  import { page } from '$app/stores';
  import { locales, localizeHref, getLocale } from '$lib/paraglide/runtime.js';
  import { m } from '$lib/paraglide/messages.js';
  const labels: Record<string, string> = {en:'English',id:'Bahasa Indonesia',ms:'Bahasa Melayu',fil:'Filipino',th:'ไทย',vi:'Tiếng Việt',my:'မြန်မာ',km:'ខ្មែរ',lo:'ລາວ','zh-Hans':'简体中文',ta:'தமிழ்',tet:'Tetun',pt:'Português'};
  let { children } = $props();
</script>
<svelte:head><meta name="theme-color" content="#e9eee6" /></svelte:head>
<div class="site-shell">
  <header><a class="brand" href={localizeHref('/', {locale:getLocale()})}>◈ {m.app_title()}</a><label>{m.language()} <select aria-label={m.language()} value={getLocale()} onchange={(event)=>location.assign(localizeHref($page.url.pathname, {locale:event.currentTarget.value as typeof locales[number]}))}>{#each locales as locale}<option value={locale}>{labels[locale]}</option>{/each}</select></label></header>
  {@render children()}
  <footer>{m.safety_notice()}</footer>
</div>
<style>
:global(*){box-sizing:border-box}:global(body){margin:0;background:#e9eee6;color:#253d31;font-family:system-ui,-apple-system,sans-serif}:global(button),:global(select){font:inherit}.site-shell{max-width:1120px;margin:auto;padding:1.5rem}header{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;padding-bottom:1.5rem}.brand{text-decoration:none;color:inherit;font-weight:800;font-size:1.25rem}label{display:flex;align-items:center;gap:.65rem}select{max-width:185px;border:1px solid #abc2ae;border-radius:.8rem;background:#f7faf5;color:#253d31;padding:.5rem}footer{font-size:.8rem;color:#5e7466;padding:2rem 0}
</style>
