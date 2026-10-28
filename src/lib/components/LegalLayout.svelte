<script lang="ts">
  import type { Snippet } from 'svelte';
  import { m } from '$lib/i18n/messages';
  import { pathFor } from '$lib/i18n/links';

  let { title, description, children }: { title: string; description: string; children: Snippet } = $props();
</script>

<svelte:head><title>{title} · Atlas Nusantara</title><meta name="description" content={description} /></svelte:head>

<div class="shell legal-shell">
  <nav class="legal-top" aria-label={m.legal_label()}>
    <a class="legal-back" href={pathFor('/')}><img src="/brand/logo-256.png" alt="" width="32" height="32" /><span class="brand-desktop">← Atlas Nusantara</span><span class="brand-mobile">← Nusantara</span></a>
    <span class="legal-links"><a href={pathFor('/terms')}>{m.legal_terms_link()}</a><a href={pathFor('/privacy')}>{m.legal_privacy_link()}</a></span>
  </nav>
  <main id="main-content">
    <article class="clay-card legal-card">
      <div class="legal-heading">
        <div>
          <p class="eyebrow">{m.legal_label()}</p>
          <h1>{title}</h1>
          <p class="legal-updated">{m.legal_updated()}: 2026-10-26</p>
        </div>
        <img class="legal-art" src="/illustrations/legal-640.webp" srcset="/illustrations/legal-384.webp 384w, /illustrations/legal-640.webp 640w" sizes="(max-width: 700px) 60vw, 240px" width="640" height="640" alt="" decoding="async" />
      </div>
      {@render children()}
    </article>
  </main>
</div>

<style>
  .legal-shell { max-width: 860px; }
  .legal-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0 20px; }
  .legal-back, .legal-links a { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; font-weight: 800; }
  .legal-back img { border-radius: 10px; }
  .legal-heading { display: flex; flex-wrap: wrap-reverse; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 8px; }
  .legal-art { width: min(240px, 100%); height: auto; aspect-ratio: 1; border-radius: 26px; object-fit: cover; box-shadow: 8px 10px 20px var(--shadow), inset 0 0 0 2px var(--clay-highlight); }
  .legal-links { display: flex; gap: 18px; }
  .legal-links a { text-decoration: underline; font-size: .85rem; color: var(--muted); }
  .legal-card { padding: clamp(24px, 4vw, 48px); }
  .legal-card h1 { margin: 8px 0 6px; font-size: clamp(2rem, 4.5vw, 3rem); letter-spacing: -.04em; line-height: 1.1; }
  .legal-updated { margin: 0 0 22px; color: var(--muted); font-size: .8rem; }
  .legal-card :global(h2) { margin: 28px 0 8px; font-size: 1.2rem; letter-spacing: -.02em; }
  .legal-card :global(p) { margin: 0 0 10px; color: var(--muted); line-height: 1.75; max-width: 70ch; }
</style>
