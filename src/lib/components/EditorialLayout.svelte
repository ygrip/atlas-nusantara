<script lang="ts">
  import type { Snippet } from 'svelte';
  import { m } from '$lib/i18n/messages';
  import { pathFor } from '$lib/i18n/links';
  let { title, description, eyebrow, children }: { title: string; description: string; eyebrow: string; children: Snippet } = $props();
</script>

<svelte:head><title>{title} · Atlas Nusantara</title><meta name="description" content={description} /></svelte:head>

<div class="shell editorial-shell">
  <nav class="editorial-top" aria-label={m.nav_label()}>
    <a class="editorial-back" href={pathFor('/')}><img src="/brand/logo-96.webp" alt="" width="32" height="32" /><span>{m.editorial_back()}</span></a>
    <span class="editorial-links"><a href={pathFor('/about')}>{m.editorial_nav_about()}</a><a href={pathFor('/guides')}>{m.editorial_nav_guides()}</a><a href={pathFor('/terms')}>{m.legal_terms_link()}</a><a href={pathFor('/privacy')}>{m.legal_privacy_link()}</a></span>
  </nav>
  <main id="main-content">
    <article class="clay-card editorial-card">
      <p class="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {@render children()}
    </article>
  </main>
</div>

<style>
  .editorial-shell { max-width: 900px; }
  .editorial-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0 20px; }
  .editorial-back, .editorial-links a { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; font-weight: 800; }
  .editorial-back img { border-radius: 10px; }
  .editorial-links { display: flex; flex-wrap: wrap; gap: 18px; }
  .editorial-links a { text-decoration: underline; font-size: .85rem; color: var(--muted); }
  .editorial-card { padding: clamp(24px, 4vw, 48px); }
  .editorial-card h1 { margin: 8px 0 6px; font-size: clamp(2rem, 4.5vw, 3rem); letter-spacing: -.04em; line-height: 1.1; }
  .editorial-card :global(h2) { margin: 36px 0 10px; font-size: 1.45rem; letter-spacing: -.02em; }
  .editorial-card :global(h3) { margin: 24px 0 8px; font-size: 1.1rem; }
  .editorial-card :global(p), .editorial-card :global(li) { color: var(--muted); line-height: 1.75; max-width: 72ch; }
  .editorial-card :global(p) { margin: 0 0 12px; }
  .editorial-card :global(code) { padding: 1px 6px; border-radius: 6px; background: var(--clay-highlight, rgba(127, 127, 127, .14)); font-size: .9em; overflow-wrap: anywhere; }
  .editorial-card :global(.content-code) { overflow-x: auto; padding: 16px; border-radius: 16px; background: var(--clay-highlight, rgba(127, 127, 127, .12)); }
  .editorial-card :global(.content-code code) { padding: 0; background: none; white-space: pre; }
  .editorial-card :global(.content-note) { padding: 12px 16px; border-left: 4px solid currentColor; border-radius: 8px; }
  .editorial-card :global(.content-table) { overflow-x: auto; margin: 12px 0; }
  .editorial-card :global(table) { border-collapse: collapse; min-width: 100%; font-size: .92rem; }
  .editorial-card :global(th), .editorial-card :global(td) { padding: 8px 12px; border-bottom: 1px solid var(--line, rgba(127, 127, 127, .25)); text-align: left; vertical-align: top; }
  .editorial-card :global(details) { padding: 12px 0; border-bottom: 1px solid var(--line, rgba(127, 127, 127, .25)); }
  .editorial-card :global(summary) { cursor: pointer; font-weight: 800; }
</style>
