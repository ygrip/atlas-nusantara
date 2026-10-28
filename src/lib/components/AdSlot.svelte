<script lang="ts">
  import { m } from '$lib/i18n/messages';
  const enabled = import.meta.env.VITE_SPONSOR_ENABLED === 'true';
  const title = String(import.meta.env.VITE_SPONSOR_TITLE ?? '').slice(0, 120);
  let href: string | undefined;
  try {
    const url = new URL(String(import.meta.env.VITE_SPONSOR_URL ?? ''));
    if (url.protocol === 'https:' && !url.username && !url.password) href = url.href;
  } catch { href = undefined; }
</script>

{#if enabled && href && title}
  <aside class="ad-slot" aria-label={m.advertisement()}>
    <span>{m.advertisement()}</span><strong>{title}</strong>
    <a {href} target="_blank" rel="sponsored noopener noreferrer">{m.sponsor_action()} ↗</a>
  </aside>
{/if}
