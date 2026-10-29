<script lang="ts">
  import { page } from '$app/state';
  import { m } from '$lib/i18n/messages';
  import { pathFor } from '$lib/i18n/links';
  import { errorPresentation, type ErrorGroup } from '$lib/errors';

  interface ErrorCopy { eyebrow: string; title: string; description: string; }

  const copyByGroup: Record<ErrorGroup, () => ErrorCopy> = {
    '404': () => ({ eyebrow: m.error_404_eyebrow(), title: m.error_404_title(), description: m.error_404_desc() }),
    '403': () => ({ eyebrow: m.error_403_eyebrow(), title: m.error_403_title(), description: m.error_403_desc() }),
    '429': () => ({ eyebrow: m.error_429_eyebrow(), title: m.error_429_title(), description: m.error_429_desc() }),
    '503': () => ({ eyebrow: m.error_503_eyebrow(), title: m.error_503_title(), description: m.error_503_desc() }),
    '500': () => ({ eyebrow: m.error_500_eyebrow(), title: m.error_500_title(), description: m.error_500_desc() }),
    other: () => ({ eyebrow: m.error_other_eyebrow(), title: m.error_other_title(), description: m.error_other_desc() })
  };

  const presentation = $derived(errorPresentation(page.status));
  const copy = $derived(copyByGroup[presentation.group]());
  const incidentId = $derived(page.error?.incidentId);

  function illustrationAlt(kind: '404' | '500'): string {
    if (kind === '404') return m.error_404_alt();
    return m.error_500_alt();
  }
</script>

<svelte:head><title>{page.status} · {m.error_title()} · Atlas Nusantara</title><meta name="robots" content="noindex" /></svelte:head>

<div class="shell error-shell">
  <header class="error-header">
    <a class="brand" href={pathFor('/')} aria-label={m.site_title()}><img src="/brand/logo-96.webp" alt="" width="40" height="40" /><span class="brand-desktop">Atlas Nusantara</span><span class="brand-mobile">Nusantara</span></a>
  </header>
  <main id="main-content" class="error-bento" aria-labelledby="error-title">
    <section class="clay-card error-copy">
      <span class="error-status">{m.error_label()} {page.status}</span>
      <p class="eyebrow">{copy.eyebrow}</p>
      <h1 id="error-title">{copy.title}</h1>
      <p class="error-description">{copy.description}</p>
      <div class="error-actions">
        {#if presentation.retry}<button class="clay-button primary" type="button" onclick={() => window.location.reload()}>{m.error_try()}</button>{/if}
        <a class="clay-button" class:primary={!presentation.retry} href={pathFor('/')}>{m.error_back()}</a>
      </div>
      {#if incidentId}<p class="error-reference">{m.error_reference()} <code>{incidentId}</code></p>{/if}
      <a class="error-report" href="https://github.com/ygrip/nusantara/issues" target="_blank" rel="noopener noreferrer">{m.error_report()} ↗</a>
    </section>
    <div class="clay-card error-illustration">
      <img src={`/illustrations/error-${presentation.illustration}-640.webp`}
        srcset={`/illustrations/error-${presentation.illustration}-384.webp 384w, /illustrations/error-${presentation.illustration}-640.webp 640w`}
        sizes="(max-width: 760px) calc(100vw - 28px), 560px" width="640" height="640" fetchpriority="high" decoding="async" alt={illustrationAlt(presentation.illustration)} />
    </div>
  </main>
</div>

<style>
  .error-shell { min-height: 100vh; }
  .error-header { display: flex; align-items: center; margin-bottom: 18px; padding: 8px 14px; border-radius: 22px; background: var(--surface); border: 1px solid var(--border); box-shadow: 8px 10px 22px var(--shadow), inset 2px 2px 4px var(--clay-highlight); }
  .error-header .brand img { width: 40px; height: 40px; border-radius: 13px; }
  .error-bento { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(14px, 2vw, 22px); }
  .error-copy { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: clamp(26px, 4vw, 52px); background: linear-gradient(150deg, var(--surface), var(--panel)); }
  .error-status { display: inline-block; padding: 6px 14px; margin-bottom: 18px; border-radius: 99px; background: var(--panel); box-shadow: var(--clay-pressed); font-size: .75rem; font-weight: 850; }
  .error-copy h1 { margin: 8px 0 16px; font-size: clamp(2rem, 4.5vw, 3.2rem); line-height: 1.08; letter-spacing: -.04em; text-wrap: balance; }
  .error-description { max-width: 44ch; margin: 0; color: var(--muted); line-height: 1.75; }
  .error-actions { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 26px; }
  .error-reference { margin: 22px 0 0; font-size: .75rem; color: var(--muted); overflow-wrap: anywhere; }
  .error-reference code { font-weight: 800; }
  .error-report { margin-top: 18px; font-size: .8rem; font-weight: 750; text-decoration: underline; }
  .error-illustration { overflow: hidden; display: grid; place-items: center; padding: 0; background: var(--sky); }
  .error-illustration img { display: block; width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; }
  @media (max-width: 760px) {
    .error-bento { grid-template-columns: minmax(0, 1fr); }
    .error-illustration { order: -1; }
  }
</style>
